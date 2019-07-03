/**
 * Returns stats relating to the collection.
 *
 * @param  {Object} client - client to check permissions for
 * @param  {String} documentId - ID of the object to get versions for
 * @return {Promise<Stats>}
 */
async function getVersions({client, documentId} = {}) {
  await this.validateAccess({
    client,
    type: 'read'
  })

  if (!this.history) {
    const error = new Error('History not enabled for collection')

    error.statusCode = 404

    return Promise.reject(error)
  }

  const {results} = await this.history.getVersions(documentId)

  if (results.length === 0) {
    const {metadata} = await this.count({
      client,
      query: {
        _id: documentId
      }
    })

    if (metadata.totalCount === 0) {
      const error = new Error('Document not found')

      error.statusCode = 404

      return Promise.reject(error)
    }
  }

  return {
    results
  }
}

module.exports = getVersions
