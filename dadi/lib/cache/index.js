const crypto = require('crypto')
const path = require('path')
const pathToRegexp = require('path-to-regexp')
const url = require('url')

const config = require(path.join(__dirname, '/../../../config'))
const utils = require('../utils')
const log = require('@dadi/logger')
const DadiCache = require('@dadi/cache')
let cache

const Cache = function (server) {
  this.cache = cache = new DadiCache(config.get('caching'))

  this.server = server
  this.enabled = config.get('caching.directory.enabled') || config.get('caching.redis.enabled')
  this.options = {}
}

let instance
module.exports = function (server) {
  if (!instance) {
    instance = new Cache(server)
  }
  return instance
}

/**
 * Locate the endpoint relating to the current request in the loaded
 * system components (collection models and custom endpoints) to determine
 * if caching is enabled.
 *
 * @param {http.IncomingMessage} req - the current HTTP request
 */
Cache.prototype.cachingEnabled = function (req) {
  let options = {}
  let endpoints = this.server.components
  let requestPath = url.parse(req.url, true).pathname

  let endpointKey = Object.keys(endpoints).find(key => pathToRegexp(key).exec(requestPath))

  if (!endpointKey) return false

  if (endpoints[endpointKey].model && endpoints[endpointKey].model.settings) {
    options = endpoints[endpointKey].model.settings
  }

  return (this.enabled && (options.cache || false))
}

/**
 * Return the content type for the current endpoint. Only two possible types: JavaScript or JSON.
 *
 * @param {http.IncomingMessage} req - the current HTTP request
 */
Cache.prototype.getEndpointContentType = function (req) {
  let query = url.parse(req.url, true).query
  return query.callback ? 'text/javascript' : 'application/json'
}

/**
 * Adds the Cache middleware to the stack
 */
Cache.prototype.init = function () {
  this.server.app.use((req, res, next) => {
    let enabled = this.cachingEnabled(req)
    if (!enabled) return next()

    // Only cache GET requests.
    if (req.method && req.method.toLowerCase() !== 'get') return next()

    let query = url.parse(req.url, true).query

    // Allow query string param to bypass cache.
    let noCache = query.cache && query.cache.toString().toLowerCase() === 'false'
    delete query.cache

    // Build the filename with a hashed hex string so it is unique
    // and avoids using file system reserved characters in the name.
    let modelDir = crypto.createHash('sha1').update(url.parse(req.url).pathname).digest('hex')
    let filename = crypto.createHash('sha1').update(url.parse(req.url).pathname + JSON.stringify(query)).digest('hex')

    // Prepend the model's name/folder hierarchy to the filename so it can be used
    // later to flush the cache for this model
    let cacheKey = `${modelDir}_${filename}`

    let acceptEncoding = req.headers['accept-encoding']

    if (acceptEncoding && acceptEncoding !== 'gzip, deflate' && /\bgzip\b/.test(acceptEncoding)) {
      acceptEncoding = 'gzip'
      cacheKey += '.gz'
    }

    // Get contentType that current endpoint requires.
    let contentType = this.getEndpointContentType(req)

    // Attempt to get from the cache.
    cache.get(cacheKey).then(stream => {
      cache.getMetadata(cacheKey).then(metadata => {
        res.setHeader('X-Cache-Lookup', 'HIT')

        let compressed = false
        if (metadata && metadata.compression === 'gzip') {
          compressed = true
        }

        if (noCache) {
          res.setHeader('X-Cache', 'MISS')
          return next()
        }

        log.info({module: 'cache'}, 'Serving ' + req.url + ' from cache')

        res.statusCode = 200
        res.setHeader('X-Cache', 'HIT')
        res.setHeader('Content-Type', contentType)

        return utils.pipeStream(stream, false, compressed, res)
      })
    }).catch(() => {
      if (noCache) {
        return next()
      }

      // not found in cache
      res.setHeader('X-Cache', 'MISS')
      res.setHeader('X-Cache-Lookup', 'MISS')

      return cacheResponse()
    })

    /**
     * Write the current response body to either the filesystem or a Redis server,
     * depending on the configuration settings.
     */
    function cacheResponse () {
      // file is expired or does not exist, wrap res.end and res.write to save to cache
      let _end = res.end
      let _write = res.write

      res.write = function (chunk) {
        _write.apply(res, arguments)
      }

      res.end = function (data) {
        // Respond before attempting to cache.
        _end.apply(res, arguments)

        if (res.statusCode !== 200) return

        // Cache the content.
        cache.set(cacheKey, data, {
          metadata: {
            compression: !acceptEncoding ? 'none' : acceptEncoding
          }
        }).then(() => {

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
 * Passes the specified pattern to the cache module to delete
 * cached items with matching keys.
 *
 * @param {string} pattern - the cache key pattern to match
 */
module.exports.delete = function (pattern, callback) {
  if (!cache) return callback(null)

  cache.flush(pattern).then(() => {
    return callback(null)
  }).catch(err => {
    console.log(err)
    return callback(null)
  })
}
