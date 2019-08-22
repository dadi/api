const ACLMatrix = require('./matrix')
const bcrypt = require('bcrypt')
const config = require('../../../../config')
const Connection = require('../connection')
const modelStore = require('../')
const roleModel = require('./role')
const Validator = require('@dadi/api-validator')

const validator = new Validator()

// This value should be incremented if we ever replace bcrypt with another
// hashing algorithm.
const HASH_VERSION = 1

const Client = function() {
  this.schema = {
    clientId: {
      type: 'string',
      required: true
    },
    accessType: {
      default: 'user',
      type: 'string'
    },
    resources: {
      default: {},
      type: 'object'
    },
    roles: {
      default: [],
      type: 'object',
      validationCallback: value => {
        if (Array.isArray(value)) {
          const hasStringsOnly = value.every(value => typeof value === 'string')

          if (hasStringsOnly) {
            return Promise.resolve()
          }
        }

        return Promise.reject()
      }
    },
    secret: {
      hidden: true,
      required: true,
      type: 'string'
    },
    data: {
      default: {},
      type: 'object'
    }
  }
}

/**
 * Fires and waits for the `this.saveCallback` callback, if defined. It sends
 * an array with `clientId` as a parameter.
 *
 * @param  {String} clientId
 * @return {Promise}
 */
Client.prototype.broadcastWrite = async function(clientId) {
  if (typeof this.saveCallback === 'function') {
    await this.saveCallback([clientId])
  }
}

/**
 * Initialises the client module with a connection to the database and a
 * reference to the ACL module.
 *
 * @param  {Object} acl
 */
Client.prototype.connect = function(acl) {
  const connection = Connection(
    {
      collection: config.get('auth.clientCollection'),
      database: config.get('auth.database'),
      override: true
    },
    null,
    config.get('auth.datastore')
  )
  const model = modelStore({
    connection,
    name: config.get('auth.clientCollection'),
    property: config.get('auth.database'),
    settings: {
      compose: false,
      storeRevisions: false
    }
  })

  this.acl = acl
  this.model = model
}

/**
 * Creates a client.
 *
 * @param  {Object}  client
 * @return {Promise<Object>}
 */
Client.prototype.create = async function(client) {
  await this.validate(client)

  const {results} = await this.model.find({
    options: {
      fields: {
        _id: 1
      }
    },
    query: {
      clientId: client.clientId
    }
  })

  if (results.length > 0) {
    return Promise.reject(new Error('CLIENT_EXISTS'))
  }

  client.secret = await this.hashSecret(client.secret, client)

  if (client.resources) {
    const resources = new ACLMatrix(client.resources)

    client.resources = resources.getAll({getArrayNotation: true})
  }

  const createdClient = await this.model.create({
    documents: [client],
    rawOutput: true,
    validate: false
  })

  await this.broadcastWrite(client.clientId)

  return createdClient
}

/**
 * Deletes a client.
 *
 * @param  {String} clientId
 * @return {Promise<Object>}
 */
Client.prototype.delete = async function(clientId) {
  const result = await this.model.delete({
    query: {
      clientId
    }
  })

  await this.broadcastWrite(clientId)

  return
}

/**
 * Finds clients that match a given query.
 *
 * @param  {Object} query
 * @return {Promise<Object>}
 */
Client.prototype.find = function(query) {
  return this.model.find({query})
}

/**
 * Sanitises a client, preparing it for output. It removes all
 * internal properties as well as sensitive information, such as
 * the client secret.
 *
 * @param  {Object} client
 * @return {Object}
 */
Client.prototype.formatForOutput = function(client) {
  const sanitisedClient = Object.keys(this.schema).reduce((output, key) => {
    if (!this.schema[key].hidden) {
      let value = client[key] || this.schema[key].default

      if (key === 'resources') {
        const resources = new ACLMatrix(value)

        value = resources.getAll({
          addFalsyTypes: true
        })
      }

      output[key] = value
    }

    return output
  }, {})

  return sanitisedClient
}

/**
 * Retrieves clients by ID. When a secret is supplied, it is validated
 * against the hash that is stored in the database. If they don't match,
 * an empty result set is returned.
 *
 * @param  {String} clientId
 * @param  {String} secret
 * @return {Promise<Object>}
 */
Client.prototype.get = function(clientId, secret) {
  const query = {}

  if (typeof clientId === 'string') {
    query.clientId = clientId
  }

  return this.model
    .find({
      query
    })
    .then(response => {
      const {results} = response
      const mustValidateSecret =
        results.length === 1 && typeof secret === 'string'
      const [record] = results
      const secretValidation = mustValidateSecret
        ? this.validateSecret(record.secret, secret, record._hashVersion)
        : Promise.resolve(true)

      return secretValidation.then(secretIsValid => {
        if (!secretIsValid) {
          return []
        }

        return results.map(result => {
          const resources = new ACLMatrix(result.resources)

          return Object.assign({}, result, {
            resources: resources.getAll()
          })
        })
      })
    })
    .then(results => {
      return {
        results
      }
    })
}

/**
 * Generates a hash from a secret. If `target` is supplied, a `_hashVersion_`
 * property will be added to that object.
 *
 * @param  {String}  secret
 * @param  {Object}  target
 * @return {Promise<String>}
 */
Client.prototype.hashSecret = function(secret, target) {
  if (!config.get('auth.hashSecrets')) {
    return Promise.resolve(secret)
  }

  const saltRounds = config.get('auth.saltRounds')

  if (target) {
    target._hashVersion = HASH_VERSION
  }

  return bcrypt.hash(secret, saltRounds)
}

/**
 * Determines whether a client has admin access.
 *
 * @param  {Object}  client
 * @return {Boolean}
 */
Client.prototype.isAdmin = function(client) {
  return (client && client.accessType === 'admin') || this.isSuperUser(client)
}

/**
 * Determines whether a client has super user access.
 *
 * @param  {Object}  client
 * @return {Boolean}
 */
Client.prototype.isSuperUser = function(client) {
  return client && client.accessType === 'superUser'
}

/**
 * Adds a resource to a client.
 *
 * @param  {String} clientId      The client ID
 * @param  {String} resourceName  The name of the resource
 * @param  {Object} access        Access matrix
 * @return {Promise<Object>}
 */
Client.prototype.resourceAdd = async function(clientId, resourceName, access) {
  try {
    await validator.validateDocument({
      document: {
        access,
        name: resourceName
      },
      schema: {
        access: {
          required: true,
          type: 'object'
        },
        name: {
          required: true,
          type: 'string'
        }
      }
    })

    validator.validateAccessMatrix(access, 'access')
  } catch (errors) {
    const error = new Error('VALIDATION_ERROR')

    error.data = errors

    return Promise.reject(error)
  }

  const {results: clients} = await this.model.find({
    options: {
      fields: {
        resources: 1
      }
    },
    query: {
      clientId
    }
  })

  if (clients.length === 0) {
    return Promise.reject(new Error('CLIENT_NOT_FOUND'))
  }

  const resources = new ACLMatrix(clients[0].resources)

  if (resources.get(resourceName)) {
    const error = new Error('CLIENT_HAS_RESOURCE')

    error.data = resourceName

    return Promise.reject(error)
  }

  resources.set(resourceName, access)

  const update = await this.model.update({
    query: {
      clientId
    },
    rawOutput: true,
    update: {
      resources: resources.getAll({
        getArrayNotation: true,
        stringifyObjects: true
      })
    },
    validate: false
  })

  await this.broadcastWrite(clientId)

  return {
    results: update.results.map(client => this.formatForOutput(client))
  }
}

/**
 * Removes a resource from a client.
 *
 * @param  {String} clientId The client ID
 * @param  {String} resource The name of the resource
 * @return {Promise<Object>}
 */
Client.prototype.resourceRemove = async function(clientId, resource) {
  const {results: clients} = await this.model.find({
    options: {
      fields: {
        resources: 1
      }
    },
    query: {
      clientId
    }
  })

  if (clients.length === 0) {
    return Promise.reject(new Error('CLIENT_NOT_FOUND'))
  }

  const resources = new ACLMatrix(clients[0].resources)

  if (!resources.get(resource)) {
    return Promise.reject(new Error('CLIENT_DOES_NOT_HAVE_RESOURCE'))
  }

  resources.remove(resource)

  const update = await this.model.update({
    query: {
      clientId
    },
    rawOutput: true,
    update: {
      resources: resources.getAll()
    },
    validate: false
  })

  await this.broadcastWrite(clientId)

  return {
    results: update.results.map(client => this.formatForOutput(client))
  }
}

/**
 * Updates the access matrix of a resource on a client.
 *
 * @param  {String} clientId      The client ID
 * @param  {String} resourceName  The name of the resource
 * @param  {Object} access        Update to access matrix
 * @return {Promise<Object>}
 */
Client.prototype.resourceUpdate = async function(
  clientId,
  resourceName,
  access
) {
  try {
    validator.validateAccessMatrix(access)
  } catch (errors) {
    const error = new Error('VALIDATION_ERROR')

    error.data = errors

    return Promise.reject(error)
  }

  const {results: clients} = await this.model.find({
    options: {
      fields: {
        resources: 1
      }
    },
    query: {
      clientId
    }
  })

  if (clients.length === 0) {
    return Promise.reject(new Error('CLIENT_NOT_FOUND'))
  }

  const resources = new ACLMatrix(clients[0].resources)

  if (!resources.get(resourceName)) {
    return Promise.reject(new Error('CLIENT_DOES_NOT_HAVE_RESOURCE'))
  }

  resources.set(resourceName, access)

  const update = await this.model.update({
    query: {
      clientId
    },
    rawOutput: true,
    update: {
      resources: resources.getAll({
        getArrayNotation: true,
        stringifyObjects: true
      })
    },
    validate: false
  })

  await this.broadcastWrite(clientId)

  return {
    results: update.results.map(client => this.formatForOutput(client))
  }
}

/**
 * Adds a list of roles to a client.
 *
 * @param  {String}         clientId
 * @param  {Array<String>}  roles
 * @return {Promise<Object>}
 */
Client.prototype.roleAdd = async function(clientId, roles) {
  const {results: clients} = await this.model.find({
    options: {
      fields: {
        _id: 1,
        roles: 1
      }
    },
    query: {
      clientId
    }
  })

  if (clients.length === 0) {
    return Promise.reject(new Error('CLIENT_NOT_FOUND'))
  }

  const clientRoles = clients[0].roles || []
  const {results: existingRoles} = await roleModel.get(roles)
  const invalidRoles = roles.filter(role => {
    return !existingRoles.find(({name}) => name === role)
  })

  if (invalidRoles.length > 0) {
    const error = new Error('INVALID_ROLE')

    error.data = invalidRoles

    return Promise.reject(error)
  }

  const newRoles = [...new Set(clientRoles.concat(roles).sort())]
  const {results} = await this.model.update({
    query: {
      clientId
    },
    rawOutput: true,
    update: {
      roles: newRoles
    },
    validate: false
  })

  await this.broadcastWrite(clientId)

  return {
    results: results.map(client => this.formatForOutput(client))
  }
}

/**
 * Removes a list of roles from a client.
 *
 * @param  {String}         clientId
 * @param  {Array<String>}  roles
 * @return {Promise<Object>}
 */
Client.prototype.roleRemove = async function(clientId, roles) {
  const rolesRemoved = []
  const {results: clients} = await this.model.find({
    options: {
      fields: {
        _id: 1,
        roles: 1
      }
    },
    query: {
      clientId
    }
  })

  if (clients.length === 0) {
    return Promise.reject(new Error('CLIENT_NOT_FOUND'))
  }

  const existingRoles = clients[0].roles || []
  const newRoles = [
    ...new Set(
      existingRoles
        .filter(role => {
          if (roles.includes(role)) {
            rolesRemoved.push(role)

            return false
          }

          return true
        })
        .sort()
    )
  ]

  const {results} = await this.model.update({
    query: {
      clientId
    },
    rawOutput: true,
    update: {
      roles: newRoles
    },
    validate: false
  })

  await this.broadcastWrite(clientId)

  return {
    removed: rolesRemoved,
    results: results.map(client => this.formatForOutput(client))
  }
}

/**
 * Sets a callback to be fired after data has been modified, so that
 * other components have the change to act on the new data.
 *
 * @param {Function} callback
 */
Client.prototype.setWriteCallback = function(callback) {
  this.saveCallback = callback
}

/**
 * Updates a client. If the update object contains a `data` property,
 * it will be merged with the current data object associated with the
 * client.
 *
 * @param  {String} clientId
 * @param  {Object} update
 * @return {Promise<Object>}
 */
Client.prototype.update = function(clientId, update) {
  const {accessType, currentSecret, secret} = update
  const findQuery = {
    clientId
  }

  // It's not possible to use this endpoint to set a client's access type
  // to `admin`.
  if (accessType === 'admin') {
    return Promise.reject(new Error('UNAUTHORISED'))
  }

  delete update.currentSecret
  delete update.secret

  return this.validate(update, {
    blockedFields: ['clientId'],
    isUpdate: true
  })
    .then(() => {
      return this.model.find({
        options: {
          fields: {
            _hashVersion: 1,
            data: 1,
            secret: 1
          }
        },
        query: findQuery
      })
    })
    .then(({results}) => {
      if (results.length === 0) {
        return Promise.reject(new Error('CLIENT_NOT_FOUND'))
      }

      const [record] = results

      // If a `currentSecret` property was sent, we must validate it against the
      // hashed secret in the database.
      if (typeof currentSecret === 'string') {
        return this.validateSecret(
          record.secret,
          currentSecret,
          record._hashVersion
        ).then(secretIsValid => {
          if (!secretIsValid) {
            return Promise.reject(new Error('INVALID_SECRET'))
          }

          return results
        })
      }

      return results
    })
    .then(results => {
      // If we're trying to update the client's secret, we must hash it
      // before sending it to the database.
      if (typeof secret === 'string') {
        return this.hashSecret(secret, update).then(hashedSecret => {
          update.secret = hashedSecret

          return results
        })
      }

      return results
    })
    .then(results => {
      if (update.data) {
        const mergedData = Object.assign({}, results[0].data, update.data)

        Object.keys(mergedData).forEach(key => {
          if (mergedData[key] === null) {
            delete mergedData[key]
          }
        })

        update.data = mergedData
      }

      return this.model.update({
        query: {
          clientId
        },
        rawOutput: true,
        update,
        validate: false
      })
    })
}

/**
 * Performs validation on a candidate client. It returns a Promise
 * that is rejected with an error object if validation fails, or
 * resolved with `undefined` otherwise.
 *
 * @param  {String}   client
 * @param  {Boolean}  options.allowedAccessTypes
 * @param  {Boolean}  options.isUpdate
 * @return {Promise}
 */
Client.prototype.validate = async function(
  client,
  {allowedAccessTypes = ['admin', 'user'], isUpdate = false} = {}
) {
  try {
    // If we're validating an update, we don't allow certain properties to be
    // set directly, so we exclude them from the schema.
    const schema = Object.assign({}, this.schema, {
      clientId: isUpdate ? null : this.schema.clientId,
      resources: isUpdate ? null : this.schema.resources,
      roles: isUpdate ? null : this.schema.roles
    })

    await validator.validateDocument({
      document: client,
      isUpdate,
      schema
    })

    if (client.accessType && !allowedAccessTypes.includes(client.accessType)) {
      throw [
        {
          code: 'ERROR_INVALID_VALUE',
          field: 'accessType',
          message: `must be one of ${allowedAccessTypes.join(', ')}`
        }
      ]
    }

    if (client.resources) {
      Object.keys(client.resources).forEach(resourceKey => {
        validator.validateAccessMatrix(
          client.resources[resourceKey],
          `resources.${resourceKey}`
        )
      })
    }

    if (client.roles) {
      const {results: existingRoles} = await roleModel.get(client.roles)
      const invalidRoles = client.roles.filter(role => {
        return !existingRoles.find(({name}) => name === role)
      })

      if (invalidRoles.length > 0) {
        const error = new Error('INVALID_ROLE')

        error.data = invalidRoles

        return Promise.reject(error)
      }
    }

    return Promise.resolve()
  } catch (errors) {
    const error = new Error('VALIDATION_ERROR')

    error.data = errors

    return Promise.reject(error)
  }
}

/**
 * Validates a secret against a stored hash, returning a Promise that
 * resolves to `true` if there is a match and `false` otherwise.
 *
 * @param  {String}   hash
 * @param  {String}   candidate
 * @return {Promise<Boolean>}
 */
Client.prototype.validateSecret = function(hash, candidate, hashVersion) {
  if (!config.get('auth.hashSecrets')) {
    return Promise.resolve(hash === candidate)
  }

  if (hashVersion !== HASH_VERSION) {
    return Promise.reject(new Error('CLIENT_NEEDS_UPGRADE'))
  }

  return bcrypt.compare(candidate, hash)
}

module.exports = new Client()
