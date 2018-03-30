'use strict'

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
 * @param  {Object} query - query to match documents against
 * @param  {Object} options
 * @return {Promise<ResultSet>}
 */
function find ({
  query = {},
  options = {}
} = {}) {
  if (!this.connection.db) {
    return Promise.reject(
      new Error('DB_DISCONNECTED')
    )
  }

  debug('Model find: %o %o', query, options)

  // Run validation.
  const validation = this.validate.query(query)

  if (!validation.success) {
    const err = this._createValidationError('Bad Query')

    err.json = validation

    return Promise.reject(err)
  }

  return this._transformQuery(query).then(query => {
    return this.connection.db.find({
      query,
      collection: this.name,
      options: Object.assign({}, options, {
        compose: undefined,
        historyFilters: undefined
      }),
      schema: this.schema,
      settings: this.settings
    })
  }).then(response => {
    if (options.includeHistory) {
      options.includeHistory = undefined

      return this._injectHistory(response, options)
    }

    return response
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
