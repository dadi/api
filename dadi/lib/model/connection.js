'use strict'

const path = require('path')
const config = require(path.join(__dirname, '/../../../config'))
const debug = require('debug')('api:connection')
const EventEmitter = require('events').EventEmitter
const log = require('@dadi/logger')
const Recovery = require('recovery')
const util = require('util')

const STATE_DISCONNECTED = 0
const STATE_CONNECTED = 1
const STATE_CONNECTING = 2

let connectionPool = {}

/**
 * @typedef ConnectionOptions
 * @type {object}
 * @property {string} database - the name of the database file to use
 * @property {object} collection - the name of the collection to use
 * @property {array} indexes - an array of indexes to create
 * @property {array} indexes.keys - an array of keys to create an index on
 * @property {object} indexes.options - options for the index
 */

/**
 * Create `new Connection` with given options
 *
 * @param {ConnectionOptions} options
 * @api public
 */
const Connection = function(options, storeName) {
  this.datastore = require('../datastore')(storeName)

  this.recovery = new Recovery({
    retries: config.get('databaseConnection.maxRetries')
  })

  if (options && this.datastore.settings.connectWithCollection !== true) {
    delete options.collection
  }

  // Setting up the reconnect method
  this.recovery.on('reconnect', opts => {
    this.connect(options)
      .then(db => {
        let connectionError

        if (db.readyState !== 1) {
          connectionError = new Error('Not connected')
        }

        this.recovery.reconnected(connectionError)
      })
      .catch(err => {
        this.recovery.reconnected(err)
      })
  })

  this.recovery.on('reconnected', () => {
    this.readyState = STATE_CONNECTED

    this.emit('connect', this.db)
  })

  this.readyState = STATE_DISCONNECTED
}

util.inherits(Connection, EventEmitter)

/**
 * Connects to the database as specified in the options, or the config
 *
 *
 */
Connection.prototype.connect = function(options) {
  this.readyState = STATE_CONNECTING

  if (this.db) {
    this.readyState = STATE_CONNECTED

    return Promise.resolve(this.db)
  }

  debug('connect %o', options)

  return this.datastore
    .connect(options, this.__foo)
    .then(() => {
      this.readyState = STATE_CONNECTED
      this.db = this.datastore

      this.emit('connect', this.db)

      debug('DB connected: %o', this.db)

      this.setUpEventListeners(this.db)

      return this.db
    })
    .catch(err => {
      log.error({module: 'connection'}, err)

      if (!this.recovery.reconnecting()) {
        this.recovery.reconnect()
      }

      const errorMessage =
        'DB connection failed with connection string ' +
        this.datastore.connectionString

      this.emit('disconnect', errorMessage)

      return Promise.reject(new Error(errorMessage))
    })
}

Connection.prototype.destroy = function() {
  if (typeof this.datastore.destroy === 'function') {
    return Promise.resolve(this.datastore.destroy())
  }

  return Promise.resolve()
}

Connection.prototype.setUpEventListeners = function(db) {
  db.on('DB_ERROR', err => {
    log.error({module: 'connection'}, err)

    this.emit(
      'disconnect',
      'DB connection failed with connection string ' +
        this.datastore.connectionString
    )

    if (!this.recovery.reconnecting()) {
      this.recovery.reconnect()
    }
  })

  db.on('DB_RECONNECTED', () => {
    debug('connection re-established: %s', this.datastore.connectionString)

    this.recovery.reconnected()
  })
}

Connection.prototype.whenConnected = function() {
  if (this.db && this.readyState === STATE_CONNECTED) {
    return Promise.resolve(this.db)
  }

  return new Promise(resolve => {
    this.on('connect', resolve)
  })
}

/**
 * Creates instances and connects them automatically
 *
 * @param {ConnectionOptions} options
 * @returns {object}
 * @api public
 */
module.exports = function(options, collection, storeName) {
  try {
    const storeSettings = require(storeName).settings

    if (storeSettings && storeSettings.connectWithCollection === false) {
      delete options.collection
    }
  } catch (err) {} // eslint-disable-line

  const connectionKey = Object.keys(options)
    .sort()
    .map(option => {
      return options[option]
    })
    .join(':')

  if (connectionPool[connectionKey]) {
    return connectionPool[connectionKey]
  }

  const connection = new Connection(options, storeName)

  if (collection) {
    options.collection = collection
  }

  connectionPool[connectionKey] = connection
  connection.setMaxListeners(35)
  connection.connect(options)

  if (config.get('env') !== 'test') {
    connection.once('disconnect', err => {
      log.error({module: 'connection'}, err)
    })
  }

  return connection
}

module.exports.Connection = Connection
module.exports.resetConnections = () => {
  const queue = Object.keys(connectionPool).map(connectionKey => {
    return connectionPool[connectionKey].destroy()
  })

  connectionPool = {}

  return Promise.all(queue)
}
