const acl = require('./../model/acl')
const model = require('./../model/acl/client')
const help = require('./../help')

acl.registerResource(
  'clients',
  'API clients'
)

const Clients = function (server) {
  server.app.routeMethods('/api/clients', {
    post: this.post.bind(this)
  })

  server.app.routeMethods('/api/clients/:clientId?', {
    delete: this.delete.bind(this),
    get: this.get.bind(this)
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

Clients.prototype.delete = function (req, res, next) {
  return acl.access.get(req.dadiApiClient, 'clients').then(access => {
    if (access.delete !== true) {
      return Promise.reject(
        acl.createError(req.dadiApiClient)
      )
    }

    return model.get(req.params.clientId)
  }).then(clients => {
    if (clients.results.length === 0) {
      return help.sendBackJSON(404, res, next)(null)
    }

    return model.delete(req.params.clientId)
  }).then(response => {
    help.sendBackJSON(204, res, next)(null, null)
  }).catch(this.handleError(res, next))
}

Clients.prototype.deleteResource = function (req, res, next) {
  // To remove a resource from a client, the requesting client
  // needs to have "update" access to the "clients" resource.
  return acl.access.get(req.dadiApiClient, 'clients').then(access => {
    if (access.update !== true) {
      return Promise.reject(
        acl.createError(req.dadiApiClient)
      )
    }

    return acl.access.get(req.dadiApiClient, req.params.resource)
  }).then(access => {
    if (
      access.create !== true ||
      access.delete !== true ||
      access.read !== true ||
      access.update !== true
    ) {
      return Promise.reject(
        acl.createError(req.dadiApiClient)
      )
    }
  }).then(() => {
    return model.resourceRemove(
      req.params.clientId,
      req.params.resource
    )
  }).then(({results}) => {
    help.sendBackJSON(204, res, next)(null, null)
  }).catch(this.handleError(res, next))
}

Clients.prototype.deleteRole = function (req, res, next) {
  let role = req.params.role

  // To remove a role from a client, the requesting client needs to have
  // "update" access to the "clients" resource, and have themselves the
  // role they're trying to remove.
  return acl.access.get(req.dadiApiClient, 'clients').then(access => {
    if (access.update !== true) {
      return Promise.reject(
        acl.createError(req.dadiApiClient)
      )
    }

    // If the client does not have admin access, we need to ensure that
    // they have the role they are trying to remove.
    if (!model.isAdmin(req.dadiApiClient)) {
      return model.get(req.dadiApiClient.clientId).then(({results}) => {
        let requestingClientHasRole = Boolean(
          results.find(dbRole => dbRole.name === role)
        )

        return requestingClientHasRole
      })
    }

    return true
  }).then(requestingClientHasRole => {
    if (!requestingClientHasRole) {
      return Promise.reject(
        acl.createError(req.dadiApiClient)
      )
    }

    return model.roleRemove(
      req.params.clientId,
      [role]
    )
  }).then(({removed, results}) => {
    if (removed.length === 0) {
      return help.sendBackJSON(404, res, next)(null)
    }

    help.sendBackJSON(200, res, next)(null, {results})
  }).catch(this.handleError(res, next))
}

Clients.prototype.get = function (req, res, next) {
  return acl.access.get(req.dadiApiClient, 'clients').then(access => {
    if (access.read !== true) {
      return Promise.reject(
        acl.createError(req.dadiApiClient)
      )
    }

    return model.get(req.params.clientId)
  }).then(clients => {
    if (req.params.clientId && (clients.results.length === 0)) {
      return help.sendBackJSON(404, res, next)(null, null)
    }

    let sanitisedClients = clients.results.map(client => {
      return model.sanitise(client)
    })

    help.sendBackJSON(200, res, next)(null, {
      results: sanitisedClients
    })
  }).catch(this.handleError(res, next))
}

Clients.prototype.handleError = function (res, next) {
  return err => {
    switch (err.message) {
      case 'FORBIDDEN':
      case 'UNAUTHORISED':
        return help.sendBackJSON(null, res, next)(err)

      case 'ACCESS_MATRIX_VALIDATION_FAILED':
        return help.sendBackJSON(400, res, next)(null, {
          success: false,
          errors: err.data
        })

      case 'CLIENT_DOES_NOT_HAVE_RESOURCE':
        return help.sendBackJSON(404, res, next)(null, null)

      case 'CLIENT_EXISTS':
        return help.sendBackJSON(409, res, next)(null, {
          success: false,
          errors: ['The client already exists']
        })

      case 'CLIENT_HAS_RESOURCE':
        return help.sendBackJSON(409, res, next)(null, {
          success: false,
          errors: ['The client already has access to resource']
        })

      case 'CLIENT_NOT_FOUND':
        return help.sendBackJSON(404, res, next)(null, null)

      case 'INVALID_FIELDS':
        return help.sendBackJSON(400, res, next)(null, {
          success: false,
          errors: err.data.map(field => `Invalid field: ${field}`)
        })

      case 'INVALID_ROLE':
        return help.sendBackJSON(400, res, next)(null, {
          success: false,
          errors: err.data.map(role => `Invalid role: ${role}`)
        })

      case 'MISSING_FIELDS':
        return help.sendBackJSON(400, res, next)(null, {
          success: false,
          errors: err.data.map(field => `Missing field: ${field}`)
        })

      default:
        return help.sendBackJSON(400, res, next)(null, {
          success: false,
          errors: ['Could not perform operation']
        })
    }
  }
}

Clients.prototype.post = function (req, res, next) {
  let {clientId, secret} = req.body || {}

  if (typeof clientId !== 'string' || typeof secret !== 'string') {
    return help.sendBackJSON(400, res, next)(null, {
      success: false,
      errors: ['Invalid input. Expected: {"clientId": String, "secret": String}']
    })
  }

  return acl.access.get(req.dadiApiClient, 'clients').then(access => {
    if (access.create !== true) {
      return Promise.reject(
        acl.createError(req.dadiApiClient)
      )
    }

    return model.create(req.body)
  }).then(({results}) => {
    help.sendBackJSON(201, res, next)(null, {
      results: [
        model.sanitise(results[0])
      ]
    })
  }).catch(this.handleError(res, next))
}

Clients.prototype.postResource = function (req, res, next) {
  if (
    typeof req.body.name !== 'string' ||
    typeof req.body.access !== 'object'
  ) {
    return help.sendBackJSON(400, res, next)(null, {
      success: false,
      errors: ['Invalid input. Expected: {"name": String, "access": Object}']
    })
  }

  if (!acl.hasResource(req.body.name)) {
    return help.sendBackJSON(400, res, next)(null, {
      success: false,
      errors: [`Invalid resource: ${req.body.name}`]
    })
  }

  // To add a resource to a client, the requesting client needs to have
  // "update" access to the "clients" resource, as well as access to the
  // resource in question.
  return acl.access.get(req.dadiApiClient, 'clients').then(access => {
    if (access.update !== true) {
      return Promise.reject(
        acl.createError(req.dadiApiClient)
      )
    }

    return acl.access.get(req.dadiApiClient, req.body.name).then(access => {
      let forbiddenType = Object.keys(req.body.access).find(type => {
        return access[type] !== true
      })

      if (forbiddenType) {
        return Promise.reject(
          acl.createError(req.dadiApiClient)
        )
      }

      return model.resourceAdd(
        req.params.clientId,
        req.body.name,
        req.body.access
      )
    })
  }).then(({results}) => {
    help.sendBackJSON(201, res, next)(null, {results})
  }).catch(this.handleError(res, next))
}

Clients.prototype.postRole = function (req, res, next) {
  let roles = req.body

  if (!Array.isArray(roles)) {
    return help.sendBackJSON(400, res, next)(null, {
      success: false,
      errors: ['Invalid input. Expecting array of roles.']
    })
  }

  // To add a role to a client, the requesting client needs to have
  // "update" access to the "clients" resource, and have themselves the
  // role they're trying to assign.
  return acl.access.get(req.dadiApiClient, 'clients').then(access => {
    if (access.update !== true) {
      return Promise.reject(
        acl.createError(req.dadiApiClient)
      )
    }

    // If the client does not have admin access, we need to ensure that
    // they have each of the roles they are trying to assign.
    if (!model.isAdmin(req.dadiApiClient)) {
      return model.get(req.dadiApiClient.clientId).then(({results}) => {
        let user = results[0]
        let forbiddenRoles = roles.filter(role => {
          return !user.roles || !user.roles.includes(role)
        })

        return forbiddenRoles
      })
    }

    return []
  }).then(forbiddenRoles => {
    if (forbiddenRoles.length > 0) {
      return Promise.reject(
        acl.createError(req.dadiApiClient)
      )
    }

    return model.roleAdd(req.params.clientId, roles)
  }).then(({results}) => {
    help.sendBackJSON(200, res, next)(null, {results})
  }).catch(this.handleError(res, next))
}

Clients.prototype.putResource = function (req, res, next) {
  if (
    typeof req.params.clientId !== 'string' ||
    typeof req.params.resource !== 'string' ||
    typeof req.body !== 'object'
  ) {
    return help.sendBackJSON(400, res, next)(null, {
      success: false,
      errors: ['Invalid input. Expected Object with access types (e.g. {"read": true, "update": false}']
    })
  }

  // To modify a resource in a client, the requesting client needs to have
  // "update" access to the "clients" resource, as well as access to the
  // resource in question.
  return acl.access.get(req.dadiApiClient, 'clients').then(access => {
    if (access.update !== true) {
      return Promise.reject(
        acl.createError(req.dadiApiClient)
      )
    }

    return acl.access.get(req.dadiApiClient, req.params.resource).then(access => {
      let forbiddenType = Object.keys(req.body).find(type => {
        return access[type] !== true
      })

      if (forbiddenType) {
        return Promise.reject(
          acl.createError(req.dadiApiClient)
        )
      }

      return model.resourceUpdate(
        req.params.clientId,
        req.params.resource,
        req.body
      )
    })
  }).then(({results}) => {
    help.sendBackJSON(200, res, next)(null, {results})
  }).catch(this.handleError(res, next))
}

module.exports = server => new Clients(server)
