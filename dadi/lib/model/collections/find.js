'use strict'

const config = require('./../../../../config')
const debug = require('debug')('api:model')

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

/**
 * Finds documents in the database.
 *
 * @param  {Object}  client - client to check permissions for
 * @param  {Boolean} isRestIDQuery - whether the query targets a specific document by ID
 * @param  {String}  language - ISO code for the language to translate documents to
 * @param  {Object}  query - query to match documents against
 * @param  {Object}  options
 * @param  {Number}  version - version of the document to retrieve
 * @return {Promise<ResultSet>}
 */
function find ({
  client,
  isRestIDQuery,
  query = {},
  options = {},
  version
} = {}) {
  if (!this.connection.db) {
    return Promise.reject(
      new Error('DB_DISCONNECTED')
    )
  }

  debug('Model find: %o %o', query, options)

  let queryFields = {}

  // Transforming the fields projection, if one is present. It
  // involves transforming reference fields with dot-notation,
  // as well as language variations of fields.
  if (options.fields && Object.keys(options.fields).length) {
    Object.keys(options.fields).forEach(field => {
      let baseField = field.split('.')[0]
      let [name, collection] = baseField.split('@')

      // If the projected field specifies a collection to search on
      // (e.g. author@people.name) and that collection is not the
      // one we're operating one, we exclude the field from the
      // projection.
      if (collection && (collection !== this.name)) {
        return
      }

      queryFields[name] = options.fields[field]

      // We must ensure that language variations are included/excluded
      // appropriately. We'll add a language variation to the projection
      // if we're dealing with an exclusion projection (i.e. if we exclude
      // a field, we can also exclude all its language variations) or if
      // the variation in question is the language requested (i.e. if we
      // include a field and request a certain language, we must also include
      // that corresponding variation).
      config.get('i18n.languages').forEach(supportedLanguage => {
        let langField = name + config.get('i18n.fieldCharacter') + supportedLanguage

        queryFields[langField] = options.fields[field]
      })

      // If we're limiting the fields we're requesting, we need to
      // ensure that any reference fields are accompanied by their
      // auxiliary collection mapping field.
      if (
        this.getFieldType(name) === 'reference' &&
        options.fields[field] === 1
      ) {
        let mappingField = this._getIdMappingName(name)

        queryFields[mappingField] = 1
      }
    })
  }

  // Run validation.
  let validation = this.validateQuery(query)

  if (!validation.success) {
    const err = this._createValidationError('Bad Query')

    err.json = validation

    return Promise.reject(err)
  }

  return this.validateAccess({
    client,
    fields: queryFields,
    query,
    type: 'read'
  }).then(({fields, query}) => {
    // If merging the request query with ACL data resulted in
    // an impossible query, we can simply return an empty result
    // set without even going to the database.
    if (
      query instanceof Error &&
      query.message === 'EMPTY_RESULT_SET'
    ) {
      return this._buildEmptyResponse(options)
    }

    queryFields = fields

    const queryOptions = Object.assign({}, options, {
      fields: queryFields
    })

    if (isRestIDQuery && version && this.history) {
      return this.history.getVersion(version, queryOptions)
    }

    return this._transformQuery(query, options).then(query => {
      return this.connection.db.find({
        query,
        collection: this.name,
        options: queryOptions,
        schema: this.schema,
        settings: this.settings
      })
    })
  })
}

module.exports = function () {
  // Compatibility with legacy model API.
  // Signature: query, options, done
  if (arguments.length > 1) {
    let callback
    let legacyArguments = {
      query: arguments[0]
    }

    if (typeof arguments[1] === 'function') {
      callback = arguments[1]
      legacyArguments.options = {}
    } else {
      callback = arguments[2]
      legacyArguments.options = arguments[1]
    }

    find.call(this, legacyArguments)
      .then(response => callback && callback(null, response))
      .catch(error => callback && callback(error))

    return
  }

  return find.apply(this, arguments)
}
