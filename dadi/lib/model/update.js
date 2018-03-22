const async = require('async')
const debug = require('debug')('api:model')
const Hook = require('./hook')
const logger = require('@dadi/logger')
const queryUtils = require('./utils')

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
 * Finds documents in the database, running any configured hooks
 * and formatting the result set for final output.
 *
 * @param  {Object} query - query to match documents against
 * @param  {Object} options
 * @param  {Object} req - request object to pass to hooks
 * @return {Promise<ResultSet>}
 */

/**
 * @param  {Object}  query - query to match documents against
 * @param  {Object}  update - properties to update documents with
 * @param  {Object}  internals - internal properties to inject in documents
 * @param  {Boolean} rawOutput - whether to bypass output formatting
 * @param  {Object}  req - request object to pass to hooks
 * @return {Promise<Array.ResultSet>} set of updated documents
 */
function update ({
  query = {},
  update,
  internals = {},
  rawOutput = false,
  req
}) {
  debug(
    'Model update: %s %o %o %o',
    req ? req.url : '',
    query,
    update,
    internals
  )

  if (!this.connection.db) {
    return Promise.reject(
      new Error('DB_DISCONNECTED')
    )
  }

  // Validate the query.
  let validation = this.validate.query(query)

  if (!validation.success) {
    let error = this._createValidationError('Bad Query')

    error.json = validation

    return Promise.reject(error)
  }

  // Validate the update.
  validation = this.validate.schema(update, true)

  if (!validation.success) {
    let error = this._createValidationError()

    error.json = validation

    return Promise.reject(error)
  }

  // Format the query.
  query = this.formatQuery(query)

  // Is this a RESTful query by ID?
  const isRestIDQuery = req && req.params.id

  // Convert DateTimes.
  update = queryUtils.convertDateTimeForSave(this.schema, update)

  // Add any internal fields to the update.
  Object.assign(update, internals)

  // Set API version.
  this.composer.setApiVersion(internals._apiVersion)

  // Get a reference to the documents that will be updated.
  let updatedDocuments = []

  return this.find({
    query
  }).then(result => {
    // Create a copy of the documents that matched the find
    // query, as these will be updated and we need to send back
    // to the client a full result set of modified documents.
    updatedDocuments = queryUtils.snapshot(result.results)

    return new Promise((resolve, reject) => {
      this.composer.createFromComposed(update, req, (error, result) => {
        if (error) {
          return reject(error.json)
        }

        resolve()
      })
    })
  }).then(() => {
    // Run any `beforeUpdate` hooks.
    if (this.settings.hooks && this.settings.hooks.beforeUpdate) {
      return new Promise((resolve, reject) => {
        async.reduce(this.settings.hooks.beforeUpdate, update, (current, hookConfig, callback) => {
          let hook = new Hook(hookConfig, 'beforeUpdate')

          Promise.resolve(hook.apply(current, updatedDocuments, this.schema, this.name, req))
            .then(newUpdate => {
              callback((newUpdate === null) ? {} : null, newUpdate)
            }).catch(err => {
              callback(hook.formatError(err))
            })
        }, (error, newUpdate) => {
          if (error) {
            reject(error)
          }

          resolve(newUpdate)
        })
      })
    }

    return update
  }).then(update => {
    return this.connection.db.update({
      collection: this.name,
      options: {
        multi: true
      },
      query,
      schema: this.schema,
      update: {
        $set: update,
        $inc: { _version: 1 }
      }
    })
  }).then(({matchedCount}) => {
    if (isRestIDQuery && (matchedCount === 0)) {
      let error = new Error('Not Found')

      error.statusCode = 404

      return Promise.reject(error)
    }

    // Create a revision for each of the updated documents.
    if (this.history) {
      return this.history.createEach(
        updatedDocuments,
        'update',
        this
      )
    }
  }).then(() => {
    let updatedDocumentsQuery = {
      _id: {
        '$in': updatedDocuments.map(doc => doc._id.toString())
      }
    }

    return this.find({
      query: updatedDocumentsQuery,
      options: {
        compose: true
      }
    })
  }).then(data => {
    if (data.results.length === 0) {
      return data
    }

    // Run any `afterUpdate` hooks.
    if (this.settings.hooks && (typeof this.settings.hooks.afterUpdate === 'object')) {
      this.settings.hooks.afterUpdate.forEach((hookConfig, index) => {
        let hook = new Hook(this.settings.hooks.afterUpdate[index], 'afterUpdate')

        return hook.apply(data.results, this.schema, this.name)
      })
    }

    // Format result set for output.
    if (!rawOutput) {
      data.results = this.formatResultSetForOutput(data.results)
    }

    return data
  }).catch(error => {
    logger.error({ module: 'model' }, error)

    return Promise.reject(error)
  })
}

module.exports = function () {
  // Compatibility with legacy model API.
  // Signature: query, update, internals, done, req, bypassOutputFormatting
  if (arguments.length > 1) {
    let callback
    let legacyArguments = {
      query: arguments[0],
      rawOutput: arguments[5],
      req: arguments[4],
      update: arguments[1]
    }

    if (typeof arguments[2] === 'function') {
      callback = arguments[2]
      legacyArguments.internals = {}
    } else {
      callback = arguments[3]
      legacyArguments.internals = arguments[2]
    }

    update.call(this, legacyArguments)
      .then(response => callback && callback(null, response))
      .catch(error => callback && callback(error))

    return
  }

  return update.apply(this, arguments)
}