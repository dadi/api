/**
 * @typedef {Object} CollectionIndex
 * @property {String} collection - name of the collection
 * @property {String} index - name of the indexed field
 */

/**
 * Creates indexes for all properties defined in the `index`
 * block of the collection settings.
 *
 * @return {Promise<Array.CollectionIndex>}
 */
async function createIndex() {
  const database = await this.dataConnector

  await database.index(this.name, this.settings.index)

  return true
}

module.exports = createIndex
