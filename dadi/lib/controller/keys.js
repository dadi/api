const acl = require('../model/acl/index')
const help = require('../help')
const model = require('../model/acl/key')
const Validator = require('@dadi/api-validator')

const validator = new Validator()

const Keys = function(server) {
  acl.registerResource('keys', 'API access keys')

  server.app.routeMethods(['/api/keys', '/api/clients/:clientId/keys'], {
    get: this.get.bind(this),
    post: this.post.bind(this)
  })

  server.app.routeMethods(
    ['/api/keys/:keyId', '/api/clients/:clientId/keys/:keyId'],
    {
      delete: this.delete.bind(this)
    }
  )

  server.app.routeMethods(
    [
      '/api/keys/:keyId/resources',
      '/api/clients/:clientId/keys/:keyId/resources'
    ],
    {
      post: this.postResource.bind(this)
    }
  )

  server.app.routeMethods(
    [
      '/api/keys/:keyId/resources/:resourceName',
      '/api/clients/:clientId/keys/:keyId/resources/:resourceName'
    ],
    {
      delete: this.deleteResource.bind(this),
      put: this.putResource.bind(this)
    }
  )
}

Keys.prototype.delete = async function(req, res, next) {
  try {
    const {clientId, keyId} = req.params
    const isAdmin = acl.client.isAdmin(req.dadiApiClient)

    // We throw an ACL error if a non-admin client is trying to access a client
    // token that doesn't belong to them.
    if (clientId && !isAdmin && clientId !== req.dadiApiClient.clientId) {
      return Promise.reject(acl.createError(req.dadiApiClient))
    }

    const filter = clientId ? {client: clientId} : {}

    // If the client is not an admin, they can only delete keys that have been
    // created by them.
    if (!isAdmin && !clientId) {
      filter._createdBy = req.dadiApiClient.clientId
    }

    const {deletedCount} = await model.delete(keyId, filter)

    if (deletedCount === 0) {
      return help.sendBackJSON(404, res, next)(null, null)
    }

    help.sendBackJSON(204, res, next)(null, null)
  } catch (error) {
    return this.handleError(res, next)(error)
  }
}

Keys.prototype.deleteResource = async function(req, res, next) {
  try {
    const query = {_id: req.params.keyId}
    const linkedClient = await this.getKeyClient(req)

    // If the client is not an admin, they can only operate on keys that
    // were created by or for themselves.
    if (!acl.client.isAdmin(req.dadiApiClient)) {
      if (linkedClient) {
        query.client = linkedClient.clientId
      } else {
        query._createdBy = req.dadiApiClient.clientId
      }
    }

    await model.resourceRemove(query, req.params.resourceName)

    return help.sendBackJSON(204, res, next)(null, null)
  } catch (error) {
    return this.handleError(res, next)(error)
  }
}

Keys.prototype.get = async function(req, res, next) {
  try {
    await this.getKeyClient(req)

    const {clientId} = req.params
    const isAdmin = acl.client.isAdmin(req.dadiApiClient)
    const query = clientId ? {client: clientId} : {}

    // If the client is not an admin, they can only see the keys that have
    // been created by them.
    if (!isAdmin && !clientId) {
      query._createdBy = req.dadiApiClient.clientId
    }

    const keys = await model.get(query)

    help.sendBackJSON(200, res, next)(null, {
      results: keys.map(model.formatForOutput)
    })
  } catch (error) {
    return this.handleError(res, next)(error)
  }
}

Keys.prototype.getKeyClient = async function(req) {
  const {clientId} = req.params

  if (clientId && clientId !== req.dadiApiClient.clientId) {
    if (acl.client.isAdmin(req.dadiApiClient)) {
      const {results} = await acl.client.get(clientId)

      if (results.length === 0) {
        throw new Error('CLIENT_NOT_FOUND')
      }

      return results[0]
    } else {
      throw new Error('CLIENT_NOT_FOUND')
    }
  }
}

Keys.prototype.handleError = function(res, next) {
  return err => {
    console.log(err)
    switch (err.message) {
      case 'CLIENT_NOT_FOUND':
      case 'KEY_NOT_FOUND':
        return help.sendBackJSON(404, res, next)(null, null)

      case 'FORBIDDEN':
      case 'UNAUTHORISED':
        return help.sendBackJSON(null, res, next)(err)

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

Keys.prototype.post = async function(req, res, next) {
  try {
    const key = req.body
    const linkedClient = await this.getKeyClient(req)

    if (key.resources) {
      await acl.validateResourcesObject(key.resources, req.dadiApiClient)
    }

    key._createdBy = req.dadiApiClient.clientId

    const result = await model.create(key, linkedClient)

    help.sendBackJSON(200, res, next)(null, {
      results: [model.formatForOutput(result)]
    })
  } catch (error) {
    return this.handleError(res, next)(error)
  }
}

Keys.prototype.postResource = async function(req, res, next) {
  const {access: resourceAccess, name: resourceName} = req.body

  try {
    await validator.validateDocument({
      document: req.body,
      schema: {
        name: {
          required: true,
          type: 'string'
        },
        access: {
          required: true,
          type: 'object'
        }
      }
    })

    validator.validateAccessMatrix(resourceAccess, 'access')
  } catch (errors) {
    return help.sendBackJSON(400, res, next)(null, {
      success: false,
      errors
    })
  }

  const query = {_id: req.params.keyId}

  try {
    const linkedClient = await this.getKeyClient(req)

    // If the client does not have admin access, we need to ensure that
    // they have access to the resource they are trying to assign, with
    // each of the access types they are trying to set.
    if (!acl.client.isAdmin(req.dadiApiClient)) {
      const access = await acl.access.get(req.dadiApiClient, resourceName)
      const forbiddenType = Object.keys(resourceAccess).find(type => {
        return access[type] !== true
      })

      if (forbiddenType) {
        throw acl.createError(req.dadiApiClient)
      }

      // If the client is not an admin, they can only operate on keys that
      // were created by or for themselves.
      if (linkedClient) {
        query.client = linkedClient.clientId
      } else {
        query._createdBy = req.dadiApiClient.clientId
      }
    }

    if (resourceName && !acl.hasResource(resourceName)) {
      return help.sendBackJSON(400, res, next)(null, {
        success: false,
        errors: [
          {
            code: 'INVALID_RESOURCE',
            field: resourceName,
            message: 'is not a valid resource'
          }
        ]
      })
    }

    const {results} = await model.resourceAdd(
      query,
      resourceName,
      resourceAccess
    )

    return help.sendBackJSON(201, res, next)(null, {results})
  } catch (error) {
    return this.handleError(res, next)(error)
  }
}

Keys.prototype.putResource = async function(req, res, next) {
  const query = {_id: req.params.keyId}

  try {
    const linkedClient = await this.getKeyClient(req)

    // If the client does not have admin access, we need to ensure that
    // they have access to the resource they are trying to modify, with
    // each of the access types they are trying to set.
    if (!acl.client.isAdmin(req.dadiApiClient)) {
      const resourceAccess = await acl.access.get(
        req.dadiApiClient,
        resourceName
      )
      const forbiddenType = Object.keys(resourceAccess).find(type => {
        return resourceAccess[type] !== true
      })

      if (forbiddenType) {
        throw acl.createError(req.dadiApiClient)
      }

      // If the client is not an admin, they can only operate on keys that
      // were created by or for themselves.
      if (linkedClient) {
        query.client = linkedClient.clientId
      } else {
        query._createdBy = req.dadiApiClient.clientId
      }
    }

    const {results} = await model.resourceUpdate(
      query,
      req.params.resourceName,
      req.body
    )

    return help.sendBackJSON(200, res, next)(null, {results})
  } catch (error) {
    return this.handleError(res, next)(error)
  }
}

module.exports = server => new Keys(server)
