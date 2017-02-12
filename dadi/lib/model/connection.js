var EventEmitter = require('events').EventEmitter
var util = require('util')

/**
 * Create `new Connection` with given options
 *
 * @param {Object} options
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

// inherits from EventEmitter
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

  this.datastore.connect(options).then(() => {
    this.readyState = 1
    this.db = this.datastore

    return this.emit('connect', this.db)
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
 * @param {Object} options
 * @returns {Object} new `Connection`
 * @api public
 */
module.exports = function (options, storeName, collection) {
  // var enableCollectionDatabases = config.get('database.enableCollectionDatabases')
  // var database = enableCollectionDatabases ? options.database : null

  // var connectionOptions = getConnectionOptions(options)
  //
  // // if a connection exists for the specified database, return it
  // if (_connections[connectionOptions.database]) {
  //   conn = _connections[connectionOptions.database]
  //
  //   if (conn.readyState === 2) {
  //     setTimeout(function () {
  //       conn.connect()
  //     }, 5000)
  //   }
  // } else {
  // else create a new connection
  var conn = new Connection(options, storeName)

  if (collection) {
    options.collection = collection
  }

  conn.on('error', function (err) {
    console.log('Connection Error: ' + err + '. Using connection string "' + conn.connectionString + '"')
  })

  // _connections[conn.connectionOptions.database] = conn
  conn.connect(options)
//  }

  return conn
}

module.exports.Connection = Connection
