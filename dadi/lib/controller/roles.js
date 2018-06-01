const acl = require('./../model/acl/index')
const model = require('./../model/acl/role')
const help = require('./../help')

const Roles = function (server) {
  server.app.routeMethods('/api/roles', {
    post: this.post.bind(this)
  })

  server.app.routeMethods('/api/roles/:role?', {
    delete: this.delete.bind(this),
    get: this.get.bind(this),
    put: this.put.bind(this)
  })

  server.app.routeMethods('/api/roles/:role/resources', {
    post: this.postResource.bind(this)
  })

  server.app.routeMethods('/api/roles/:role/resources/:resource', {
    delete: this.deleteResource.bind(this),
    put: this.putResource.bind(this)
  })
}

Roles.prototype.delete = function (req, res, next) {
  return model.get(req.params.role).then(roles => {
    if (roles.results.length === 0) {
      return help.sendBackJSON(404, res, next)(null)
    }

    return model.delete(req.params.role).then(response => {
      help.sendBackJSON(204, res, next)(null, null)
    })
  })
}

Roles.prototype.deleteResource = function (req, res, next) {
  return model.resourceRemove(
    req.params.role,
    req.params.resource
  ).then(({results}) => {
    help.sendBackJSON(204, res, next)(null, null)
  }).catch(this.handleError(res, next))
}

Roles.prototype.get = function (req, res, next) {
  let roleNames = typeof req.params.role === 'string'
    ? [req.params.role]
    : null

  return model.get(roleNames).then(roles => {
    if (req.params.role && (roles.results.length === 0)) {
      return help.sendBackJSON(404, res, next)(null)
    }

    help.sendBackJSON(200, res, next)(null, {
      results: roles.results.map(client => {
        return model.sanitise(client)
      })
    })
  })
}

Roles.prototype.handleError = function (res, next) {
  return err => {
    console.log('---> ERROR:', err)

    switch (err.message) {
      case 'ROLE_DOES_NOT_HAVE_RESOURCE':
        return help.sendBackJSON(404, res, next)(null, null)

      case 'ROLE_EXISTS':
        return help.sendBackJSON(409, res, next)(null, {
          success: false,
          errors: ['The role already exists']
        })

      case 'ROLE_HAS_RESOURCE':
        return help.sendBackJSON(409, res, next)(null, {
          success: false,
          errors: ['The role already has access to resource']
        })

      case 'ROLE_NOT_FOUND':
        return help.sendBackJSON(404, res, next)(null, null)

      case 'INVALID_PARENT_ROLE':
        return help.sendBackJSON(400, res, next)(null, {
          success: false,
          errors: ['The specified parent role does not exist']
        })

      default:
        return help.sendBackJSON(400, res, next)(null, {
          success: false,
          errors: ['Could not perform operation']
        })
    }
  }
}

Roles.prototype.post = function (req, res, next) {
  let role = req.body && req.body.name

  if (typeof role !== 'string') {
    return help.sendBackJSON(400, res, next)(null, {
      success: false,
      errors: ['Missing `name` property']
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

Roles.prototype.postResource = function (req, res, next) {
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
    req.params.role,
    req.body.resource,
    req.body.access
  ).then(({results}) => {
    help.sendBackJSON(201, res, next)(null, results)
  }).catch(this.handleError(res, next))
}

Roles.prototype.put = function (req, res, next) {
  if (
    typeof req.params.role !== 'string' ||
    typeof req.body !== 'object'
  ) {
    return help.sendBackJSON(400, res, next)(null, {
      success: false,
      errors: ['Invalid input']
    })
  }

  let update = req.body

  // Don't allow direct modification of resources. The RESTful
  // endpoints provided should be used for this effect.
  delete update.resources

  return model.update(req.params.role, req.body).then(({results}) => {
    help.sendBackJSON(200, res, next)(null, {
      results: [
        model.sanitise(results[0])
      ]
    })
  }).catch(this.handleError(res, next))
}

Roles.prototype.putResource = function (req, res, next) {
  if (
    typeof req.params.role !== 'string' ||
    typeof req.params.resource !== 'string' ||
    typeof req.body !== 'object'
  ) {
    return help.sendBackJSON(400, res, next)(null, {
      success: false,
      errors: ['Invalid input']
    })
  }

  return model.resourceUpdate(
    req.params.role,
    req.params.resource,
    req.body
  ).then(({results}) => {
    help.sendBackJSON(200, res, next)(null, results)
  }).catch(this.handleError(res, next))
}

module.exports = server => new Roles(server)
