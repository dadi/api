var _ = require('underscore')
var EventEmitter = require('events').EventEmitter
var mongodb = require('mongodb')
var MongoClient = mongodb.MongoClient
var path = require('path')
var util = require('util')

var config = require(path.join(__dirname, '/../../../config.js'))

// instantiate once
var mongoClient = new MongoClient()
var _connections = []

/**
 * Create `new Connection` with given options
 *
 * @param {Object} options
 * @api public
 */
var Connection = function (options) {
  this.connectionOptions = getConnectionOptions(options)
  this.connectionString = constructConnectionString(this.connectionOptions)

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
Connection.prototype.connect = function () {
  this.readyState = 2

  var self = this

  if (self.db) {
    self.readyState = 1
    self.emit('connect', self.db)
    return
  }

  mongoClient.connect(this.connectionString, function (err, db) {
    if (err) {
      self.readyState = 0
      return self.emit('error', err)
    }

    self.readyState = 1
    self.db = db

    _connections[self.connectionOptions.database] = self

    if (!self.connectionOptions.username || !self.connectionOptions.password) {
      return self.emit('connect', self.db)
    }

    self.db.authenticate(self.connectionOptions.username, self.connectionOptions.password, function (err) {
      if (err) return self.emit('error', err)
      self.emit('connect', self.db)
    })
  })
}

function getConnectionOptions (options) {
  options = options || {}

  var dbConfig = config.get('database')

  if (options.auth || options.search) {
    // extend primary database config with the auth database options
    options = _.extend({}, dbConfig, options)
  } else {
    if (options.database && dbConfig.enableCollectionDatabases) {
      if (dbConfig[options.database]) {
        options = _.extend(dbConfig, dbConfig[options.database], options)
      } else {
        options = _.extend(dbConfig, options)
      }
    } else {
      // use primary database config
      options = _.extend({}, dbConfig)
    }
  }

  var connectionOptions = options

  // required config fields
  if (!(connectionOptions.hosts && connectionOptions.hosts.length)) {
    throw new Error('`hosts` Array is required for Connection')
  }

  if (!connectionOptions.database) throw new Error('`database` String is required for Connection')

  return connectionOptions
}

function constructConnectionString (options) {
  // mongodb://[username:password@]host1[:port1][,host2[:port2],...[,hostN[:portN]]][/[database][?options]]
  // mongodb://myprimary.com:27017,mysecondary.com:27017/MyDatabase/?replicaset=MySet

  var connectionOptions = _.extend({
    options: {}
  }, options)

  if (options.replicaSet && options.replicaSet !== 'false') {
    connectionOptions.options.replicaSet = options.replicaSet
  }

  if (options.ssl) connectionOptions.options['ssl'] = options.ssl

  if (options.maxPoolSize) connectionOptions.options['maxPoolSize'] = options.maxPoolSize

  if (options.readPreference) connectionOptions.options['readPreference'] = options.readPreference

  // test specific connection pool size
  if (config.get('env') === 'test') {
    connectionOptions.options['maxPoolSize'] = 1
  }

  return 'mongodb://' +
    credentials(connectionOptions) +
    connectionOptions.hosts.map(function (host, index) {
      return host.host + ':' + (host.port || 27017)
    }).join(',') +
  '/' +
  connectionOptions.database +
  encodeOptions(connectionOptions.options)

/*
options = {
    "hosts": [
        {
            "host": "localhost",
            "port": 27020
        },
        {
            "host": "localhost",
            "port": 27021
        }
    ],
    "username": "",
    "password": "",
    "database": "test",
    "ssl": false,
    "replicaSet": "test",
    "secondary": {
        "hosts": [
            {
                "host": "127.0.0.1",
                "port": 27018
            }
        ],
        "username": "",
        "password": "",
        "replicaSet": false,
        "ssl": false
    },
    "testdb": {
        "hosts": [
            {
                "host": "127.0.0.1",
                "port": 27017
            }
        ],
        "username": "",
        "password": ""
    }
}
*/
}

function encodeOptions (options) {
  if (!options || _.isEmpty(options)) return ''

  return '?' + Object.keys(options).map(function (key) {
    return encodeURIComponent(key) + '=' + encodeURIComponent(options[key] || '')
  }).join('&')
}

function credentials (options) {
  if (!options.username || !options.password) return ''

  return options.username + ':' + options.password + '@'
}

/**
 * Creates instances and connects them automatically
 *
 * @param {Object} options
 * @returns {Object} new `Connection`
 * @api public
 */
module.exports = function (options) {
  var conn
  var connectionOptions = getConnectionOptions(options)

  // if a connection exists for the specified database, return it
  if (_connections[connectionOptions.database]) {
    conn = _connections[connectionOptions.database]

    if (conn.readyState === 2) {
      setTimeout(function () {
        conn.connect()
      }, 5000)
    }
  } else {
    // else create a new connection
    conn = new Connection(options)

    conn.on('error', function (err) {
      console.log('Connection Error: ' + err + '. Using connection string "' + conn.connectionString + '"')
    })

    _connections[conn.connectionOptions.database] = conn
    conn.connect()
  }

  return conn
}

// test helper
module.exports.resetConnections = function () {
  _connections = []
}

// export constructor
module.exports.Connection = Connection
