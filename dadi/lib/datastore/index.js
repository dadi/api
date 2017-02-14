var path = require('path')
var config = require(path.join(__dirname, '/../../../config.js'))

module.exports = function (storeName) {
  var store = storeName || config.get('datastore')
  var DataStore = require(store)
  var DataStoreConfig = require(store).Config

  console.log('++++++++++++')
  console.log(DataStoreConfig.get())
  console.log('++++++++++++')

  return new DataStore(DataStoreConfig.get())
}
