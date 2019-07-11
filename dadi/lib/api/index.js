const fs = require('fs')
const http = require('http')
const https = require('https')
const path = require('path')
const pathToRegexp = require('path-to-regexp')
const url = require('url')

const log = require('@dadi/logger')
const config = require(path.join(__dirname, '/../../../config'))

const Api = function() {
  this.paths = []
  this.all = []
  this.errors = []

  // always add default error handler in case the application doesn't define one
  this.errors.push(defaultError(this))

  // permanently bind context to listener
  this.listener = this.listener.bind(this)

  this.protocol = config.get('server.protocol')
  this.redirectPort = config.get('server.redirectPort')

  if (this.protocol === 'http') {
    this.httpInstance = http.createServer(this.listener)
  } else if (this.protocol === 'https') {
    // Redirect http to https
    if (this.redirectPort > 0) {
      this.redirectInstance = http.createServer(this.redirectListener)
    }

    const readFileSyncSafe = path => {
      try {
        return fs.readFileSync(path)
      } catch (_) {
        return null
      }
    }

    const passphrase = config.get('server.sslPassphrase')
    const caPath = config.get('server.sslIntermediateCertificatePath')
    const caPaths = config.get('server.sslIntermediateCertificatePaths')
    const serverOptions = {
      key: readFileSyncSafe(config.get('server.sslPrivateKeyPath')),
      cert: readFileSyncSafe(config.get('server.sslCertificatePath'))
    }

    if (passphrase && passphrase.length >= 4) {
      serverOptions.passphrase = passphrase
    }

    if (caPaths && caPaths.length > 0) {
      serverOptions.ca = []
      caPaths.forEach(path => {
        const data = readFileSyncSafe(path)

        data && serverOptions.ca.push(data)
      })
    } else if (caPath && caPath.length > 0) {
      serverOptions.ca = readFileSyncSafe(caPath)
    }

    // we need to catch any errors resulting from bad parameters
    // such as incorrect passphrase or no passphrase provided
    try {
      this.httpsInstance = https.createServer(serverOptions, this.listener)
    } catch (ex) {
      const exPrefix = 'error starting https server: '

      switch (ex.message) {
        case 'error:06065064:digital envelope routines:EVP_DecryptFinal_ex:bad decrypt':
          throw new Error(exPrefix + 'incorrect ssl passphrase')
        case 'error:0906A068:PEM routines:PEM_do_header:bad password read':
          throw new Error(exPrefix + 'required ssl passphrase not provided')
        default:
          throw new Error(exPrefix + ex.message)
      }
    }
  }
}

/**
 *  Connects a handler to a specific path
 *  @param {String} path
 *  @param {Controller} handler
 *  @return undefined
 *  @api public
 */
Api.prototype.use = function(path, handler) {
  if (typeof path === 'function') {
    if (path.length === 4) return this.errors.push(path)

    return this.all.push(path)
  }

  const regex = pathToRegexp(path)
  const order = routePriority(path, regex.keys)
  const newPath = {
    handler,
    order,
    path,
    regex
  }
  const existingIndex = this.paths.findIndex(item => item.path === path)

  if (existingIndex !== -1) {
    this.paths[existingIndex] = newPath
  } else {
    this.paths.push(newPath)
  }

  this.paths = this.paths.sort((a, b) => {
    if (a.order < b.order) {
      return 1
    }

    if (a.order > b.order) {
      return -1
    }

    return 0
  })
}

/**
 *  Connects a set of handlers, one per HTTP verb, to
 *  a given path.
 *
 *  @param {String} path
 *  @param {Object} handlers
 *  @return undefined
 *  @api public
 */
Api.prototype.routeMethods = function(path, handlers) {
  return this.use(path, function(req, res, next) {
    const method = req.method && req.method.toLowerCase()

    if (typeof handlers[method] === 'function') {
      return handlers[method](req, res, next)
    }

    next()
  })
}

/**
 *  Removes a handler or removes the handler attached to a specific path
 *  @param {String} path
 *  @return undefined
 *  @api public
 */
Api.prototype.unuse = function(path) {
  let indx

  if (typeof path === 'function') {
    if (path.length === 4) {
      indx = this.errors.indexOf(path)

      return Boolean(~indx) && this.errors.splice(indx, 1)
    }

    indx = this.all.indexOf(path)

    return Boolean(~indx) && this.all.splice(indx, 1)
  }

  const pathIndex = this.paths.findIndex(item => item.path === path)

  if (pathIndex !== -1) {
    this.paths.splice(pathIndex, 1)
  }
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
Api.prototype.listen = function(backlog, done) {
  const port = config.get('server.port')
  const host = config.get('server.host')
  const redirectPort = config.get('server.redirectPort')

  // If http only, return the http instance
  if (this.httpInstance) {
    return this.httpInstance.listen(port, host, backlog, done)
  }

  // If http should redirect to https, listen but don't return
  if (this.redirectInstance) {
    this.redirectInstance.listen(redirectPort, host, backlog, done)
  }

  // If https enabled, return the https instance
  if (this.httpsInstance) {
    return this.httpsInstance.listen(port, host, backlog, done)
  }
}

/**
 * convenience method that closes http/https server
 *
 * @param  {Function} [done]
 * @return void
 */
Api.prototype.close = function(done) {
  try {
    if (this.redirectInstance) {
      this.redirectInstance.close()
    }

    if (this.httpInstance) {
      this.httpInstance.close(done)
    } else if (this.httpsInstance) {
      this.httpsInstance.close(done)
    }
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
Api.prototype.listener = function(req, res) {
  // clone the middleware stack
  let stack = this.all.slice(0)
  const path = url.parse(req.url).pathname

  // get matching routes, and add req.params
  const matches = this._match(path, req)

  const doStack = function(i) {
    return function(err) {
      if (err) return errStack(0)(err)
      stack[i](req, res, doStack(++i))
    }
  }

  const self = this
  const errStack = function(i) {
    return function(err) {
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
 *  listener function to be passed to node's `createServer`
 *  @param {http.IncomingMessage} req
 *  @param {http.ServerResponse} res
 *  @return undefined
 *  @api public
 */
Api.prototype.redirectListener = function(req, res) {
  const port = config.get('server.port')
  const hostname = req.headers.host.split(':')[0]
  const location = 'https://' + hostname + ':' + port + req.url

  res.setHeader('Location', location)
  res.statusCode = 301
  res.end()
}

/**
 *  Check if any of the registered routes match the current url, if so populate `req.params`
 *  @param {String} path
 *  @param {http.IncomingMessage} req
 *  @return Array
 *  @api private
 */
Api.prototype._match = function(path, req) {
  const handlers = []

  // always add params object to avoid need for checking later
  req.params = {}

  this.paths.forEach(registeredPath => {
    const match = registeredPath.regex.exec(path)

    if (!match) return

    const keys = registeredPath.regex.keys

    handlers.push(registeredPath.handler)

    match.forEach((k, i) => {
      const keyOpts = keys[i] || {}

      if (match[i + 1] && keyOpts.name) req.params[keyOpts.name] = match[i + 1]
    })
  })

  return handlers
}

module.exports = function() {
  return new Api()
}

module.exports.Api = Api

// Default error handler, in case application doesn't define error handling
function defaultError(api) {
  return function(err, req, res) {
    let resBody

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
function notFound(req, res) {
  return function() {
    res.statusCode = 404
    res.end()
  }
}

function routePriority(path, keys) {
  const tokens = pathToRegexp.parse(path)
  const staticRouteLength =
    typeof tokens[0] === 'string'
      ? tokens[0].split('/').filter(Boolean).length
      : 0
  const requiredParamLength = keys.filter(key => !key.optional).length
  const optionalParamLength = keys.filter(key => key.optional).length

  let order =
    staticRouteLength * 5 + requiredParamLength * 2 + optionalParamLength

  // make internal routes less important...
  if (path.indexOf('/api/') > 0) order = -100

  return order
}
