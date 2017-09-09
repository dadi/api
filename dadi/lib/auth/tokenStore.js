var debug = require('debug')('api:tokenStore')
var path = require('path')
var Connection = require(path.join(__dirname, '/../model/connection'))
var config = require(path.join(__dirname, '/../../../config.js'))

var TokenStore = function () {
  this.connect()

  var _done = function (database) {
    debug('connected')

    // set index on token and expiry
    // database.collection(tokenCollection).ensureIndex(
    //   { 'token': 1, 'tokenExpire': 1 },
    //   { },
    //   function (err, indexName) {
    //     if (err) console.log(err)
    //     console.log('Token index: "' + tokenCollection + '.' + indexName + "'")
    //   }
    // )
    //
    // // set a TTL index to remove the token documents after the tokenExpire value
    // database.collection(tokenCollection).ensureIndex(
    //   { 'created': 1 },
    //   { expireAfterSeconds: config.get('auth.tokenTtl') },
    //   function (err, indexName) {
    //     if (err) console.log(err)
    //     console.log('Token expiry index: "' + tokenCollection + '.' + indexName + "', with expireAfterSeconds = " + config.get('auth.tokenTtl'))
    //   }
    // )
  }

  if (this.connection.db) return _done(this.connection.db)
  this.connection.once('connect', _done)
}

TokenStore.prototype.getSchema = function () {
  return {
    fields: {
      token: {
        type: 'String',
        required: true
      },
      tokenExpire: {
        type: 'Number',
        required: true
      },
      created: {
        type: 'DateTime',
        required: true
      },
      value: {
        type: 'Object',
        required: false
      }
    },
    settings: {
      cache: false
    }
  }
}

/**
 *
 */
TokenStore.prototype.get = function (token, done) {
  var _done = (database) => {
    var query = {
      token: token,
      tokenExpire: { $gte: Date.now() }
    }

    database.find(query, this.tokenCollection, {}, this.getSchema()).then((result) => {
      var tokenResult = result.results.length ? result.results[0] : null
      return done(null, tokenResult)
    })
  }

  if (this.connection.db) return _done(this.connection.db)
  this.connection.once('connect', _done)
}

/**
 *
 */
TokenStore.prototype.set = function (token, value, done) {
  var _done = (database) => {
    database.insert({
      token: token,
      tokenExpire: Date.now() + (config.get('auth.tokenTtl') * 1000),
      created: new Date(),
      value: value
    }, this.tokenCollection, this.getSchema()).then(() => {
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
TokenStore.prototype.connect = function () {
  var authConfig = config.get('auth')

  this.tokenCollection = authConfig.tokenCollection
  var dbOptions = { auth: true, database: authConfig.database, collection: this.tokenCollection }
  this.connection = Connection(dbOptions, null, authConfig.datastore)
}

module.exports = function () {
  return new TokenStore()
}

module.exports.TokenStore = TokenStore
