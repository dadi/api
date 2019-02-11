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

// Schema.prototype.getResources = function () {
//   return this.resources
// }

// Schema.prototype.hasResource = function (resource) {
//   return this.resources[resource] !== undefined
// }

// Schema.prototype.registerResource = function (name, description = null) {
//   this.resources[name] = {
//     description
//   }
// }

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

/**
 * Adds a field to a collection.
 *
 * @param  {String} collection     The collection name
 * @param  {String} resource The name of the resource
 * @param  {Object} access   Access matrix
 * @return {Promise<Object>}
 */
Schema.prototype.fieldAdd = function (collection, newField, access) {
  return this.model.find({
    options: {},
    query: {
      name: collection
    }
  }).then(({results}) => {
    if (results.length === 0) {
      return Promise.reject(
        new Error('COLLECTION_NOT_FOUND')
      )
    }

    // let resources = new ACLMatrix(
    //   results[0].resources
    // )

    // let fields = {}

    // if (fields.get(field)) {
    //   return Promise.reject(
    //     new Error('COLLECTION_HAS_FIELD')
    //   )
    // }
    newField.collection = collection

    return Fields.create(newField).then(x => {
      return this.model.update({
        query: {
          name: collection
        },
        rawOutput: true,
        update: {
          // resources: resources.getAll({
          //   getArrayNotation: true,
          //   stringifyObjects: true
          // })
        },
        validate: false
      })
    }).then(result => {
      return this.broadcastWrite(result)
    }).then(({results}) => {
      let formattedResults = results.map(result => {
        return this.formatForOutput(result)
      })

      return Promise.all(formattedResults).then(results => {
        return {
          results: results
        }
      })
    })
  })

  // resources.validate(access)
  // resources.set(resource, access)
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
Schema.prototype.update = function (collection, update) {
  return this.model.find({
    options: {
      fields: {
        _id: 0,
        secret: 0
      }
    },
    query: {
      name: collection.name
    }
  }).then(({results}) => {
    if (results.length > 0) {
      return Promise.reject(
        new Error('COLLECTION_EXISTS')
      )
    }

    return this.validate(update, {
      partial: true
    })
  }).then(() => {
    return this.model.update({
      query: {
        name: collection
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

  if (collection.extends) {
    return this.model.find({
      options: {
        fields: {
          _id: 1
        }
      },
      query: {
        name: collection.extends
      }
    }).then(({results}) => {
      if (results.length === 0) {
        return Promise.reject(
          new Error('INVALID_PARENT_collection')
        )
      }
    })
  }

  return Promise.resolve()
}

module.exports = new Schema()

module.exports.Schema = Schema
module.exports.ERROR_FORBIDDEN = ERROR_FORBIDDEN
module.exports.ERROR_UNAUTHORISED = ERROR_UNAUTHORISED
// module.exports.collection = collection
// module.exports.field = field
