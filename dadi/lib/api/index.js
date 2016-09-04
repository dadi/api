var fs = require('fs')
var http = require('http')
var https = require('https')
var path = require('path')
var pathToRegexp = require('path-to-regexp')
var url = require('url')

var log = require(path.join(__dirname, '/../log'))
var config = require(path.join(__dirname, '/../../../config'))

var Api = function () {
  this.paths = {}
  this.all = []
  this.errors = []

  // always add default error handler in case the application doesn't define one
  this.errors.push(defaultError(this))

  // permanently bind context to listener
  this.listener = this.listener.bind(this)

  this.protocol = config.get('server.protocol') || 'http'

  if (this.protocol === 'https') {
    var readFileSyncSafe = (path) => {
      try { return fs.readFileSync(path) } catch (ex) {}
      return null
    }

    var passphrase = config.get('server.sslPassphrase')
    var caPath = config.get('server.sslIntermediateCertificatePath')
    var caPaths = config.get('server.sslIntermediateCertificatePaths')
    var serverOptions = {
      key: readFileSyncSafe(config.get('server.sslPrivateKeyPath')),
      cert: readFileSyncSafe(config.get('server.sslCertificatePath'))
    }

    if (passphrase && passphrase.length >= 4) {
      serverOptions.passphrase = passphrase
    }

    if (caPaths && caPaths.length > 0) {
      serverOptions.ca = []
      caPaths.forEach((path) => {
        var data = readFileSyncSafe(path)
        data && serverOptions.ca.push(data)
      })
    } else if (caPath && caPath.length > 0) {
      serverOptions.ca = readFileSyncSafe(caPath)
    }

    // we need to catch any errors resulting from bad parameters
    // such as incorrect passphrase or no passphrase provided
    try {
      this.serverInstance = https.createServer(serverOptions, this.listener)
    } catch (ex) {
      var exPrefix = 'error starting https server: '
      switch (ex.message) {
        case 'error:06065064:digital envelope routines:EVP_DecryptFinal_ex:bad decrypt':
          throw new Error(exPrefix + 'incorrect ssl passphrase')
        case 'error:0906A068:PEM routines:PEM_do_header:bad password read':
          throw new Error(exPrefix + 'required ssl passphrase not provided')
        default:
          throw new Error(exPrefix + ex.message)
      }
    }
  } else {
    // default to http
    this.serverInstance = http.createServer(this.listener)
  }
}

/**
 *  Connects a handler to a specific path
 *  @param {String} path
 *  @param {Controller} handler
 *  @return undefined
 *  @api public
 */
Api.prototype.use = function (path, handler) {
  if (typeof path === 'function') {
    if (path.length === 4) return this.errors.push(path)
    return this.all.push(path)
  }

  this.paths[path] = {
    handler: handler,
    regex: pathToRegexp(path)
  }
}

/**
 *  Removes a handler or removes the handler attached to a specific path
 *  @param {String} path
 *  @return undefined
 *  @api public
 */
Api.prototype.unuse = function (path) {
  var indx
  if (typeof path === 'function') {
    if (path.length === 4) {
      indx = this.errors.indexOf(path)
      return !!~indx && this.errors.splice(indx, 1)
    }
    indx = this.all.indexOf(path)
    return !!~indx && this.all.splice(indx, 1)
  }
  delete this.paths[path]
}

/**
 *  convenience method that creates http/https server and attaches listener
 *  @param {Number} port
 *  @param {String} host
 *  @param {Number} backlog
 *  @param {Function} [done]
 *  @return http.Server
 *  @api public
 */
Api.prototype.listen = function (port, host, backlog, done) {
  return this.serverInstance.listen(port, host, backlog, done)
}

/**
 * convenience method that closes http/https server
 *
 * @param  {Function} [done]
 * @return void
 */
Api.prototype.close = function (done) {
  try {
    this.serverInstance.close(done)
  } catch (ex) {
    console.log('error closing server:', ex)
    done()
  }
}

/**
 *  listener function to be passed to node's `createServer`
 *  @param {http.IncomingMessage} req
 *  @param {http.ServerResponse} res
 *  @return undefined
 *  @api public
 */
Api.prototype.listener = function (req, res) {
  // clone the middleware stack
  var stack = this.all.slice(0)
  var path = url.parse(req.url).pathname

  // get matching routes, and add req.params
  var matches = this._match(path, req)

  var doStack = function (i) {
    return function (err) {
      if (err) return errStack(0)(err)
      stack[i](req, res, doStack(++i))
    }
  }

  var self = this
  var errStack = function (i) {
    return function (err) {
      self.errors[i](err, req, res, errStack(++i))
    }
  }

  // add path specific handlers
  stack = stack.concat(matches)

  // add 404 handler
  stack.push(notFound(req, res))

  // start going through the middleware/routes
  doStack(0)()
}

/**
 *  Check if any of the registered routes match the current url, if so populate `req.params`
 *  @param {String} path
 *  @param {http.IncomingMessage} req
 *  @return Array
 *  @api private
 */
Api.prototype._match = function (path, req) {
  var paths = this.paths
  var handlers = []

  // always add params object to avoid need for checking later
  req.params = {}

  Object.keys(paths).forEach(function (key) {
    var match = paths[key].regex.exec(path)
    if (!match) return

    var keys = paths[key].regex.keys

    handlers.push(paths[key].handler)

    match.forEach(function (k, i) {
      var keyOpts = keys[i] || {}
      if (match[i + 1] && keyOpts.name) req.params[keyOpts.name] = match[i + 1]
    })
  })

  return handlers
}

module.exports = function () {
  return new Api()
}

module.exports.Api = Api

// Default error handler, in case application doesn't define error handling
function defaultError (api) {
  return function (err, req, res) {
    var resBody

    log.error({module: 'api'}, err)

    if (err.json) {
      resBody = JSON.stringify(err.json)
    } else {
      resBody = JSON.stringify(err)
    }

    res.statusCode = err.statusCode || 500
    res.setHeader('content-type', 'application/json')
    res.setHeader('content-length', Buffer.byteLength(resBody))
    return res.end(resBody)
  }
}

// return a 404
function notFound (req, res) {
  return function () {
    res.statusCode = 404
    res.end()
  }
}
