const ACLMatrix = require('./matrix')
const clientModel = require('./client')
const roleModel = require('./role')

const ACCESS_TYPES = ACLMatrix.ACCESS_TYPES

const Access = function () {
  clientModel.setWriteCallback(
    this.write.bind(this)
  )
  roleModel.setWriteCallback(
    this.write.bind(this)
  )
}

/**
 * Combines values from two matrices to produce a matrix with the
 * broadest permissions possible.
 *
 * @param  {Object} matrix1
 * @param  {Object} matrix2
 * @return {Objct}
 */
Access.prototype.combineAccessMatrices = function (matrix1 = {}, matrix2 = {}) {
  let accessTypes = [...new Set(
    Object.keys(matrix1).concat(Object.keys(matrix2))
  )]

  accessTypes.forEach(accessType => {
    // If the existing value for the access type is already `true`
    // or if the new candidate value is `false`, the existing value
    // will remain unchanged.
    if (
      matrix1[accessType] === true ||
      !matrix2[accessType]
    ) {
      return
    }

    // If the candidate value is `true`, there's nothing else to do
    // other than setting the existing value to `true`.
    if (matrix2[accessType] === true) {
      matrix1[accessType] = true

      return
    }

    // If the existing value is `false`, we take whatever the candidate
    // value is.
    if (!matrix1[accessType]) {
      matrix1[accessType] = matrix2[accessType]

      return
    }

    // At this point, we now that both the existing and the candidate
    // values are objects. We can start by merging the `fields` objects
    // of both the existing and candidate values, so that they result in
    // the broadest set of fields.
    if (matrix1[accessType].fields || matrix2[accessType].fields) {
      let fields = this.mergeFields([
        matrix1[accessType].fields,
        matrix2[accessType].fields
      ])

      // If `fields` is the only property in the access type and the
      // result of merging the matrices resulted in a projection with
      // no field restrictions, we can simply set the access type to
      // `true`.
      if (
        Object.keys(matrix1[accessType]).length === 1 &&
        Object.keys(fields).length === 0
      ) {
        matrix1[accessType] = true
      } else {
        matrix1[accessType].fields = fields
      }
    }

    // We can't do the same with `filter`, because it's not possible to
    // compute the union of two filter expressions (we'd have to use an
    // *or* expression, which API doesn't currently have).
  })

  return matrix1
}

/**
 * Takes an ACL access value and an input, which should be an array of fields
 * or an object where keys represent fields. This method will return the input
 * with any fields excluded by the ACL access value filtered out.
 *
 * @param  {Object}       access
 * @param  {Array/Object} input
 * @return {Array/Object}
 */
Access.prototype.filterFields = function (access, input) {
  let fields = access.fields

  if ((typeof fields !== 'object') || !input || !Object.keys(input).length) {
    return input
  }

  let isExclusion = Object.keys(fields).some(field => {
    return field !== '_id' && fields[field] === 0
  })
  let allowedFields = Array.isArray(input)
    ? input
    : Object.keys(input)

  allowedFields = allowedFields.filter(field => {
    return (
      (isExclusion && (fields[field] === undefined)) ||
      !isExclusion && (fields[field] === 1)
    )
  })

  if (Array.isArray(input)) {
    return allowedFields
  }

  return allowedFields.reduce((result, field) => {
    result[field] = input[field]

    return result
  }, {})
}

Access.prototype.get = function ({clientId = null, accessType = null} = {}, resource, {
  resolveOwnTypes = true
} = {}) {
  if (typeof clientId !== 'string') {
    return Promise.resolve({})
  }

  if (accessType === 'admin') {
    let matrix = {}

    ACCESS_TYPES.forEach(accessType => {
      matrix[accessType] = true
    })

    return Promise.resolve(matrix)
  }

  let query = {
    client: clientId
  }

  if (resource) {
    query.resource = resource
  }

  return this.model.get({
    query,
    rawOutput: true
  }).then(({results}) => {
    if (results.length === 0) {
      return {}
    }

    let accessMap = new ACLMatrix()

    results.forEach(result => {
      accessMap.set(result.resource, result.access)
    })

    if (resource) {
      let matrix = accessMap.get(resource)

      return resolveOwnTypes
        ? this.resolveOwnTypes(matrix, clientId)
        : matrix
    }

    return accessMap.getAll()
  })
}

/**
 * Resolves role inheritance by taking an array of roles and returning
 * another array with those roles plus any roles inherited from the
 * initial set. It uses a hash map for caching roles, so that details
 * for a given role are only retrieved from the database once.
 *
 * @param  {Array}  roles Initial roles
 * @param  {Object} cache Hash for caching roles
 * @param  {Array}  chain Array with roles found
 * @return {Array}  full list of roles
 */
Access.prototype.getRoleChain = function (roles = [], cache = {}, chain) {
  chain = chain || roles

  // We only need to fetch from the database the roles that
  // are not already in cache.
  let rolesToFetch = roles.filter(role => {
    return !Object.keys(cache).includes(role)
  })

  if (rolesToFetch.length === 0) {
    return Promise.resolve(
      [...new Set(chain)]
    )
  }

  return roleModel.get(rolesToFetch).then(({results}) => {
    let parentRoles = new Set()

    results.forEach(role => {
      cache[role.name] = role.resources || {}

      if (role.extends) {
        parentRoles.add(role.extends)
      }
    })

    return this.getRoleChain(
      Array.from(parentRoles),
      cache,
      chain.concat(Array.from(parentRoles))
    )
  })
}

Access.prototype.getClientRoles = function (clientId) {
  return clientModel.get(clientId).then(({results}) => {
    if (results.length === 0) {
      return []
    }

    let roles = results[0].roles

    if (roles.length === 0) {
      return []
    }

    return this.getRoleChain(roles)
  })
}

Access.prototype.mergeFields = function mergeFields (projections) {
  let fields = []
  let isExclusion = false

  projections.some(projection => {
    if (!projection) {
      fields = []

      return true
    }

    let projectionFields = Object.keys(projection)
    let projectionIsExclusion = projectionFields.find(field => {
      return field !== '_id' && projection[field] === 0
    })

    if (projectionIsExclusion) {
      if (isExclusion) {
        fields = fields.filter(field => {
          return projectionFields.includes(field)
        })
      } else {
        fields = projectionFields.filter(field => {
          return !fields.includes(field)
        })
      }

      isExclusion = true
    } else {
      if (isExclusion) {
        fields = fields.filter(field => {
          return !projectionFields.includes(field)
        })
      } else {
        projectionFields.forEach(field => {
          if (!fields.includes(field)) {
            fields.push(field)
          }
        })
      }
    }
  })

  return fields.reduce((result, field) => {
    result[field] = isExclusion ? 0 : 1

    return result
  }, {})
}

/**
 * Takes the matrix given and resolves any *Own values to
 * a filter on the corresponding base type – e.g. having
 * {"update": false, updateOwn": true} is equivalent to
 * having {"update": {"filter": {"_createdBy": "C1"}}},
 * where "C1" is the client ID being resolved to.
 *
 * @param  {Object} matrix
 * @param  {String} clientId
 * @return {Object}
 */
Access.prototype.resolveOwnTypes = function (matrix, clientId) {
  let newMatrix = {}
  let splitTypes = Object.keys(matrix).reduce((result, accessType) => {
    let match = accessType.match(/^(.*)Own$/)

    if (match) {
      result.own.push(match[1])
    } else {
      result.base.push(accessType)
    }

    return result
  }, {
    base: [],
    own: []
  })

  splitTypes.base.forEach(accessType => {
    newMatrix[accessType] = matrix[accessType]
  })

  splitTypes.own.forEach(baseType => {
    let accessType = `${baseType}Own`

    if (!matrix[accessType] || (matrix[baseType] === true)) {
      return
    }

    let filter = Object.assign(
      {},
      newMatrix[baseType] && newMatrix[baseType].filter,
      newMatrix[accessType] && newMatrix[accessType].filter,
      {_createdBy: clientId}
    )

    let fields = (matrix[baseType] && matrix[baseType].fields) ||
      (matrix[accessType] && matrix[accessType].fields)

    newMatrix[baseType] = Object.assign(
      {},
      newMatrix[baseType],
      {filter},
      fields ? {fields} : {}
    )
  })

  return newMatrix
}

Access.prototype.setModel = function (model) {
  this.model = model
}

/**
 * Computes final access matrices for each client and each resource,
 * taking into account client-level and role-level permissions. An
 * entry is created in the access collection for each client/resource
 * pair.
 *
 * The collection is wiped every time this method is called.
 *
 * @return {Promise}
 */
Access.prototype.write = function () {
  // Keeping a local cache of roles for the course of
  // this operation. This way, if X roles inherit from role
  // R1, we just fetch R1 from the database once, instead of
  // X times.
  let roleCache = {}

  // Getting all the clients.
  return clientModel.get().then(({results}) => {
    // An entry is an object with {client, resource, access}. This
    // array will serve as a buffer, where we'll store all the
    // entries we need to push and then make a single call to
    // the database, as opposed to writing every time we process
    // a client or a resource.
    let entries = []
    let queue = Promise.resolve()

    // For each client, we find out all the resources they have access to.
    results.forEach(client => {
      queue = queue.then(() => {
        // Getting an array with the name of every role the client is
        // assigned to, including inheritance.
        return this.getRoleChain(client.roles, roleCache).then(chain => {
          // Start with the resources assigned to the client directly.
          let clientResources = client.resources || {}
          let clientResourcesMap = new ACLMatrix(clientResources)

          // Take the resources associated with each role and extend
          // the corresponding entry in `clientResources`.
          chain.forEach(roleName => {
            let role = roleCache[roleName]

            if (!role) return

            let roleMap = new ACLMatrix(role)

            Object.keys(role).forEach(resource => {
              let combinedMatrix = this.combineAccessMatrices(
                clientResourcesMap.get(resource, {
                  parseObjects: true
                }),
                roleMap.get(resource, {
                  parseObjects: true
                })
              )

              clientResourcesMap.set(resource, combinedMatrix)
            })
          })

          let combinedResources = clientResourcesMap.getAll({
            stringifyObjects: true
          })

          Object.keys(combinedResources).forEach(resource => {
            entries.push({
              client: client.clientId,
              resource,
              access: combinedResources[resource]
            })
          })
        })
      })
    })

    return queue.then(() => entries)
  }).then(entries => {
    // Before we write anything to the access collection, we need
    // to delete all existing records.
    return this.model.delete({
      query: {}
    }).then(() => {
      if (entries.length === 0) return

      return this.model.create({
        documents: entries,
        rawOutput: true,
        validate: false
      })
    })
  })
}

module.exports = new Access()
