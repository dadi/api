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
async function getStats({client} = {}) {
  const database = await this.dataConnector

  await this.validateAccess({
    client,
    type: 'read'
  })

  return database.stats(this.name)
}

module.exports = getStats
