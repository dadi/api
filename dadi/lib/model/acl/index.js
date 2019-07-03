const access = require('./access')
const client = require('./client')
const config = require('../../../../config.js')
const Model = require('../index')
const role = require('./role')
const schemaStore = require('../schemaStore')

const ERROR_FORBIDDEN = 'FORBIDDEN'
const ERROR_UNAUTHORISED = 'UNAUTHORISED'

const ACL = function() {
  this.resources = {}

  this.connect()
}

ACL.prototype.connect = function() {
  // Establishing connection for access model.
  const accessModel = Model({
    name: config.get('auth.accessCollection'),
    property: config.get('auth.database'),
    schema: {},
    usePropertyDatabase: true
  })

  access.setModel(accessModel)

  // Establishing connection for client model.
  const clientModel = Model({
    name: config.get('auth.clientCollection'),
    property: config.get('auth.database'),
    schema: {},
    usePropertyDatabase: true
  })

  client.setModel(clientModel)

  // Establishing connection for role model.
  const roleModel = Model({
    name: config.get('auth.roleCollection'),
    property: config.get('auth.database'),
    schema: {},
    usePropertyDatabase: true
  })

  role.setModel(roleModel)
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
  return this.resources
}

ACL.prototype.hasResource = async function(resource) {
  if (this.resources[resource] !== undefined) {
    return true
  }

  try {
    const {results} = await schemaStore.find({
      aclKey: resource
    })

    return results.length > 0
  } catch (error) {
    logger.error({module: 'acl'}, error)

    return false
  }
}

ACL.prototype.registerResource = function(name, description = null) {
  this.resources[name] = {
    description
  }
}

module.exports = new ACL()
module.exports.ACL = ACL
module.exports.ERROR_FORBIDDEN = ERROR_FORBIDDEN
module.exports.ERROR_UNAUTHORISED = ERROR_UNAUTHORISED
module.exports.access = access
module.exports.client = client
module.exports.role = role
