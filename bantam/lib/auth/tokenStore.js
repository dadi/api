var connection = require(__dirname + '/../model/connection');
var config = require(__dirname + '/../../../config.js');

var storeCollectionName = config.get('auth.tokenCollection');

var Store = function () {
    this.connection = connection(config.get('auth.database'));

    var _done = function (database) {
      database.collection(storeCollectionName).ensureIndex(
        { 'token': 1,'tokenExpire': 1 },
        { },
        function (err, indexName) {
          if (err) console.log(err);
          console.log('Using authentication layer index "' + storeCollectionName  + '.' + indexName + "'");
        }
      );
    }

    if (this.connection.db) return _done(this.connection.db);
    this.connection.once('connect', _done);
};

Store.prototype.get = function(token, done) {
    var self = this;
    var _done = function (database) {
        database.collection(storeCollectionName).findOne({
            token: token,
            tokenExpire: {$gte: Date.now()}
        }, done);
    };

    if (this.connection.db) return _done(this.connection.db);

    // If the db is not connected queue the insert
    this.connection.once('connect', _done);
};

Store.prototype.expire = function(done) {
    var self = this;
    var _done = function (database) {
        // set the TTL index to remove the token documents after the tokenExpire value
        database.collection(storeCollectionName).ensureIndex({ 'created': 1 }, { expireAfterSeconds: config.get('auth.tokenTtl') }, done);
    };

    if (this.connection.db) return _done(this.connection.db);

    // If the db is not connected queue the index check
    this.connection.once('connect', _done);
};

Store.prototype.set = function(token, value, done) {
    var self = this;
    var _done = function (database) {
        database.collection(storeCollectionName).insert({
            token: token,
            tokenExpire: Date.now() + (config.get('auth.tokenTtl') * 1000),
            created: new Date(),
            value: value
        }, done);
    };

    if (this.connection.db) return _done(this.connection.db);

    // If the db is not connected queue the insert
    this.connection.once('connect', _done);
};

module.exports = function () {
    return new Store();
};

module.exports.Store = Store;
