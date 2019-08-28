const acl = require('./../model/acl')
const model = require('./../model/acl/client')
const help = require('./../help')

const Clients = function(server) {
  acl.registerResource('clients', 'API clients')

  server.app.routeMethods('/api/client', {
    get: this.bindOwn(this.get.bind(this)),
    put: this.bindOwn(this.put.bind(this))
  })

  server.app.routeMethods('/api/clients', {
    post: this.post.bind(this)
  })

  server.app.routeMethods('/api/clients/:clientId?', {
    delete: this.delete.bind(this),
    get: this.get.bind(this),
    put: this.put.bind(this)
  })

  server.app.routeMethods('/api/clients/:clientId/roles', {
    post: this.postRole.bind(this)
  })

  server.app.routeMethods('/api/clients/:clientId/roles/:role', {
    delete: this.deleteRole.bind(this)
  })

  server.app.routeMethods('/api/clients/:clientId/resources', {
    post: this.postResource.bind(this)
  })

  server.app.routeMethods('/api/clients/:clientId/resources/:resource', {
    delete: this.deleteResource.bind(this),
    put: this.putResource.bind(this)
  })
}

Clients.prototype.bindOwn = function(handler) {
  return (req, res, next) => {
    const modifiedRequest = Object.assign({}, req, {
      params: Object.assign({}, req.params, {
        clientId: req.dadiApiClient && req.dadiApiClient.clientId
      })
    })

    return handler(modifiedRequest, res, next)
  }
}

Clients.prototype.delete = function(req, res, next) {
  return acl.access
    .get(req.dadiApiClient, 'clients')
    .then(access => {
      if (access.delete !== true) {
        return Promise.reject(acl.createError(req.dadiApiClient))
      }

      return model.get(req.params.clientId)
    })
    .then(clients => {
      if (clients.results.length === 0) {
        return help.sendBackJSON(404, res, next)(null)
      }

      return model.delete(req.params.clientId)
    })
    .then(() => {
      help.sendBackJSON(204, res, next)(null, null)
    })
    .catch(this.handleError(res, next))
}

Clients.prototype.deleteResource = async function(req, res, next) {
  try {
    // To remove a resource from a client, the requesting client
    // needs to have "update" access to the "clients" resource.
    const clientsAccess = await acl.access.get(req.dadiApiClient, 'clients')

    if (clientsAccess.update !== true) {
      throw acl.createError(req.dadiApiClient)
    }

    const resourceAccess = await acl.access.get(
      req.dadiApiClient,
      req.params.resource
    )

    if (
      resourceAccess.create !== true ||
      resourceAccess.delete !== true ||
      resourceAccess.read !== true ||
      resourceAccess.update !== true
    ) {
      throw acl.createError(req.dadiApiClient)
    }

    await model.resourceRemove(req.params.clientId, req.params.resource)

    return help.sendBackJSON(204, res, next)(null, null)
  } catch (error) {
    return this.handleError(res, next)(error)
  }
}

Clients.prototype.deleteRole = async function(req, res, next) {
  try {
    const role = req.params.role

    // To remove a role from a client, the requesting client needs to have
    // "update" access to the "clients" resource, and have themselves the
    // role they're trying to remove.
    const clientsAccess = await acl.access.get(req.dadiApiClient, 'clients')

    if (clientsAccess.update !== true) {
      throw acl.createError(req.dadiApiClient)
    }

    // If the client does not have admin access, we need to ensure that
    // they have the role they are trying to remove.
    if (!model.isAdmin(req.dadiApiClient)) {
      const {results: clients} = await model.get(req.dadiApiClient.clientId)
      const user = clients[0]
      const requestingClientHasRole = user.roles && user.roles.includes(role)

      if (!requestingClientHasRole) {
        throw acl.createError(req.dadiApiClient)
      }
    }

    const {removed, results} = await model.roleRemove(req.params.clientId, [
      role
    ])

    if (removed.length === 0) {
      return help.sendBackJSON(404, res, next)(null)
    }

    return help.sendBackJSON(204, res, next)(null, {results})
  } catch (error) {
    return this.handleError(res, next)(error)
  }
}

Clients.prototype.get = async function(req, res, next) {
  try {
    if (!req.dadiApiClient || !req.dadiApiClient.clientId) {
      throw acl.createError(req.dadiApiClient)
    }

    const clientId = req.params.clientId

    // Clients will always have read access to their own endpoint.
    if (!clientId || req.dadiApiClient.clientId !== clientId) {
      const access = await acl.access.get(req.dadiApiClient, 'clients')

      if (access.read !== true) {
        throw acl.createError(req.dadiApiClient)
      }
    }

    const clients = await model.get(clientId)

    if (clientId && clients.results.length === 0) {
      return help.sendBackJSON(404, res, next)(null, null)
    }

    const sanitisedClients = clients.results.map(client => {
      return model.formatForOutput(client)
    })

    help.sendBackJSON(200, res, next)(null, {
      results: sanitisedClients
    })
  } catch (error) {
    return this.handleError(res, next)(error)
  }
}

Clients.prototype.handleError = function(res, next) {
  return err => {
    switch (err.message) {
      case 'FORBIDDEN':
      case 'UNAUTHORISED':
        return help.sendBackJSON(null, res, next)(err)

      case 'CLIENT_DOES_NOT_HAVE_RESOURCE':
        return help.sendBackJSON(404, res, next)(null, null)

      case 'CLIENT_EXISTS':
        return help.sendBackJSON(409, res, next)(null, {
          success: false,
          errors: [
            {
              code: 'ERROR_CLIENT_EXISTS',
              field: 'clientId',
              message: 'client already exists'
            }
          ]
        })

      case 'CLIENT_HAS_RESOURCE':
        return help.sendBackJSON(409, res, next)(null, {
          success: false,
          errors: [
            {
              code: 'ERROR_CLIENT_HAS_RESOURCE',
              field: err.data,
              message: 'is already assigned to the client'
            }
          ]
        })

      case 'CLIENT_NOT_FOUND':
        return help.sendBackJSON(404, res, next)(null, null)

      case 'INVALID_ROLE':
        return help.sendBackJSON(400, res, next)(null, {
          success: false,
          errors: err.data.map(role => ({
            code: 'ERROR_INVALID_ROLE',
            field: role,
            message: 'is not a valid role'
          }))
        })

      case 'INVALID_SECRET':
        return help.sendBackErrorWithCode('0008', 400, res, next)

      case 'MISSING_SECRET':
        return help.sendBackErrorWithCode('0007', 400, res, next)

      case 'PROTECTED_DATA_FIELDS':
        return help.sendBackJSON(400, res, next)(null, {
          success: false,
          errors: err.data.map(field => ({
            code: 'ERROR_PROTECTED_DATA_FIELD',
            field: `data.${field}`,
            message: 'is a read-only data property'
          }))
        })

      case 'VALIDATION_ERROR':
        return help.sendBackJSON(400, res, next)(null, {
          success: false,
          errors: err.data
        })

      default:
        return help.sendBackJSON(400, res, next)(err)
    }
  }
}

Clients.prototype.post = async function(req, res, next) {
  try {
    const access = await acl.access.get(req.dadiApiClient, 'clients')
    const client = req.body

    if (client.resources) {
      await acl.validateResourcesObject(client.resources, req.dadiApiClient)
    }

    await this.validateDataObject(client.data, req.dadiApiClient)

    if (access.create !== true) {
      throw acl.createError(req.dadiApiClient)
    }

    if (
      client.accessType === 'admin' &&
      !model.isSuperUser(req.dadiApiClient)
    ) {
      throw acl.createError(req.dadiApiClient)
    }

    const {results} = await model.create(client)

    return help.sendBackJSON(201, res, next)(null, {
      results: [model.formatForOutput(results[0])]
    })
  } catch (error) {
    this.handleError(res, next)(error)
  }
}

Clients.prototype.postResource = async function(req, res, next) {
  const {access, name} = req.body

  try {
    // To add a resource to a client, the requesting client needs to have
    // "update" access to the "clients" resource, as well as access to the
    // resource in question.
    const clientsAccess = await acl.access.get(req.dadiApiClient, 'clients')

    if (clientsAccess.update !== true) {
      throw acl.createError(req.dadiApiClient)
    }

    // If the client does not have admin access, we need to ensure that
    // they have each of the access types they are trying to assign.
    if (!model.isAdmin(req.dadiApiClient)) {
      const resourceAccess = await acl.access.get(req.dadiApiClient, name)
      const forbiddenType = Object.keys(resourceAccess).find(type => {
        return resourceAccess[type] !== true
      })

      if (forbiddenType) {
        throw acl.createError(req.dadiApiClient)
      }
    }

    if (name && !acl.hasResource(name)) {
      return help.sendBackJSON(400, res, next)(null, {
        success: false,
        errors: [
          {
            code: 'ERROR_INVALID_RESOURCE',
            field: 'name',
            message: 'is not a valid resource'
          }
        ]
      })
    }

    const {results} = await model.resourceAdd(req.params.clientId, name, access)

    return help.sendBackJSON(201, res, next)(null, {results})
  } catch (error) {
    this.handleError(res, next)(error)
  }
}

Clients.prototype.postRole = async function(req, res, next) {
  const roles = req.body

  if (!Array.isArray(roles)) {
    return help.sendBackJSON(400, res, next)(null, {
      success: false,
      errors: [
        {
          code: 'ERROR_INVALID_VALUE',
          message: 'is not a valid value – expected array of role names'
        }
      ]
    })
  }

  try {
    // To add a role to a client, the requesting client needs to have
    // "update" access to the "clients" resource, and have themselves the
    // role they're trying to assign.

    const clientsAccess = await acl.access.get(req.dadiApiClient, 'clients')

    if (clientsAccess.update !== true) {
      throw acl.createError(req.dadiApiClient)
    }

    // If the client does not have admin access, we need to ensure that
    // they have each of the roles they are trying to assign.
    if (!model.isAdmin(req.dadiApiClient)) {
      const {results: users} = await model.get(req.dadiApiClient.clientId)
      const user = users[0]
      const forbiddenRoles = roles.filter(role => {
        return !user.roles || !user.roles.includes(role)
      })

      if (forbiddenRoles.length > 0) {
        throw acl.createError(req.dadiApiClient)
      }
    }

    const {results} = await model.roleAdd(req.params.clientId, roles)

    return help.sendBackJSON(200, res, next)(null, {results})
  } catch (error) {
    return this.handleError(res, next)(error)
  }
}

Clients.prototype.put = function(req, res, next) {
  const clientIsAdmin = acl.client.isAdmin(req.dadiApiClient)
  const update = req.body

  // A client can only be updated by themselves or by an admin.
  if (!clientIsAdmin && req.params.clientId !== req.dadiApiClient.clientId) {
    return this.handleError(res, next)(acl.createError(req.dadiApiClient))
  }

  return this.validateDataObject(update.data, req.dadiApiClient)
    .then(() => {
      if (
        !clientIsAdmin &&
        typeof update.secret === 'string' &&
        typeof update.currentSecret !== 'string'
      ) {
        return Promise.reject(new Error('MISSING_SECRET'))
      }

      return model.update(req.params.clientId, update)
    })
    .then(({results}) => {
      if (results.length === 0) {
        return Promise.reject(new Error('CLIENT_NOT_FOUND'))
      }

      help.sendBackJSON(200, res, next)(null, {
        results: [model.formatForOutput(results[0])]
      })
    })
    .catch(this.handleError(res, next))
}

Clients.prototype.putResource = async function(req, res, next) {
  try {
    // To modify a resource in a client, the requesting client needs to have
    // "update" access to the "clients" resource, as well as access to the
    // resource in question.
    const clientsAccess = await acl.access.get(req.dadiApiClient, 'clients')

    if (clientsAccess.update !== true) {
      throw acl.createError(req.dadiApiClient)
    }

    // If the client does not have admin access, we need to ensure that
    // they have each of the access types they are trying to assign.
    if (!model.isAdmin(req.dadiApiClient)) {
      const resourceAccess = await acl.access.get(
        req.dadiApiClient,
        req.params.resource
      )
      const forbiddenType = Object.keys(req.body).find(type => {
        return resourceAccess[type] !== true
      })

      if (forbiddenType) {
        throw acl.createError(req.dadiApiClient)
      }
    }

    const {results} = await model.resourceUpdate(
      req.params.clientId,
      req.params.resource,
      req.body
    )

    return help.sendBackJSON(200, res, next)(null, {results})
  } catch (error) {
    return this.handleError(res, next)(error)
  }
}

Clients.prototype.validateDataObject = function(data = {}, requestingClient) {
  const isAdmin = model.isAdmin(requestingClient)
  const protectedDataFields = Object.keys(data).filter(key => {
    return key.indexOf('_') === 0
  })

  // If the request contains an update to protected data properties
  // (i.e. prefixed with an underscore) *and* the requesting client
  // is not an admin, we abort the operation.
  if (!isAdmin && protectedDataFields.length) {
    const error = new Error('PROTECTED_DATA_FIELDS')

    error.data = protectedDataFields

    return Promise.reject(error)
  }

  return Promise.resolve()
}

module.exports = server => new Clients(server)
