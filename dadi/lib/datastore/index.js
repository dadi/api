const path = require('path')
const config = require(path.join(__dirname, '/../../../config.js'))

/**
 * Creates a new DataStore from the configuration property "datastore"
 * @constructor
 * @classdesc
 */
const DataStore = function (storeName) {
  const store = storeName || config.get('datastore')

  try {
    const DataStore = require(store)
    const instance = new DataStore()

    instance.settings = DataStore.settings || {}

    return instance
  } catch (err) {
    if (err.message.indexOf('Cannot find module') > -1) {
      console.error('\n  Error: API configured to use a datastore that has not been installed: "' + store + '"\n')
    } else {
      console.error('\n  Error: Loading datastore "' + store + '" caused an error: ' + err.message + '\n')
    }

    throw err
  }
}

module.exports = DataStore
