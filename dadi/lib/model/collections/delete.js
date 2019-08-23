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
function deleteFn({client, description, query, req}) {
  if (!this.connection.db) {
    return Promise.reject(new Error('DB_DISCONNECTED'))
  }

  // Is this a RESTful query by ID?
  const isRestIDQuery = req && req.params && req.params.id

  // A reference to all documents in the collection, so that we
  // know how many are left after the operation.
  let allDocuments = []

  // A reference to the documents affected by the query.
  let deletedDocuments = []

  return this.validateAccess({
    client,
    query,
    type: 'delete'
  })
    .then(({query: aclQuery}) => {
      const validation = this.validateQuery(aclQuery)

      if (!validation.success) {
        const error = this._createValidationError('Validation Failed')

        error.json = validation

        return Promise.reject(error)
      }

      // Op 1: Finding all documents
      return this.find({
        options: {
          compose: false,
          fields: {
            _id: 1
          }
        }
      }).then(documents => {
        return {
          aclQuery,
          documents
        }
      })
    })
    .then(({aclQuery, documents}) => {
      // If merging the request query with ACL data resulted in
      // an impossible query, we can simply return an empty result
      // set without even going to the database.
      if (
        aclQuery instanceof Error &&
        aclQuery.message === 'EMPTY_RESULT_SET'
      ) {
        return {
          deletedCount: 0,
          totalCount: documents.length
        }
      }

      query = this.formatQuery(aclQuery)

      allDocuments = documents

      // Op 2: Finding documents matching query
      return this.find({
        options: {
          compose: false
        },
        query
      })
        .then(({results}) => {
          deletedDocuments = results

          if (isRestIDQuery && deletedDocuments.length === 0) {
            const error = new Error('Document not found')

            error.statusCode = 404

            return Promise.reject(error)
          }

          // Create a revision for each of the updated documents.
          if (this.history && deletedDocuments.length > 0) {
            workQueue.queueBackgroundJob(() => {
              this.formatForInput(deletedDocuments).then(versions => {
                return this.history.addVersion(versions, {
                  author: client && client.clientId,
                  date: Date.now(),
                  description
                })
              })
            })
          }
        })
        .then(() => {
          // Run any `beforeDelete` hooks.
          if (this.settings.hooks && this.settings.hooks.beforeDelete) {
            return new Promise((resolve, reject) => {
              async.reduce(
                this.settings.hooks.beforeDelete,
                query,
                (current, hookConfig, callback) => {
                  const hook = new Hook(hookConfig, 'beforeDelete')
                  const hookError = {}

                  Promise.resolve(
                    hook.apply(
                      current,
                      deletedDocuments,
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

          return query
        })
        .then(query => {
          return this.connection.db
            .delete({
              collection: this.name,
              query,
              schema: this.schema
            })
            .then(result => {
              if (result.deletedCount > 0) {
                // Run any `afterDelete` hooks.
                if (
                  this.settings.hooks &&
                  typeof this.settings.hooks.afterDelete === 'object'
                ) {
                  this.settings.hooks.afterDelete.forEach(hookConfig => {
                    const hook = new Hook(hookConfig, 'afterDelete')

                    return hook.apply(
                      query,
                      deletedDocuments,
                      this.schema,
                      this.name
                    )
                  })
                }
              }

              return Object.assign({}, result, {
                totalCount:
                  allDocuments.metadata.totalCount - result.deletedCount
              })
            })
            .then(result => {
              // Add a background job to the work queue that deletes from the search
              // collection each reference to the documents that were just deleted.
              if (search.isEnabled()) {
                workQueue.queueBackgroundJob(() => {
                  search.delete(deletedDocuments)
                })
              }

              return result
            })
        })
    })
    .catch(error => {
      logger.error({module: 'model'}, error)

      return Promise.reject(error)
    })
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
