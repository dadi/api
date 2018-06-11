'use strict'

const debug = require('debug')('api:tokens')
const path = require('path')
const config = require(path.join(__dirname, '/../../../config.js'))
const Connection = require(path.join(__dirname, '/../model/connection'))
const formatError = require('@dadi/format-error')
const tokenStore = require(path.join(__dirname, '/tokenStore'))()

const clientCollectionName = config.get('auth.clientCollection')
const dbOptions = {
  collection: clientCollectionName,
  database: config.get('auth.database'),
  override: true
}

let connection

module.exports.connect = () => {
  connection = Connection(dbOptions, null, config.get('auth.datastore'))
}

module.exports.generate = (req, res, next) => {
  debug('Generate token')

  const handleInvalidCredentials = () => {
    const error = new Error('Invalid Credentials')

    error.statusCode = 401

    res.setHeader(
      'WWW-Authenticate', 'Bearer, error="invalid_credentials", error_description="Invalid credentials supplied"'
    )

    return next(error)
  }

  // Look up the credentials supplied in the request body in clientStore
  const credentials = {
    clientId: req.body.clientId,
    secret: req.body.secret
  }

  // Return 401 if the clientId/secret are not plain strings.
  if (
    typeof credentials.clientId !== 'string' ||
    typeof credentials.secret !== 'string'
  ) {
    return handleInvalidCredentials()
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

  if (!connection.db) {
    let error = formatError.createApiError('0004')

    error.statusCode = 503

    return next(JSON.stringify(error))
  }

  return connectionReady(connection.db)
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
