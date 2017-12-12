const path = require('path')
const vary = require('vary')

const config = require(path.join(__dirname, '/../../../config.js'))

module.exports = function cors (server) {
  server.app.use((req, res, next) => {
    if (config.get('cors') !== true) {
      return next()
    }

    const method = req.method && req.method.toUpperCase && req.method.toUpperCase()

    // Preflight requests set some sensible defaults, but mostly permit anything
    // the client asks for by reflecting its headers back.
    if (method === 'OPTIONS') {
      // Reflect the requesting `Origin` back to the client, falling back on a
      // wildcard permission.
      if (req.headers.origin) {
        res.setHeader('Access-Control-Allow-Origin', req.headers.origin)
        vary(res, 'Origin')
      } else {
        res.setHeader('Access-Control-Allow-Origin', '*')
      }

      // Permit all HTTP methods.
      res.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE')

      // Reflect any requested headers.
      if (req.headers['access-control-request-headers']) {
        res.setHeader('Access-Control-Allow-Headers', req.headers['access-control-request-headers'])
        vary(res, 'Access-Control-Request-Headers')
      }

      // Explicitly set the content length to 0 for buggy browsers.
      res.setHeader('Content-Length', 0)

      // Set the status code to 204 (No Content).
      res.statusCode = 204

      // Do not process further middleware.
      return res.end()
    }

    // All other requests reflect the requesting `Origin` back to the client,
    // effectively enabling CORS for all endpoints and HTTP methods.
    if (req.headers.origin) {
      res.setHeader('Access-Control-Allow-Origin', req.headers.origin)
      vary(res, 'Origin')
    } else {
      res.setHeader('Access-Control-Allow-Origin', '*')
    }

    next()
  })
}
