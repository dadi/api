const acl = require('../model/acl/index')
const help = require('../help')
const model = require('../model/acl/key')
const Validator = require('@dadi/api-validator')

const validator = new Validator()

const Keys = function(server) {
  acl.registerResource('keys', 'API access keys')

  server.app.use(this.addKeyClientToRequest.bind(this))

  server.app.routeMethods(['/api/keys', '/api/clients/:clientId/keys'], {
    get: this.get.bind(this, {}),
    post: this.post.bind(this, {})
  })

  server.app.routeMethods('/api/client/keys', {
    get: this.get.bind(this, {isClientEndpoint: true}),
    post: this.post.bind(this, {isClientEndpoint: true})
  })

  server.app.routeMethods(
    ['/api/keys/:keyId', '/api/clients/:clientId/keys/:keyId'],
    {
      delete: this.delete.bind(this, {})
    }
  )

  server.app.routeMethods('/api/client/keys/:keyId', {
    delete: this.delete.bind(this, {isClientEndpoint: true})
  })

  server.app.routeMethods(
    [
      '/api/keys/:keyId/resources',
      '/api/clients/:clientId/keys/:keyId/resources'
    ],
    {
      post: this.postResource.bind(this, {})
    }
  )

  server.app.routeMethods('/api/client/keys/:keyId/resources', {
    post: this.postResource.bind(this, {isClientEndpoint: true})
  })

  server.app.routeMethods(
    [
      '/api/keys/:keyId/resources/:resourceName',
      '/api/clients/:clientId/keys/:keyId/resources/:resourceName'
    ],
    {
      delete: this.deleteResource.bind(this, {}),
      put: this.putResource.bind(this, {})
    }
  )

  server.app.routeMethods('/api/client/keys/:keyId/resources/:resourceName', {
    delete: this.deleteResource.bind(this, {isClientEndpoint: true}),
    put: this.putResource.bind(this, {isClientEndpoint: true})
  })
}

Keys.prototype.addKeyClientToRequest = async function(req, _, next) {
  const {accessType, token} = req.dadiApiClient || {}

  if (accessType === 'key' && typeof token === 'string') {
    try {
      const {results} = await acl.access.keyAccessModel.find({
        options: {
          fields: {
            client: 1,
            clientAccessType: 1
          },
          limit: 1
        },
        query: {
          key: token
        }
      })
      const [key] = results

      if (key) {
        req.dadiApiClient.isAccessKey = true

        if (key.client) {
          req.dadiApiClient.clientId = key.client
          req.dadiApiClient.accessType = key.clientAccessType
        }
      }
    } catch (_) {
      // no-op
    }
  }

  next()
}

Keys.prototype.delete = async function({isClientEndpoint}, req, res, next) {
  try {
    const {keyId} = req.params
    const {clientId, isAdmin} = this.validateKeyAccess(req, isClientEndpoint)
    const filter = clientId ? {client: clientId} : {}

    // If the client is not an admin, they can only delete keys that have been
    // created by them.
    if (!isAdmin && !req.params.clientId) {
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

Keys.prototype.deleteResource = async function(
  {isClientEndpoint},
  req,
  res,
  next
) {
  try {
    const query = {_id: req.params.keyId}
    const {clientId, isAdmin} = this.validateKeyAccess(req, isClientEndpoint)

    // If the client is not an admin, they can only operate on keys that
    // were created by or for themselves.
    if (!isAdmin) {
      if (clientId) {
        query.client = clientId
      } else {
        query._createdBy = req.dadiApiClient.clientId
      }
    } else if (isClientEndpoint) {
      query.client = req.dadiApiClient.clientId
    }

    await model.resourceRemove(query, req.params.resourceName)

    return help.sendBackJSON(204, res, next)(null, null)
  } catch (error) {
    return this.handleError(res, next)(error)
  }
}

Keys.prototype.get = async function({isClientEndpoint}, req, res, next) {
  try {
    const {clientId, isAdmin} = this.validateKeyAccess(req, isClientEndpoint)
    const query = clientId ? {client: clientId} : {}

    // If the client is accessing the /api/client endpoint, the query must
    // only show keys associated with the client. Also, if the client is not
    // an admin, they can only see the keys that have been created by them.
    if (isClientEndpoint) {
      query.client = req.dadiApiClient.clientId
    } else if (!isAdmin && !clientId) {
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

Keys.prototype.handleError = function(res, next) {
  return err => {
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

Keys.prototype.post = async function({isClientEndpoint}, req, res, next) {
  try {
    const {clientId} = this.validateKeyAccess(req, isClientEndpoint)
    const key = req.body

    if (key.resources) {
      await acl.validateResourcesObject(key.resources, req.dadiApiClient)
    }

    key._createdBy = req.dadiApiClient.clientId

    const result = await model.create(key, clientId)

    help.sendBackJSON(200, res, next)(null, {
      results: [
        model.formatForOutput(result, {
          obfuscateKey: false
        })
      ]
    })
  } catch (error) {
    return this.handleError(res, next)(error)
  }
}

Keys.prototype.postResource = async function(
  {isClientEndpoint},
  req,
  res,
  next
) {
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
    const {clientId, isAdmin} = this.validateKeyAccess(req, isClientEndpoint)

    // If the client does not have admin access, we need to ensure that
    // they have access to the resource they are trying to assign, with
    // each of the access types they are trying to set.
    if (!isAdmin) {
      const access = await acl.access.get(req.dadiApiClient, resourceName)
      const forbiddenType = Object.keys(resourceAccess).find(type => {
        return access[type] !== true
      })

      if (forbiddenType) {
        throw acl.createError(req.dadiApiClient)
      }

      // If the client is not an admin, they can only operate on keys that
      // were created by or for themselves.
      if (clientId) {
        query.client = clientId
      } else {
        query._createdBy = req.dadiApiClient.clientId
      }
    } else if (isClientEndpoint) {
      query.client = req.dadiApiClient.clientId
    }

    if (resourceName && !acl.hasResource(resourceName)) {
      return help.sendBackJSON(400, res, next)(null, {
        success: false,
        errors: [
          {
            code: 'ERROR_INVALID_RESOURCE',
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

Keys.prototype.putResource = async function(
  {isClientEndpoint},
  req,
  res,
  next
) {
  const {keyId, resourceName} = req.params
  const query = {_id: keyId}

  try {
    const {clientId, isAdmin} = this.validateKeyAccess(req, isClientEndpoint)

    // If the client does not have admin access, we need to ensure that
    // they have access to the resource they are trying to modify, with
    // each of the access types they are trying to set.
    if (!isAdmin) {
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
      if (clientId) {
        query.client = clientId
      } else {
        query._createdBy = req.dadiApiClient.clientId
      }
    } else if (isClientEndpoint) {
      query.client = req.dadiApiClient.clientId
    }

    const {results} = await model.resourceUpdate(query, resourceName, req.body)

    return help.sendBackJSON(200, res, next)(null, {results})
  } catch (error) {
    return this.handleError(res, next)(error)
  }
}

Keys.prototype.validateKeyAccess = function(req, isClientEndpoint) {
  const {clientId} = isClientEndpoint ? req.dadiApiClient : req.params
  const isAdmin = acl.client.isAdmin(req.dadiApiClient)
  const isKey = acl.client.isKey(req.dadiApiClient)

  if (
    !req.dadiApiClient.clientId ||
    isKey ||
    (clientId && !isAdmin && clientId !== req.dadiApiClient.clientId)
  ) {
    throw acl.createError(req.dadiApiClient)
  }

  return {clientId, isAdmin, isKey}
}

module.exports = server => new Keys(server)
