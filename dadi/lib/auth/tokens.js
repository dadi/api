var path = require('path')
var uuid = require('uuid')
var config = require(path.join(__dirname, '/../../../config.js'))
var connection = require(path.join(__dirname, '/../model/connection'))
var tokenStore = require(path.join(__dirname, '/tokenStore'))()

var dbOptions = config.get('auth.database')
dbOptions.auth = true
var clientStore = connection(dbOptions)
var clientCollectionName = config.get('auth.clientCollection') || 'clientStore'

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
  // Look up the creds in clientStore
  var _done = function (database) {
    if (
      typeof req.body.clientId !== 'string' ||
      typeof req.body.secret !== 'string'
    ) {
      var error = new Error('Invalid Credentials')
      error.statusCode = 401
      res.setHeader('WWW-Authenticate', 'Bearer, error="invalid_credentials", error_description="Invalid credentials supplied"')
      return next(error)
    }

    database.collection(clientCollectionName).findOne({
      clientId: req.body.clientId,
      secret: req.body.secret
    }, function (err, client) {
      if (err) return next(err)

      if (client) {
        // Generate token
        var token
        getToken(function (returnedToken) {
          token = returnedToken

          // Save token
          return tokenStore.set(token, client, function (err) {
            if (err) return next(err)

            var tok = {
              accessToken: token,
              tokenType: 'Bearer',
              expiresIn: config.get('auth.tokenTtl')
            }

            var json = JSON.stringify(tok)
            res.setHeader('Content-Type', 'application/json')
            res.setHeader('Cache-Control', 'no-store')
            res.setHeader('Pragma', 'no-cache')
            res.end(json)
          })
        })
      } else {
        var error = new Error('Invalid Credentials')
        error.statusCode = 401
        res.setHeader('WWW-Authenticate', 'Bearer, error="invalid_credentials", error_description="Invalid credentials supplied"')
        return next(error)
      }
    })
  }

  if (clientStore.db) return _done(clientStore.db)

  clientStore.on('connect', _done)
}

module.exports.validate = function (token, done) {
  tokenStore.get(token, function (err, doc) {
    if (err) return done(err)

    if (doc) return done(null, doc.value)

    done()
  })
}

module.exports.store = tokenStore
