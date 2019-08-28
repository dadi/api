const ACLMatrix = require('./matrix')
const clientModel = require('./client')
const config = require('../../../../config')
const Connection = require('../connection')
const keyModel = require('./key')
const modelStore = require('../')
const roleModel = require('./role')

const ACCESS_TYPES = ACLMatrix.ACCESS_TYPES

const Access = function() {
  clientModel.setWriteCallback(this.writeAccessForClientsWithIds.bind(this))
  keyModel.setWriteCallback(this.writeKeyAccess.bind(this))
  roleModel.setWriteCallback(this.writeAccessForAllClients.bind(this))
}

/**
 * Initialises the access module with a connection to the database and a
 * reference to the ACL module.
 *
 * @param  {Object} acl
 */
Access.prototype.connect = function(acl) {
  const accessConnection = Connection({
    collection: config.get('auth.accessCollection'),
    database: config.get('auth.database'),
    override: true
  })
  const accessModel = modelStore({
    connection: accessConnection,
    name: config.get('auth.accessCollection'),
    property: config.get('auth.database'),
    settings: {
      compose: false,
      storeRevisions: false
    }
  })
  const keyAccessConnection = Connection({
    collection: config.get('auth.keyAccessCollection'),
    database: config.get('auth.database'),
    override: true
  })
  const keyAccessModel = modelStore({
    connection: keyAccessConnection,
    name: config.get('auth.keyAccessCollection'),
    property: config.get('auth.database'),
    settings: {
      compose: false,
      storeRevisions: false
    }
  })

  this.acl = acl
  this.accessModel = accessModel
  this.keyAccessModel = keyAccessModel
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
Access.prototype.filterFields = function(access, input) {
  const fields = access.fields

  if (typeof fields !== 'object' || !input || !Object.keys(input).length) {
    return input
  }

  const isExclusion = Object.keys(fields).some(field => {
    return field !== '_id' && fields[field] === 0
  })
  let allowedFields = Array.isArray(input) ? input : Object.keys(input)

  allowedFields = allowedFields.filter(field => {
    return (
      (isExclusion && fields[field] === undefined) ||
      (!isExclusion && fields[field] === 1)
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

/**
 * Gets a client's access matrix for a given resource if `resource` is
 * supplied, otherwise returns the access matrices for all resources that
 * are associated with the client.
 *
 * If the client has an `accessType` of `admin`, the method returns a full
 * access matrix (i.e. containing `true` on all access levels) for each of
 * the resources.
 *
 * If `ownerReference` is supplied, information about the requesting client
 * is added to this object. If the request contains a bearer token, or an
 * access key associated with a client record, the ID of the client will be
 * added to the `clientId` property. If the request contains an access key
 * that is not associated with a client, the ID of the key will be set to
 * the `keyId` property.
 *
 * @param  {String}       accessType
 * @param  {String}       clientId
 * @param  {String}       token
 * @param  {String}       resource
 * @param  {Object}       ownerReference
 * @param  {Boolean}      resolveOwnTypes
 * @return {Array/Object}
 */
Access.prototype.get = async function(
  {accessType = null, clientId = null, token} = {},
  resource,
  {ownerReference, resolveOwnTypes = true} = {}
) {
  const isAccessKey = accessType === 'key' && typeof token === 'string'

  if (!isAccessKey && typeof clientId !== 'string') {
    return Promise.resolve({})
  }

  if (clientModel.isAdmin({clientId, accessType})) {
    const matrix = {}

    ACCESS_TYPES.forEach(accessType => {
      matrix[accessType] = true
    })

    if (ownerReference) {
      ownerReference.clientId = clientId
    }

    return Promise.resolve(matrix)
  }

  const query = isAccessKey ? {key: token} : {client: clientId}

  if (resource) {
    query.resource = resource
  }

  const model = accessType === 'key' ? this.keyAccessModel : this.accessModel
  const {results} = await model.get({
    query,
    rawOutput: true
  })

  if (results.length === 0) {
    return {}
  }

  if (ownerReference) {
    if (isAccessKey) {
      if (results[0].client) {
        ownerReference.clientId = results[0].client
      } else {
        ownerReference.keyId = results[0].keyId
      }
    } else {
      ownerReference.clientId = clientId
    }
  }

  const accessMap = new ACLMatrix()

  results.forEach(result => {
    accessMap.set(result.resource, result.access)
  })

  if (resource) {
    const matrix = accessMap.get(resource)

    return resolveOwnTypes ? this.resolveOwnTypes(matrix, clientId) : matrix
  }

  return accessMap.getAll()
}

/**
 * Returns an array with all the roles associated with a client, either
 * directly or via role inheritance.
 *
 * @param  {String} clientId
 * @return {Promise<Array>}
 */
Access.prototype.getClientRoles = function(clientId) {
  return clientModel.get(clientId).then(({results}) => {
    if (results.length === 0) {
      return []
    }

    const roles = results[0].roles

    if (roles.length === 0) {
      return []
    }

    return this.getRoleChain(roles)
  })
}

/**
 * Computes the access matrices for all resources for a given user, taking
 * into account the resource permissions assigned directly to them, as well
 * as permissions coming from their role chain.
 *
 * @param  {Object} client
 * @param  {Object} roleCache
 * @return {Promise<Object>}
 */
Access.prototype.getCombinedResourcesForClient = async function(
  client,
  roleCache
) {
  // Getting an array with the name of every role the client is
  // assigned to, including inheritance.
  const chain = await this.getRoleChain(client.roles, roleCache)

  // Start with the resources assigned to the client directly.
  const clientResources = client.resources || {}
  const clientResourcesMap = new ACLMatrix(clientResources)

  // Take the resources associated with each role and extend
  // the corresponding entry in `clientResources`.
  chain.forEach(roleName => {
    const role = roleCache[roleName]

    if (!role) return

    const roleMap = new ACLMatrix(role)

    Object.keys(role).forEach(resource => {
      const combinedMatrix = this.uniteAccessMatrices(
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

  const combinedResources = clientResourcesMap.getAll({
    stringifyObjects: true
  })

  return combinedResources
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
Access.prototype.getRoleChain = function(roles = [], cache = {}, chain) {
  chain = chain || roles

  // We only need to fetch from the database the roles that
  // are not already in cache.
  const rolesToFetch = roles.filter(role => {
    return !Object.keys(cache).includes(role)
  })

  if (rolesToFetch.length === 0) {
    return Promise.resolve([...new Set(chain)])
  }

  return roleModel.get(rolesToFetch).then(({results}) => {
    const parentRoles = new Set()

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

/**
 * Combines values from two matrices to produce a matrix with the
 * narrowest permissions possible.
 *
 * @param  {Object} base
 * @param  {Object} candidate
 * @return {Objct}
 */
Access.prototype.intersectAccessMatrices = function(base = {}, candidate = {}) {
  const accessTypes = [
    ...new Set(Object.keys(base).concat(Object.keys(candidate)))
  ]
  const result = Object.assign({}, base)

  accessTypes.forEach(accessType => {
    // If the base value and the candidate value are the same, or if the
    // candidate value is `undefined`, we simply keep the base value, so
    // there's nothing we need to do here.
    if (
      base[accessType] === candidate[accessType] ||
      candidate[accessType] === undefined
    ) {
      return
    }

    // If either the base value or the candidate value are falsy, then the
    // resulting value is `false`.
    if (!base[accessType] || !candidate[accessType]) {
      result[accessType] = false

      return
    }

    // If the base value is `true` and the candidate is an object, we use the
    // candidate's value, because it's more restrictive.
    if (base[accessType] === true && typeof candidate === 'object') {
      result[accessType] = candidate[accessType]

      return
    }

    // Conversely, if the candidate value is `true` and the base is an
    // object we use the base value, because it's more restrictive.
    if (candidate[accessType] === true && typeof base === 'object') {
      return
    }

    // At this point, we now that both the base and the candidate
    // values are objects. We can start by merging the `fields` objects
    // of both the base and candidate values, so that they result in
    // the narrowest set of fields.
    if (base[accessType].fields || candidate[accessType].fields) {
      result[accessType].fields = this.intersectFieldProjections([
        base[accessType].fields,
        candidate[accessType].fields
      ])
    }
  })

  return result
}

/**
 * Takes a key object, which may or may not contain its own resources object,
 * and merges it against an object that maps client IDs to resources. For each
 * resource, the client's resources are merged with the key resources so that
 * the narrowest set of permissions is obtained. The output is an object that
 * maps resource keys to updated access matrices.
 *
 * @param  {Object}   key
 * @param  {Object}   clientResources
 * @return {Object}
 */
Access.prototype.intersectClientAndKeyResources = function(
  key,
  clientResources = {}
) {
  const resources = key.resources || {}

  Object.keys(clientResources).forEach(resourceKey => {
    // If there is a key-specific access matrix for this resource, we must
    // intersect it with the client's access matrix for the resource. If not,
    // we'll simply use the client's matrix.
    resources[resourceKey] = resources[resourceKey]
      ? this.intersectAccessMatrices(
          clientResources[resourceKey],
          resources[resourceKey]
        )
      : clientResources[resourceKey]
  })

  return resources
}

/**
 * Creates an intersection of a set of field projections, resulting in the
 * narrowest field set.
 *
 * @param  {Array}  projections
 * @return {Object}
 */
Access.prototype.intersectFieldProjections = function(projections) {
  let fields = []
  let isExclusion = false

  projections.some(projection => {
    if (!projection) {
      fields = []

      return true
    }

    const projectionFields = Object.keys(projection)
    const projectionIsExclusion = projectionFields.find(field => {
      return field !== '_id' && projection[field] === 0
    })

    if (projectionIsExclusion) {
      if (isExclusion) {
        // Both the current and the aggregate projections are exclusions. The
        // new aggregate remains an exclusion and we add any fields from the
        // current projection that haven't been excluded before.
        projectionFields.forEach(field => {
          if (!fields.includes(field)) {
            fields.push(field)
          }
        })
      } else {
        // The current projection is an exclusion, but the aggregate projection
        // is not. The new aggregate remains an inclusion and we remove from it
        // any fields that have been excluded in the current projection.
        fields = projectionFields.filter(field => {
          return !fields.includes(field)
        })
      }
    } else {
      if (isExclusion) {
        // The current projection is an inclusion, but the aggregate projection
        // is not. The new aggregate becomes an inclusion containing the fields
        // from the current projection that haven't been previously excluded.
        fields = fields.filter(field => {
          return !projectionFields.includes(field)
        })

        isExclusion = true
      } else {
        // Both the current and the aggregate projections are inclusions. The
        // new aggregate remains an inclusion with the fields that are common
        // to both projections.
        fields = fields.filter(field => projectionFields.includes(field))
      }
    }

    return false
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
Access.prototype.resolveOwnTypes = function(matrix, clientId) {
  const newMatrix = {}
  const splitTypes = Object.keys(matrix).reduce(
    (result, accessType) => {
      const match = accessType.match(/^(.*)Own$/)

      if (match) {
        result.own.push(match[1])
      } else {
        result.base.push(accessType)
      }

      return result
    },
    {
      base: [],
      own: []
    }
  )

  splitTypes.base.forEach(accessType => {
    newMatrix[accessType] = matrix[accessType]
  })

  splitTypes.own.forEach(baseType => {
    const accessType = `${baseType}Own`

    if (!matrix[accessType] || matrix[baseType] === true) {
      return
    }

    const filter = Object.assign(
      {},
      newMatrix[baseType] && newMatrix[baseType].filter,
      newMatrix[accessType] && newMatrix[accessType].filter,
      {_createdBy: clientId}
    )

    const fields =
      (matrix[baseType] && matrix[baseType].fields) ||
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

/**
 * Combines values from two matrices to produce a matrix with the
 * broadest permissions possible.
 *
 * @param  {Object} base
 * @param  {Object} candidate
 * @return {Object}
 */
Access.prototype.uniteAccessMatrices = function(base = {}, candidate = {}) {
  const accessTypes = [
    ...new Set(Object.keys(base).concat(Object.keys(candidate)))
  ]
  const result = Object.assign({}, base)

  accessTypes.forEach(accessType => {
    // If the base value for the access type is already `true`
    // or if the new candidate value is `false`, the base value
    // will remain unchanged.
    if (base[accessType] === true || !candidate[accessType]) {
      return
    }

    // If the candidate value is `true`, there's nothing else to do
    // other than setting the base value to `true`.
    if (candidate[accessType] === true) {
      result[accessType] = true

      return
    }

    // If the base value is `false`, we take whatever the candidate
    // value is.
    if (!base[accessType]) {
      result[accessType] = candidate[accessType]

      return
    }

    // At this point, we now that both the base and the candidate
    // values are objects. We can start by merging the `fields` objects
    // of both the base and candidate values, so that they result in
    // the broadest set of fields.
    if (base[accessType].fields || candidate[accessType].fields) {
      const fields = this.uniteFieldProjections([
        base[accessType].fields,
        candidate[accessType].fields
      ])

      // If `fields` is the only property in the access type and the
      // result of merging the matrices resulted in a projection with
      // no field restrictions, we can simply set the access type to
      // `true`.
      if (
        Object.keys(base[accessType]).length === 1 &&
        Object.keys(fields).length === 0
      ) {
        result[accessType] = true
      } else {
        result[accessType].fields = fields
      }
    }

    // We can't do the same with `filter`, because it's not possible to
    // compute the union of two filter expressions (we'd have to use an
    // *or* expression, which API doesn't currently have).
  })

  return result
}

/**
 * Creates a union from a set of projections, resulting in the broadest field
 * set.
 *
 * @param  {Array}  projections
 * @return {Object}
 */
Access.prototype.uniteFieldProjections = function(projections) {
  let fields = []
  let isExclusion = false

  projections.some(projection => {
    if (!projection) {
      fields = []

      return true
    }

    const projectionFields = Object.keys(projection)
    const projectionIsExclusion = projectionFields.find(field => {
      return field !== '_id' && projection[field] === 0
    })

    if (projectionIsExclusion) {
      if (isExclusion) {
        // Both the current and the aggregate projections are exclusions, so
        // the new aggregate becomes an exclusion containing only the fields
        // that are common to both.
        fields = fields.filter(field => {
          return projectionFields.includes(field)
        })
      } else {
        // The current projection is an exclusion, but the aggregate projection
        // is not. The new aggregate becomes an exclusion containing the fields
        // that were previously included and that are not excluded in the
        // current projection.
        fields = projectionFields.filter(field => {
          return !fields.includes(field)
        })
      }

      isExclusion = true
    } else {
      if (isExclusion) {
        // The current projection is an inclusion, but the aggregate projection
        // is not. The new aggregate remains an inclusion, but we remove any
        // fields that have been excluded by the current projection.
        fields = fields.filter(field => {
          return !projectionFields.includes(field)
        })
      } else {
        // Both the current and the aggregate projections are inclusions. The
        // new aggregate remains an inclusion and we add any fields from the
        // current projection that haven't been included before.
        projectionFields.forEach(field => {
          if (!fields.includes(field)) {
            fields.push(field)
          }
        })
      }
    }

    return false
  })

  return fields.reduce((result, field) => {
    result[field] = isExclusion ? 0 : 1

    return result
  }, {})
}

/**
 * Computes final access matrices for all clients
 *
 * @return {Promise}
 */
Access.prototype.writeAccessForAllClients = async function() {
  const {results} = await clientModel.find({})

  return this.writeClientAccess(results, {})
}

/**
 * Computes final access matrices for any clients that match a list of IDs.
 *
 * @param  {Array<String>}  clients
 * @return {Promise}
 */
Access.prototype.writeAccessForClientsWithIds = async function(clients) {
  const clientFilter = {$in: clients}
  const {results} = await clientModel.find({clientId: clientFilter})

  return this.writeClientAccess(results, {client: clientFilter})
}

/**
 * Computes final access matrices for each client and each resource,
 * taking into account client-level and role-level permissions. An
 * entry is created in the access collection for each client/resource
 * pair.
 *
 * @param  {Array<Object>}  clients
 * @param  {Object}         deleteQuery
 * @return {Promise}
 */
Access.prototype.writeClientAccess = async function(clients, deleteQuery = {}) {
  // Keeping a local cache of roles for the course of
  // this operation. This way, if X roles inherit from role
  // R1, we just fetch R1 from the database once, instead of
  // X times.
  const roleCache = {}

  // An entry is an object with {client, resource, access}. This
  // array will serve as a buffer, where we'll store all the
  // entries we need to push and then make a single call to
  // the database, as opposed to writing every time we process
  // a client or a resource.
  const entries = []

  // If `clients` wasn't supplied, we operate on all the existing clients.
  const clientResults =
    clients || (await clientModel.find({}).then(({results}) => results))

  // We'll use this object to store the final access matrix for each client and
  // each resource key.
  const combinedResourcesByClient = {}

  // For each client, we find out all the resources they have access to.
  const queue = clientResults.reduce(async (queue, client) => {
    if (clientModel.isAdmin(client)) {
      return queue
    }

    await queue

    const combinedResources = await this.getCombinedResourcesForClient(
      client,
      roleCache
    )

    combinedResourcesByClient[client.clientId] = combinedResources

    Object.keys(combinedResources).forEach(resource => {
      entries.push({
        client: client.clientId,
        resource,
        access: combinedResources[resource]
      })
    })

    return queue
  }, Promise.resolve())

  await queue

  // Before we write the new entries to the access collection, we need to
  // delete the previous ones.
  await this.accessModel.delete({
    query: deleteQuery
  })

  if (entries.length > 0) {
    await this.accessModel.create({
      documents: entries,
      rawOutput: true,
      validate: false
    })
  }

  // We need to rewrite access for any keys associated with the clients
  // modified by this operation.
  await this.writeKeyAccessForClientEntries(combinedResourcesByClient)

  return entries
}

/**
 * Computes final access matrices for each registered key, taking into account
 * the permissions coming from the key itself as well as permissions inherited
 * from associated clients. An entry is created in the access collection for
 * each key/resource pair.
 *
 * @param  {Object}   clientsCache
 * @param  {Object}   combinedResourcesCache
 * @param  {Array}   deletedKeyIds
 * @param  {Array}    updatedKeys
 * @return {Promise}
 */
Access.prototype.writeKeyAccess = async function({
  clientsCache = {},
  combinedResourcesCache = {},
  deletedKeyIds = [],
  updatedKeys = []
}) {
  const entries = []
  const roleCache = {}

  let queue = Promise.resolve()

  updatedKeys.forEach(key => {
    queue = queue.then(async () => {
      const keyResources = new ACLMatrix(key.resources || []).getAll()
      const {client: clientId} = key
      const combinedResourcesForKey = {}

      if (clientId) {
        let clientResources = combinedResourcesCache[clientId]

        // If the resources for this client are not cached, we retrieve them and
        // then cache them for subsequent iterations.
        if (!clientResources) {
          const client =
            clientsCache[clientId] ||
            (await clientModel
              .get(clientId)
              .then(({results}) => results && results[0]))

          if (!client) return

          // Ensure the client is cached.
          clientsCache[clientId] = clientsCache[clientId] || client

          clientResources = await this.getCombinedResourcesForClient(
            client,
            roleCache
          )

          combinedResourcesCache[clientId] = clientResources
        }

        Object.keys(clientResources).forEach(resourceKey => {
          // If the key has permissions defined for this resource, we merge them
          // with the client's. If not, we'll use just the permissions from the
          // client.
          combinedResourcesForKey[resourceKey] = keyResources[resourceKey]
            ? this.intersectAccessMatrices(
                clientResources[resourceKey],
                keyResources[resourceKey]
              )
            : clientResources[resourceKey]
        })
      }

      // We must now add any resources that have been defined for the key which
      // haven't been added to the aggregate resources map yet.
      Object.keys(keyResources).forEach(resourceKey => {
        if (!combinedResourcesForKey[resourceKey]) {
          combinedResourcesForKey[resourceKey] = keyResources[resourceKey]
        }
      })

      // Finally, we create an access entry for each resource.
      Object.keys(combinedResourcesForKey).forEach(resourceKey => {
        entries.push({
          key: key.token,
          keyId: key._id,
          client: clientId || null,
          clientAccessType: clientId ? clientsCache[clientId].accessType : null,
          resource: resourceKey,
          access: combinedResourcesForKey[resourceKey]
        })
      })
    })
  })

  await queue

  // If we are updating any keys, we must delete their previous records first.
  if (updatedKeys.length > 0) {
    const keyIds = updatedKeys.map(({_id}) => _id)

    await this.keyAccessModel.delete({
      query: {
        _id: {$in: keyIds}
      }
    })
  }

  // If any keys have been deleted, we have to delete their access records.
  if (deletedKeyIds.length > 0) {
    await this.keyAccessModel.delete({
      query: {
        keyId: {$in: deletedKeyIds}
      }
    })
  }

  if (entries.length > 0) {
    await this.keyAccessModel.create({
      documents: entries,
      rawOutput: true,
      validate: false
    })
  }

  return entries
}

/**
 * Computes final access matrices for any keys associated with clients from
 * a given list of entries. The input is an object mapping client IDs to
 * resources.
 *
 * @param  {Object}   resourcesByClient
 * @return {Promise}
 */
Access.prototype.writeKeyAccessForClientEntries = async function(
  resourcesByClient
) {
  const {results: keys} = await this.keyAccessModel.find({
    query: {
      client: {
        $in: Object.keys(resourcesByClient)
      }
    }
  })
  const entries = []

  keys.forEach(async key => {
    const keyResources = this.intersectClientAndKeyResources(
      key,
      resourcesByClient[key.client]
    )

    Object.keys(keyResources).forEach(resourceKey => {
      entries.push({
        key: key.key,
        keyId: key._id,
        client: key.client,
        resource: resourceKey,
        access: keyResources[resourceKey]
      })
    })
  })

  // Before we write the new entries to the key access collection, we need to
  // delete the previous ones.
  await this.keyAccessModel.delete({
    query: {
      _id: {
        $in: keys.map(key => key._id)
      }
    }
  })

  if (entries.length > 0) {
    await this.keyAccessModel.create({
      documents: entries,
      rawOutput: true,
      validate: false
    })
  }

  return entries
}

module.exports = new Access()
