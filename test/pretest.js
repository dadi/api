const exec = require('child_process').exec
const fs = require('fs')
const path = require('path')
const colors = require('colors')

const testConfigPath = './config/config.test.json'
const testConfigSamplePath = './config/config.test.json.sample'

const testConfigSample = fs.readFileSync(testConfigSamplePath, { encoding: 'utf-8'}).toString()

function loadConfig (done) {
  try {
    const testConfig = fs.readFileSync(testConfigPath, { encoding: 'utf-8'})
    const conf = JSON.parse(testConfig)

    console.log('\n  Running test suite using the in-memory test connector'.green)

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
  const database = config.database.database
  const authDatabase = config.auth.database.database

  if (database !== 'test' || authDatabase !== 'test') {
    const message = '\nWARNING: The test suite requires the use of a `test` database. The databases for authentication and data can be configured in the file ' + testConfigPath + '.'

    console.log(message.bold.red)
    console.log('')
    console.log('Tests will not be run with the current configuration.\n'.bold.red)
    stop()
  }
}

loadConfig(function (config) {
  testDatabaseSetting(config)
})
