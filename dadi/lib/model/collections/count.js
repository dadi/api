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
 * Searchs for documents in the datbase and returns a
 * metadata object.
 *
 * @param {Object} client - client to check permissions for
 * @param {Object} options - an options object
 * @param {Object} query - the search query
 * @returns {Promise<Metadata>}
 */
function count ({
  client,
  options = {},
  query = {}
} = {}) {
  return this.validateAccess({
    client,
    type: 'read'
  }).then(() => {
    let validation = this.validate.query(query)

    if (!validation.success) {
      let err = this._createValidationError('Bad Query')

      err.json = validation

      return Promise.reject(err)
    }

    if (typeof query !== 'object') {
      return Promise.reject(
        this._createValidationError('Bad Query')
      )
    }

    return this.find({
      query,
      options
    }).then(response => {
      return {
        metadata: response.metadata
      }
    })
  })
}

module.exports = function () {
  // Compatibility with legacy model API.
  // Signature: query, options, done
  if (arguments.length > 1) {
    let callback
    let legacyArguments = {
      query: arguments[0]
    }

    if (typeof arguments[1] === 'function') {
      callback = arguments[1]
      legacyArguments.options = {}
    } else {
      callback = arguments[2]
      legacyArguments.options = arguments[1]
    }

    // Legacy arguments: query, options, done
    count.call(this, legacyArguments)
      .then(response => callback && callback(null, response))
      .catch(error => callback && callback(error))

    return
  }

  return count.apply(this, arguments)
}
