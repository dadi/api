const access = require('./access')
const client = require('./client')
const key = require('./key')
const modelStore = require('../index')
const role = require('./role')

const ERROR_FORBIDDEN = 'FORBIDDEN'
const ERROR_UNAUTHORISED = 'UNAUTHORISED'

const ACL = function() {
  this.resources = {}

  this.connect()
}

ACL.prototype.connect = function() {
  // Initialising the various sub-models with a reference to the ACL instance.
  access.connect(this)
  client.connect(this)
  key.connect(this)
  role.connect(this)
}

ACL.prototype.createError = function(client) {
  // If the client exists and there is no error associated with it, it
  // means that a valid bearer token was supplied, but it doesn't have the
  // right permissions to perform the operation - i.e. the request is
  // authenticated, just not authorised. That is a 403. In any other case,
  // the request is unauthorised, so a 401 is returned.
  if (client && client.clientId && !client.error) {
    return new Error(ERROR_FORBIDDEN)
  }

  return new Error(ERROR_UNAUTHORISED)
}

ACL.prototype.getResources = function() {
  const models = modelStore.getAll()
  const collectionResources = Object.keys(models).reduce((result, key) => {
    if (models[key].isListable) {
      result[models[key].aclKey] = {
        description: `${key} collection`
      }
    }

    return result
  }, {})

  return Object.assign({}, this.resources, collectionResources)
}

ACL.prototype.hasResource = function(resource) {
  if (this.resources[resource] !== undefined) {
    return true
  }

  return Boolean(modelStore.getByAclKey(resource))
}

ACL.prototype.registerResource = function(name, description = null) {
  this.resources[name] = {
    description
  }
}

ACL.prototype.validateResourcesObject = async function(
  resources,
  creatingClient
) {
  if (!creatingClient) {
    return Promise.reject(this.createError(creatingClient))
  }

  if (!client.isAdmin(creatingClient)) {
    const clientResources = await access.get(creatingClient)
    const hasInsufficientAccess = Object.keys(resources).some(resourceKey => {
      // We're looking for any cases where the client is attempting to grant an
      // access type that they do not possess themselves.
      const hasForbiddenAccessTypes = Object.keys(resources[resourceKey]).some(
        accessType =>
          Boolean(resources[resourceKey][accessType]) &&
          (clientResources[resourceKey] &&
            clientResources[resourceKey][accessType]) !== true
      )

      return hasForbiddenAccessTypes
    })

    if (hasInsufficientAccess) {
      return Promise.reject(this.createError(client))
    }
  }

  const resourceErrors = Object.keys(resources)
    .filter(key => !this.hasResource(key))
    .map(key => ({
      code: 'ERROR_INVALID_RESOURCE',
      field: `resources.${key}`,
      message: 'is not a valid resource'
    }))

  if (resourceErrors.length > 0) {
    const error = new Error('VALIDATION_ERROR')

    error.data = resourceErrors

    return Promise.reject(error)
  }
}

module.exports = new ACL()
module.exports.ACL = ACL
module.exports.ERROR_FORBIDDEN = ERROR_FORBIDDEN
module.exports.ERROR_UNAUTHORISED = ERROR_UNAUTHORISED
module.exports.access = access
module.exports.client = client
module.exports.key = key
module.exports.role = role
