var debug = require('debug')('api:TestHelper')
var fs = require('fs')
var path = require('path')
var config = require(__dirname + '/../config.js')

var _configs = []

var TestHelper = function () {
  this.baseConfigPath = path.join(__dirname, '../config')
}

TestHelper.prototype.getConfig = function () {
  return new Promise((resolve, reject) => {
    var originalConfig = JSON.parse(this.originalConfigString)
    return resolve(Object.assign({}, originalConfig))
  })
}

TestHelper.prototype.updateConfig = function (configFile, configBlock) {
  debug('update config %s %o', configFile, configBlock)

  _configs.push(configFile)

  return new Promise((resolve, reject) => {
    var configPath = path.join(this.baseConfigPath, configFile + '.' + config.get('env') + '.json')

    this.originalConfigString = fs.readFileSync(configPath).toString()

    var newConfig = Object.assign({}, JSON.parse(this.originalConfigString), configBlock)

    fs.writeFileSync(configPath, JSON.stringify(newConfig, null, 2))
    // config.loadFile(path.resolve(config.configPath()))

    Object.keys(require.cache).forEach(key => {
      if (key.indexOf('datastore/') > -1) {
        delete require.cache[key]
      }
    })

    delete require.cache[configPath]
    return resolve('')
  })
}

TestHelper.prototype.resetConfigs = function () {
  _configs.forEach(conf => {
    delete _configs[conf]
    this.resetConfig(conf).then(() => {})
  })
}

TestHelper.prototype.resetConfig = function (configFile) {
  debug('reset config %s', configFile)

  return new Promise((resolve, reject) => {
    var configPath = path.join(this.baseConfigPath, configFile + '.' + config.get('env') + '.json')

    fs.writeFileSync(configPath, JSON.stringify(JSON.parse(this.originalConfigString), null, 2))
    // config.loadFile(path.resolve(config.configPath()))
    delete require.cache[configPath]
    return resolve('')
  })
}

var instance
module.exports = function () {
  if (!instance) {
    instance = new TestHelper()
  }

  return instance
}

module.exports.TestHelper = TestHelper
