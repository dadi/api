const ACLMatrix = require('./matrix')
const config = require('../../../../config')
const Connection = require('../connection')
const modelStore = require('../')
const Validator = require('@dadi/api-validator')

const validator = new Validator()

const Role = function() {
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
Role.prototype.broadcastWrite = async function(input) {
  if (typeof this.saveCallback === 'function') {
    await this.saveCallback()
  }

  return input
}

/**
 * Initialises the role module with a connection to the database and a
 * reference to the ACL module.
 *
 * @param  {Object} acl
 */
Role.prototype.connect = function(acl) {
  const connection = Connection({
    collection: config.get('auth.roleCollection'),
    database: config.get('auth.database'),
    override: true
  })
  const model = modelStore({
    connection,
    name: config.get('auth.roleCollection'),
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
 * Creates a role.
 *
 * @param  {Object} role
 * @return {Promise<Object>}
 */
Role.prototype.create = async function(role) {
  await this.validate(role)

  const {results: existingRoles} = await this.model.find({
    query: {
      name: role.name
    }
  })

  if (existingRoles.length > 0) {
    const error = new Error('ROLE_EXISTS')

    error.data = role.name

    return Promise.reject(error)
  }

  if (role.resources) {
    const resources = new ACLMatrix(role.resources)

    role.resources = resources.getAll({getArrayNotation: true})
  }

  const result = await this.model.create({
    documents: [role],
    rawOutput: true,
    validate: false
  })

  await this.broadcastWrite()

  return result
}

/**
 * Deletes a role.
 *
 * @param  {String} name
 * @return {Promise<Object>}
 */
Role.prototype.delete = async function(name) {
  // Before deleting a role, we need to check for any
  // roles that extend it and set their `extends` property
  // to `null`.
  await this.model.update({
    query: {
      extends: name
    },
    update: {
      extends: null
    },
    validate: false
  })

  const result = await this.model.delete({
    query: {
      name
    }
  })

  await this.broadcastWrite()

  return result
}

/**
 * Sanitises a role, preparing it for output.
 *
 * @param  {Object} role
 * @return {Object}
 */
Role.prototype.formatForOutput = function(role) {
  const sanitisedRole = Object.keys(this.schema).reduce((output, key) => {
    if (!this.schema[key].hidden) {
      output[key] = role[key] || this.schema[key].default

      if (key === 'resources') {
        const resources = new ACLMatrix(output[key])

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
Role.prototype.get = async function(names) {
  const query = {}

  if (Array.isArray(names)) {
    query.name = {
      $in: names
    }
  } else if (typeof names === 'string') {
    query.name = names
  }

  const response = await this.model.find({
    query
  })

  const formattedResults = response.results.map(result => {
    const resources = new ACLMatrix(result.resources)

    return Object.assign({}, result, {
      resources: resources.getAll()
    })
  })

  return {
    results: formattedResults
  }
}

/**
 * Adds a resource to a role.
 *
 * @param  {String}  roleName
 * @param  {String}  resourceName
 * @param  {Object}  access
 * @return {Promise<Object>}
 */
Role.prototype.resourceAdd = async function(roleName, resourceName, access) {
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

  const {results: roles} = await this.model.find({
    options: {
      fields: {
        resources: 1
      }
    },
    query: {
      name: roleName
    }
  })

  if (roles.length === 0) {
    return Promise.reject(new Error('ROLE_NOT_FOUND'))
  }

  const resources = new ACLMatrix(roles[0].resources)

  if (resources.get(resourceName)) {
    const error = new Error('ROLE_HAS_RESOURCE')

    error.data = resourceName

    return Promise.reject(error)
  }

  resources.set(resourceName, access)

  const {results} = await this.model.update({
    query: {
      name: roleName
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

  await this.broadcastWrite()

  return {
    results: results.map(role => this.formatForOutput(role))
  }
}

/**
 * Removes a resource from a role.
 *
 * @param  {String}  roleName
 * @param  {String}  resourceName
 * @return {Promise<Object>}
 */
Role.prototype.resourceRemove = async function(roleName, resourceName) {
  const {results: roles} = await this.model.find({
    options: {
      fields: {
        resources: 1
      }
    },
    query: {
      name: roleName
    }
  })

  if (roles.length === 0) {
    return Promise.reject(new Error('ROLE_NOT_FOUND'))
  }

  const resources = new ACLMatrix(roles[0].resources)

  if (!resources.get(resourceName)) {
    return Promise.reject(new Error('ROLE_DOES_NOT_HAVE_RESOURCE'))
  }

  resources.remove(resourceName)

  const {results} = await this.model.update({
    query: {
      name: roleName
    },
    rawOutput: true,
    update: {
      resources: resources.getAll()
    },
    validate: false
  })

  await this.broadcastWrite()

  return {
    results: results.map(client => this.formatForOutput(client))
  }
}

/**
 * Updates the access matrix of a resource on a role.
 *
 * @param  {String}  roleName
 * @param  {String}  resourceName
 * @param  {Object}  access
 * @return {Promise<Object>}
 */
Role.prototype.resourceUpdate = async function(roleName, resourceName, access) {
  try {
    validator.validateAccessMatrix(access)
  } catch (errors) {
    const error = new Error('VALIDATION_ERROR')

    error.data = errors

    return Promise.reject(error)
  }

  const {results: roles} = await this.model.find({
    options: {
      fields: {
        resources: 1
      }
    },
    query: {
      name: roleName
    }
  })

  if (roles.length === 0) {
    return Promise.reject(new Error('ROLE_NOT_FOUND'))
  }

  const resources = new ACLMatrix(roles[0].resources)

  if (!resources.get(resourceName)) {
    return Promise.reject(new Error('ROLE_DOES_NOT_HAVE_RESOURCE'))
  }

  resources.set(resourceName, access)

  const {results} = await this.model.update({
    query: {
      name: roleName
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

  await this.broadcastWrite()

  return {
    results: results.map(client => this.formatForOutput(client))
  }
}

/**
 * Sets a callback to be fired after data has been modified, so that
 * other components have the change to act on the new data.
 *
 * @param {Function} callback
 */
Role.prototype.setWriteCallback = function(callback) {
  this.saveCallback = callback
}

/**
 * Updates a role.
 *
 * @param  {Object}  roleName
 * @param  {Object}  update
 * @return {Promise<Object>}
 */
Role.prototype.update = async function(roleName, update) {
  const {results: roles} = await this.model.find({
    options: {
      fields: {
        _id: 1
      }
    },
    query: {
      name: roleName
    }
  })

  if (roles.length === 0) {
    return Promise.reject(new Error('ROLE_NOT_FOUND'))
  }

  await this.validate(update, {
    isUpdate: true
  })

  const result = await this.model.update({
    query: {
      _id: roles[0]._id
    },
    rawOutput: true,
    update,
    validate: false
  })

  await this.broadcastWrite()

  return result
}

/**
 * Performs validation on a candidate role. It returns a Promise
 * that is rejected with an error object if validation fails, or
 * resolved with `undefined` otherwise.
 *
 * @param  {String}   role
 * @param  {Boolean}  options.isUpdate
 * @return {Promise}
 */
Role.prototype.validate = async function(role, {isUpdate = false} = {}) {
  try {
    // If we're validating an update, we don't allow a `resources` property
    // to be set directly, so we exclude it from the schema.
    const schema = Object.assign({}, this.schema, {
      resources: isUpdate ? null : this.schema.resources
    })

    await validator.validateDocument({
      document: role,
      isUpdate,
      schema
    })

    if (role.extends) {
      const {results: roles} = await this.model.find({
        options: {
          fields: {
            _id: 1
          }
        },
        query: {
          name: role.extends
        }
      })

      if (roles.length === 0) {
        throw [
          {
            code: 'ERROR_INVALID_PARENT_ROLE',
            field: 'extends',
            message: 'is not a valid role to extend'
          }
        ]
      }
    }

    if (role.resources) {
      Object.keys(role.resources).forEach(resourceKey => {
        validator.validateAccessMatrix(
          role.resources[resourceKey],
          `resources.${resourceKey}`
        )
      })
    }
  } catch (error) {
    const errorObject = new Error('VALIDATION_ERROR')

    errorObject.data = error

    throw errorObject
  }
}

module.exports = new Role()
