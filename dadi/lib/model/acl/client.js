const ACLMatrix = require('./matrix')
const bcrypt = require('bcrypt')
const config = require('./../../../../config.js')
const roleModel = require('./role')

// This value should be incremented if we ever replace bcrypt with another
// hashing algorithm.
const HASH_VERSION = 1

const Client = function () {
  this.schema = {
    clientId: {
      required: true,
      type: 'string'
    },
    accessType: {
      allowedInInput: false,
      default: 'user',
      type: 'string'
    },
    resources: {
      allowedInInput: false,
      default: {},
      type: 'object'
    },
    roles: {
      allowedInInput: false,
      default: [],
      type: 'object'
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
 * Fires the callback defined in `this.saveCallback`, if any,
 * returning the value of the input argument after it finishes
 * executing. If the callback is not defined, a Promise resolved
 * with the input argument is returned instead.
 *
 * @param  {Object} input
 * @return {Promise}
 */
Client.prototype.broadcastWrite = function (input) {
  if (typeof this.saveCallback === 'function') {
    return this.saveCallback().then(() => input)
  }

  return Promise.resolve(input)
}

/**
 * Creates a client.
 *
 * @param  {Object}  client
 * @param  {Boolean} options.allowAccessType
 * @return {Promise<Object>}
 */
Client.prototype.create = function (client, {
  allowAccessType = false
} = {}) {
  const allowedFields = allowAccessType ? ['accessType'] : []

  return this.validate(client, {
    allowedFields
  }).then(() => {
    return this.model.find({
      options: {
        fields: {
          _id: 1
        }
      },
      query: {
        clientId: client.clientId
      }
    })
  }).then(({results}) => {
    if (results.length > 0) {
      return Promise.reject(
        new Error('CLIENT_EXISTS')
      )
    }

    return this.hashSecret(client.secret, client)
  }).then(hashedsecret => {
    client.secret = hashedsecret

    return this.model.create({
      documents: [client],
      rawOutput: true,
      validate: false
    })
  }).then(result => {
    return this.broadcastWrite(result)
  })
}

/**
 * Deletes a client.
 *
 * @param  {String} clientId
 * @return {Promise<Object>}
 */
Client.prototype.delete = function (clientId) {
  return this.model.delete({
    query: {
      clientId
    }
  }).then(result => {
    return this.broadcastWrite(result)
  })
}

/**
 * Sanitises a client, preparing it for output. It removes all
 * internal properties as well as sensitive information, such as
 * the client secret.
 *
 * @param  {Object} client
 * @return {Object}
 */
Client.prototype.formatForOutput = function (client) {
  let sanitisedClient = Object.keys(this.schema).reduce((output, key) => {
    if (!this.schema[key].hidden) {
      let value = client[key] || this.schema[key].default

      if (key === 'resources') {
        let resources = new ACLMatrix(value)

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
Client.prototype.get = function (clientId, secret) {
  let query = {}

  if (typeof clientId === 'string') {
    query.clientId = clientId
  }

  return this.model.find({
    query
  }).then(response => {
    const {results} = response
    const mustValidateSecret = results.length === 1 &&
      typeof secret === 'string'
    const [record] = results
    const secretValidation = mustValidateSecret
      ? this.validateSecret(record.secret, secret, record._hashVersion)
      : Promise.resolve(true)

    return secretValidation.then(secretIsValid => {
      if (!secretIsValid) {
        return []
      }

      return results.map(result => {
        let resources = new ACLMatrix(result.resources)

        return Object.assign({}, result, {
          resources: resources.getAll()
        })
      })
    })
  }).then(results => {
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
Client.prototype.hashSecret = function (secret, target) {
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
Client.prototype.isAdmin = function (client) {
  return client && (client.accessType === 'admin')
}

/**
 * Adds a resource to a client.
 *
 * @param  {String} clientId The client ID
 * @param  {String} resource The name of the resource
 * @param  {Object} access   Access matrix
 * @return {Promise<Object>}
 */
Client.prototype.resourceAdd = function (clientId, resource, access) {
  return this.model.find({
    options: {
      fields: {
        resources: 1
      }
    },
    query: {
      clientId
    }
  }).then(({results}) => {
    if (results.length === 0) {
      return Promise.reject(
        new Error('CLIENT_NOT_FOUND')
      )
    }

    let resources = new ACLMatrix(
      results[0].resources
    )

    resources.validate(access)

    if (resources.get(resource)) {
      return Promise.reject(
        new Error('CLIENT_HAS_RESOURCE')
      )
    }

    resources.set(resource, access)

    return this.model.update({
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
  }).then(result => {
    return this.broadcastWrite(result)
  }).then(({results}) => {
    return {
      results: results.map(client => this.formatForOutput(client))
    }
  })
}

/**
 * Removes a resource from a client.
 *
 * @param  {String} clientId The client ID
 * @param  {String} resource The name of the resource
 * @return {Promise<Object>}
 */
Client.prototype.resourceRemove = function (clientId, resource) {
  return this.model.find({
    options: {
      fields: {
        resources: 1
      }
    },
    query: {
      clientId
    }
  }).then(({results}) => {
    if (results.length === 0) {
      return Promise.reject(
        new Error('CLIENT_NOT_FOUND')
      )
    }

    let resources = new ACLMatrix(
      results[0].resources
    )

    if (!resources.get(resource)) {
      return Promise.reject(
        new Error('CLIENT_DOES_NOT_HAVE_RESOURCE')
      )
    }

    resources.remove(resource)

    return this.model.update({
      query: {
        clientId
      },
      rawOutput: true,
      update: {
        resources: resources.getAll()
      },
      validate: false
    })
  }).then(result => {
    return this.broadcastWrite(result)
  }).then(({results}) => {
    return {
      results: results.map(client => this.formatForOutput(client))
    }
  })
}

/**
 * Updates the access matrix of a resource on a client.
 *
 * @param  {String} clientId The client ID
 * @param  {String} resource The name of the resource
 * @param  {Object} access   Update to access matrix
 * @return {Promise<Object>}
 */
Client.prototype.resourceUpdate = function (clientId, resource, access) {
  return this.model.find({
    options: {
      fields: {
        resources: 1
      }
    },
    query: {
      clientId
    }
  }).then(({results}) => {
    if (results.length === 0) {
      return Promise.reject(
        new Error('CLIENT_NOT_FOUND')
      )
    }

    let resources = new ACLMatrix(
      results[0].resources
    )

    if (!resources.get(resource)) {
      return Promise.reject(
        new Error('CLIENT_DOES_NOT_HAVE_RESOURCE')
      )
    }

    resources.validate(access)
    resources.set(resource, access)

    return this.model.update({
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
  }).then(result => {
    return this.broadcastWrite(result)
  }).then(({results}) => {
    return {
      results: results.map(client => this.formatForOutput(client))
    }
  })
}

/**
 * Adds a list of roles to a client.
 *
 * @param  {String}         clientId
 * @param  {Array<String>}  roles
 * @return {Promise<Object>}
 */
Client.prototype.roleAdd = function (clientId, roles) {
  return this.model.find({
    options: {
      fields: {
        _id: 1,
        roles: 1
      }
    },
    query: {
      clientId
    }
  }).then(({results}) => {
    if (results.length === 0) {
      return Promise.reject(
        new Error('CLIENT_NOT_FOUND')
      )
    }

    let existingRoles = results[0].roles || []

    return roleModel.get(roles).then(({results}) => {
      let invalidRoles = roles.filter(role => {
        return !results.find(dbRole => dbRole.name === role)
      })

      if (invalidRoles.length > 0) {
        let error = new Error('INVALID_ROLE')

        error.data = invalidRoles

        return Promise.reject(error)
      }

      return existingRoles
    })
  }).then(existingRoles => {
    let newRoles = [...new Set(existingRoles.concat(roles).sort())]

    return this.model.update({
      query: {
        clientId
      },
      rawOutput: true,
      update: {
        roles: newRoles
      },
      validate: false
    })
  }).then(result => {
    return this.broadcastWrite(result)
  }).then(({results}) => {
    return {
      results: results.map(client => this.formatForOutput(client))
    }
  })
}

/**
 * Removes a list of roles from a client.
 *
 * @param  {String}         clientId
 * @param  {Array<String>}  roles
 * @return {Promise<Object>}
 */
Client.prototype.roleRemove = function (clientId, roles) {
  let rolesRemoved = []

  return this.model.find({
    options: {
      fields: {
        _id: 1,
        roles: 1
      }
    },
    query: {
      clientId
    }
  }).then(({results}) => {
    if (results.length === 0) {
      return Promise.reject(
        new Error('CLIENT_NOT_FOUND')
      )
    }

    let existingRoles = results[0].roles || []
    let newRoles = [...new Set(
      existingRoles.filter(role => {
        if (roles.includes(role)) {
          rolesRemoved.push(role)

          return false
        }

        return true
      }).sort()
    )]

    return this.model.update({
      query: {
        clientId
      },
      rawOutput: true,
      update: {
        roles: newRoles
      },
      validate: false
    })
  }).then(result => {
    return this.broadcastWrite(result)
  }).then(({results}) => {
    return {
      removed: rolesRemoved,
      results: results.map(client => this.formatForOutput(client))
    }
  })
}

/**
 * Sets an internal reference to the instance of Model.
 *
 * @param {Object} model
 */
Client.prototype.setModel = function (model) {
  this.model = model
}

/**
 * Sets a callback to be fired after data has been modified, so that
 * other components have the change to act on the new data.
 *
 * @param {Function} callback
 */
Client.prototype.setWriteCallback = function (callback) {
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
Client.prototype.update = function (clientId, update) {
  const {currentSecret, secret} = update
  const findQuery = {
    clientId
  }

  delete update.currentSecret
  delete update.secret

  return this.validate(update, {
    blockedFields: ['clientId'],
    partial: true
  }).then(() => {
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
  }).then(({results}) => {
    if (results.length === 0) {
      return Promise.reject(
        new Error('CLIENT_NOT_FOUND')
      )
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
          return Promise.reject(
            new Error('INVALID_SECRET')
          )
        }

        return results
      })
    }

    return results
  }).then(results => {
    // If we're trying to update the client's secret, we must hash it
    // before sending it to the database.
    if (typeof secret === 'string') {
      return this.hashSecret(secret, update).then(hashedSecret => {
        update.secret = hashedSecret

        return results
      })
    }

    return results
  }).then(results => {
    if (update.data) {
      let mergedData = Object.assign({}, results[0].data, update.data)

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
 * @param  {Boolean}  options.allowedFields A whitelist of fields
 * @param  {Boolean}  options.blockedFields A blacklist of fields
 * @param  {Boolean}  options.partial Whether this is a partial value
 * @return {Promise}
 */
Client.prototype.validate = function (client, {
  allowedFields = [],
  blockedFields = [],
  partial = false
} = {}) {
  let missingFields = Object.keys(this.schema).filter(field => {
    return this.schema[field].required && client[field] === undefined
  })

  if (!partial && missingFields.length > 0) {
    let error = new Error('MISSING_FIELDS')

    error.data = missingFields

    return Promise.reject(error)
  }

  let invalidFields = Object.keys(this.schema).filter(field => {
    if (
      client[field] !== undefined &&
      this.schema[field].allowedInInput === false &&
      !allowedFields.includes(field)
    ) {
      return true
    }

    return (
      client[field] !== undefined &&
      client[field] !== null &&
      typeof client[field] !== this.schema[field].type
    )
  })

  Object.keys(client).forEach(field => {
    if (!this.schema[field] || blockedFields.includes(field)) {
      invalidFields.push(field)
    }
  })

  if (invalidFields.length > 0) {
    let error = new Error('INVALID_FIELDS')

    error.data = invalidFields

    return Promise.reject(error)
  }

  return Promise.resolve()
}

/**
 * Validates a secret against a stored hash, returning a Promise that
 * resolves to `true` if there is a match and `false` otherwise.
 *
 * @param  {String}   hash
 * @param  {String}   candidate
 * @return {Promise<Boolean>}
 */
Client.prototype.validateSecret = function (hash, candidate, hashVersion) {
  if (!config.get('auth.hashSecrets')) {
    return Promise.resolve(hash === candidate)
  }

  if (hashVersion !== HASH_VERSION) {
    return Promise.reject(
      new Error('CLIENT_NEEDS_UPGRADE')
    )
  }

  return bcrypt.compare(candidate, hash)
}

module.exports = new Client()
