var path = require('path')
var config = require(path.join(__dirname, '/../../../config.js'))

/**
 * Creates a new DataStore from the configuration property "datastore"
 * @constructor
 * @classdesc
 */
var DataStore = function (storeName) {
  var store = storeName || config.get('datastore')
  var DataStore

  try {
    DataStore = require(store)
  } catch (err) {
    if (err.message.indexOf('Cannot find module') > -1) {
      console.error('\n  Error: API configured to use a datastore that has not been installed: "' + store + '"\n')
      process.exit(1)
    }
  }

  var DataStoreConfig = require(store).Config

  return new DataStore(DataStoreConfig.get())
}

module.exports = DataStore
