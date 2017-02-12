var path = require('path')
var uuid = require('uuid')
var config = require(path.join(__dirname, '/../../../config.js'))
var Connection = require(path.join(__dirname, '/../model/connection'))
var tokenStore = require(path.join(__dirname, '/tokenStore'))()

var clientCollectionName = config.get('auth.clientCollection')
var dbOptions = { auth: true, database: config.get('auth.database'), collection: clientCollectionName }
var connection = Connection(dbOptions, config.get('auth.datastore'))

/**
 * Generate a token and test that it doesn't already exist in the token store.
 * If it does exist, keep generating tokens until we've got a unique one.
 */
function getToken (callback) {
  (function checkToken () {
    var token = uuid.v4()
    tokenStore.get(token, function (err, val) {
      if (err) console.log(err)

      if (val) {
        checkToken()
      } else {
        callback(token)
      }
    })
  })()
}

module.exports.generate = function (req, res, next) {
  // Look up the credentials supplied in the request body in clientStore
  var credentials = {
    clientId: req.body.clientId,
    secret: req.body.secret
  }

  var _done = function (database) {
    database.find(credentials, clientCollectionName).then((results) => {
      var client = results[0]

      // Generate token
      getToken((returnedToken) => {
        // Save token
        return tokenStore.set(returnedToken, client, (err) => {
          if (err) {
            return next(err)
          }

          var token = {
            accessToken: returnedToken,
            tokenType: 'Bearer',
            expiresIn: config.get('auth.tokenTtl')
          }

          var json = JSON.stringify(token)
          res.setHeader('Content-Type', 'application/json')
          res.setHeader('Cache-Control', 'no-store')
          res.setHeader('Pragma', 'no-cache')
          return res.end(json)
        })
      })
    })
  }

  if (connection.db) return _done(connection.db)
  connection.once('connect', _done)
}

module.exports.validate = function (token, done) {
  tokenStore.get(token, function (err, doc) {
    if (err) return done(err)
    if (doc) return done(null, doc.value)
    done()
  })
}

module.exports.store = tokenStore
