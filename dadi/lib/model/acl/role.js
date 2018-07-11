const ACLMatrix = require('./matrix')

const Role = function () {
  this.schema = {
    name: {
      required: true,
      type: 'string'
    },
    extends: {
      default: null,
      type: 'string'
    },
    resources: {
      allowedInInput: false,
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
Role.prototype.broadcastWrite = function (input) {
  if (typeof this.saveCallback === 'function') {
    return this.saveCallback().then(() => input)
  }

  return Promise.resolve(input)
}

/**
 * Creates a role.
 *
 * @param  {Object} role
 * @return {Promise<Object>}
 */
Role.prototype.create = function (role) {
  return this.validate(role).then(() => {
    return this.model.find({
      query: {
        name: role.name
      }
    })
  }).then(({results}) => {
    if (results.length > 0) {
      return Promise.reject(
        new Error('ROLE_EXISTS')
      )
    }

    return this.model.create({
      documents: [role],
      rawOutput: true,
      validate: false
    })
  }).then(result => {
    return this.broadcastWrite(result)
  })
}

/**
 * Deletes a role.
 *
 * @param  {String} name
 * @return {Promise<Object>}
 */
Role.prototype.delete = function (name) {
  // Before deleting a role, we need to check for any
  // roles that extend it and set their `extends` property
  // to `null`.
  return this.model.update({
    query: {
      extends: name
    },
    update: {
      extends: null
    },
    validate: false
  }).then(res => {
    return this.model.delete({
      query: {
        name
      }
    })
  }).then(result => {
    return this.broadcastWrite(result)
  })
}

/**
 * Sanitises a role, preparing it for output.
 *
 * @param  {Object} role
 * @return {Object}
 */
Role.prototype.formatForOutput = function (role) {
  let sanitisedRole = Object.keys(this.schema).reduce((output, key) => {
    if (!this.schema[key].hidden) {
      output[key] = role[key] || this.schema[key].default

      if (key === 'resources') {
        let resources = new ACLMatrix(output[key])

        output[key] = resources.getAll({
          addFalsyTypes: true
        })
      }
    }

    return output
  }, {})

  return sanitisedRole
}

/**
 * Retrieves the roles that match `name` if it is
 * supplied; otherwise, all roles are returned.
 *
 * @param  {String|Array<String>} names
 * @return {Promise<Object>}
 */
Role.prototype.get = function (names) {
  let query = {}

  if (Array.isArray(names)) {
    query.name = {
      $in: names
    }
  } else if (typeof names === 'string') {
    query.name = names
  }

  return this.model.find({
    query
  }).then(response => ({
    results: response.results
  }))
}

/**
 * Adds a resource to a role.
 *
 * @param  {String} role     The role name
 * @param  {String} resource The name of the resource
 * @param  {Object} access   Access matrix
 * @return {Promise<Object>}
 */
Role.prototype.resourceAdd = function (role, resource, access) {
  return this.model.find({
    options: {
      fields: {
        resources: 1
      }
    },
    query: {
      name: role
    }
  }).then(({results}) => {
    if (results.length === 0) {
      return Promise.reject(
        new Error('ROLE_NOT_FOUND')
      )
    }

    let resources = new ACLMatrix(
      results[0].resources
    )

    if (resources.get(resource)) {
      return Promise.reject(
        new Error('ROLE_HAS_RESOURCE')
      )
    }

    resources.validate(access)
    resources.set(resource, access)

    return this.model.update({
      query: {
        name: role
      },
      rawOutput: true,
      update: {
        resources: resources.getAll({
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
 * Removes a resource from a role.
 *
 * @param  {String} role     The name of the role
 * @param  {String} resource The name of the resource
 * @return {Promise<Object>}
 */
Role.prototype.resourceRemove = function (role, resource) {
  return this.model.find({
    options: {
      fields: {
        resources: 1
      }
    },
    query: {
      name: role
    }
  }).then(({results}) => {
    if (results.length === 0) {
      return Promise.reject(
        new Error('ROLE_NOT_FOUND')
      )
    }

    let resources = new ACLMatrix(
      results[0].resources
    )

    if (!resources.get(resource)) {
      return Promise.reject(
        new Error('ROLE_DOES_NOT_HAVE_RESOURCE')
      )
    }

    resources.remove(resource)

    return this.model.update({
      query: {
        name: role
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
 * Updates the access matrix of a resource on a role.
 *
 * @param  {String} roles.   The name of the role
 * @param  {String} resource The name of the resource
 * @param  {Object} access   Update to access matrix
 * @return {Promise<Object>}
 */
Role.prototype.resourceUpdate = function (role, resource, access) {
  return this.model.find({
    options: {
      fields: {
        resources: 1
      }
    },
    query: {
      name: role
    }
  }).then(({results}) => {
    if (results.length === 0) {
      return Promise.reject(
        new Error('ROLE_NOT_FOUND')
      )
    }

    let resources = new ACLMatrix(
      results[0].resources
    )

    if (!resources.get(resource)) {
      return Promise.reject(
        new Error('ROLE_DOES_NOT_HAVE_RESOURCE')
      )
    }

    resources.validate(access)
    resources.set(resource, access)

    return this.model.update({
      query: {
        name: role
      },
      rawOutput: true,
      update: {
        resources: resources.getAll({
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

Role.prototype.setModel = function (model) {
  this.model = model
}

/**
 * Sets a callback to be fired after data has been modified, so that
 * other components have the change to act on the new data.
 *
 * @param {Function} callback
 */
Role.prototype.setWriteCallback = function (callback) {
  this.saveCallback = callback
}

/**
 * Updates a role.
 *
 * @param  {Object} role
 * @param  {Object} update
 * @return {Promise<Object>}
 */
Role.prototype.update = function (role, update) {
  return this.model.find({
    options: {
      fields: {
        _id: 0,
        secret: 0
      }
    },
    query: {
      name: role.name
    }
  }).then(({results}) => {
    if (results.length > 0) {
      return Promise.reject(
        new Error('ROLE_EXISTS')
      )
    }

    return this.validate(update, {
      partial: true
    })
  }).then(() => {
    return this.model.update({
      query: {
        name: role
      },
      rawOutput: true,
      update,
      validate: false
    })
  }).then(result => {
    return this.broadcastWrite(result)
  })
}

/**
 * Performs validation on a candidate role. It returns a Promise
 * that is rejected with an error object if validation fails, or
 * resolved with `undefined` otherwise.
 *
 * @param  {String}   role
 * @param  {Boolean}  options.partial Whether this is a partial value
 * @return {Promise}
 */
Role.prototype.validate = function (role, {partial = false} = {}) {
  let missingFields = Object.keys(this.schema).filter(field => {
    return this.schema[field].required && role[field] === undefined
  })

  if (!partial && missingFields.length > 0) {
    let error = new Error('MISSING_FIELDS')

    error.data = missingFields

    return Promise.reject(error)
  }

  let invalidFields = Object.keys(this.schema).filter(field => {
    if (
      role[field] !== undefined &&
      this.schema[field].allowedInInput === false
    ) {
      return true
    }

    return (
      role[field] !== undefined &&
      role[field] !== null &&
      typeof role[field] !== this.schema[field].type
    )
  })

  if (invalidFields.length > 0) {
    let error = new Error('INVALID_FIELDS')

    error.data = invalidFields

    return Promise.reject(error)
  }

  if (role.extends) {
    return this.model.find({
      options: {
        fields: {
          _id: 1
        }
      },
      query: {
        name: role.extends
      }
    }).then(({results}) => {
      if (results.length === 0) {
        return Promise.reject(
          new Error('INVALID_PARENT_ROLE')
        )
      }
    })
  }

  return Promise.resolve()
}

module.exports = new Role()
