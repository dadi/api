/**
 * @typedef {Object} Stats
 * @property {Number} count
 * @property {Number} size
 * @property {Number} averageObjectSize
 * @property {Number} storageSize
 * @property {Number} indexes
 * @property {Number} totalIndexSize
 * @property {Number} indexSizes
 */

/**
 * Returns stats relating to the collection.
 *
 * @param  {Object} client - client to check permissions for
 * @return {Promise<Stats>}
 */
function getStats ({
  client
} = {}) {
  if (!this.connection.db) {
    return Promise.reject(
      new Error('DB_DISCONNECTED')
    )
  }

  return this.validateAccess({
    client,
    type: 'read'
  }).then(() => {
    return this.connection.db.stats(this.name)
  })
}

module.exports = getStats
