const access = require('./access')
const client = require('./client')
const config = require('./../../../../config.js')
const Connection = require('./../connection')
const Model = require('./../index')
const role = require('./role')

const ACL = function () {
  this.resources = {}

  this.connect()
}

ACL.prototype.connect = function () {
  // Establishing connection for access model.
  let accessConnection = Connection(
    {
      collection: config.get('auth.accessCollection'),
      database: config.get('auth.database'),
      override: true
    }
  )
  let accessModel = Model(
    config.get('auth.accessCollection'),
    {},
    accessConnection,
    {
      compose: false,
      database: config.get('auth.database'),
      storeRevisions: false
    }
  )

  access.setModel(accessModel)

  // Establishing connection for client model.
  let clientConnection = Connection(
    {
      collection: config.get('auth.clientCollection'),
      database: config.get('auth.database'),
      override: true
    },
    null,
    config.get('auth.datastore')
  )
  let clientModel = Model(
    config.get('auth.clientCollection'),
    {},
    clientConnection,
    {
      compose: false,
      database: config.get('auth.database'),
      storeRevisions: false
    }
  )

  client.setModel(clientModel)

  // Establishing connection for role model.
  let roleConnection = Connection(
    {
      collection: config.get('auth.roleCollection'),
      database: config.get('auth.database'),
      override: true
    }
  )

  let roleModel = Model(
    config.get('auth.roleCollection'),
    {},
    roleConnection,
    {
      compose: false,
      database: config.get('auth.database'),
      storeRevisions: false
    }
  )

  role.setModel(roleModel)
}

ACL.prototype.getResources = function () {
  return this.resources
}

ACL.prototype.hasResource = function (resource) {
  return this.resources[resource] !== undefined
}

ACL.prototype.registerResource = function (name, description = null) {
  this.resources[name] = {
    description
  }
}

module.exports = new ACL()
module.exports.access = access
