const clientModel = require('./../model/acl/client')
const config = require('./../../../config')
const jwt = require('jsonwebtoken')

const AuthMiddleware = function (server) {
  this.tokenRoute = config.get('auth.tokenUrl')

  server.routeMethods(this.tokenRoute, {
    post: this.generateToken.bind(this)
  })

  server.use(
    this.authenticateRequest.bind(this)
  )
}

/**
 * Intercepts every request, apart from the ones targeting
 * the token store URL, and checks for the presence of a
 * bearer token in the appropriate header. If one is found,
 * it's JWT-decoded and in case of success, the resulting
 * client is added to the request as `req.dadiApiClient`.
 *
 * @param  {http.IncomingMessage}   req
 * @param  {http.ServerResponse}    res
 * @param  {Function}               next
 */
AuthMiddleware.prototype.authenticateRequest = function (req, res, next) {
  if (req.url === this.tokenRoute) return next()

  let header = req.headers && req.headers.authorization
  let match = header && header.match(/^Bearer (.*)$/)

  if (!match) {
    req.dadiApiClient = {}

    return next()
  }

  jwt.verify(
    match[1],
    config.get('auth.tokenKey'),
    (err, decoded) => {
      req.dadiApiClient = err
        ? { error: err }
        : decoded

      next()
    }
  )
}

/**
 * Handles the case where the client credentials are invalid.
 * Results in a 401 error response.
 *
 * @param  {http.IncomingMessage}   req
 * @param  {http.ServerResponse}    res
 * @param  {Function}               next
 */
AuthMiddleware.prototype.handleInvalidCredentials = function (req, res, next) {
  let error = new Error('Invalid Credentials')

  error.statusCode = 401

  res.setHeader(
    'WWW-Authenticate',
    'Bearer, error="invalid_credentials", error_description="Invalid credentials supplied"'
  )

  next(error)
}

/**
 * Takes the client ID and secret present in the request body and
 * attempts to generate a bearer token with them. If successful,
 * a signed JWT will be sent in the response, as well as some additional
 * data about the client. If not, a 401 error is delivered.
 *
 * @param  {http.IncomingMessage}   req
 * @param  {http.ServerResponse}    res
 * @param  {Function}               next
 */
AuthMiddleware.prototype.generateToken = function (req, res, next) {
  let {clientId, secret} = req.body

  res.setHeader('Content-Type', 'application/json')
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('Pragma', 'no-cache')

  if (
    typeof clientId !== 'string' ||
    typeof secret !== 'string'
  ) {
    return this.handleInvalidCredentials(req, res, next)
  }

  clientModel.get(clientId, secret).then(({results}) => {
    if (results.length === 0) {
      return this.handleInvalidCredentials(req, res, next)
    }

    let client = clientModel.sanitise(results[0])
    let payload = {
      clientId,
      accessType: client.accessType
    }

    jwt.sign(payload, config.get('auth.tokenKey'), {
      expiresIn: config.get('auth.tokenTtl')
    }, (err, token) => {
      if (err) {
        return this.handleInvalidCredentials(req, res, next)
      }

      let response = {
        accessToken: token,
        tokenType: 'Bearer',
        expiresIn: config.get('auth.tokenTtl'),
        permissions: {
          resources: client.resources,
          roles: client.roles
        }
      }

      return res.end(JSON.stringify(response))
    })
  })
}

module.exports = server => new AuthMiddleware(server)
