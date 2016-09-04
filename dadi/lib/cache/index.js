var crypto = require('crypto')
var fs = require('fs')
var mkdirp = require('mkdirp')
var path = require('path')
var pathToRegexp = require('path-to-regexp')
var redis = require('redis')
var redisRStream = require('redis-rstream')
var redisWStream = require('redis-wstream')
var Readable = require('stream').Readable
var url = require('url')
var _ = require('underscore')

var config = require(path.join(__dirname, '/../../../config'))
var log = require(path.join(__dirname, '/../../../dadi/lib/log'))

var Cache = function (server) {
  log.info({module: 'cache'}, 'Cache logging started.')

  this.server = server
  this.enabled = config.get('caching.directory.enabled') || config.get('caching.redis.enabled')
  this.dir = config.get('caching.directory.path')
  this.extension = config.get('caching.directory.extension')

  this.encoding = 'utf8'
  this.options = {}

  this.redisClient = null

  var self = this

  // create cache directory or initialise Redis
  if (config.get('caching.directory.enabled')) {
    mkdirp(self.dir, {}, function (err, made) {
      if (err) log.error({module: 'cache'}, err)
      if (made) log.info({module: 'cache'}, 'Created cache directory ' + made)
    })
  } else if (config.get('caching.redis.enabled')) {
    self.redisClient = self.initialiseRedisClient()

    self.redisClient.on('error', function (err) {
      log.error({module: 'cache'}, err)

      if (err.code === 'CONNECTION_BROKEN') {
        log.warn({module: 'cache'}, 'Resetting Redis client and cache instance. Falling back to directory cache.')

        // close the existing client
        self.redisClient.end(true)
        self.redisClient = null

        // modify config
        config.set('caching.redis.enabled', false)
        config.set('caching.directory.enabled', true)

        // restart the cache
        instance = new Cache(self.server)
      }
    })
  }
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

Cache.prototype.initialiseRedisClient = function () {
  return redis.createClient(config.get('caching.redis.port'), config.get('caching.redis.host'), {detect_buffers: true, max_attempts: 3})
}

Cache.prototype.init = function () {
  var self = this

  this.server.app.use(function (req, res, next) {
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
    var cachepath = path.join(self.dir, modelDir, filename + '.' + self.extension)

    // Prepend the model's name/folder hierarchy to the filename so it can be used
    // later to flush the cache for this model
    var cacheKey = modelDir + '_' + filename

    // get contentType that current endpoint requires
    var contentType = self.getEndpointContentType(req)

    var readStream

    if (self.redisClient) {
      self.redisClient.exists(cacheKey, function (err, exists) {
        log.error({module: 'cache'}, err)

        if (exists > 0) {
          res.setHeader('X-Cache-Lookup', 'HIT')

          if (noCache) {
            res.setHeader('X-Cache', 'MISS')
            return next()
          }

          res.statusCode = 200
          res.setHeader('X-Cache', 'HIT')
          res.setHeader('Server', config.get('server.name'))
          res.setHeader('Content-Type', contentType)

          readStream = redisRStream(self.redisClient, cacheKey)
          readStream.pipe(res)
        } else {
          res.setHeader('X-Cache', 'MISS')
          res.setHeader('X-Cache-Lookup', 'MISS')
          return cacheResponse()
        }
      })
    } else {
      readStream = fs.createReadStream(cachepath, {encoding: self.encoding})

      readStream.on('error', function () {
        res.setHeader('X-Cache', 'MISS')
        res.setHeader('X-Cache-Lookup', 'MISS')

        if (!noCache) {
          return cacheResponse()
        } else {
          return next()
        }
      })

      var data = ''
      readStream.on('data', function (chunk) {
        if (chunk) data += chunk
      })

      readStream.on('end', function () {
        if (data === '') {
          res.setHeader('X-Cache', 'MISS')
          res.setHeader('X-Cache-Lookup', 'MISS')
          return cacheResponse()
        }

        if (noCache) {
          res.setHeader('X-Cache', 'MISS')
          res.setHeader('X-Cache-Lookup', 'HIT')
          return next()
        }

        // check if ttl has elapsed
        try {
          var stats = fs.statSync(cachepath)
          var ttl = self.options.ttl || config.get('caching.ttl')
          var lastMod = stats && stats.mtime && stats.mtime.valueOf()
          if (!(lastMod && (Date.now() - lastMod) / 1000 <= ttl)) {
            res.setHeader('X-Cache', 'MISS')
            res.setHeader('X-Cache-Lookup', 'HIT')
            return cacheResponse()
          }
        } catch (err) {
          console.log(err)
        }

        log.info({module: 'cache'}, 'Serving ' + req.url + ' from cache file (' + cachepath + ')')

        // fs.stat(cachepath, function (err, stat) {
        res.statusCode = 200
        res.setHeader('Server', config.get('server.name'))
        res.setHeader('Content-Type', contentType)
        res.setHeader('Content-Length', stats.size)
        res.setHeader('X-Cache', 'HIT')
        res.setHeader('X-Cache-Lookup', 'HIT')

        var stream = new Readable()
        stream.push(data)
        stream.push(null)

        stream.pipe(res)
        // })
      })
    }

    /*
    * cacheResponse
    *
    * file is expired or does not exist, wrap res.end and res.write to save to cache
    */
    function cacheResponse () {
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

        var stream = new Readable()
        stream.push(data)
        stream.push(null)

        if (self.redisClient) {
          // save to redis
          stream.pipe(redisWStream(self.redisClient, cacheKey)).on('finish', function () {
            // set expiry
            if (config.get('caching.ttl')) {
              self.redisClient.expire(cacheKey, config.get('caching.ttl'), function (err, result) {
                if (err) log.error({module: 'cache'}, err)
                // console.log('expire result')
                // console.log(result)
              })
            }
          })
        } else {
          mkdirp(path.dirname(cachepath), {}, function (err, made) {
            if (err) log.error({module: 'cache'}, err)
            var cacheFile = fs.createWriteStream(cachepath, { flags: 'w', defaultEncoding: self.encoding })
            stream.pipe(cacheFile)
          })
        }
      }
      return next()
    }
  })
}

// get method for redis client
module.exports.client = function () {
  if (instance) return instance.redisClient
  return null
}

// reset method for unit tests
module.exports.reset = function () {
  instance = null
}

module.exports.delete = function (pattern, callback) {
  var async = require('async')
  var iter = '0'
  pattern = pattern + '*'
  var cacheKeys = []
  var self = this

  async.doWhilst(
    function (acb) {
      // scan with the current iterator, matching the given pattern
      self.client().scan(iter, 'MATCH', pattern, function (err, result) {
        if (err) {
          acb(err)
        } else {
          // update the iterator
          iter = result[0]
          async.each(result[1],
            // for each key
            function (key, ecb) {
              cacheKeys.push(key)
              return ecb(err)
            },
            function (err) {
              // done with this scan iterator; on to the next
              return acb(err)
            }
          )
        }
      })
    },
    // test to see if iterator is done
    function () { return iter !== '0' },
    // done
    function (err) {
      if (err) {
        console.log('Error:', err)
      } else {
        if (cacheKeys.length === 0) {
          return callback(null)
        }

        var i = 0
        _.each(cacheKeys, function (key) {
          self.client().del(key, function (err, result) {
            if (err) log.error({module: 'cache'}, err)

            i++
            // finished, all keys deleted
            if (i === cacheKeys.length) {
              return callback(null)
            }
          })
        })
      }
    }
  )
}
