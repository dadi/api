'use strict'

const config = require('./../../../config')
const Connection = require('./connection')
const dadiMetadata = require('@dadi/metadata')
const deepMerge = require('deepmerge')
const fields = require('./../fields')
const History = require('./history')
const logger = require('@dadi/logger')
const Search = require('./../search')
const Validator = require('@dadi/api-validator')

const DEFAULT_HISTORY_COLLECTION_SUFFIX = 'Versions'
const INTERNAL_PROPERTIES = [
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
  this.acl = require('./acl')

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

  // Set ACL key
  this.aclKey = settings.aclKey || `collection:${settings.database}_${name}`

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

  // Unless `enableVersioning` (or `storeRevisions`, for backward-compatibility)
  // is explicitly set to `false`, we enable history.
  if (
    this.settings.enableVersioning !== false &&
    this.settings.storeRevisions !== false
  ) {
    let versioningCollection = this.settings.versioningCollection ||
      this.settings.revisionCollection ||
      this.name + DEFAULT_HISTORY_COLLECTION_SUFFIX

    this.history = new History({
      database: this.settings.database,
      name: versioningCollection
    })
  }

  // Create connection for this model, if it doesn't exist.
  this.connection = connection || Connection(
    {
      collection: this.name,
      database: this.settings.database
    },
    this.name,
    config.get('datastore')
  )

  this.connection.setMaxListeners(35)

  if (config.get('env') !== 'test') {
    this.connection.once('disconnect', err => {
      logger.error({module: 'model'}, err)
    })
  }

  // Save reference to this model in the pool.
  _models[name] = this

  // Setup validatior.
  this.validator = new Validator({
    i18nFieldCharacter: config.get('i18n.fieldCharacter'),
    internalFieldsPrefix: config.get('internalFieldsPrefix')
  })

  // Create indexes.
  if (this.settings.index) {
    this.createIndex()
  }

  // Compile a list of hooks by field type.
  this.hooks = this._compileFieldHooks()
}

/**
 * Builds an empty response in the expected format, containing
 * a results array and a metadata block.
 *
 * @param  {Object} options
 * @return {ResultSet}
 */
Model.prototype._buildEmptyResponse = function (options = {}) {
  return {
    results: [],
    metadata: dadiMetadata(options, 0)
  }
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
Model.prototype._createValidationError = function (message, data, {
  originalDocuments
} = {}) {
  const error = new Error(message || 'Model Validation Failed')

  error.statusCode = 400
  error.success = false

  // We're checking for the specific case where the only reason for which the
  // validation failed was because there are one or more required fields that
  // were present in the request but the client does not have permissions to
  // write it (i.e. `create.fields` in ACL). When that happens, we flag the
  // corresponding error entries as `ERROR_UNAUTHORISED` and change the status
  // code from 400 (Bad request) to 403 (Forbidden).
  if (originalDocuments && Array.isArray(data)) {
    let is403 = true

    data.some(error => {
      let {code, field} = error

      if (code === 'ERROR_REQUIRED') {
        let fieldIsInAllDocuments = originalDocuments.every(document => {
          return document[field] !== undefined && document[field] !== null
        })

        is403 = is403 && fieldIsInAllDocuments

        if (fieldIsInAllDocuments) {
          error.code = 'ERROR_UNAUTHORISED'
          error.message =
            'is a required field which the client has no permission to write to'
        }
      } else {
        is403 = false

        return true
      }
    })

    if (is403) {
      error.statusCode = 403
    }
  }

  if (data) {
    error.errors = data
  }

  return error
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
  let fields = null

  // Based on the access matrix we may receive, `fields` may contain a field
  // projection, which the formatted documents will need to comply with.
  if (data.access !== true) {
    if (data.access === false) {
      fields = {
        _id: 1
      }
    } else if (data.access && data.access.fields) {
      fields = data.access.fields
    }
  }

  return Promise.all(
    documents.map(document => {
      if (!document) {
        return null
      }

      if (typeof document === 'string') {
        return document
      }

      // A field projection from the actual fields present in the document.
      let documentFields = Object.keys(document).reduce((result, field) => {
        result[field] = 1

        return result
      }, {})

      // If `fields` is defined, we need to filter out any fields that are
      // not supposed to be there due to ACL permissions.
      if (fields) {
        documentFields = this._mergeQueryAndAclFields(
          fields,
          documentFields
        )
      }

      return Object.keys(document).sort().reduce((result, field) => {
        // If `fields` is defined, we filter out any fields that are not
        // part of that projection (excluding _id).
        if (field !== '_id' && documentFields[field] !== 1) {
          return result
        }

        return result.then(newDocument => {
          let hookName = formatForInput
            ? 'beforeSave'
            : 'beforeOutput'

          // The hook will receive the portion of the document that
          // corresponds to the field in question, including any language
          // variations.
          let subDocument = Object.keys(document)
            .reduce((subDocument, rawField) => {
              let canonicalField = rawField.split(
                config.get('i18n.fieldCharacter')
              )[0]

              if (canonicalField === field) {
                subDocument[rawField] = document[rawField]
              }

              return subDocument
            }, {})

          return this.runFieldHooks({
            config,
            data: Object.assign({}, data, { document }),
            input: subDocument,
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
 * Takes two sets of field projection fields, one from a query and the
 * other from an ACL rule that will affect the query, and combines them
 * into one.
 *
 * @param  {Object} query
 * @param  {Object} acl
 * @return {Object}
 */
Model.prototype._mergeQueryAndAclFields = function (query, acl) {
  if (!query || !Object.keys(query).length) {
    return acl
  }

  if (!acl || !Object.keys(acl).length) {
    return query
  }

  const isExclusion = fields => {
    return Object.keys(fields).some(field => {
      return field !== '_id' && fields[field] === 0
    })
  }

  let result
  let queryIsExclusion = isExclusion(query)
  let aclIsExclusion = isExclusion(acl)

  if (queryIsExclusion) {
    if (aclIsExclusion) {
      result = Object.assign({}, query)

      Object.keys(acl).forEach(field => {
        result[field] = acl[field]
      })
    } else {
      result = {}

      Object.keys(acl).forEach(field => {
        if (query[field] === undefined) {
          result[field] = acl[field]
        }
      })
    }
  } else {
    if (aclIsExclusion) {
      result = {}

      Object.keys(query).forEach(field => {
        if (acl[field] === undefined) {
          result[field] = query[field]
        }
      })
    } else {
      result = {}

      Object.keys(query).forEach(field => {
        if (acl[field]) {
          result[field] = query[field]
        }
      })

      if (Object.keys(result).length === 0) {
        throw new Error('Empty field set')
      }
    }
  }

  return result
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
    if (!INTERNAL_PROPERTIES.includes(field)) {
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
    let errorObject = {
      field,
      message: error.message
    }

    if (error.code) {
      errorObject.code = error.code
    }

    logger.error({module: 'field hooks'}, error)

    return Promise.reject(
      this._createValidationError('Validation failed', [errorObject])
    )
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

/**
 * This is a convenience method for determining whether a client has
 * access to a client resource, as well as creating or augmenting the
 * a series of variables useful for processing a query with ACL.
 *
 * It receives a client object ({clientId, accessType}), a document
 * object (which may be an update object or a new document entirely),
 * a fields and query objects, and an access type (e.g. 'read'). If
 * the client does not have permission to access the resource, the
 * resulting Promise is rejected with an 'UNAUTHORISED' error; otherwise,
 * the Promise is resolved with a {document, fields, query} object, with
 * the augmented document, fields and query objects.
 *
 * Optionally, it can also receive an `access` object, which prevents the
 * function from getting the access matrix from the database. This can be
 * useful when calling the method consecutively for different access types,
 * where the result of the first call can be used as a cached value for the
 * others.
 *
 * @param  {Object}   options.access
 * @param  {Object}   options.client
 * @param  {Object}   options.documents
 * @param  {Object}   options.fields
 * @param  {Object}   options.query
 * @param  {Object}   options.schema
 * @param  {String}   options.type
 * @param  {String}   options.value
 * @return {Promise}
 */
Model.prototype.validateAccess = function ({
  access,
  client,
  documents,
  fields = {},
  query = {},
  schema = this.schema,
  type
}) {
  if (!client) {
    return Promise.resolve({
      documents,
      fields,
      query,
      schema
    })
  }

  // Ensuring documents is in array format.
  let normalisedDocuments = Array.isArray(documents)
    ? documents
    : documents && [documents]

  if (this.settings) {
    // If the collection has an `authenticate` property and it's set to
    // `false`, then access is granted.
    if (this.settings.authenticate === false) {
      return Promise.resolve({
        documents,
        fields,
        query,
        schema
      })
    }

    // If the collection has an `authenticate` property and it's an array,
    // we must check the type of access that is being attempted against the
    // list of HTTP verbs that must be authenticated.
    if (Array.isArray(this.settings.authenticate)) {
      let authenticatedVerbs = this.settings.authenticate.map(
        s => s.toLowerCase()
      )

      if (
        (type === 'create' && !authenticatedVerbs.includes('post')) ||
        (type === 'delete' && !authenticatedVerbs.includes('delete')) ||
        (type === 'read' && !authenticatedVerbs.includes('get')) ||
        (type === 'update' && !authenticatedVerbs.includes('put'))
      ) {
        return Promise.resolve({
          documents,
          fields,
          query,
          schema
        })
      }
    }
  }

  let accessQueue = access
    ? Promise.resolve(access)
    : this.acl.access.get(client, this.aclKey)

  return accessQueue.then(access => {
    let value = access[type]

    if (!value) {
      return Promise.reject(
        this.acl.createError(client)
      )
    }

    if (value.filter) {
      let conflict = Object.keys(value.filter).some(field => {
        return (
          query[field] !== undefined &&
          JSON.stringify(query[field]) !== JSON.stringify(value.filter[field])
        )
      })

      query = conflict
        ? new Error('EMPTY_RESULT_SET')
        : Object.assign({}, query, value.filter)
    }

    if (value.fields) {
      let candidateFields = fields

      // If we're dealing with a create or update request, then the candidate
      // fields are not the ones sent via the `fields` URL parameter (assigned
      // to `fields`), but the fields present in the actual create/upload
      // payload.
      if (normalisedDocuments) {
        candidateFields = normalisedDocuments.reduce((fields, document) => {
          if (document && typeof document === 'object') {
            Object.keys(document).forEach(field => {
              fields[field] = 1
            })
          }

          return fields
        }, {})
      }

      try {
        fields = this._mergeQueryAndAclFields(
          candidateFields,
          value.fields
        )
      } catch (err) {
        return Promise.reject(err)
      }

      // If we're dealing with a create or update request, we must filter the
      // payload to ensure that the document(s) only contain the fields which
      // the client has access to.
      if (normalisedDocuments) {
        normalisedDocuments = normalisedDocuments.map(document => {
          if (!document || typeof document !== 'object') {
            return document
          }

          let newDocument = {}

          Object.keys(document).forEach(field => {
            if (field === '_id' || fields[field]) {
              newDocument[field] = document[field]
            }
          })

          return newDocument
        })
      }
    }

    let newDocuments = Array.isArray(documents)
      ? normalisedDocuments
      : documents && normalisedDocuments[0]
    let newSchema = this.acl.access.filterFields(access, schema)

    return {
      access,
      documents: newDocuments,
      fields,
      query,
      schema: newSchema
    }
  })
}

/**
 * Validates a query object and returns an object with `success`
 * indicating whether validation has failed or passed, and an
 * `errors` array with any resulting validation errors.
 *
 * @param  {Object} query
 * @return {Object}
 */
Model.prototype.validateQuery = function (query) {
  let response = {
    success: true,
    errors: []
  }

  if (!Array.isArray(query) && Object(query) !== query) {
    response.success = false
    response.errors.push({
      message: 'Query must be either a JSON array or a JSON object.'
    })

    return response
  }

  Object.keys(query).every(key => {
    if (key === '$where') {
      response.success = false
      response.errors.push({
        message: `'$where' is not a valid query operator`
      })
    }
  })

  return response
}

Model.prototype.count = require('./collections/count')
Model.prototype.create = require('./collections/create')
Model.prototype.createIndex = require('./collections/createIndex')
Model.prototype.delete = require('./collections/delete')
Model.prototype.find = require('./collections/find')
Model.prototype.get = require('./collections/get')
Model.prototype.getIndexes = require('./collections/getIndexes')
Model.prototype.getRevisions = require('./collections/getRevisions')
Model.prototype.getStats = require('./collections/getStats')
Model.prototype.getVersions = require('./collections/getVersions')
Model.prototype.update = require('./collections/update')
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
