const ACLMatrix = require('./matrix')
const roleModel = require('./role')

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
 * @param  {Object} client
 * @return {Promise<Object>}
 */
Client.prototype.create = function (client) {
  return this.validate(client).then(() => {
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
 * Retrieves clients by ID.
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

  if (typeof secret === 'string') {
    query.secret = secret
  }

  return this.model.find({
    query
  }).then(response => {
    let formattedResults = response.results.map(result => {
      let resources = new ACLMatrix(result.resources)

      return Object.assign({}, result, {
        resources: resources.getAll()
      })
    })

    return {
      results: formattedResults
    }
  })
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
 * Performs validation on a candidate client. It returns a Promise
 * that is rejected with an error object if validation fails, or
 * resolved with `undefined` otherwise.
 *
 * @param  {String}   client
 * @param  {Boolean}  options.partial Whether this is a partial value
 * @return {Promise}
 */
Client.prototype.validate = function (client, {partial = false} = {}) {
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
      this.schema[field].allowedInInput === false
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

module.exports = new Client()
