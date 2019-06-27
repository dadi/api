const path = require('path')
const config = require(path.join(__dirname, '/../../../config.js'))
const semver = require('semver')

let packageData = require('./../../../package.json')

/**
 * Creates a new DataStore from the configuration property "datastore"
 * @constructor
 * @classdesc
 */
const DataStore = function (storeName) {
  const store = storeName || config.get('datastore')
  const minimumVersion = packageData.dataConnectorDependencies[store]

  try {
    const DataStore = require(store)
    const instance = new DataStore()
    let version = '0.0.0'

    if (typeof instance.handshake === 'function') {
      const connectorData = instance.handshake()

      version = connectorData.version || version

      if (
        connectorData.minimumApiVersion &&
        semver.lt(packageData.version, connectorData.minimumApiVersion)
      ) {
        throw new Error(
          `The version of '${store}' being used (${version}) requires version ${connectorData.minimumApiVersion} (or greater) of DADI API. Please update your app or install an older version of the data connector, if available.`
        )
      }
    }

    if (minimumVersion && semver.lt(version, minimumVersion)) {
      throw new Error(
        `The minimum supported version of '${store}' is '${minimumVersion}'. Please update your dependency.`
      )
    }

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

// Used for tests.
module.exports.setPackageData = data => {
  packageData = data
}
