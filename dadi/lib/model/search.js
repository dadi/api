const config = require('./../../../config')
const debug = require('debug')('api:model:search')

/**
 * Searches for documents in the database and returns a
 * metadata object.
 *
 * @param {Object} query - the search query
 * @param {Object} options - an options object
 * @returns {Promise<Metadata>}
 */
module.exports = function ({
  client,
  options = {}
} = {}) {
  let err

  if (!this.searchHandler.canUse()) {
    err = new Error('Not Implemented')
    err.statusCode = 501
    err.json = {
      errors: [{
        message: `Search is disabled or an invalid data connector has been specified.`
      }]
    }
  } else if (!options.search || options.search.length < config.get('search.minQueryLength')) {
    err = new Error('Bad Request')
    err.statusCode = 400
    err.json = {
      errors: [{
        message: `Search query must be at least ${config.get('search.minQueryLength')} characters.`
      }]
    }
  }

  if (err) {
    return Promise.reject(err)
  }

  return this.validateAccess({
    client,
    type: 'read'
  }).then(() => {
    debug(options.search)
    return this.searchHandler.find(options.search)
  })
}
