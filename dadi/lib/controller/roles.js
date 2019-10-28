const acl = require('./../model/acl/index')
const help = require('./../help')

const Roles = function(server) {
  acl.registerResource('roles', 'API roles')

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

Roles.prototype.delete = async function(req, res, next) {
  try {
    const rolesAccess = await acl.access.get(req.dadiApiClient, 'roles')

    if (rolesAccess.delete !== true) {
      throw acl.createError(req.dadiApiClient)
    }

    // If the requesting client isn't an admin, we need to ensure they
    // have access to the role they are trying to delete.
    if (!acl.client.isAdmin(req.dadiApiClient)) {
      const {results} = await acl.client.get({
        clientId: req.dadiApiClient.clientId
      })
      const clientRoles = results[0].roles || []

      if (!clientRoles.includes(req.params.role)) {
        throw acl.createError(req.dadiApiClient)
      }
    }

    const {results: roles} = await acl.role.get(req.params.role)

    if (roles.length === 0) {
      throw new Error('ROLE_NOT_FOUND')
    }

    await acl.role.delete(req.params.role)

    return help.sendBackJSON(204, res, next)(null, null)
  } catch (error) {
    return this.handleError(res, next)(error)
  }
}

Roles.prototype.deleteResource = async function(req, res, next) {
  try {
    // To remove a resource from a role, the requesting client
    // needs to have "update" access to the "roles" resource
    // as well as full access to the given resource.
    const rolesAccess = await acl.access.get(req.dadiApiClient, 'roles')

    if (rolesAccess.update !== true) {
      throw acl.createError(req.dadiApiClient)
    }

    if (!acl.client.isAdmin(req.dadiApiClient)) {
      const resourceAccess = await acl.access.get(
        req.dadiApiClient,
        req.params.resource,
        {
          resolveOwnTypes: false
        }
      )

      if (
        resourceAccess.create !== true ||
        resourceAccess.delete !== true ||
        resourceAccess.read !== true ||
        resourceAccess.update !== true
      ) {
        throw acl.createError(req.dadiApiClient)
      }

      const {results: clients} = await acl.client.get({
        clientId: req.dadiApiClient.clientId
      })
      const roles = clients[0].roles || []

      if (!roles.includes(req.params.role)) {
        throw acl.createError(req.dadiApiClient)
      }
    }

    await acl.role.resourceRemove(req.params.role, req.params.resource)

    return help.sendBackJSON(204, res, next)(null, null)
  } catch (error) {
    return this.handleError(res, next)(error)
  }
}

Roles.prototype.get = async function(req, res, next) {
  try {
    const roleNames =
      typeof req.params.role === 'string' ? [req.params.role] : null
    const rolesAccess = await acl.access.get(req.dadiApiClient, 'roles')

    if (rolesAccess.read !== true) {
      throw acl.createError(req.dadiApiClient)
    }

    const {results: roles} = await acl.role.get(roleNames)

    if (req.params.role && roles.length === 0) {
      throw new Error('ROLE_NOT_FOUND')
    }

    return help.sendBackJSON(200, res, next)(null, {
      results: roles
        .map(client => {
          return acl.role.formatForOutput(client)
        })
        .sort((a, b) => {
          return a.name < b.name ? -1 : 1
        })
    })
  } catch (error) {
    return this.handleError(res, next)(error)
  }
}

Roles.prototype.handleError = function(res, next) {
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
          errors: [
            {
              code: 'ERROR_ROLE_EXISTS',
              field: err.data,
              message: 'already exists'
            }
          ]
        })

      case 'ROLE_HAS_RESOURCE':
        return help.sendBackJSON(409, res, next)(null, {
          success: false,
          errors: [
            {
              code: 'ERROR_ROLE_HAS_RESOURCE',
              field: err.data,
              message: 'is already assigned to the role'
            }
          ]
        })

      case 'ROLE_NOT_FOUND':
        return help.sendBackJSON(404, res, next)(null, null)

      case 'VALIDATION_ERROR':
        return help.sendBackJSON(400, res, next)(null, {
          success: false,
          errors: err.data
        })

      default:
        return help.sendBackJSON(400, res, next)(null, {
          success: false
        })
    }
  }
}

Roles.prototype.post = async function(req, res, next) {
  try {
    const role = req.body
    const rolesAccess = await acl.access.get(req.dadiApiClient, 'roles')

    if (rolesAccess.create !== true) {
      throw acl.createError(req.dadiApiClient)
    }

    // If there is a role being extended and the requesting client does
    // not have admin access, we need to ensure they have the role in
    // question *or* some other role that extends it.
    if (role.extends && !acl.client.isAdmin(req.dadiApiClient)) {
      const roles = await acl.access.getClientRoles(req.dadiApiClient.clientId)

      if (!roles.includes(role.extends)) {
        throw acl.createError(req.dadiApiClient)
      }
    }

    if (role.resources) {
      await acl.validateResourcesObject(role.resources, req.dadiApiClient)
    }

    const {results} = await acl.role.create(role)

    return help.sendBackJSON(201, res, next)(null, {
      results: [acl.role.formatForOutput(results[0])]
    })
  } catch (error) {
    return this.handleError(res, next)(error)
  }
}

Roles.prototype.postResource = async function(req, res, next) {
  try {
    const {access: resourceAccess, name: resourceName} = req.body

    if (resourceName && !acl.hasResource(resourceName)) {
      const error = new Error('VALIDATION_ERROR')

      error.data = [
        {
          code: 'ERROR_INVALID_RESOURCE',
          field: 'name',
          message: 'is not a valid resource'
        }
      ]

      throw error
    }

    // To add a resource to a role, the requesting client needs to have
    // "update" access to the "roles" resource, access to the role being
    // updated as well as access to the resource in question.
    const rolesAccess = await acl.access.get(req.dadiApiClient, 'roles')

    if (rolesAccess.update !== true) {
      throw acl.createError(req.dadiApiClient)
    }

    if (!acl.client.isAdmin(req.dadiApiClient)) {
      const access = await acl.access.get(req.dadiApiClient, resourceName, {
        resolveOwnTypes: false
      })
      const forbiddenType = Object.keys(resourceAccess).find(type => {
        return Boolean(resourceAccess[type]) && access[type] !== true
      })

      if (forbiddenType) {
        throw acl.createError(req.dadiApiClient)
      }

      const {results} = await acl.client.get({
        clientId: req.dadiApiClient.clientId
      })
      const roles = results[0].roles || []

      if (!roles.includes(req.params.role)) {
        throw acl.createError(req.dadiApiClient)
      }
    }

    const {results} = await acl.role.resourceAdd(
      req.params.role,
      resourceName,
      resourceAccess
    )

    return help.sendBackJSON(201, res, next)(null, {results})
  } catch (error) {
    return this.handleError(res, next)(error)
  }
}

Roles.prototype.put = async function(req, res, next) {
  try {
    if (req.body.name !== undefined && req.body.name !== req.params.role) {
      const error = new Error('VALIDATION_ERROR')

      error.data = [
        {
          code: 'ERROR_INVALID_FIELD',
          field: 'name',
          message: 'cannot be updated'
        }
      ]

      throw error
    }

    const rolesAccess = await acl.access.get(req.dadiApiClient, 'roles')

    if (rolesAccess.update !== true) {
      throw acl.createError(req.dadiApiClient)
    }

    // We need to ensure the requesting client has access to the role
    // being updated as well as to any role being extended after the
    // update.
    if (!acl.client.isAdmin(req.dadiApiClient)) {
      const roles = await acl.access.getClientRoles(req.dadiApiClient.clientId)

      if (
        !roles.includes(req.params.role) ||
        (req.body.extends && !roles.includes(req.body.extends))
      ) {
        throw acl.createError(req.dadiApiClient)
      }
    }

    const {results} = await acl.role.update(req.params.role, req.body)

    return help.sendBackJSON(200, res, next)(null, {
      results: [acl.role.formatForOutput(results[0])]
    })
  } catch (error) {
    return this.handleError(res, next)(error)
  }
}

Roles.prototype.putResource = async function(req, res, next) {
  if (
    typeof req.params.role !== 'string' ||
    typeof req.params.resource !== 'string' ||
    typeof req.body !== 'object'
  ) {
    return help.sendBackJSON(400, res, next)(null, {
      success: false,
      errors: [
        'Invalid input. Expected Object with access types (e.g. {"read": true, "update": false}'
      ]
    })
  }

  try {
    // To update a resource on a role, the requesting client needs to have
    // "update" access to the "roles" resource, access to the role being
    // updated as well as access to the resource in question.
    const rolesAccess = await acl.access.get(req.dadiApiClient, 'roles')

    if (rolesAccess.update !== true) {
      throw acl.createError(req.dadiApiClient)
    }

    if (!acl.client.isAdmin(req.dadiApiClient)) {
      const resourceAccess = await acl.access.get(
        req.dadiApiClient,
        req.params.resource,
        {
          resolveOwnTypes: false
        }
      )
      const forbiddenType = Object.keys(req.body).find(type => {
        return resourceAccess[type] !== true
      })

      if (forbiddenType) {
        throw acl.createError(req.dadiApiClient)
      }

      const {results: clients} = await acl.client.get({
        clientId: req.dadiApiClient.clientId
      })
      const roles = clients[0].roles || []

      if (!roles.includes(req.params.role)) {
        throw acl.createError(req.dadiApiClient)
      }
    }

    const {results} = await acl.role.resourceUpdate(
      req.params.role,
      req.params.resource,
      req.body
    )

    return help.sendBackJSON(200, res, next)(null, {results})
  } catch (error) {
    return this.handleError(res, next)(error)
  }
}

module.exports = server => new Roles(server)
