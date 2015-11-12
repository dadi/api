var config = require(__dirname + '/../../../config.js');
var mongodb = require('mongodb');
var MongoClient = mongodb.MongoClient;
var Server = mongodb.Server;
var EventEmitter = require('events').EventEmitter;
var util = require('util');
var _ = require('underscore');

/**
 * Create `new Connection` with given options
 *
 * @param {Object} options
 * @api public
 */
var Connection = function (options) {

    options = options || {};

    if (options.database && config.get('database')[options.database]) {
        options = _.extend({}, config.get('database')[options.database], options);
    } else {
        options = _.extend({}, config.get('database'), options);
    }

    this.connectionOptions = options;

    // required config fields
    if (!(this.connectionOptions.hosts && this.connectionOptions.hosts.length)) {
        throw new Error('`hosts` Array is required for Connection');
    }

    if (!this.connectionOptions.database) throw new Error('`database` String is required for Connection');

    this.connectionString = constructConnectionString(this.connectionOptions);

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
Connection.prototype.connect = function () {
    this.readyState = 2;

    this.mongoClient = new MongoClient();

    var self = this;

    this.mongoClient.connect(this.connectionString, function(err, db) {

        if (err) {
            self.readyState = 0;
            return self.emit('error', err);
        }

        self.readyState = 1;
        self.db = db;

        if (!self.connectionOptions.username || !self.connectionOptions.password) {
            return self.emit('connect', self.db);
        }

        self.db.authenticate(self.connectionOptions.username, self.connectionOptions.password, function (err) {
            if (err) return self.emit('error', err);
            self.emit('connect', self.db);
        });

    });

};


function constructConnectionString(options) {

    // mongodb://[username:password@]host1[:port1][,host2[:port2],...[,hostN[:portN]]][/[database][?options]]
    // mongodb://myprimary.com:27017,mysecondary.com:27017/MyDatabase/?replicaset=MySet

    connectionOptions = _.extend({
        options: {}
    }, options);


    if (options.replicaSet) {
        connectionOptions.options.replicaSet = options.replicaSet;
    }

    if (options.ssl) connectionOptions.options['ssl'] = options.ssl;

    if (options.maxPoolSize) connectionOptions.options['maxPoolSize'] = options.maxPoolSize;

    // test specific connection pool size
    if (config.get('env') === 'test') {
        connectionOptions.options['maxPoolSize'] = 1;
    }

    return 'mongodb://'
        + credentials(connectionOptions)
        + connectionOptions.hosts.map(function(host, index) {
                return host.host + ':' + (host.port || 27017);
            }).join(',')
        + '/'
        + connectionOptions.database
        + encodeOptions(connectionOptions.options);

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
        "database": "serama",
        "ssl": false,
        "replicaSet": "test",
        "secondary": {
            "enabled": true,
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

function encodeOptions(options) {
    if (!options || _.isEmpty(options)) return "";

    return "?" + Object.keys(options).map(function(key) {
        return encodeURIComponent(key) + "=" + encodeURIComponent(options[key] || "");
    }).join('&');
}

function credentials(options) {
    if (!options.username || !options.password) return "";

    return options.username + ":" + options.password + "@";
}

/**
 * Creates instances and connects them automatically
 *
 * @param {Object} options
 * @returns {Object} new `Connection`
 * @api public
 */
module.exports = function (options) {
    var conn = new Connection(options);

    conn.on('error', function (err) {
        console.log('Connection Error: ' + err + '. Using connection string "' + conn.connectionString + '"');
    });

    conn.connect();
    return conn;
};

// export constructor
module.exports.Connection = Connection;
