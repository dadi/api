const ACLMatrix = require('./matrix')
const config = require('../../../../config')
const Connection = require('../connection')
const jwt = require('jsonwebtoken')
const modelStore = require('../')
const Validator = require('@dadi/api-validator')

const validator = new Validator()

const Key = function() {
  this.schema = {
    description: {
      type: 'string'
    },
    resources: {
      default: {},
      type: 'object'
    }
  }
}

/**
 * Initialises the key module with a connection to the database and a
 * reference to the ACL module.
 *
 * @param  {Object} acl
 */
Key.prototype.connect = function(acl) {
  const connection = Connection({
    collection: config.get('auth.keyCollection'),
    database: config.get('auth.database'),
    override: true
  })
  const model = modelStore({
    connection,
    name: config.get('auth.keyCollection'),
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
 * Creates a key.
 *
 * @param  {Object} data
 * @param  {Object} client
 * @return {Promise<Object>}
 */
Key.prototype.create = async function(data, client) {
  await this.validate(data)

  const token = await this.generateToken()
  const document = Object.assign({}, data, {token})

  if (document.resources) {
    const resources = new ACLMatrix(document.resources)

    document.resources = resources.getAll({getArrayNotation: true})
  }

  if (client) {
    document.client = client.clientId
  }

  const {results: keys} = await this.model.create({
    documents: [document],
    rawOutput: true,
    removeInternalProperties: false,
    validate: false
  })

  await this.saveCallback({
    clientsCache: client ? {[client.clientId]: client} : {},
    updatedKeys: keys
  })

  return keys[0]
}

/**
 * Deletes a key with a given ID as long as it matches a filter query.
 *
 * @param  {String} keyId
 * @param  {Object} filter
 * @return {Promise<Object>}
 */
Key.prototype.delete = async function(keyId, filter = {}) {
  const query = Object.assign({}, filter, {_id: keyId})
  const result = await this.model.delete({query})

  if (result.deletedCount > 0) {
    await this.saveCallback({
      deletedKeyIds: [keyId]
    })
  }

  return result
}

/**
 * Formats a key for output, modifying or removing any data that should not
 * be public (e.g. the full key).
 *
 * @param  {Object} query
 * @return {Object}
 */
Key.prototype.formatForOutput = function(key, {obfuscateKey = true} = {}) {
  if (key.resources) {
    const resources = new ACLMatrix(key.resources)

    key.resources = resources.getAll({
      addFalsyTypes: true
    })
  }

  return {
    ...key,
    token: obfuscateKey ? key.token.slice(-5) : key.token
  }
}

/**
 * Generates a new JWT with a given data payload.
 *
 * @param  {Object} data
 * @return {Promise<String>}
 */
Key.prototype.generateToken = function(data = {}) {
  const payload = Object.assign({}, data, {
    accessType: 'key'
  })

  return new Promise((resolve, reject) => {
    jwt.sign(payload, config.get('auth.tokenKey'), (err, token) => {
      if (err) {
        return reject(err)
      }

      return resolve(token)
    })
  })
}

/**
 * Retrieves keys that match a query.
 *
 * @param  {Object} query
 * @return {Promise<Object>}
 */
Key.prototype.get = async function(query) {
  const {results} = await this.model.find({
    query
  })

  return results
}

/**
 * Adds a resource to a key.
 *
 * @param  {Object} query         The key query
 * @param  {String} resourceName  The name of the resource
 * @param  {Object} access        Access matrix
 * @return {Promise<Object>}
 */
Key.prototype.resourceAdd = async function(query, resourceName, access) {
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

  const {results: keys} = await this.model.find({
    options: {
      fields: {
        resources: 1
      }
    },
    query
  })

  if (keys.length === 0) {
    return Promise.reject(new Error('KEY_NOT_FOUND'))
  }

  const resources = new ACLMatrix(keys[0].resources)

  if (resources.get(resourceName)) {
    const error = new Error('VALIDATION_ERROR')

    error.data = [
      {
        code: 'ERROR_KEY_HAS_RESOURCE',
        field: 'name',
        message: 'is already assigned to the client'
      }
    ]

    return Promise.reject(error)
  }

  resources.set(resourceName, access)

  const {results} = await this.model.update({
    query,
    rawOutput: true,
    update: {
      resources: resources.getAll({
        getArrayNotation: true,
        stringifyObjects: true
      })
    },
    validate: false
  })

  await this.saveCallback({
    updatedKeys: [Object.assign({}, keys[0], {resources: resources.getAll()})]
  })

  return {
    results: results.map(client => this.formatForOutput(client))
  }
}

/**
 * Removes a resource from a key.
 *
 * @param  {Object} query         The key query
 * @param  {String} resourceName  The name of the resource
 * @return {Promise<Object>}
 */
Key.prototype.resourceRemove = async function(query, resourceName) {
  const {results: keys} = await this.model.find({
    options: {
      fields: {
        resources: 1
      }
    },
    query
  })

  if (keys.length === 0) {
    return Promise.reject(new Error('KEY_NOT_FOUND'))
  }

  const resources = new ACLMatrix(keys[0].resources)

  if (!resources.get(resourceName)) {
    return Promise.reject(new Error('KEY_DOES_NOT_HAVE_RESOURCE'))
  }

  resources.remove(resourceName)

  const update = await this.model.update({
    query,
    rawOutput: true,
    update: {
      resources: resources.getAll()
    },
    validate: false
  })

  return {
    results: update.results.map(client => this.formatForOutput(client))
  }
}

/**
 * Updates the access matrix of a resource on a key.
 *
 * @param  {Object} query         The key query
 * @param  {String} resourceName  The name of the resource
 * @param  {Object} access        Update to access matrix
 * @return {Promise<Object>}
 */
Key.prototype.resourceUpdate = async function(query, resourceName, access) {
  try {
    validator.validateAccessMatrix(access)
  } catch (errors) {
    const error = new Error('VALIDATION_ERROR')

    error.data = errors

    return Promise.reject(error)
  }

  const {results: keys} = await this.model.find({
    options: {
      fields: {
        resources: 1
      }
    },
    query
  })

  if (keys.length === 0) {
    return Promise.reject(new Error('KEY_NOT_FOUND'))
  }

  const resources = new ACLMatrix(keys[0].resources)

  if (!resources.get(resourceName)) {
    return Promise.reject(new Error('KEY_DOES_NOT_HAVE_RESOURCE'))
  }

  resources.set(resourceName, access)

  const update = await this.model.update({
    query,
    rawOutput: true,
    update: {
      resources: resources.getAll({
        getArrayNotation: true,
        stringifyObjects: true
      })
    },
    validate: false
  })

  return {
    results: update.results.map(client => this.formatForOutput(client))
  }
}

/**
 * Sets a callback to be fired after data has been modified, so that
 * other components have the change to act on the new data.
 *
 * @param {Function} callback
 */
Key.prototype.setWriteCallback = function(callback) {
  this.saveCallback = callback
}

/**
 * Performs validation on a candidate key. It returns a Promise
 * that is rejected with an error object if validation fails, or
 * resolved with `undefined` otherwise.
 *
 * @param  {Object}   key
 * @param  {Boolean}  options.isUpdate
 * @return {Promise}
 */
Key.prototype.validate = async function(key, {isUpdate = false} = {}) {
  try {
    // If we're validating an update, we don't allow a `resources` property
    // to be set directly, so we exclude it from the schema.
    const schema = Object.assign({}, this.schema, {
      resources: isUpdate ? null : this.schema.resources
    })

    await validator.validateDocument({
      document: key,
      isUpdate,
      schema
    })

    if (key.resources) {
      Object.keys(key.resources).forEach(resourceKey => {
        validator.validateAccessMatrix(
          key.resources[resourceKey],
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

module.exports = new Key()
