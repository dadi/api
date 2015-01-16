var connection = require(__dirname + '/../model/connection');
var config = require(__dirname + '/../../../config');

var storeCollectionName = config.auth.database.tokenCollection;

var Store = function () {
    this.connection = connection(config.auth.database);
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

    // if the db is not connected queue the insert
    this.connection.once('connect', _done);
};

Store.prototype.set = function(token, value, done) {
    var self = this;
    var _done = function (database) {
        database.collection(storeCollectionName).insert({
            token: token,
            tokenExpire: Date.now() + (config.auth.tokenTtl),
            value: value
        }, done);
    };

    if (this.connection.db) return _done(this.connection.db);

    // if the db is not connected queue the insert
    this.connection.once('connect', _done);
};

module.exports = function () {
    return new Store();
};

module.exports.Store = Store;
