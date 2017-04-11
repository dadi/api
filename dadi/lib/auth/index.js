var _ = require('underscore')
var path = require('path')
var url = require('url')

var config = require(path.join(__dirname, '/../../../config.js'))
var tokens = require(path.join(__dirname, '/tokens'))
var pathToRegexp = require('path-to-regexp')

function mustAuthenticate (endpoints, path, reqMethod) {
  path = url.parse(path, true)

  // all /config requests must be authenticated
  if (path.pathname.indexOf('config') > -1) return true

  // docs requests don't need to be authenticated
  if (path.pathname.indexOf('docs') > 0) return false

  const staticEndpoint = '/api/media/'

  // If the URL is for a media asset, but not at the root, then it can be
  // unauthenticated
  if ((path.pathname.indexOf(staticEndpoint) === 0) && (path.pathname.length > staticEndpoint.length)) {
    return false
  }

  var endpointKey = _.find(_.keys(endpoints), function (k) { return path.pathname.match(pathToRegexp(k)) })

  if (!endpointKey) return true

  if (endpoints[endpointKey].model && endpoints[endpointKey].model.settings && endpoints[endpointKey].model.settings.hasOwnProperty('authenticate')) {
    if (typeof endpoints[endpointKey].model.settings.authenticate === 'boolean') {
      return endpoints[endpointKey].model.settings.authenticate
    } else {
      return endpoints[endpointKey].model.settings.authenticate.indexOf(reqMethod) > -1
    }
  } else {
    return true
  }
}

function isAuthorized (endpoints, req, client) {
  var path = url.parse(req.url, true)

  var urlParts = _.compact(path.pathname.split('/'))
  var version = urlParts.shift()

  var endpointKey = _.find(_.keys(endpoints), function (k) { return k.indexOf(path.pathname) > -1 })

  // check if this is a master config request first
  // if (path.pathname.indexOf('api/config') > -1 && client.permissions) {
  //     if (client.permissions.collections && client.permissions.collections.indexOf(path.pathname) < 0) {
  //         return false
  //     }

  //     if (client.permissions.endpoints && client.permissions.endpoints.indexOf(path.pathname) < 0) {
  //         return false
  //     }
  // }

  // check if user accessType allows access to collection config
  if (path.pathname.indexOf('config') > -1 && req.method === 'POST') {
    if (client.accessType && client.accessType === 'admin') {
      return true
    } else {
      return false
    }
  }

  if (!endpointKey || !client.permissions) return true

  var authorized = true

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
  var tokenRoute = config.get('auth.tokenUrl') || '/token'

  // Authorize
  server.app.use(function (req, res, next) {
    // Let requests for tokens through, along with endpoints configured to not use authentication
    if (req.url === tokenRoute || !mustAuthenticate(server.components, req.url, req.method)) return next()

    // require an authorization header for every request
    if (!(req.headers && req.headers.authorization)) return fail()

    // Strip token value out of request headers
    var parts = req.headers.authorization.split(' ')
    var token

    // Headers should be `Authorization: Bearer <%=tokenvalue%>`
    if (parts.length === 2 && /^Bearer$/i.test(parts[0])) {
      token = parts[1]
    }

    if (!token) return fail('NoToken')

    tokens.validate(token, function (err, client) {
      if (err) return next(err)

      // If token is good continue, else `fail()`
      if (client) {
        if (!isAuthorized(server.components, req, client)) {
          var error = new Error('ClientId not authorized to access requested collection.')
          error.statusCode = 401
          res.setHeader('WWW-Authenticate', 'Bearer realm="' + url.parse(req.url, true).pathname + '"')
          return next(error)
        } else {
          // Token is valid attach client to request
          req.client = client
          return next()
        }
      }

      fail('InvalidToken')
    })

    function fail (type) {
      var err = new Error('Unauthorized')
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
