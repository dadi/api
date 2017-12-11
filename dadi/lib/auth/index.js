'use strict'

const _ = require('underscore')
const path = require('path')
const url = require('url')

const config = require(path.join(__dirname, '/../../../config.js'))
const formatError = require('@dadi/format-error')
const tokens = require(path.join(__dirname, '/tokens'))
const pathToRegexp = require('path-to-regexp')

function mustAuthenticate (endpoints, req) {
  const parsedUrl = url.parse(req.url, true)

  // all /config requests must be authenticated
  if (parsedUrl.pathname.indexOf('config') > -1) return true

  // /hello welcome route doesn't require authentication
  if (req.url === '/hello') return false

  // docs requests don't need to be authenticated
  if (parsedUrl.pathname.indexOf('docs') > 0) return false

  const endpointKey = _.find(_.keys(endpoints), function (k) {
    return parsedUrl.pathname.match(pathToRegexp(k))
  })

  if (!endpointKey) return true

  const endpoint = endpoints[endpointKey]

  if (isMediaEndpoint(endpoint, req)) {
    if (req.params.token && req.params.token === 'sign') {
      return true
    } else {
      // no auth required, token is an actual token or req.params.filename exists
      return false
    }
  }

  if (endpoint.model && endpoint.model.settings && endpoint.model.settings.hasOwnProperty('authenticate')) {
    if (typeof endpoint.model.settings.authenticate === 'boolean') {
      return endpoint.model.settings.authenticate
    } else {
      return endpoint.model.settings.authenticate.indexOf(req.method) > -1
    }
  } else {
    return true
  }
}

/**
 * If the URL is for a media asset, but not at the root, then it can be unauthenticated
 * @param {Object} endpoint - the component/controller matching the request URL
 * @param {Object} req - the original HTTP request
 * @returns {Boolean} - returns true if the URL starts with '/api/media/' followed by a filename
 */
function isMediaEndpoint (endpoint, req) {
  return endpoint.model &&
    endpoint.model.settings &&
    endpoint.model.settings.type &&
    endpoint.model.settings.type === 'mediaCollection'
}

function isAuthorized (endpoints, req, client) {
  const path = url.parse(req.url, true)

  const urlParts = _.compact(path.pathname.split('/'))
  const version = urlParts.shift()

  const endpointKey = _.find(_.keys(endpoints), function (k) { return k.indexOf(path.pathname) > -1 })

  // check if user accessType allows access to collection config
  if (path.pathname.indexOf('config') > -1 && req.method === 'POST') {
    if (client.accessType && client.accessType === 'admin') {
      return true
    } else {
      return false
    }
  }

  if (!endpointKey || !client.permissions) return true

  let authorized = true

  if (endpoints[endpointKey].model && client.permissions.collections) {
    authorized = _.findWhere(client.permissions.collections, { path: endpoints[endpointKey].model.name })
  } else if (endpoints[endpointKey].get && client.permissions.endpoints) {
    authorized = _.findWhere(client.permissions.endpoints, { path: urlParts.pop() })
  } else {
    authorized = false
  }

  if (authorized && authorized.apiVersion) {
    authorized = (authorized.apiVersion === version)
  }

  return authorized
}

// This attaches middleware to the passed in app instance
module.exports = function (server) {
  tokens.connect()

  const tokenRoute = config.get('auth.tokenUrl') || '/token'

  // Authorize
  server.app.use(function (req, res, next) {
    // Let requests for tokens through, along with endpoints configured to not use authentication
    if (req.url === tokenRoute || !mustAuthenticate(server.components, req)) return next()

    // require an authorization header for every request
    if (!(req.headers && req.headers.authorization)) return fail()

    // Strip token value out of request headers
    const parts = req.headers.authorization.split(' ')

    let token

    // Headers should be `Authorization: Bearer <%=tokenvalue%>`
    if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
      token = parts[1]
    }

    if (!token) return fail('NoToken')

    tokens.validate(token, function (err, client) {
      if (err) {
        if (err.message === 'DB_DISCONNECTED') {
          const error = formatError.createApiError('0004')

          error.statusCode = 503

          return next(error)
        }

        return next(err)
      }

      // If token is good continue, else `fail()`
      if (client) {
        if (!isAuthorized(server.components, req, client)) {
          const error = new Error('ClientId not authorized to access requested collection.')
          error.statusCode = 401

          res.setHeader('WWW-Authenticate', 'Bearer realm="' + url.parse(req.url, true).pathname + '"')

          return next(error)
        } else {
          // Token is valid. Attach client to request.
          req.client = client

          return next()
        }
      }

      fail('InvalidToken')
    })

    function fail (type) {
      const err = new Error('Unauthorized')

      err.statusCode = 401

      if (type === 'InvalidToken') {
        res.setHeader('WWW-Authenticate', 'Bearer, error="invalid_token", error_description="Invalid or expired access token"')
      } else if (type === 'NoToken') {
        res.setHeader('WWW-Authenticate', 'Bearer, error="no_token", error_description="No access token supplied"')
      }

      next(err)
    }
  })

  // Setup token service
  server.app.use(tokenRoute, function (req, res, next) {
    var method = req.method && req.method.toLowerCase()
    if (method === 'post') {
      return tokens.generate(req, res, next)
    }

    next()
  })
}
