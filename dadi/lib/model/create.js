const async = require('async')
const debug = require('debug')('api:model')
const Hook = require('./hook')
const queryUtils = require('./utils')

/**
 * Creates one or multiple documents.
 *
 * @param {Object|Array} documents - the document(s) to insert
 * @param {Object} internals - internal properties to attach to documents
 * @param {Boolean} rawOutput - whether to bypass formatting routine
 * @param {Object} req - request
 * @returns {Promise<Array>} array of created documents
 */
function create ({
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

  documents.forEach(document => {
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

    // DateTime conversion.
    document = queryUtils.convertDateTimeForSave(this.schema, document)
  })

  // Pre-composed references.
  this.composer.setApiVersion(internals._apiVersion)

  const composeQueue = documents.map(document => {
    return new Promise((resolve, reject) => {
      this.composer.createFromComposed(document, req, (err, result) => {
        if (err) return reject(err)

        resolve(result)
      })
    })
  })

  return Promise.all(composeQueue).then(documents => {
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

      return new Promise((resolve, reject) => {
        this.composer.compose(returnData.results, composedResults => {
          returnData.results = composedResults

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
            returnData.results = this.formatResultSetForOutput(returnData.results)
          }

          resolve(returnData)
        })
      })
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
