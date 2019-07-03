const async = require('async')
const Hook = require('./../hook')
const logger = require('@dadi/logger')
const search = require('./../search')
const workQueue = require('./../../workQueue')

/**
 * @typedef {Object} DeleteResult
 * @property {Number} deletedCount - number of documents deleted
 * @property {Number} totalCount - number of documents remaining in the collection
 */

/**
 * Deletes documents from the database.
 *
 * @param  {Object} client - client to check permissions for
 * @param  {String} description - optional update description
 * @param  {Object} query - query to find documents to delete
 * @param  {Object} req - request to be passed to hooks
 * @return {Promise<DeleteResult>}
 */
async function deleteFn({client, description, query: inputQuery, req}) {
  const database = await this.dataConnector
  const {hooks} = this.settings || {}

  // Is this a RESTful query by ID?
  const isRestIDQuery = req && req.params && req.params.id

  // Finding all documents.
  const {metadata: allDocuments} = await this.find({
    options: {
      compose: false,
      fields: {
        _id: 1
      }
    }
  })

  const {query} = await this.validateAccess({
    client,
    query: inputQuery,
    type: 'delete'
  })

  // If merging the request query with ACL data resulted in
  // an impossible query, we can simply return an empty result
  // set without even going to the database.
  if (query instanceof Error && query.message === 'EMPTY_RESULT_SET') {
    return {
      deletedCount: 0,
      totalCount: allDocuments.totalCount
    }
  }

  const validation = this.validateQuery(query)

  if (!validation.success) {
    const error = this._createValidationError('Validation Failed')

    error.json = validation

    return Promise.reject(error)
  }

  // Finding documents matching query.
  const {results: affectedDocuments} = await this.find({
    options: {
      compose: false
    },
    query
  })

  if (isRestIDQuery && affectedDocuments.length === 0) {
    const error = new Error('Document not found')

    error.statusCode = 404

    return Promise.reject(error)
  }

  let queryAfterHook = query

  // Run any `beforeDelete` hooks.
  if (hooks && hooks.beforeDelete) {
    queryAfterHook = await new Promise((resolve, reject) => {
      async.reduce(
        hooks.beforeDelete,
        query,
        (current, hookConfig, callback) => {
          const hook = new Hook(hookConfig, 'beforeDelete')
          const hookError = {}

          Promise.resolve(
            hook.apply(
              current,
              affectedDocuments,
              hookError,
              this.schema,
              this.name,
              req
            )
          )
            .then(newQuery => {
              callback(newQuery === null ? {} : null, newQuery || query)
            })
            .catch(error => {
              callback(hook.formatError(error))
            })
        },
        (error, result) => {
          if (error) return reject(error)

          resolve(result)
        }
      )
    })
  }

  const {deletedCount} = await database.delete({
    collection: this.name,
    query: queryAfterHook,
    schema: this.schema
  })

  if (deletedCount > 0) {
    // Run any `afterDelete` hooks.
    if (hooks && Array.isArray(hooks.afterDelete)) {
      hooks.afterDelete.forEach(hookConfig => {
        const hook = new Hook(hookConfig, 'afterDelete')

        hook.apply(queryAfterHook, affectedDocuments, this.schema, this.name)
      })
    }
  }

  // Add a background job to the work queue that deletes from the search
  // collection each reference to the documents that were just deleted.
  if (search.isEnabled()) {
    workQueue.queueBackgroundJob(() => {
      search.delete(affectedDocuments)
    })
  }

  return {
    deletedCount,
    totalCount: allDocuments.totalCount - deletedCount
  }
}

module.exports = function() {
  // Compatibility with legacy model API.
  // Signature: query, done, req
  if (arguments.length > 1) {
    let callback
    const legacyArguments = {
      query: arguments[0],
      req: arguments[2]
    }

    if (typeof arguments[1] === 'function') {
      callback = arguments[1]
    }

    deleteFn
      .call(this, legacyArguments)
      .then(response => callback && callback(null, response))
      .catch(error => callback && callback(error))

    return
  }

  return deleteFn.apply(this, arguments)
}
