var debug = require('debug')('api:tokenStore')
var path = require('path')
var Connection = require(path.join(__dirname, '/../model/connection'))
var config = require(path.join(__dirname, '/../../../config.js'))

var Store = function () {
  this.connect()

  var _done = function (database) {
    debug('connected')

    // set index on token and expiry
    // database.collection(storeCollectionName).ensureIndex(
    //   { 'token': 1, 'tokenExpire': 1 },
    //   { },
    //   function (err, indexName) {
    //     if (err) console.log(err)
    //     console.log('Token index: "' + storeCollectionName + '.' + indexName + "'")
    //   }
    // )
    //
    // // set a TTL index to remove the token documents after the tokenExpire value
    // database.collection(storeCollectionName).ensureIndex(
    //   { 'created': 1 },
    //   { expireAfterSeconds: config.get('auth.tokenTtl') },
    //   function (err, indexName) {
    //     if (err) console.log(err)
    //     console.log('Token expiry index: "' + storeCollectionName + '.' + indexName + "', with expireAfterSeconds = " + config.get('auth.tokenTtl'))
    //   }
    // )
  }

  if (this.connection.db) return _done(this.connection.db)
  this.connection.once('connect', _done)
}

/**
 *
 */
Store.prototype.get = function (token, done) {
  var _done = (database) => {
    var query = {
      token: token,
      tokenExpire: { $gte: Date.now() }
    }

    database.find(query, this.storeCollectionName).then((result) => {
      var tokenResult = result.length ? result[0] : null
      return done(null, tokenResult)
    })
  }

  if (this.connection.db) return _done(this.connection.db)
  this.connection.once('connect', _done)
}

/**
 *
 */
Store.prototype.set = function (token, value, done) {
  var _done = (database) => {
    database.insert({
      token: token,
      tokenExpire: Date.now() + (config.get('auth.tokenTtl') * 1000),
      created: new Date(),
      value: value
    }, this.storeCollectionName).then(() => {
      return done()
    }).catch((err) => {
      return done(err)
    })
  }

  if (this.connection.db) return _done(this.connection.db)
  this.connection.once('connect', _done)
}

/**
 *
 */
Store.prototype.connect = function () {
  this.storeCollectionName = config.get('auth.tokenCollection')
  var dbOptions = { auth: true, database: config.get('auth.database'), collection: this.storeCollectionName }
  this.connection = Connection(dbOptions, config.get('auth.datastore'))
}

module.exports = function () {
  return new Store()
}

module.exports.Store = Store
