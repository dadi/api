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
  return this.validateAccess({
    client,
    type: 'read'
  }).then(() => {
    debug(options.search)

    return this.searchHandler.find(options.search)
  }).then(query => {
    const ids = query._id['$containsAny'].map(id => id.toString())

    return this.find({
      client,
      query
    }).then(({results, metadata}) => {
      const sortedResults = results.sort((a, b) => {
        const aIndex = ids.indexOf(a._id.toString())
        const bIndex = ids.indexOf(b._id.toString())

        if (aIndex === bIndex) return 0

        return aIndex > bIndex ? 1 : -1
      })

      return this.formatForOutput(
        sortedResults,
        {
          client
        }
      ).then(formattedResults => {
        return {
          results: formattedResults,
          metadata
        }
      })
    })
  })
}
