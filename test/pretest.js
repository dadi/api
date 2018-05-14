const exec = require('child_process').exec
const fs = require('fs')
const path = require('path')
const colors = require('colors')

const testConfigPath = './config/config.test.json'
const testConfigSamplePath = './config/config.test.json.sample'

const testConfigSample = fs.readFileSync(testConfigSamplePath, { encoding: 'utf-8'}).toString()

let cleanup = function (dir) {
  exec('rm -r ' + dir, (err, stdout, stderr) => {
    exec('mkdir -p ' + dir)
  })
}

function loadConfig (done) {
  try {
    var testConfig = fs.readFileSync(testConfigPath, { encoding: 'utf-8'})
    var conf = JSON.parse(testConfig)

    console.log('\n  Running test suite using the in-memory test connector'.green)

    cleanup(path.resolve(conf.caching.directory.path || './cache/api'))

    return done(conf)
  } catch (err) {
    if (err.code === 'ENOENT') {
      fs.writeFileSync(testConfigPath, testConfigSample)
      console.log()
      console.log("Created file at '" + testConfigPath + "'")
      loadConfig(function (config) {
        testDatabaseSetting(config)
      })
    }
  }
}

function stop () {
  process.exit(1)
}

function testDatabaseSetting (config) {
  var database = config.database.database
  var authDatabase = config.auth.database.database

  if (database !== 'test' || authDatabase !== 'test') {
    var message = '\nWARNING: The test suite requires the use of a `test` database. The databases for authentication and data can be configured in the file ' + testConfigPath + '.'
    console.log(message.bold.red)
    console.log('')
    console.log('Tests will not be run with the current configuration.\n'.bold.red)
    stop()
  }
}

loadConfig(config => {
  testDatabaseSetting(config)
})
