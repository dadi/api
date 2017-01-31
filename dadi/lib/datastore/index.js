var path = require('path')

module.exports = function (config) {
  if (!config.name) {
    throw new Error('you must provide `name` value in config')
  }

  var storePath = path.join(__dirname, config.name)
  var DataStore = require(storePath)

  return new DataStore(config)
}
