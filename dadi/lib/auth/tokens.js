'use strict'

const debug = require('debug')('api:tokens')
const path = require('path')
const config = require(path.join(__dirname, '/../../../config.js'))
const Connection = require(path.join(__dirname, '/../model/connection'))
const tokenStore = require(path.join(__dirname, '/tokenStore'))()

const clientCollectionName = config.get('auth.clientCollection')
const dbOptions = { override: true, database: config.get('auth.database'), collection: clientCollectionName }

let connection

module.exports.connect = () => {
  connection = Connection(dbOptions, null, config.get('auth.datastore'))
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

  const connectionReady = database => {
    database.find({
      query: credentials,
      collection: clientCollectionName,
      schema: tokenStore.schema.fields,
      settings: tokenStore.schema.settings
    }).then(results => {
      const client = results.results[0]

      // no client found matchibg the credentials
      // return 401 Unauthorized
      if (!client) {
        return handleInvalidCredentials()
      }

      return tokenStore.generateNew().then(newToken => {
        return tokenStore.set(newToken, client).then(doc => newToken)
      })
    }).then(token => {
      if (!token) return

      const response = {
        accessToken: token,
        tokenType: 'Bearer',
        expiresIn: config.get('auth.tokenTtl')
      }

      res.setHeader('Content-Type', 'application/json')
      res.setHeader('Cache-Control', 'no-store')
      res.setHeader('Pragma', 'no-cache')

      return res.end(JSON.stringify(response))
    }).catch(next)
  }

  if (connection.db) return connectionReady(connection.db)
  connection.once('connect', connectionReady)
}

module.exports.validate = (token, done) => {
  debug('Validate token %s', token)

  tokenStore.get(token).then(document => {
    if (document) {
      return done(null, document.value)
    }

    return done()
  }).catch(done)
}

module.exports.tokenStore = tokenStore
