var path = require('path')
var config = require(path.join(__dirname, '/../../../config.js'))

/**
 * Creates a new DataStore from the configuration property "datastore"
 * @constructor
 * @classdesc
 */
var DataStore = function (storeName) {
  var store = storeName || config.get('datastore')
  var DataStore = require(store)
  var DataStoreConfig = require(store).Config

  return new DataStore(DataStoreConfig.get())
}

module.exports = DataStore