const ACCESS_TYPES = require('./matrix').ACCESS_TYPES
const clientModel = require('./client')
const roleModel = require('./role')

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
    // values are objects. When merging, we always want to get the
    // broadest set of permissions, but it's difficult when it comes
    // to merging objects. Because having a property like `fields` or
    // `filter` means narrowing permissions, the best we can do is to
    // remove from the existing value any properties that don't exist
    // in the candidate value. If a property exists in both, we'll keep
    // the one from the existing value, meaning that inheriting compound
    // permissions will be limited.
    if (
      typeof matrix1[accessType] === 'object' &&
      typeof matrix2[accessType] === 'object'
    ) {
      Object.keys(matrix1[accessType]).forEach(key => {
        if (matrix2[accessType][key] === undefined) {
          delete matrix1[accessType][key]
        }
      })
    }
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

Access.prototype.get = function ({clientId = null, accessType = null} = {}, resource) {
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

  if (!resource) {
    return Promise.resolve({})
  }

  return this.model.get({
    query: {
      client: clientId,
      resource
    }
  }).then(({results}) => {
    if (
      results.length > 0 &&
      typeof results[0].access === 'object'
    ) {
      return this.resolveOwnTypes(results[0].access, clientId)
    }

    return {}
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
Access.prototype.getRoleChain = function (roles = [], cache, chain) {
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
      cache[role.name] = role.resources

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

    if (!matrix[accessType]) {
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
    // An entry is a tuple of <client, resource, access>. This
    // array will serve as a buffer, where we'll store all the
    // entries we need to push and then make a single call to
    // the database, as opposed to write every time we process
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

          // Take the resources associated with each role and extend
          // the corresponding entry in `clientResources`.
          chain.forEach(roleName => {
            let role = roleCache[roleName]

            if (!role) return

            Object.keys(role).forEach(resource => {
              clientResources[resource] = this.combineAccessMatrices(
                clientResources[resource],
                role[resource]
              )
            })
          })

          Object.keys(clientResources).forEach(resource => {
            entries.push({
              client: client.clientId,
              resource,
              access: clientResources[resource]
            })
          })
        })
      })
    })

    return entries
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
