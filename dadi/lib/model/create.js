const async = require('async')
const debug = require('debug')('api:model')
const Hook = require('./hook')

/**
 * Creates one or multiple documents.
 *
 * @param {Boolean|Number} compose - the composition settings for the result
 * @param {Object|Array} documents - the document(s) to insert
 * @param {Object} internals - internal properties to attach to documents
 * @param {Boolean} rawOutput - whether to bypass formatting routine
 * @param {Object} req - request
 * @returns {Promise<Array>} array of created documents
 */
function create ({
  compose = true,
  documents,
  internals = {},
  rawOutput = false,
  req
}) {
  debug('Model create: %o %o', documents, internals)

  if (!this.connection.db) {
    return Promise.reject(
      new Error('DB_DISCONNECTED')
    )
  }

  // Add `createdAt` internal field.
  internals._createdAt = internals._createdAt || Date.now()

  if (!Array.isArray(documents)) {
    documents = [documents]
  }

  // Validate each document.
  let validation

  documents.forEach(document => {
    if (validation === undefined || validation.success) {
      validation = this.validate.schema(document)
    }
  })

  if (!validation.success) {
    let error = this._createValidationError('Validation Failed')

    error.success = validation.success
    error.errors = validation.errors
    error.data = documents

    return Promise.reject(error)
  }

  let transformQueue = Promise.all(documents.map(document => {
    // Add internal properties to documents
    if (typeof internals === 'object' && internals !== null) {
      Object.assign(document, internals)
    }

    // Add placeholder for document history.
    if (this.history) {
      document._history = []
    }

    // Add initial revision number.
    document._version = 1

    return Object.keys(document).reduce((documentTransform, field) => {
      if (field === '_id') {
        return documentTransform
      }

      return documentTransform.then(transformedDocument => {
        return this.runFieldHooks({
          data: {
            internals
          },
          field,
          input: {
            [field]: document[field]
          },
          name: 'beforeSave'
        }).then(subDocument => {
          return Object.assign({}, transformedDocument, subDocument)
        }).catch(error => {
          error.success = false
          error.errors = [
            {
              field,
              message: error.message
            }
          ]

          return Promise.reject(error)
        })
      })
    }, Promise.resolve({}))
  }))

  return transformQueue.then(documents => {
    // Run any `beforeCreate` hooks.
    if (this.settings.hooks && this.settings.hooks.beforeCreate) {
      return new Promise((resolve, reject) => {
        let processedDocuments = 0

        documents.forEach((doc, docIndex) => {
          async.reduce(this.settings.hooks.beforeCreate, doc, (current, hookConfig, callback) => {
            let hook = new Hook(hookConfig, 'beforeCreate')

            Promise.resolve(hook.apply(current, this.schema, this.name, req))
              .then((newDoc) => {
                callback((newDoc === null) ? {} : null, newDoc)
              })
              .catch(err => {
                callback(hook.formatError(err))
              })
          }, (err, result) => {
            processedDocuments++

            if (processedDocuments === documents.length) {
              if (err) {
                return reject(err)
              }

              resolve(documents)
            }
          })
        })
      })
    }

    return documents
  }).then(documents => {
    return this.connection.db.insert({
      data: documents,
      collection: this.name,
      schema: this.schema,
      settings: this.settings
    }).then(results => {
      let returnData = {
        results
      }

      // Run any `afterCreate` hooks.
      if (this.settings.hooks && (typeof this.settings.hooks.afterCreate === 'object')) {
        returnData.results.forEach(document => {
          this.settings.hooks.afterCreate.forEach((hookConfig, index) => {
            let hook = new Hook(this.settings.hooks.afterCreate[index], 'afterCreate')

            return hook.apply(document, this.schema, this.name)
          })
        })
      }

      // Prepare result set for output.
      if (!rawOutput) {
        return this.formatForOutput(
          returnData.results,
          {
            composeOverride: compose
          }).then(results => ({results}))
      }

      return returnData
    })
  })
}

module.exports = function () {
  // Compatibility with legacy model API.
  // Signature: documents, internals, done, req, bypassOutputFormatting
  if (arguments.length > 1) {
    let callback
    let legacyArguments = {
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

    create.call(this, legacyArguments)
      .then(response => callback && callback(null, response))
      .catch(error => callback && callback(error))

    return
  }

  return create.apply(this, arguments)
}
