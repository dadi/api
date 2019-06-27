const debug = require('debug')('api:model')

/**
 * Gets history revisions for a given document.
 *
 * @param {String} id - document ID
 * @param {Object} options
 * @returns {Promise<Array>} array of revision documents
 */
function getRevisions({id, options = {}}) {
  const fields = options.fields || {}
  let historyQuery = {}

  if (options.historyFilters) {
    try {
      historyQuery = JSON.parse(options.historyFilters)
    } catch (_) {
      // noop
    }
  }

  return this.connection.db
    .find({
      query: {_id: id},
      collection: this.name,
      options: {history: 1, limit: 1},
      schema: this.schema,
      settings: this.settings
    })
    .then(({metadata, results}) => {
      debug('Model find in history: %o', results)

      if (results && results.length && this.history) {
        historyQuery._id = {
          $in: results[0]._history.map(id => id.toString())
        }

        return this.connection.db
          .find({
            query: historyQuery,
            collection: this.revisionCollection,
            options: fields,
            schema: this.schema,
            settings: this.settings
          })
          .then(({metadata, results}) => results)
      }

      return []
    })
}

module.exports = function() {
  // Compatibility with legacy model API.
  // Signature: id, options, done
  if (arguments.length > 1) {
    const callback = arguments[2]
    const legacyArguments = {
      id: arguments[0],
      options: arguments[1]
    }

    getRevisions
      .call(this, legacyArguments)
      .then(response => callback && callback(null, response))
      .catch(error => callback && callback(error))

    return
  }

  return getRevisions.apply(this, arguments)
}
