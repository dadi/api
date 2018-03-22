'use strict'

const path = require('path')
const Composer = require(path.join(__dirname, '/composer')).Composer
const config = require(path.join(__dirname, '/../../../config'))
const Connection = require(path.join(__dirname, '/connection'))
const History = require(path.join(__dirname, '/history'))
const logger = require('@dadi/logger')
const Validator = require(path.join(__dirname, '/validator'))

/**
 * Block with metadata pertaining to an API collection.
 *
 * @typedef {Object} Metadata
 * @property {Number} page - current page
 * @property {Number} offset - offset from start of collection
 * @property {Number} totalCount - total number of documents
 * @property {Number} totalPages - total number of pages
 * @property {Number} nextPage - number of next available page
 * @property {Number} prevPage - number of previous available page
 */

/**
 * @typedef {Object} ResultSet
 * @property {Metadata} metadata - object with collection metadata
 * @property {Array} results - list of documents
 */

// track all models that have been instantiated by this process
let _models = {}

/**
 * Creates a new Model instance
 * @constructor
 * @classdesc
 */
const Model = function (name, schema, connection, settings) {
  // Attach collection name.
  this.name = name

  // Attach original schema.
  if (_models[name] && (!schema || !Object.keys(schema).length)) {
    this.schema = _models[name].schema
  } else {
    this.schema = schema
  }

  // Attach default settings.
  this.settings = Object.assign({}, settings, this.schema.settings)

  // Attach display name if supplied.
  if (this.settings.displayName) {
    this.displayName = this.settings.displayName
  }

  // Composable reference fields.
  if (this.settings.compose) {
    this.compose = this.settings.compose
  }

  // Add any configured indexes.
  if (this.settings.index && !Array.isArray(this.settings.index)) {
    this.settings.index = [
      {
        keys: this.settings.index.keys,
        options: this.settings.index.options || {}
      }
    ]
  }

  // Setup history context unless requested not to.
  this.storeRevisions = this.settings.storeRevisions !== false

  if (this.storeRevisions) {
    this.history = new History(this)

    // Define the name of the revision collection for this model.
    // If no value is specified, use the name of the model with
    // the 'History' suffix.
    this.revisionCollection = this.settings.revisionCollection
      ? this.settings.revisionCollection
      : this.name + 'History'
  }

  // Create connection for this model.
  if (connection) {
    this.connection = connection
  } else {
    let connectionOptions = {
      collection: this.name,
      database: settings.database,
      revisionCollection: this.revisionCollection
    }

    this.connection = Connection(
      connectionOptions,
      this.name,
      config.get('datastore')
    )
  }

  this.connection.setMaxListeners(35)

  if (config.get('env') !== 'test') {
    this.connection.once('disconnect', err => {
      logger.error({module: 'model'}, err)
    })
  }

  // Save reference to this model in the pool.
  _models[name] = this

  // Setup validatior.
  this.validate = new Validator(this)

  // Setup composer.
  this.composer = new Composer(this)

  // Create indexes.
  if (this.settings.index) {
    this.createIndex()
  }
}

/**
 * Creates a connection error object.
 *
 * @param {String} message
 * @return Error
 * @api private
 */
Model.prototype._createValidationError = function (message, data) {
  const err = new Error(message || 'Model Validation Failed')
  err.statusCode = 400

  return err
}

/**
 * Formats a result for being sent to the client (formatForInput = false)
 * or to be fed into the model (formatForInput = true)
 *
 * @param {Object} results
 * @param {Boolean} formatForInput
 * @return {ResultSet}
 * @api private
 */
Model.prototype._formatResultSet = function (results, formatForInput) {
  const multiple = Array.isArray(results)
  const documents = multiple ? results : [results]
  const prefixes = {
    from: formatForInput
      ? config.get('internalFieldsPrefix')
      : '_',
    to: formatForInput
      ? '_'
      : config.get('internalFieldsPrefix')
  }

  let newResultSet = []

  documents.forEach(document => {
    const internalProperties = this.connection.db.settings.internalProperties || []
    let newDocument = {}

    Object.keys(document).sort().forEach(field => {
      const property = field.indexOf(prefixes.from) === 0
        ? prefixes.to + field.slice(1)
        : field

      // Stripping null values from the response.
      if (document[field] === null) {
        return
      }

      // Stripping internal properties (other than `_id`)
      if ((field !== '_id') && internalProperties.includes(field)) {
        return
      }

      newDocument[property] = document[field]
    })

    newResultSet.push(newDocument)
  })

  return multiple ? newResultSet : newResultSet[0]
}

/**
 * Attaches the full history of each document and returns
 * the modified result set.
 *
 * @return {ResultSet}
 * @api private
 */
Model.prototype._injectHistory = function (data, options) {
  return new Promise((resolve, reject) => {
    if (data.results.length === 0) {
      return resolve(data)
    }

    data.results.forEach((doc, idx) => {
      this.revisions(doc._id, options, (err, history) => {
        if (err) logger.error({module: 'model'}, err)

        doc._history = this.formatResultSetForOutput(history)

        if (idx === data.results.length - 1) {
          return resolve(data)
        }
      })
    })
  })
}

/**
 * Performs a last round of formatting to the query before it's
 * delivered to the data adapters
 *
 * @param {Object} query
 * @return An object representing the formatted query
 * @api public
 */
Model.prototype.formatQuery = function (query) {
  const internalFieldsPrefix = config.get('internalFieldsPrefix')
  let newQuery = {}

  Object.keys(query).forEach(key => {
    if (
      internalFieldsPrefix !== '_' &&
      key.indexOf(internalFieldsPrefix) === 0
    ) {
      newQuery['_' + key.slice(1)] = query[key]
    } else {
      newQuery[key] = query[key]
    }
  })

  return newQuery
}

/**
 * Formats a result set before it's fed into the model for insertion/update.
 *
 * @param {Object} results
 * @return {ResultSet}
 * @api public
 */
Model.prototype.formatResultSetForInput = function (results) {
  return this._formatResultSet(results, true)
}

/**
 * Formats a result set before it's sent to the client.
 *
 * @param {Object} results
 * @return {ResultSet}
 * @api public
 */
Model.prototype.formatResultSetForOutput = function (results) {
  return this._formatResultSet(results, false)
}

/**
 * Determines whether the given string is a valid key for
 * the model
 *
 * @param {String} key
 * @return A Boolean indicating whether the key is valid
 * @api public
 */
Model.prototype.isKeyValid = function (key) {
  if (key === '_id' || this.schema[key] !== undefined) {
    return true
  }

  // Check for dot notation so we can determine the datatype
  // of the first part of the key.
  if (key.indexOf('.') > 0) {
    const keyParts = key.split('.')

    if (this.schema[keyParts[0]] !== undefined) {
      if (/Mixed|Object|Reference/.test(this.schema[keyParts[0]].type)) {
        return true
      }
    }
  }
}

Model.prototype.count = require('./count')
Model.prototype.create = require('./create')
Model.prototype.createIndex = require('./createIndex')
Model.prototype.delete = require('./delete')
Model.prototype.find = require('./find')
Model.prototype.get = require('./get')
Model.prototype.getIndexes = require('./getIndexes')
Model.prototype.getRevisions = require('./getRevisions')
Model.prototype.getStats = require('./getStats')
Model.prototype.revisions = require('./getRevisions') // (!) Deprecated in favour of `getRevisions`
Model.prototype.stats = require('./getStats') // (!) Deprecated in favour of `getStats`
Model.prototype.update = require('./update')

module.exports = function (name, schema, connection, settings) {
  if (schema) {
    return new Model(
      name,
      schema,
      connection,
      settings
    )
  }

  return _models[name]
}

module.exports.Model = Model
