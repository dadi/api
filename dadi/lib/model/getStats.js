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
  const getStatsFromDatabase = database => {
    return database.stats(this.name, options)
  }

  if (!this.connection.db) {
    return new Promise((resolve, reject) => {
      this.connection.once('connect', database => {
        resolve(getStatsFromDatabase(database))
      })
    })
  }

  return getStatsFromDatabase(this.connection.db)
}

module.exports = getStats
