var config = require(__dirname + '/../../../config').database;
var mongodb = require('mongodb');
var MongoClient = mongodb.MongoClient;
var Server = mongodb.Server;
var EventEmitter = require('events').EventEmitter;
var util = require('util');

/**
 * Create `new Connection` with given options
 *
 * @param {Object} options
 * @api public
 */
var Connection = function (options) {
    options || (options = {});
    this.host = options.host || config.host;
    this.port = options.port || config.port;
    this.database = options.database || config.database;

    // connection readyState
    // 0 = disconnected
    // 1 = connected
    // 2 = connecting
    // 3 = disconnecting
    this.readyState = 0;
};

// inherits from EventEmitter
util.inherits(Connection, EventEmitter);

/**
 * Connects to the database as specified in the options, or the config
 *
 * 
 */
Connection.prototype.connect = function (options) {
    options || (options = {});
    this.readyState = 2;

    this.mongoClient = new MongoClient(new Server(options.host || this.host, options.port || this.port));

    var self = this;
    this.mongoClient.open(function (err, mongoClient) {
        if (err) {
            self.readyState = 0;
            return self.emit('error', err);
        }

        var username = options.username || config.username;
        var password = options.password || config.password;

        self.readyState = 1;
        self.db = mongoClient.db(options.database || self.database);

        if (!username || !password) {
            return self.emit('connect', self.db);
        }

        self.db.authenticate(username, password, function (err) {
            if (err) return self.emit('error', err);
            self.emit('connect', self.db);
        });
    });
};

/**
 * Creates instances and connects them automatically
 *
 * @param {Object} options
 * @returns {Object} new `Connection`
 * @api public
 */
module.exports = function (options) {
    var conn = new Connection(options);
    conn.connect(options);
    return conn;
};

// export constructor
module.exports.Connection = Connection;
