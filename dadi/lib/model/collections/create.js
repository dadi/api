const async = require('async')
const debug = require('debug')('api:model')
const Hook = require('./../hook')

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
function create ({
  client,
  compose = true,
  documents,
  internals = {},
  rawOutput = false,
  removeInternalProperties = true,
  req,
  validate = true
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

  let {hooks} = this.settings
  let originalDocuments = documents

  // If an ACL check is performed, this variable will contain the resulting
  // access matrix.
  let aclAccess

  return this.validateAccess({
    client,
    documents,
    type: 'create'
  }).then(({access, documents: newDocuments, fields, schema}) => {
    if (!validate) return

    // Storing the access matrix in a variable that is global to the method.
    aclAccess = access

    // This is now the filtered documents object, containing only the fields
    // which the client has access to.
    documents = newDocuments

    return this.validator.validateDocuments({
      documents,
      schema
    }).catch(errors => {
      let error = this._createValidationError('Validation Failed', errors, {
        originalDocuments
      })

      return Promise.reject(error)
    })
  }).then(() => {
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
    }))

    return transformQueue
  }).then(documents => {
    // Run any `beforeCreate` hooks.
    if (hooks && hooks.beforeCreate) {
      return new Promise((resolve, reject) => {
        let processedDocuments = 0

        documents.forEach((doc, docIndex) => {
          async.reduce(hooks.beforeCreate, doc, (current, hookConfig, callback) => {
            let hook = new Hook(hookConfig, 'beforeCreate')

            Promise.resolve(hook.apply(current, this.schema, this.name, req))
              .then(newDoc => {
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
      // Asynchronous search index.
      this.searchHandler.index(results)

      // Run any `afterCreate` hooks.
      if (hooks && Array.isArray(hooks.afterCreate)) {
        results.forEach(document => {
          hooks.afterCreate.forEach((hookConfig, index) => {
            let hook = new Hook(hooks.afterCreate[index], 'afterCreate')

            return hook.apply(document, this.schema, this.name)
          })
        })
      }

      // If `rawOutput` is truthy, we don't need to worry about formatting
      // the result set for output. We return it as is.
      if (rawOutput) {
        return {results}
      }

      return this.formatForOutput(results, {
        access: aclAccess && aclAccess.read,
        client,
        composeOverride: compose
      }).then(results => ({results}))
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
