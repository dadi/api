const async = require('async')
const debug = require('debug')('api:model')
const Hook = require('../hook')
const logger = require('@dadi/logger')
const search = require('../search')
const workQueue = require('../../workQueue')

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
 * @param  {Object} client - client to check permissions for
 * @param  {Boolean|Number} compose - the composition settings for the result
 * @param  {Object}  query - query to match documents against
 * @param  {String}  description - optional update description
 * @param  {Object}  update - properties to update documents with
 * @param  {Object}  internals - internal properties to inject in documents
 * @param  {Boolean} rawOutput - whether to bypass output formatting
 * @param  {Boolean} removeInternalProperties - whether to remove internal properties
 * @param  {Object}  req - request object to pass to hooks
 * @param  {Boolean} validate - whether to run validation
 * @return {Promise<Array.ResultSet>} set of updated documents
 */
function update({
  client,
  compose = true,
  description,
  internals = {},
  query = {},
  rawOutput = false,
  removeInternalProperties = true,
  req,
  update,
  validate = true
}) {
  debug(
    'Model update: %s %o %o %o',
    req ? req.url : '',
    query,
    update,
    internals
  )

  if (!this.connection.db) {
    return Promise.reject(new Error('DB_DISCONNECTED'))
  }

  // Add `lastModifiedAt` internal field.
  internals._lastModifiedAt = internals._lastModifiedAt || Date.now()

  // Is this a RESTful query by ID?
  const isRestIDQuery = req && req.params && req.params.id

  // Get a reference to the documents that will be updated.
  let updatedDocuments = []

  // Removing internal API properties from the update object.
  if (removeInternalProperties) {
    update = this.removeInternalProperties(update)
  }

  const {hooks} = this.settings

  // If an ACL check is performed, this variable will contain the resulting
  // access matrix.
  let aclAccess

  return this.validateAccess({
    client,
    documents: update,
    query,
    type: 'update'
  })
    .then(
      ({access, documents: newUpdate, owner = {}, query: aclQuery, schema}) => {
        aclAccess = access
        query = aclQuery
        update = newUpdate

        // Adding metadata about who is creating the document.
        if (owner.clientId) {
          internals._lastModifiedBy = owner.clientId
          internals._lastModifiedByKey = null
        } else if (owner.keyId) {
          internals._lastModifiedBy = null
          internals._lastModifiedByKey = owner.keyId
        }

        // If merging the request query with ACL data resulted in
        // an impossible query, we can simply return an empty result
        // set without even going to the database. We'll reject the
        // Promise now and catch this case at the end of the chain.
        if (query instanceof Error) {
          return Promise.reject(query)
        }

        if (!validate) return

        // Validating the query.
        const queryValidation = this.validateQuery(query)

        if (!queryValidation.success) {
          const error = this._createValidationError('Bad Query')

          error.json = queryValidation

          return Promise.reject(error)
        }

        return this.validator
          .validateDocument({
            document: update,
            isUpdate: true,
            schema
          })
          .catch(errors => {
            const error = this._createValidationError(
              'Validation Failed',
              errors
            )

            return Promise.reject(error)
          })
      }
    )
    .then(() => {
      // Format the query.
      query = this.formatQuery(query)

      return this.find({
        query
      })
    })
    .then(({results}) => {
      // Create a copy of the documents that matched the find
      // query, as these will be updated and we need to send back
      // to the client a full result set of modified documents.
      // We do a shallow copy of each document because, depending on
      // the data connector being used, we might have in-memory references
      // to the documents that get mutated by the update operation. This
      // ensures that `updatedDocuments` reflects the state of the
      // documents before the update operation.
      updatedDocuments = results.map(result => Object.assign({}, result))

      // Add any internal fields to the update.
      Object.assign(update, internals)

      // Run `beforeSave` hooks on update fields.
      return Object.keys(update)
        .reduce((result, field) => {
          if (field === '_id') {
            return result
          }

          return result.then(transformedUpdate => {
            return this.runFieldHooks({
              data: {
                internals,
                updatedDocuments
              },
              field,
              input: {
                [field]: update[field]
              },
              name: 'beforeSave'
            }).then(subDocument => {
              return Object.assign({}, transformedUpdate, subDocument)
            })
          })
        }, Promise.resolve({}))
        .then(transformedUpdate => {
          update = transformedUpdate

          // Run any `beforeUpdate` hooks.
          if (hooks && hooks.beforeUpdate) {
            return new Promise((resolve, reject) => {
              async.reduce(
                hooks.beforeUpdate,
                update,
                (current, hookConfig, callback) => {
                  const hook = new Hook(hookConfig, 'beforeUpdate')

                  Promise.resolve(
                    hook.apply(
                      current,
                      updatedDocuments,
                      this.schema,
                      this.name,
                      req
                    )
                  )
                    .then(newUpdate => {
                      callback(newUpdate === null ? {} : null, newUpdate)
                    })
                    .catch(err => {
                      callback(hook.formatError(err))
                    })
                },
                (error, newUpdate) => {
                  if (error) {
                    reject(error)
                  }

                  resolve(newUpdate)
                }
              )
            })
          }

          return update
        })
        .then(update => {
          return this.connection.db.update({
            collection: this.name,
            options: {
              multi: true
            },
            query,
            schema: this.schema,
            update: {
              $set: update
            }
          })
        })
        .then(({matchedCount}) => {
          if (isRestIDQuery && matchedCount === 0) {
            const error = new Error('Not Found')

            error.statusCode = 404

            return Promise.reject(error)
          }
        })
        .then(() => {
          const updatedDocumentsQuery = {
            _id: {
              $in: updatedDocuments.map(doc => doc._id.toString())
            }
          }

          return this.find({
            options: {
              compose: true
            },
            query: updatedDocumentsQuery
          })
        })
        .then(data => {
          if (data.results.length === 0) {
            return data
          }

          // Run any `afterUpdate` hooks.
          if (hooks && Array.isArray(hooks.afterUpdate)) {
            hooks.afterUpdate.forEach(hookConfig => {
              const hook = new Hook(hookConfig, 'afterUpdate')

              return hook.apply(data.results, this.schema, this.name)
            })
          }

          // Index all the created documents for search, as a background job.
          if (search.isEnabled()) {
            search.indexDocumentsInTheBackground({
              documents: data.results,
              model: this,
              original: updatedDocuments
            })
          }

          // Format result set for output.
          if (!rawOutput) {
            return this.formatForOutput(data.results, {
              access: aclAccess && aclAccess.read,
              client,
              composeOverride: compose
            }).then(results => {
              return Object.assign({}, data, {
                results
              })
            })
          }

          return data
        })
    })
    .then(response => {
      // Create a revision for each of the updated documents.
      if (this.history && updatedDocuments.length > 0) {
        workQueue.queueBackgroundJob(() => {
          this.formatForInput(updatedDocuments).then(versions => {
            return this.history.addVersion(versions, {
              author: internals._lastModifiedBy,
              date: internals._lastModifiedAt,
              description
            })
          })
        })
      }

      return response
    })
    .catch(error => {
      // Dealing with the case of an impossible query. We can simply return
      // an empty result set here.
      if (error.message === 'EMPTY_RESULT_SET') {
        return this._buildEmptyResponse()
      }

      logger.error({module: 'model'}, error)

      return Promise.reject(error)
    })
}

module.exports = function() {
  // Compatibility with legacy model API.
  // Signature: query, update, internals, done, req, bypassOutputFormatting
  if (arguments.length > 1) {
    let callback
    const legacyArguments = {
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

    update
      .call(this, legacyArguments)
      .then(response => callback && callback(null, response))
      .catch(error => callback && callback(error))

    return
  }

  return update.apply(this, arguments)
}
