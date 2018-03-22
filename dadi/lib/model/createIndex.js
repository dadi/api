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
function createIndex () {
  const createIndexInDatastore = database => {
    return database.index(this.name, this.settings.index)
  }

  if (!this.connection.db) {
    return new Promise((resolve, reject) => {
      this.connection.once('connect', database => {
        resolve(createIndexInDatastore(database))
      })
    })
  }

  return createIndexInDatastore(this.connection.db)
}

module.exports = function () {
  // Compatibility with legacy model API.
  // Signature: done
  if (arguments.length > 0) {
    let callback = arguments[0]

    createIndex.call(this)
      .then(response => callback && callback(null, response))
      .catch(error => callback && callback(error))

    return
  }

  return createIndex.call(this)
}
