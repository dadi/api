// const collection = require('./collection')
const config = require('../../../../config.js')
const Connection = require('../connection')
const Model = require('../index')
const Fields = require('./fields')

const ERROR_FORBIDDEN = 'FORBIDDEN'
const ERROR_UNAUTHORISED = 'UNAUTHORISED'

const Schema = function () {
  this.schema = {
    name: {
      required: true,
      type: 'string'
    },
    version: {
      required: true,
      type: 'string'
    },
    database: {
      required: true,
      type: 'string'
    },
    fields: {
      required: true,
      type: 'object'
    },
    settings: {
      required: true,
      type: 'object'
    }
  }

  this.connect()
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
Schema.prototype.broadcastWrite = function (input) {
  if (typeof this.saveCallback === 'function') {
    return this.saveCallback().then(() => input)
  }

  return Promise.resolve(input)
}

Schema.prototype.connect = function () {
  let schemaConnection = Connection(
    {
      collection: config.get('schemas.schemaCollection'),
      database: config.get('schemas.database'),
      override: true
    }
  )

  let schemaModel = Model(
    config.get('schemas.schemaCollection'),
    {},
    schemaConnection,
    {
      compose: false,
      database: config.get('schemas.database'),
      storeRevisions: false
    }
  )

  this.setModel(schemaModel)
}

Schema.prototype.createError = function (client) {
  // If the client exists and there is no error associated with it, it
  // means that a valid bearer token was supplied, but it doesn't have the
  // right permissions to perform the operation - i.e. the request is
  // authenticated, just not authorised. That is a 403. In any other case,
  // the request is unauthorised, so a 401 is returned.
  if (client && client.clientId && !client.error) {
    return new Error(ERROR_FORBIDDEN)
  }

  return new Error(ERROR_UNAUTHORISED)
}

/**
 * Creates a Collection.
 *
 * @param  {Object} Collection
 * @return {Promise<Object>}
 */
Schema.prototype.create = function (collection) {
  return this.validate(collection).then(() => {
    return this.model.find({
      query: {
        name: collection.name
      }
    })
  }).then(({results}) => {
    if (results.length > 0) {
      return Promise.reject(
        new Error('COLLECTION_EXISTS')
      )
    }

    return Fields
      .validateFields(collection.fields)
      .then(() => {
        return this.model.create({
          documents: [collection],
          rawOutput: true,
          validate: false
        })
      })
  }).then(result => {
    return this.broadcastWrite(result)
  })
}

/**
 * Deletes a Collection.
 *
 * @param  {Object} collection
 * @return {Promise<Object>}
 */
Schema.prototype.delete = function (collection) {
  return this.model.delete({
    query: collection
  }).then(result => {
    return this.broadcastWrite(result)
  })
}

/**
 * Sanitises a Collection, preparing it for output.
 *
 * @param  {Object} Collection
 * @return {Object}
 */
Schema.prototype.formatForOutput = function (collection) {
  let sanitisedCollection = Object.keys(this.schema).reduce((output, key) => {
    if (!this.schema[key].hidden) {
      output[key] = collection[key] || this.schema[key].default

      if (key === 'settings') {
        output[key] = collection[key] || {}
      }
    }

    return output
  }, {})

  return sanitisedCollection
}

/**
 * Retrieves the Collection that matches `name` if it is
 * supplied; otherwise, all Collections are returned.
 *
 * @param  {String|Array<String>} names
 * @return {Promise<Object>}
 */
Schema.prototype.get = function (collection) {
  let query = {}

  if (collection) {
    query = Object.assign({}, collection)
  }

  return this.model.find({
    query
  }).then(response => {
    let formattedResults = response.results.map(result => {
      return this.formatForOutput(result)
    })

    return Promise.all(formattedResults).then(results => {
      return {
        results: results
      }
    })
  })
}

Schema.prototype.setModel = function (model) {
  this.model = model
}

/**
 * Sets a callback to be fired after data has been modified, so that
 * other components have the change to act on the new data.
 *
 * @param {Function} callback
 */
Schema.prototype.setWriteCallback = function (callback) {
  this.saveCallback = callback
}

/**
 * Updates a collection.
 *
 * @param  {Object} collection
 * @param  {Object} update
 * @return {Promise<Object>}
 */
Schema.prototype.update = function (collection, update, type) {
  let query = {
    name: collection.name
  }

  return this.model.find({
    query
  }).then(({results}) => {
    if (results.length === 0) {
      return Promise.reject(
        new Error('COLLECTION_NOT_FOUND')
      )
    }

    let collection = results[0]
    let validate = Promise.resolve()

    if (type === 'fields') {
      validate = Fields.validateFields(update)
    }

    return validate
      .then(() => {
        let updateObj = {}
        updateObj[type] = Object.assign({}, collection[type], update)

        return this.model.update({
          query: {
            name: collection.name
          },
          rawOutput: true,
          update: updateObj,
          validate: false
        })
        .then(result => {
          return this.broadcastWrite(result)
        })
      })
  })
}

/**
 * Performs validation on a candidate collection. It returns a Promise
 * that is rejected with an error object if validation fails, or
 * resolved with `undefined` otherwise.
 *
 * @param  {String}   collection
 * @param  {Boolean}  options.partial Whether this is a partial value
 * @return {Promise}
 */
Schema.prototype.validate = function (collection, {partial = false} = {}) {
  let missingFields = Object.keys(this.schema).filter(field => {
    return this.schema[field].required && collection[field] === undefined
  })

  if (!partial && missingFields.length > 0) {
    let error = new Error('MISSING_FIELDS')

    error.data = missingFields

    return Promise.reject(error)
  }

  let invalidFields = Object.keys(this.schema).filter(field => {
    if (
      collection[field] !== undefined &&
      this.schema[field].allowedInInput === false
    ) {
      return true
    }

    return (
      collection[field] !== undefined &&
      collection[field] !== null &&
      typeof collection[field] !== this.schema[field].type
    )
  })

  Object.keys(collection).forEach(field => {
    if (!this.schema[field]) {
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

module.exports = new Schema()

module.exports.Schema = Schema
module.exports.ERROR_FORBIDDEN = ERROR_FORBIDDEN
module.exports.ERROR_UNAUTHORISED = ERROR_UNAUTHORISED
