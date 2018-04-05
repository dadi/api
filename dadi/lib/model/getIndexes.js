const logger = require('@dadi/logger')

/**
 * @typedef {Object} Index
 * @property {String} index - name of the indexed field
 */

/**
 * Returns all indexes defined for the collection.
 *
 * @return {Promise<Array.Index>}
 */
function getIndexes () {
  const getIndexesFromDatabase = database => {
    return database.getIndexes(this.name)
  }

  if (!this.connection.db) {
    return new Promise((resolve, reject) => {
      this.connection.once('connect', database => {
        resolve(getIndexesFromDatabase(database))
      })
    })
  }

  return getIndexesFromDatabase(this.connection.db)
}

module.exports = function () {
  // Compatibility with legacy model API.
  // Signature: done
  if (arguments.length > 0) {
    let callback = arguments[0]

    getIndexes.call(this)
      .then(response => callback && callback(response))
      .catch(error => {
        logger.error({module: 'model'}, error)

        callback && callback(null)
      })

    return
  }

  return getIndexes.call(this)
}
