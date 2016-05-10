var connection = require(__dirname + '/../model/connection');
var config = require(__dirname + '/../../../config.js');

var storeCollectionName = config.get('auth.tokenCollection');

var Store = function () {

    var dbOptions = config.get('auth.database');
    dbOptions.auth = true;
    this.connection = connection(dbOptions);

    var _done = function (database) {
      database.collection(storeCollectionName).dropIndexes(function(err) {
        if (err) console.log(err);
        console.log('Dropped authentication layer indexes')
      })

      database.collection(storeCollectionName).ensureIndex(
        { 'token': 1,'tokenExpire': 1 },
        { },
        function (err, indexName) {
          if (err) console.log(err);
          console.log('Created token index "' + storeCollectionName  + '.' + indexName + "'");
        }
      );

      // set a TTL index to remove the token documents after the tokenExpire value
      database.collection(storeCollectionName).ensureIndex(
        { 'created': 1 },
        { expireAfterSeconds: config.get('auth.tokenTtl') },
        function (err, indexName) {
          if (err) console.log(err);
          console.log('Created token expiry index "' + storeCollectionName  + '.' + indexName + "', with expireAfterSeconds = " + config.get('auth.tokenTtl'));
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
