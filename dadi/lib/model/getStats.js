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
 * @param  {Object} options
 * @return {Promise<Stats>}
 */
function getStats ({options = {}} = {}) {
  if (!this.connection.db) {
    return Promise.reject(
      new Error('DB_DISCONNECTED')
    )
  }

  return this.connection.db.stats(this.name, options)
}

module.exports = getStats
