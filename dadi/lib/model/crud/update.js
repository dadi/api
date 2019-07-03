const async = require('async')
const debug = require('debug')('api:model')
const Hook = require('./../hook')
const logger = require('@dadi/logger')
const search = require('./../search')

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
async function update({
  client,
  compose = true,
  description,
  internals = {},
  query: inputQuery = {},
  rawOutput = false,
  removeInternalProperties = true,
  req,
  update: inputUpdate,
  validate = true
}) {
  const database = await this.dataConnector

  // Add `lastModifiedAt` internal field.
  internals._lastModifiedAt = internals._lastModifiedAt || Date.now()

  // Is this a RESTful query by ID?
  const isRestIDQuery = req && req.params && req.params.id

  // Removing internal API properties from the update object.
  if (removeInternalProperties) {
    inputUpdate = this.removeInternalProperties(inputUpdate)
  }

  const {hooks} = this.settings
  const {access, documents: update, query, schema} = await this.validateAccess({
    client,
    documents: inputUpdate,
    query: inputQuery,
    type: 'update'
  })

  // If merging the request query with ACL data resulted in
  // an impossible query, we can simply return an empty result
  // set without even going to the database. We'll reject the
  // Promise now and catch this case at the end of the chain.
  if (query instanceof Error && query.message === 'EMPTY_RESULT_SET') {
    return this._buildEmptyResponse()
  }

  if (validate) {
    // Validating the query.
    const queryValidation = this.validateQuery(query)

    if (!queryValidation.success) {
      const error = this._createValidationError('Bad Query')

      error.json = queryValidation

      return Promise.reject(error)
    }

    try {
      await this.validator.validateDocument({
        document: update,
        isUpdate: true,
        schema
      })
    } catch (errors) {
      const error = this._createValidationError('Validation Failed', errors)

      return Promise.reject(error)
    }
  }

  const {results: affectedDocuments} = await this.find({
    query: this.formatQuery(query)
  })

  // Add any internal fields to the update.
  Object.assign(update, internals)

  // Run `beforeSave` hooks on update fields.
  const updateAfterBeforeSave = await Object.keys(update).reduce(
    async (result, field) => {
      if (field === '_id') {
        return result
      }

      const transformedUpdate = await result
      const subDocument = await this.runFieldHooks({
        data: {
          internals,
          updatedDocuments: affectedDocuments
        },
        field,
        input: {
          [field]: update[field]
        },
        name: 'beforeSave'
      })

      return Object.assign({}, transformedUpdate, subDocument)
    },
    Promise.resolve({})
  )

  // Run any `beforeUpdate` hooks.
  let updateAfterBeforeUpdate = updateAfterBeforeSave

  if (hooks && hooks.beforeUpdate) {
    updateAfterBeforeUpdate = await new Promise((resolve, reject) => {
      async.reduce(
        hooks.beforeUpdate,
        updateAfterBeforeSave,
        (current, hookConfig, callback) => {
          const hook = new Hook(hookConfig, 'beforeUpdate')

          Promise.resolve(
            hook.apply(current, affectedDocuments, this.schema, this.name, req)
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

  const {matchedCount} = database.update({
    collection: this.name,
    options: {
      multi: true
    },
    query,
    schema: this.schema,
    update: {
      $set: updateAfterBeforeUpdate
    }
  })

  if (isRestIDQuery && matchedCount === 0) {
    const error = new Error('Not Found')

    error.statusCode = 404

    return Promise.reject(error)
  }

  const updatedDocumentsQuery = {
    _id: {
      $in: affectedDocuments.map(doc => doc._id.toString())
    }
  }
  const updatedDocuments = await this.find({
    options: {
      compose: true
    },
    query: updatedDocumentsQuery
  })

  if (updatedDocuments.results.length === 0) {
    return updatedDocuments
  }

  // Create a revision for each of the updated documents.
  if (this.history) {
    await this.history.addVersion(updatedDocuments.results, {
      description
    })
  }

  // Run any `afterUpdate` hooks.
  if (hooks && Array.isArray(hooks.afterUpdate)) {
    hooks.afterUpdate.forEach(hookConfig => {
      const hook = new Hook(hookConfig, 'afterUpdate')

      return hook.apply(updatedDocuments.results, this.schema, this.name)
    })
  }

  // Index all the created documents for search, as a background job.
  if (search.isEnabled()) {
    search.indexDocumentsInTheBackground({
      documents: updatedDocuments.results,
      model: this,
      original: affectedDocuments
    })
  }

  if (rawOutput) {
    return updatedDocuments
  }

  // Formatting result set for output.
  const formattedDocuments = await this.formatForOutput(
    updatedDocuments.results,
    {
      access: access && access.read,
      client,
      composeOverride: compose
    }
  )

  return Object.assign({}, updatedDocuments, {
    results: formattedDocuments
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
