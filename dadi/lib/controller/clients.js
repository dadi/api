const acl = require('./../model/acl')
const model = require('./../model/acl/client')
const help = require('./../help')

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
      return help.sendBackJSON(null, res, next)(
        acl.createError(req.dadiApiClient)
      )
    }

    return model.get(req.params.clientId)
  }).then(clients => {
    if (clients.results.length === 0) {
      return help.sendBackJSON(404, res, next)(null)
    }

    return model.delete(req.params.clientId).then(response => {
      help.sendBackJSON(204, res, next)(null, null)
    })
  })
}

Clients.prototype.deleteResource = function (req, res, next) {
  return model.resourceRemove(
    req.params.clientId,
    req.params.resource
  ).then(({results}) => {
    help.sendBackJSON(204, res, next)(null, null)
  }).catch(this.handleError(res, next))
}

Clients.prototype.deleteRole = function (req, res, next) {
  return model.roleRemove(
    req.params.clientId,
    [req.params.role]
  ).then(({results}) => {
    help.sendBackJSON(201, res, next)(null, results)
  }).catch(this.handleError(res, next))
}

Clients.prototype.get = function (req, res, next) {
  return model.get(req.params.clientId).then(clients => {
    console.log('---> CLIENTS:', clients)
    if (req.params.clientId && (clients.results.length === 0)) {
      return help.sendBackJSON(404, res, next)(null)
    }

    let sanitisedClients = clients.results.map(client => {
      return model.sanitise(client)
    })

    help.sendBackJSON(200, res, next)(null, {
      results: sanitisedClients
    })
  })
}

Clients.prototype.handleError = function (res, next) {
  return err => {
    console.log('---> ERROR:', err)

    switch (err.message) {
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
  let clientId = req.body && req.body.clientId

  if (typeof clientId !== 'string') {
    return help.sendBackJSON(400, res, next)(null, {
      success: false,
      message: 'Invalid input. No client ID.'
    })
  }

  if (typeof req.body.resources === 'object') {
    let errors = Object.keys(req.body.resources).filter(resource => {
      return !acl.hasResource(resource)
    })

    if (errors.length > 0) {
      let messages = errors.map(resource => `Invalid resource: ${resource}`)

      return help.sendBackJSON(400, res, next)(null, {
        success: false,
        errors: messages
      })
    }
  }

  return model.create(req.body).then(({results}) => {
    help.sendBackJSON(201, res, next)(null, {
      results: [
        model.sanitise(results[0])
      ]
    })
  }).catch(this.handleError(res, next))
}

Clients.prototype.postResource = function (req, res, next) {
  if (
    typeof req.body.resource !== 'string' ||
    typeof req.body.access !== 'object'
  ) {
    return help.sendBackJSON(400, res, next)(null, {
      success: false,
      errors: ['Invalid input']
    })
  }

  if (!acl.hasResource(req.body.resource)) {
    return help.sendBackJSON(400, res, next)(null, {
      success: false,
      errors: [`Invalid resource: ${req.body.resource}`]
    })
  }

  return model.resourceAdd(
    req.params.clientId,
    req.body.resource,
    req.body.access
  ).then(({results}) => {
    help.sendBackJSON(201, res, next)(null, results)
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

  return model.roleAdd(req.params.clientId, roles).then(({results}) => {
    help.sendBackJSON(201, res, next)(null, results)
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
      errors: ['Invalid input']
    })
  }

  return model.resourceUpdate(
    req.params.clientId,
    req.params.resource,
    req.body
  ).then(({results}) => {
    help.sendBackJSON(200, res, next)(null, results)
  }).catch(this.handleError(res, next))
}

module.exports = server => new Clients(server)
