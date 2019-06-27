/**
 * Returns stats relating to the collection.
 *
 * @param  {Object} client - client to check permissions for
 * @param  {String} documentId - ID of the object to get versions for
 * @return {Promise<Stats>}
 */
function getVersions({client, documentId} = {}) {
  if (!this.connection.db) {
    return Promise.reject(new Error('DB_DISCONNECTED'))
  }

  const response = {
    results: []
  }

  return this.validateAccess({
    client,
    type: 'read'
  }).then(() => {
    if (!this.history) {
      const error = new Error('History not enabled for collection')

      error.statusCode = 404

      return Promise.reject(error)
    }

    return this.history
      .getVersions(documentId)
      .then(({results}) => {
        if (results.length === 0) {
          return this.count({
            client,
            query: {
              _id: documentId
            }
          }).then(({metadata}) => {
            if (metadata.totalCount === 0) {
              const error = new Error('Document not found')

              error.statusCode = 404

              return Promise.reject(error)
            }

            return results
          })
        }

        return results
      })
      .then(results => {
        response.results = results

        return response
      })
  })
}

module.exports = getVersions
