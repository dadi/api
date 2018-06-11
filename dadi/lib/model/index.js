'use strict'

const config = require('./../../../config')
const Connection = require('./connection')
const deepMerge = require('deepmerge')
const fields = require('./../fields')
const History = require('./history')
const logger = require('@dadi/logger')
const Search = require('./../search')
const Validator = require('./validator')

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

// Pool of initialised models.
let _models = {}

/**
 * Creates a new Model instance
 * @constructor
 * @classdesc
 */
const Model = function (name, schema, connection, settings) {
  this.internalProperties = [
    '_apiVersion',
    '_composed',
    '_createdAt',
    '_createdBy',
    '_history',
    '_id',
    '_lastModifiedAt',
    '_lastModifiedBy',
    '_version'
  ]

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

  // setup search context
  this.searchHandler = new Search(this)

  if (this.searchHandler.canUse()) {
    this.searchHandler.init()
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
      database: this.settings.database,
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

  // Create indexes.
  if (this.settings.index) {
    this.createIndex()
  }

  // Compile a list of hooks by field type.
  this.hooks = this._compileFieldHooks()
}

/**
 * Creates an object containing an array of field hooks grouped
 * by field type.
 *
 * @return {Object}
 */
Model.prototype._compileFieldHooks = function () {
  let hooks = {}

  Object.keys(fields).forEach(key => {
    let type = fields[key].type

    // Exit if the field doesn't export a `type` property.
    if (!type) return

    // Ensure `type` is an array.
    if (!Array.isArray(type)) {
      type = [type]
    }

    type.forEach(item => {
      let sanitisedItem = item.toString().toLowerCase()

      hooks[sanitisedItem] = hooks[sanitisedItem] || []
      hooks[sanitisedItem].push(fields[key])
    })
  })

  return hooks
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
 * @param {Object} data - data object for hooks
 * @return {Promise<ResultSet>}
 * @api private
 */
Model.prototype._formatResultSet = function (
  results,
  formatForInput,
  data = {}
) {
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

  return Promise.all(
    documents.map(document => {
      if (!document) return null
      if (typeof document === 'string') {
        return document
      }

      return Object.keys(document).sort().reduce((result, field) => {
        return result.then(newDocument => {
          let hookName = formatForInput
            ? 'beforeSave'
            : 'beforeOutput'

          return this.runFieldHooks({
            config,
            data: Object.assign({}, data, { document }),
            input: {
              [field]: document[field]
            },
            field,
            name: hookName
          }).then(subDocument => {
            // Doing a shallow merge (i.e. `Object.assign`) isn't enough here,
            // because several fields might need to write to the same property
            // in the document (e.g. `_composed`). We need a deep merge.
            return deepMerge(newDocument, subDocument)
          })
        })
      }, Promise.resolve({})).then(document => {
        let internals = this.connection.db.settings.internalProperties || []

        return Object.keys(document).sort().reduce((sanitisedDocument, field) => {
          const property = field.indexOf(prefixes.from) === 0
            ? prefixes.to + field.slice(1)
            : field

          // Stripping null values from the response.
          if (document[field] === null) {
            return sanitisedDocument
          }

          // Stripping internal properties (other than `_id`)
          if ((field !== '_id') && internals.includes(field)) {
            return sanitisedDocument
          }

          sanitisedDocument[property] = document[field]

          return sanitisedDocument
        }, {})
      })
    })
  ).then(newResultSet => {
    return multiple ? newResultSet : newResultSet[0]
  })
}

/**
 * Merges the value of `compose` in the schema settings
 * with a URL override and returns the computed value.
 *
 * @param  {Boolean} override
 * @return {Boolean}
 */
Model.prototype._getComposeValue = function (override) {
  let rawValue = override !== undefined
    ? override
    : this.settings.compose

  if (!rawValue) return 0

  switch (rawValue.toString()) {
    case 'true': return 1
    case 'all': return Infinity
    default: return parseInt(rawValue)
  }
}

/**
 * Returns the name of the id-collection mapping field
 * for a given reference field.
 *
 * @param  {String} fieldName - name of the reference field
 * @return {String}
 */
Model.prototype._getIdMappingName = function (fieldName) {
  return `_ref${fieldName[0].toUpperCase()}${fieldName.slice(1)}`
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

        this.formatForOutput(history).then(formattedHistory => {
          doc._history = formattedHistory

          if (idx === data.results.length - 1) {
            return resolve(data)
          }
        })
      })
    })
  })
}

/**
 * Transforms a query for execution, running all field hooks.
 *
 * @param  {Object} query
 * @return {Promise<Object>} transformed query
 */
Model.prototype._transformQuery = function (query, options) {
  let result = Promise.resolve({})
  let canonicalQuery = Object.keys(query).reduce((canonical, key) => {
    let rootNode = key.split('.')[0].split('@')[0]

    canonical[rootNode] = canonical[rootNode] || {}
    canonical[rootNode][key] = query[key]

    return canonical
  }, {})

  Object.keys(canonicalQuery).forEach(rootField => {
    result = result.then(transformedQuery => {
      return this.runFieldHooks({
        data: { options },
        field: rootField,
        input: canonicalQuery[rootField],
        name: 'beforeQuery'
      }).then(subQuery => {
        return Object.assign({}, transformedQuery, subQuery)
      })
    })
  })

  return result
}

/**
 * Formats a result set before it's fed into the model for insertion/update.
 *
 * @param {Object} results
 * @param {Object} data - data object for hooks
 * @return {ResultSet}
 * @api public
 */
Model.prototype.formatForInput = function (results, data = {}) {
  return this._formatResultSet(results, true, data)
}

/**
 * Formats a result set before it's sent to the client.
 *
 * @param {Object} results
 * @param {Object} data - data object for hooks
 * @return {ResultSet}
 * @api public
 */
Model.prototype.formatForOutput = function (results, data = {}) {
  return this._formatResultSet(results, false, data)
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
  let internalFieldsPrefix = config.get('internalFieldsPrefix')
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
 * Returns the field with a given name, if it exists.
 *
 * @param  {String} name
 * @return {Object} the field schema
 */
Model.prototype.getField = function (name) {
  return this.schema[name]
}

/**
 * Returns the lower-cased type of a field if it exists in the
 * collection, or `undefined` if it doesn't.
 *
 * @param  {String} field - name of the field
 * @param  {Object} schema - collection schema
 * @return {String} the field type
 */
Model.prototype.getFieldType = function (field) {
  if (
    !this.getField(field) ||
    !this.getField(field).type ||
    !this.getField(field).type.length
  ) {
    return undefined
  }

  return this.getField(field).type.toLowerCase()
}

/**
 * Returns a reference to the model of another collection.
 *
 * @param  {String} name - name of the collection
 * @return {Model}
 */
Model.prototype.getForeignModel = function (name) {
  return _models[name]
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

  // Check for dot-notation, verifying the existence of the
  // root node.
  let rootNode = key.split('.')[0]

  return Boolean(this.schema[rootNode])
}

/**
 * Strips all the internal properties from a document.
 *
 * @param  {Object} document
 * @return {Object} sanitised document
 */
Model.prototype.removeInternalProperties = function (document) {
  return Object.keys(document).reduce((output, field) => {
    if (!this.internalProperties.includes(field)) {
      output[field] = document[field]
    }

    return output
  }, {})
}

/**
 * Runs all hooks with a given name associated with a field,
 * returning a Promise with the result.
 *
 * @param  {Object} data - optional data object
 * @param  {String} field - field name
 * @param  {Object} input - hook input
 * @param  {String} name - hook name
 * @return {Promise<Object>} input after hooks
 */
Model.prototype.runFieldHooks = function ({
  data = {},
  field,
  input,
  name
}) {
  let fieldType = this.getFieldType(field)
  let queue = Promise.resolve(input)

  if (!this.hooks[fieldType]) {
    return Promise.resolve(input)
  }

  this.hooks[fieldType].forEach(hook => {
    if (typeof hook[name] === 'function') {
      queue = queue.then(query => {
        return hook[name].call(
          this,
          Object.assign({}, data, {
            config,
            field,
            input,
            schema: this.getField(field)
          })
        )
      })
    }
  })

  return queue.catch(error => {
    let hookError = new Error('BAD_REQUEST')

    hookError.errors = [
      {
        field,
        message: error.message
      }
    ]

    return Promise.reject(hookError)
  })
}

/**
 * Returns whether the current level of nested reference fields
 * should be composed, based on the collection settings, the level
 * of nesting and an override value of `compose`, coming from the URL.
 *
 * @param  {Number}  options.level
 * @param  {Boolean} options.composeOverride
 * @return {Boolean}
 */
Model.prototype.shouldCompose = function ({
  level = 1,
  composeOverride = false
}) {
  // A value of 'all' enables composition on every level.
  if (composeOverride === 'all') return true

  // If `compose` is `false`, we disable composition.
  if (composeOverride === 'false') return false

  let overrideString = composeOverride.toString()
  let overrideNumber = parseInt(composeOverride)

  // If the value is a number, we compose up to that level.
  if (overrideNumber.toString() === overrideString) {
    return level <= overrideNumber
  }

  // If `compose` is `true`, we compose on the first level
  // and then rely on the collection-wide settings for the
  // remaining levels.
  if (overrideString === 'true' && level === 1) {
    return true
  }

  return Boolean(this.settings.compose)
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
Model.prototype.search = require('./search')

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
