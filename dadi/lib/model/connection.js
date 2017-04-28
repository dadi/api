var debug = require('debug')('api:connection')
var EventEmitter = require('events').EventEmitter
var util = require('util')

var _connections = []

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
var Connection = function (options, storeName) {
  this.datastore = require('../datastore')(storeName)

  // connection readyState
  // 0 = disconnected
  // 1 = connected
  // 2 = connecting
  // 3 = disconnecting
  this.readyState = 0
}

util.inherits(Connection, EventEmitter)

/**
 * Connects to the database as specified in the options, or the config
 *
 *
 */
Connection.prototype.connect = function (options) {
  this.readyState = 2

  if (this.db) {
    this.readyState = 1
    this.emit('connect', this.db)
    return
  }

  debug('connect %o', options)

  this.datastore.connect(options).then(() => {
    debug('connect returned')

    this.readyState = 1
    this.db = this.datastore

    return this.emit('connect', this.db)
  }).catch((err) => {
    debug('connection error %o', err)
    return this.emit('error', err)
  })

  // mongoClient.connect(this.connectionString, function (err, db) {
  //   if (err) {
  //     self.readyState = 0
  //     return self.emit('error', err)
  //   }

    // self.readyState = 1
    // self.db = db
    // self.db = datastore

    // _connections[self.connectionOptions.database] = self
    //
    // if (!self.connectionOptions.username || !self.connectionOptions.password) {
    // return this.emit('connect', this.db)
    // }
    //
    // self.db.authenticate(self.connectionOptions.username, self.connectionOptions.password, function (err) {
    //   if (err) return self.emit('error', err)
    //   self.emit('connect', self.db)
    // })
  // })
}

/**
 * Creates instances and connects them automatically
 *
 * @param {ConnectionOptions} options
 * @returns {object}
 * @api public
 */
module.exports = function (options, collection, storeName) {
  // var enableCollectionDatabases = config.get('database.enableCollectionDatabases')
  // var database = enableCollectionDatabases ? options.database : null
  var conn
  // var connectionOptions = getConnectionOptions(options)
  //

  // if a connection exists for the specified database, return it
  // if (_connections[JSON.stringify(options)]) {
  //   return _connections[JSON.stringify(options)]
  // }

  var connectionKey = Object.keys(options).map((option) => { return options[option] }).join(':')

  if (_connections[connectionKey]) {
    return _connections[connectionKey]
  }
  //
  //   if (conn.readyState === 2) {
  //     setTimeout(function () {
  //       conn.connect()
  //     }, 5000)
  //   }
  // } else {
  // else create a new connection

  conn = new Connection(options, storeName)

  if (collection) {
    options.collection = collection
  }

  conn.on('error', function (err) {
    console.log('Connection Error: ' + err + '. Using connection string "' + conn.datastore.connectionString + '"')
  })

  // _connections[JSON.stringify(options)] = conn
  _connections[connectionKey] = conn

  conn.connect(options)
//  }

  return conn
}

module.exports.Connection = Connection
