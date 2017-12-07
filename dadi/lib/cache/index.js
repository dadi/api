var _ = require('underscore')
var crypto = require('crypto')
var path = require('path')
var pathToRegexp = require('path-to-regexp')
var url = require('url')

var config = require(path.join(__dirname, '/../../../config'))
var log = require('@dadi/logger')
var DadiCache = require('@dadi/cache')
var cache

var Cache = function (server) {
  this.cache = cache = new DadiCache(config.get('caching'))

  this.server = server
  this.enabled = config.get('caching.directory.enabled') || config.get('caching.redis.enabled')
  this.encoding = 'utf8'
  this.options = {}
}

var instance
module.exports = function (server) {
  if (!instance) {
    instance = new Cache(server)
  }
  return instance
}

Cache.prototype.cachingEnabled = function (req) {
  var options = {}
  var endpoints = this.server.components
  var requestPath = url.parse(req.url, true).pathname

  var endpointKey = _.find(_.keys(endpoints), function (k) { return pathToRegexp(k).exec(requestPath) })

  if (!endpointKey) return false

  if (endpoints[endpointKey].model && endpoints[endpointKey].model.settings) {
    options = endpoints[endpointKey].model.settings
  }

  return (this.enabled && (options.cache || false))
}

Cache.prototype.getEndpointContentType = function (req) {
  // there are only two possible types javascript or json
  var query = url.parse(req.url, true).query
  return query.callback ? 'text/javascript' : 'application/json'
}

/**
 * Adds the Cache middleware to the stack
 */
Cache.prototype.init = function () {
  var self = this

  this.server.app.use((req, res, next) => {
    var enabled = self.cachingEnabled(req)
    if (!enabled) return next()

    // only cache GET requests
    if (req.method && req.method.toLowerCase() !== 'get') return next()

    var query = url.parse(req.url, true).query

    // allow query string param to bypass cache
    var noCache = query.cache && query.cache.toString().toLowerCase() === 'false'
    delete query.cache

    // we build the filename with a hashed hex string so we can be unique
    // and avoid using file system reserved characters in the name.
    var modelDir = crypto.createHash('sha1').update(url.parse(req.url).pathname).digest('hex')
    var filename = crypto.createHash('sha1').update(url.parse(req.url).pathname + JSON.stringify(query)).digest('hex')

    // Prepend the model's name/folder hierarchy to the filename so it can be used
    // later to flush the cache for this model
    var cacheKey = modelDir + '_' + filename

    // get contentType that current endpoint requires
    var contentType = self.getEndpointContentType(req)

    // attempt to get from the cache
    cache.get(cacheKey).then((stream) => {
      res.setHeader('X-Cache-Lookup', 'HIT')

      if (noCache) {
        res.setHeader('X-Cache', 'MISS')
        return next()
      }

      log.info({module: 'cache'}, 'Serving ' + req.url + ' from cache')

      res.statusCode = 200
      res.setHeader('X-Cache', 'HIT')
      res.setHeader('Content-Type', contentType)
      // res.setHeader('Content-Length', stats.size)

      stream.pipe(res)
    }).catch(() => {
      // not found in cache
      res.setHeader('X-Cache', 'MISS')
      res.setHeader('X-Cache-Lookup', 'MISS')
      return cacheResponse()
    })

    /**
     * cacheResponse
     * Writes the current response body to either the filesystem or a Redis server,
     * depending on the configuration settings
     */
    function cacheResponse () {
      // file is expired or does not exist, wrap res.end and res.write to save to cache
      var _end = res.end
      var _write = res.write

      var data = ''

      res.write = function (chunk) {
        _write.apply(res, arguments)
      }

      res.end = function (chunk) {
        // respond before attempting to cache
        _end.apply(res, arguments)

        if (chunk) data += chunk

        // if response is not 200 don't cache
        if (res.statusCode !== 200) return

        // cache the content
        cache.set(cacheKey, data).then(() => {

        })
      }
      return next()
    }
  })
}

// reset method for unit tests
module.exports.reset = function () {
  instance = null
}

/**
 *
 */
module.exports.delete = function (pattern, callback) {
  if (!cache) return callback(null)

  cache.flush(pattern).then(() => {
    return callback(null)
  }).catch((err) => {
    console.log(err)
    return callback(null)
  })
}
