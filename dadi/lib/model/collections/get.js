const async = require('async')
const Hook = require('./../hook')
const logger = require('@dadi/logger')

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
 * @param  {Object}  client - client to check permissions for
 * @param  {String}  language - ISO code for the language to translate documents to
 * @param  {Object}  query - query to match documents against
 * @param  {Object}  options
 * @param  {Boolean} rawOutput - whether to bypass formatting routine
 * @param  {Object}  req - request object to pass to hooks
 * @param  {Boolean} runHooks - whether to run before/after hooks
 * @param  {Number}  version - version of the document to retrieve
 * @return {Promise<ResultSet>}
 */
function get({
  client,
  language,
  query = {},
  options = {},
  rawOutput = false,
  req,
  runHooks = true,
  version
}) {
  // Is this a RESTful query by ID?
  const isRestIDQuery = req && req.params && req.params.id

  const hooks = runHooks ? this.settings.hooks : null

  return new Promise((resolve, reject) => {
    // Run any `beforeGet` hooks.
    if (hooks && hooks.beforeGet) {
      async.reduce(
        hooks.beforeGet,
        query,
        (current, hookConfig, callback) => {
          const hook = new Hook(hookConfig, 'beforeGet')

          Promise.resolve(hook.apply(current, this.schema, this.name, req))
            .then(newQuery => {
              callback(null, newQuery)
            })
            .catch(error => {
              callback(hook.formatError(error))
            })
        },
        (error, finalQuery) => {
          if (error) {
            return reject(error)
          }

          resolve(finalQuery)
        }
      )
    } else {
      resolve(query)
    }
  })
    .then(query => {
      return this.find({
        client,
        isRestIDQuery,
        language,
        query,
        options,
        version
      })
    })
    .then(({metadata, results}) => {
      if (isRestIDQuery && results.length === 0) {
        const error = new Error('Document not found')

        error.statusCode = 404

        return Promise.reject(error)
      }

      const formatter = rawOutput
        ? Promise.resolve(results)
        : this.formatForOutput(results, {
            client,
            composeOverride: options.compose,
            language,
            urlFields: options.fields
          })

      return formatter.then(results => {
        return {results, metadata}
      })
    })
    .then(response => {
      if (hooks && hooks.afterGet) {
        return new Promise((resolve, reject) => {
          async.reduce(
            hooks.afterGet,
            response,
            (current, hookConfig, callback) => {
              const hook = new Hook(hookConfig, 'afterGet')

              Promise.resolve(hook.apply(current, this.schema, this.name, req))
                .then(newResults => {
                  callback(newResults === null ? {} : null, newResults)
                })
                .catch(error => {
                  callback(hook.formatError(error))
                })
            },
            (error, resultsAfterHooks) => {
              if (error) {
                logger.error({module: 'model'}, error)
              }

              resolve(resultsAfterHooks)
            }
          )
        })
      }

      return response
    })
}

module.exports = function() {
  // Compatibility with legacy model API.
  // Signature: query, options, done, req
  if (arguments.length > 1) {
    let callback
    const legacyArguments = {
      query: arguments[0],
      req: arguments[3]
    }

    if (typeof arguments[1] === 'function') {
      callback = arguments[1]
      legacyArguments.options = {}
    } else {
      callback = arguments[2]
      legacyArguments.options = arguments[1]
    }

    get
      .call(this, legacyArguments)
      .then(response => callback && callback(null, response))
      .catch(error => callback && callback(error))

    return
  }

  return get.apply(this, arguments)
}
