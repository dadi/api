let _ = require('underscore')
const crypto = require('crypto')
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

const Cache = function (server) {
  this.cache = cache = new DadiCache(config.get('caching'))

  this.server = server
  this.enabled = config.get('caching.directory.enabled') || config.get('caching.redis.enabled')
  this.encoding = 'utf8'
  this.options = {}
}

let instance
module.exports = function (server) {
  if (!instance) {
    instance = new Cache(server)
  }
  return instance
}

Cache.prototype.cachingEnabled = function (req) {
  let options = {}
  let endpoints = this.server.components
  let requestPath = url.parse(req.url, true).pathname

  let endpointKey = _.find(_.keys(endpoints), function (k) { return pathToRegexp(k).exec(requestPath) })

  if (!endpointKey) return false

  if (endpoints[endpointKey].model && endpoints[endpointKey].model.settings) {
    options = endpoints[endpointKey].model.settings
  }

  return (this.enabled && (options.cache || false))
}

Cache.prototype.getEndpointContentType = function (req) {
  // there are only two possible types javascript or json
  let query = url.parse(req.url, true).query
  return query.callback ? 'text/javascript' : 'application/json'
}

/**
 * Adds the Cache middleware to the stack
 */
Cache.prototype.init = function () {
  let self = this

  this.server.app.use((req, res, next) => {
    let enabled = self.cachingEnabled(req)
    if (!enabled) return next()

    // only cache GET requests
    if (req.method && req.method.toLowerCase() !== 'get') return next()

    let query = url.parse(req.url, true).query

    // allow query string param to bypass cache
    let noCache = query.cache && query.cache.toString().toLowerCase() === 'false'
    delete query.cache

    // we build the filename with a hashed hex string so we can be unique
    // and avoid using file system reserved characters in the name.
    let modelDir = crypto.createHash('sha1').update(url.parse(req.url).pathname).digest('hex')
    let filename = crypto.createHash('sha1').update(url.parse(req.url).pathname + JSON.stringify(query)).digest('hex')

    // File extension for cache file
    let cacheExt = help.shouldCompress(req) ? '.gzip' : ''

        // Prepend the model's name/folder hierarchy to the filename so it can be used
    // later to flush the cache for this model
    let cacheKey = `${modelDir}_${filename}${cacheExt}`

    // let opts = {
    //   directory: { extension: `.json${cacheExt}` }
    // }

    // get contentType that current endpoint requires
    let contentType = self.getEndpointContentType(req)

    // attempt to get from the cache
    cache
      .get(cacheKey)
      .then(stream => {
        res.setHeader('X-Cache-Lookup', 'HIT')

        if (noCache) {
          res.setHeader('X-Cache', 'MISS')
          return next()
        }

        log.info({module: 'cache'}, `Serving ${req.url} from cache`)

        res.statusCode = 200
        res.setHeader('X-Cache', 'HIT')
        res.setHeader('Content-Type', contentType)
        res.setHeader('Content-Encoding', help.shouldCompress(req) ? 'gzip' : 'utf-8')

        return _streamFile(res, stream, () => {})
      })
      .catch(() => {
        // not found in cache
        res.setHeader('X-Cache', 'MISS')
        res.setHeader('X-Cache-Lookup', 'MISS')
        return cacheResponse()
      })

    function _streamFile (res, stream, cb) {
      let streamCache = new StreamCache()

      let lstream = lengthStream(length => {
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
     * cacheResponse
     * Writes the current response body to either the filesystem or a Redis server,
     * depending on the configuration settings
     */
    function cacheResponse () {
      // file is expired or does not exist, wrap res.end and res.write to save to cache
      let _end = res.end
      let _write = res.write

      let bufs = []
      let body = ''

      res.write = function (chunk) {
        _write.apply(res, arguments)
      }

      res.end = function (chunk) {
        // respond before attempting to cache
        _end.apply(res, arguments)

        if (chunk) {
          if (chunk instanceof Buffer) {
            bufs.push(chunk)
          } else {
            body += chunk
          }
        }

        // if response is not 200 don't cache
        if (res.statusCode !== 200) return

        body = body !== '' ? body : Buffer.concat(bufs)

        // cache the content
        cache.set(cacheKey, body).then(() => {

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
