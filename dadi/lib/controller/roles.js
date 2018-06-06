const acl = require('./../model/acl/index')
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
  return acl.access.get(req.dadiApiClient, 'roles').then(access => {
    if (access.delete !== true) {
      return Promise.reject(
        acl.createError(req.dadiApiClient)
      )
    }

    // If the requesting client isn't an admin, we need to ensure they
    // have access to the role they are trying to delete.
    if (!acl.client.isAdmin(req.dadiApiClient)) {
      return acl.client.get(req.dadiApiClient.clientId).then(({results}) => {
        let clientRoles = results[0].roles || []

        if (!clientRoles.includes(req.params.role)) {
          return Promise.reject(
            acl.createError(req.dadiApiClient)
          )
        }
      })
    }
  }).then(() => {
    return acl.role.get(req.params.role)
  }).then(roles => {
    if (roles.results.length === 0) {
      return Promise.reject(
        new Error('ROLE_NOT_FOUND')
      )
    }

    return acl.role.delete(req.params.role)
  }).then(response => {
    help.sendBackJSON(204, res, next)(null, null)
  }).catch(this.handleError(res, next))
}

Roles.prototype.deleteResource = function (req, res, next) {
  // To remove a resource from a role, the requesting client
  // needs to have "update" access to the "roles" resource
  // as well as full access to the given resource.
  return acl.access.get(req.dadiApiClient, 'roles').then(access => {
    if (access.update !== true) {
      return Promise.reject(
        acl.createError(req.dadiApiClient)
      )
    }

    if (!acl.client.isAdmin(req.dadiApiClient)) {
      return acl.access.get(req.dadiApiClient, req.params.resource, {
        resolveOwnTypes: false
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

        return acl.client.get(req.dadiApiClient.clientId).then(({results}) => {
          let roles = results[0].roles || []

          if (!roles.includes(req.params.role)) {
            return Promise.reject(
              acl.createError(req.dadiApiClient)
            )
          }
        })
      })
    }
  }).then(() => {
    return acl.role.resourceRemove(
      req.params.role,
      req.params.resource
    )
  }).then(({results}) => {
    help.sendBackJSON(204, res, next)(null, null)
  }).catch(this.handleError(res, next))
}

Roles.prototype.get = function (req, res, next) {
  let roleNames = typeof req.params.role === 'string'
    ? [req.params.role]
    : null

  return acl.access.get(req.dadiApiClient, 'roles').then(access => {
    if (access.read !== true) {
      return Promise.reject(
        acl.createError(req.dadiApiClient)
      )
    }

    return acl.role.get(roleNames)
  }).then(roles => {
    if (req.params.role && (roles.results.length === 0)) {
      return Promise.reject(
        new Error('ROLE_NOT_FOUND')
      )
    }

    help.sendBackJSON(200, res, next)(null, {
      results: roles.results.map(client => {
        return acl.role.sanitise(client)
      }).sort((a, b) => {
        return a.name < b.name
          ? -1
          : 1
      })
    })
  }).catch(this.handleError(res, next))
}

Roles.prototype.handleError = function (res, next) {
  return err => {
    switch (err.message) {
      case 'FORBIDDEN':
      case 'UNAUTHORISED':
        return help.sendBackJSON(null, res, next)(err)

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
  if (typeof req.body.name !== 'string') {
    return help.sendBackJSON(400, res, next)(null, {
      success: false,
      errors: ['Invalid input. Expected: {"name": String}']
    })
  }

  return acl.access.get(req.dadiApiClient, 'roles').then(access => {
    if (access.create !== true) {
      return Promise.reject(
        acl.createError(req.dadiApiClient)
      )
    }

    // If there is a role being extended and the requesting client does
    // not have admin access, we need to ensure they have the role in
    // question *or* some other role that extends it.
    if (req.body.extends && !acl.client.isAdmin(req.dadiApiClient)) {
      return acl.access.getClientRoles(req.dadiApiClient.clientId).then(roles => {
        if (!roles.includes(req.body.extends)) {
          return Promise.reject(
            acl.createError(req.dadiApiClient)
          )
        }
      })
    }
  }).then(() => {
    return acl.role.create(req.body)
  }).then(({results}) => {
    help.sendBackJSON(201, res, next)(null, {
      results: [
        acl.role.sanitise(results[0])
      ]
    })
  }).catch(this.handleError(res, next))
}

Roles.prototype.postResource = function (req, res, next) {
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

  // To add a resource to a role, the requesting client needs to have
  // "update" access to the "roles" resource, access to the role being
  // updated as well as access to the resource in question.
  return acl.access.get(req.dadiApiClient, 'roles').then(access => {
    if (access.update !== true) {
      return Promise.reject(
        acl.createError(req.dadiApiClient)
      )
    }

    if (!acl.client.isAdmin(req.dadiApiClient)) {
      return acl.access.get(req.dadiApiClient, req.body.name, {
        resolveOwnTypes: false
      }).then(access => {
        let forbiddenType = Object.keys(req.body.access).find(type => {
          return Boolean(req.body.access[type]) && access[type] !== true
        })

        if (forbiddenType) {
          return Promise.reject(
            acl.createError(req.dadiApiClient)
          )
        }

        return acl.client.get(req.dadiApiClient.clientId).then(({results}) => {
          let roles = results[0].roles || []

          if (!roles.includes(req.params.role)) {
            return Promise.reject(
              acl.createError(req.dadiApiClient)
            )
          }
        })
      })
    }
  }).then(() => {
    return acl.role.resourceAdd(
      req.params.role,
      req.body.name,
      req.body.access
    )
  }).then(({results}) => {
    help.sendBackJSON(201, res, next)(null, {results})
  }).catch(this.handleError(res, next))
}

Roles.prototype.put = function (req, res, next) {
  if (
    typeof req.params.role !== 'string' ||
    typeof req.body !== 'object'
  ) {
    return help.sendBackJSON(400, res, next)(null, {
      success: false,
      errors: ['Invalid input. Expected: {"extends": String|null}']
    })
  }

  if ((req.body.name !== undefined) && (req.body.name !== req.params.role)) {
    return help.sendBackJSON(400, res, next)(null, {
      success: false,
      errors: ['Role names cannot be changed']
    })
  }

  return acl.access.get(req.dadiApiClient, 'roles').then(access => {
    if (access.update !== true) {
      return Promise.reject(
        acl.createError(req.dadiApiClient)
      )
    }

    // We need to ensure the requesting client has access to the role
    // being updated as well as to any role being extended after the
    // update.
    if (!acl.client.isAdmin(req.dadiApiClient)) {
      return acl.access.getClientRoles(req.dadiApiClient.clientId).then(roles => {
        if (
          !roles.includes(req.params.role) ||
          (req.body.extends && !roles.includes(req.body.extends))
        ) {
          return Promise.reject(
            acl.createError(req.dadiApiClient)
          )
        }
      })
    }
  }).then(() => {
    return acl.role.update(req.params.role, req.body)
  }).then(({results}) => {
    help.sendBackJSON(200, res, next)(null, {
      results: [
        acl.role.sanitise(results[0])
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
      errors: ['Invalid input. Expected Object with access types (e.g. {"read": true, "update": false}']
    })
  }

  // To update a resource on a role, the requesting client needs to have
  // "update" access to the "roles" resource, access to the role being
  // updated as well as access to the resource in question.
  return acl.access.get(req.dadiApiClient, 'roles').then(access => {
    if (access.update !== true) {
      return Promise.reject(
        acl.createError(req.dadiApiClient)
      )
    }

    if (!acl.client.isAdmin(req.dadiApiClient)) {
      return acl.access.get(req.dadiApiClient, req.params.resource, {
        resolveOwnTypes: false
      }).then(access => {
        let forbiddenType = Object.keys(req.body).find(type => {
          return access[type] !== true
        })

        if (forbiddenType) {
          return Promise.reject(
            acl.createError(req.dadiApiClient)
          )
        }

        return acl.client.get(req.dadiApiClient.clientId).then(({results}) => {
          let roles = results[0].roles || []

          if (!roles.includes(req.params.role)) {
            return Promise.reject(
              acl.createError(req.dadiApiClient)
            )
          }
        })
      })
    }
  }).then(() => {
    return acl.role.resourceUpdate(
      req.params.role,
      req.params.resource,
      req.body
    )
  }).then(({results}) => {
    help.sendBackJSON(200, res, next)(null, {results})
  }).catch(this.handleError(res, next))
}

module.exports = server => new Roles(server)
