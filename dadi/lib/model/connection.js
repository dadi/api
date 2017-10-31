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

let connectionPool = []

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
const Connection = function (options, storeName) {
  this.datastore = require('../datastore')(storeName)

  this.recovery = new Recovery({
    retries: config.get('databaseConnection.maxRetries')
  })

  // Setting up the reconnect method
  this.recovery.on('reconnect', opts => {
    this.connect(options).then(db => {
      let connectionError

      if (db.readyState !== 1) {
        connectionError = new Error('Not connected')
      }

      this.recovery.reconnected(connectionError)
    }).catch(err => {
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
Connection.prototype.connect = function (options) {
  this.readyState = STATE_CONNECTING

  if (this.db) {
    this.readyState = STATE_CONNECTED

    return Promise.resolve(this.db)
  }

  debug('connect %o', options)

  return this.datastore.connect(options).then(() => {
    this.readyState = STATE_CONNECTED
    this.db = this.datastore

    this.emit('connect', this.db)

    debug('DB connected: %o', this.db)

    this.setUpEventListeners(this.db)

    return this.db
  }).catch(err => {
    log.error({module: 'connection'}, err)

    if (!this.recovery.reconnecting()) {
      this.recovery.reconnect()
    }

    const errorMessage = 'DB connection failed with connection string ' + this.datastore.connectionString

    this.emit('disconnect', errorMessage)

    return Promise.reject(new Error(errorMessage))
  })
}

Connection.prototype.setUpEventListeners = function (db) {
  db.on('DB_ERROR', err => {
    log.error({module: 'connection'}, err)

    this.emit('disconnect', 'DB connection failed with connection string ' + this.datastore.connectionString)

    if (!this.recovery.reconnecting()) {
      this.recovery.reconnect()
    }
  })

  db.on('DB_RECONNECTED', () => {
    debug('connection re-established: %s', this.datastore.connectionString)

    this.recovery.reconnected()
  })
}

/**
 * Creates instances and connects them automatically
 *
 * @param {ConnectionOptions} options
 * @returns {object}
 * @api public
 */
module.exports = function (options, collection, storeName) {
  let conn

  try {
    const storeConfig = require(storeName).Config

    if (storeConfig.get('connectWithCollection') === false) {
      delete options.collection
    }
  } catch (err) {
    log.error({module: 'connection'}, err)
  }

  const connectionKey = Object.keys(options).map(option => { return options[option] }).join(':')

  // if a connection exists for the specified database, return it
  if (connectionPool[connectionKey]) {
    return connectionPool[connectionKey]
  }

  conn = new Connection(options, storeName)

  if (collection) {
    options.collection = collection
  }

  connectionPool[connectionKey] = conn
  conn.connect(options)

  return conn
}

module.exports.Connection = Connection
module.exports.resetConnections = () => {
  connectionPool = []
}
