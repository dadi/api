const async = require('async')
const debug = require('debug')('api:model')
const Hook = require('./../hook')
const search = require('./../search')

/**
 * Creates one or multiple documents.
 *
 * @param {Object} client - client to check permissions for
 * @param {Boolean|Number} compose - the composition settings for the result
 * @param {Object|Array} documents - the document(s) to insert
 * @param {Object} internals - internal properties to attach to documents
 * @param {Boolean} rawOutput - whether to bypass formatting routine
 * @param {Boolean} removeInternalProperties - whether to remove internal properties
 * @param {Object} req - request
 * @returns {Promise<Array>} array of created documents
 */
async function create({
  client,
  compose = true,
  documents: input,
  internals = {},
  rawOutput = false,
  removeInternalProperties = true,
  req,
  validate = true
}) {
  // Add `createdAt` internal field.
  internals._createdAt = internals._createdAt || Date.now()

  let documents = Array.isArray(input) ? input : [input]

  documents = documents.map(document => {
    // Add default value for missing fields.
    Object.keys(this.schema).forEach(field => {
      if (
        this.schema[field].default !== undefined &&
        document[field] === undefined
      ) {
        document[field] = this.schema[field].default
      }
    })

    // Removing internal API properties from the documents.
    if (removeInternalProperties) {
      document = this.removeInternalProperties(document)
    }

    return document
  })

  const {hooks} = this.settings || {}
  const database = await this.dataConnector
  const aclCheck = await this.validateAccess({
    client,
    documents,
    type: 'create'
  })
  const {access, documents: documentsAfterACL, schema} = aclCheck

  if (validate) {
    try {
      await this.validator.validateDocuments({
        documents: documentsAfterACL,
        schema
      })
    } catch (errors) {
      console.log('---<-', errors)
      const error = this._createValidationError('Validation Failed', errors, {
        originalDocuments: input
      })

      return Promise.reject(error)
    }
  }

  // Updating `documents` with the result of running field hooks.
  const documentsAfterFieldHooks = await Promise.all(
    documentsAfterACL.map(document => {
      // Add internal properties to documents
      if (typeof internals === 'object' && internals !== null) {
        Object.assign(document, internals)
      }

      return Object.keys(document).reduce((documentTransform, field) => {
        if (field === '_id') {
          return documentTransform
        }

        return documentTransform.then(transformedDocument => {
          return this.runFieldHooks({
            data: {
              client,
              internals
            },
            field,
            input: {
              [field]: document[field]
            },
            name: 'beforeSave'
          }).then(subDocument => {
            return Object.assign({}, transformedDocument, subDocument)
          })
        })
      }, Promise.resolve({}))
    })
  )

  // Run any `beforeCreate` hooks.
  let documentsAfterBeforeCreateHook = documentsAfterFieldHooks

  if (hooks && hooks.beforeCreate) {
    documentsAfterBeforeCreateHook = await new Promise((resolve, reject) => {
      let processedDocuments = 0

      documentsAfterFieldHooks.forEach(doc => {
        async.reduce(
          hooks.beforeCreate,
          doc,
          (current, hookConfig, callback) => {
            const hook = new Hook(hookConfig, 'beforeCreate')

            Promise.resolve(hook.apply(current, this.schema, this.name, req))
              .then(newDoc => {
                callback(newDoc === null ? {} : null, newDoc)
              })
              .catch(err => {
                callback(hook.formatError(err))
              })
          },
          err => {
            processedDocuments++

            if (processedDocuments === documentsAfterFieldHooks.length) {
              if (err) {
                return reject(err)
              }

              resolve(documentsAfterFieldHooks)
            }
          }
        )
      })
    })
  }

  const results = await database.insert({
    data: documentsAfterBeforeCreateHook,
    collection: this.name,
    schema: this.schema,
    settings: this.settings
  })

  // Index all the created documents for search, as a background job.
  if (search.isEnabled()) {
    search.indexDocumentsInTheBackground({
      documents: results,
      model: this
    })
  }

  // Run any `afterCreate` hooks.
  if (hooks && Array.isArray(hooks.afterCreate)) {
    results.forEach(document => {
      hooks.afterCreate.forEach(hookConfig => {
        const hook = new Hook(hookConfig, 'afterCreate')

        return hook.apply(document, this.schema, this.name)
      })
    })
  }

  // If `rawOutput` is truthy, we don't need to worry about formatting
  // the result set for output. We return it as is.
  if (rawOutput) {
    return {results}
  }

  const formattedResults = await this.formatForOutput(results, {
    access: access && access.read,
    client,
    composeOverride: compose
  })

  return {
    results: formattedResults
  }
}

module.exports = function() {
  // Compatibility with legacy model API.
  // Signature: documents, internals, done, req, bypassOutputFormatting
  if (arguments.length > 1) {
    let callback
    const legacyArguments = {
      documents: arguments[0],
      rawOutput: arguments[4],
      req: arguments[3]
    }

    if (typeof arguments[1] === 'function') {
      callback = arguments[1]
      legacyArguments.internals = {}
    } else {
      callback = arguments[2]
      legacyArguments.internals = arguments[1]
    }

    create
      .call(this, legacyArguments)
      .then(response => callback && callback(null, response))
      .catch(error => callback && callback(error))

    return
  }

  return create.apply(this, arguments)
}
