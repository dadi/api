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
async function getIndexes() {
  const database = await this.dataConnector

  return database.getIndexes(this.name)
}

module.exports = function() {
  // Compatibility with legacy model API.
  // Signature: done
  if (arguments.length > 0) {
    const callback = arguments[0]

    getIndexes
      .call(this)
      .then(response => callback && callback(response))
      .catch(error => {
        logger.error({module: 'model'}, error)

        callback && callback(null)
      })

    return
  }

  return getIndexes.call(this)
}
