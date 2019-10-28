const crypto = require('crypto')
const etag = require('etag')
const lengthStream = require('length-stream')
const path = require('path')
const pathToRegexp = require('path-to-regexp')
const StreamCache = require('stream-cache')
const url = require('url')

const config = require(path.join(__dirname, '/../../../config'))
const help = require(path.join(__dirname, '/../help'))
const log = require('@dadi/logger')
const DadiCache = require('@dadi/cache')
let cache

const Cache = function(server) {
  this.cache = cache = new DadiCache(config.get('caching'))

  this.server = server
  this.enabled =
    config.get('caching.directory.enabled') ||
    config.get('caching.redis.enabled')
  this.encoding = 'utf8'
  this.options = {}
}

let instance

module.exports = function(server) {
  if (!instance) {
    instance = new Cache(server)
  }

  return instance
}

Cache.prototype.cachingEnabled = function(req) {
  return Boolean(
    this.enabled && req.collectionModel && req.collectionModel.isCacheable()
  )
}

Cache.prototype.getEndpointContentType = function(req) {
  // there are only two possible types javascript or json
  const query = url.parse(req.url, true).query

  return query.callback ? 'text/javascript' : 'application/json'
}

/**
 * Adds the Cache middleware to the stack
 */
Cache.prototype.init = function() {
  this.server.app.use((req, res, next) => {
    const enabled = this.cachingEnabled(req)

    if (!enabled) return next()

    // Only cache GET requests.
    if (req.method && req.method.toLowerCase() !== 'get') {
      return next()
    }

    const query = url.parse(req.url, true).query

    // Allow query string param to bypass cache.
    const noCache =
      query.cache && query.cache.toString().toLowerCase() === 'false'

    delete query.cache

    // Build the filename with a hashed hex string so it is unique
    // and avoids using file system reserved characters in the name.
    const modelDir = crypto
      .createHash('sha1')
      .update(url.parse(req.url).pathname)
      .digest('hex')
    const filename = crypto
      .createHash('sha1')
      .update(url.parse(req.url).pathname + JSON.stringify(query))
      .digest('hex')

    // Prepend the model's name/folder hierarchy to the filename so it can be used
    // later to flush the cache for this model
    let cacheKey = `${modelDir}_${filename}`
    let acceptEncoding

    // Extend cache key if compressed.
    if (help.shouldCompress(req)) {
      acceptEncoding = 'gzip'
      cacheKey += '.gz'
    }

    // get contentType that current endpoint requires
    const contentType = this.getEndpointContentType(req)

    // attempt to get from the cache
    cache
      .get(cacheKey)
      .then(stream => {
        return cache.getMetadata(cacheKey).then(metadata => {
          res.statusCode = 200
          res.setHeader('X-Cache-Lookup', 'HIT')

          let compressed = false

          if (metadata) {
            if (metadata.compression === 'gzip') {
              compressed = true
            }

            if (metadata.etag) {
              res.setHeader('ETag', metadata.etag)

              if (req.headers['if-none-match'] === metadata.etag) {
                res.statusCode = 304

                return res.end()
              }
            }
          }

          if (noCache) {
            res.setHeader('X-Cache', 'MISS')

            return next()
          }

          log.info({module: 'cache'}, `Serving ${req.url} from cache`)

          res.statusCode = 200
          res.setHeader('X-Cache', 'HIT')
          res.setHeader('Content-Type', contentType)

          if (compressed) {
            res.setHeader('Content-Encoding', 'gzip')
          }

          return _streamFile(res, stream, () => {})
        })
      })
      .catch(() => {
        res.setHeader('X-Cache', 'MISS')

        // not found in cache
        if (noCache) {
          return next()
        }

        res.setHeader('X-Cache-Lookup', 'MISS')

        return cacheResponse()
      })

    function _streamFile(res, stream, cb) {
      const streamCache = new StreamCache()

      const lstream = lengthStream(length => {
        res.setHeader('Content-Length', length)
        streamCache.pipe(res)
      })

      stream.on('error', err => {
        return cb(err)
      })

      stream.on('end', () => {
        return cb(null, true)
      })

      return stream.pipe(lstream).pipe(streamCache)
    }

    /**
     * Write the current response body to either the filesystem or a Redis server,
     * depending on the configuration settings.
     */
    function cacheResponse() {
      // file is expired or does not exist, wrap res.end and res.write to save to cache
      const _end = res.end
      const _write = res.write

      res.write = function(chunk) {
        _write.apply(res, arguments)
      }

      res.end = function(data) {
        // respond before attempting to cache
        _end.apply(res, arguments)

        // If response is not 200 don't cache.
        if (res.statusCode !== 200) {
          return
        }

        // Cache the content.
        cache
          .set(cacheKey, data, {
            metadata: {
              compression: !acceptEncoding ? 'none' : acceptEncoding,
              etag: etag(data)
            }
          })
          .then(() => {})
      }

      return next()
    }
  })
}

// reset method for unit tests
module.exports.reset = function() {
  instance = null
}

/**
 *
 */
module.exports.delete = function(pattern, callback) {
  if (!cache) return callback(null)

  cache
    .flush(pattern)
    .then(() => {
      return callback(null)
    })
    .catch(err => {
      console.log(err)

      return callback(null)
    })
}
