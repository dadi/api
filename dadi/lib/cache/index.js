var crypto = require('crypto');
var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');
var redis = require('redis');
var redisRStream = require('redis-rstream');
var redisWStream = require('redis-wstream');
var Readable = require('stream').Readable;
var url = require('url');
var _ = require('underscore');

var config = require(__dirname + '/../../../config.js');
var help = require(__dirname + '/../help');
var log = require(__dirname + '/../../../dadi/lib/log');

var Cache = function(server) {
  this.server = server;
  this.enabled = config.get('caching.directory.enabled') || config.get('caching.redis.enabled');
  this.dir = config.get('caching.directory.path');
  this.extension = config.get('caching.directory.extension');

  this.encoding = 'utf8';
  this.options = {};

  var self = this;

  // create cache directory or initialise Redis
  if (config.get('caching.directory.enabled')) {
    mkdirp(self.dir, {}, function (err, made) {
      if (err) self.log.error(err);
      if (made) self.log.info('Created cache directory ' + made);
    });
  }
  else if (config.get('caching.redis.enabled')) {
    self.redisClient = self.initialiseRedisClient();

    self.redisClient.on("error", function (err) {
      self.log.error(err);
    });
  }
}

var instance;
module.exports = function(server) {
  if (!instance) {
    instance = new Cache(server);
  }
  return instance;
};

Cache.prototype.cachingEnabled = function(req) {
  var options = {};
  var endpoints = this.server.components;
  var requestUrl = url.parse(req.url, true).pathname;

  // var query = url.parse(req.url, true).query;
  // if (query.hasOwnProperty('cache') && query.cache === 'false') {
  //   return false;
  // }

  var endpointKey = _.find(_.keys(endpoints), function (k){ return k.indexOf(url.parse(requestUrl).pathname) > -1; });

  if (!endpointKey) return false;

  if (endpoints[endpointKey].model && endpoints[endpointKey].model.settings) {
    options = endpoints[endpointKey].model.settings;
  }

  return (this.enabled && (options.cache || false));
};

Cache.prototype.getEndpointContentType = function(req) {
  // there are only two possible types javascript or json
  var query = url.parse(req.url, true).query;
  return query.callback ? 'text/javascript' : 'application/json';
}

Cache.prototype.initialiseRedisClient = function() {
  return redis.createClient(config.get('caching.redis.port'), config.get('caching.redis.host'), {detect_buffers: true, max_attempts: 3});
};

Cache.prototype.init = function() {
  var self = this;

  this.server.app.use(function (req, res, next) {
    var enabled = self.cachingEnabled(req);
    if (!enabled) return next();

    // only cache GET requests
    if (req.method && req.method.toLowerCase() !== 'get') return next();

    var query = url.parse(req.url, true).query;

    // we build the filename with a hashed hex string so we can be unique
    // and avoid using file system reserved characters in the name
    var filename = crypto.createHash('sha1').update(req.url).digest('hex');
    var modelDir = crypto.createHash('sha1').update(url.parse(req.url).pathname).digest('hex');
    var cachepath = path.join(self.dir, modelDir, filename + '.' + this.extension);

    // allow query string param to bypass cache
    var noCache = query.cache && query.cache.toString().toLowerCase() === 'false';

    // get contentType that current endpoint requires
    var contentType = self.getEndpointContentType(req);

    var readStream;

    if (self.redisClient) {
      self.redisClient.exists(filename, function (err, exists) {
        if (exists > 0) {
          res.setHeader('X-Cache-Lookup', 'HIT');

          if (noCache) {
              //console.log('noCache');
              res.setHeader('X-Cache', 'MISS');
              return next();
          }

          res.statusCode = 200;
          res.setHeader('X-Cache', 'HIT');
          res.setHeader('Server', config.get('server.name'));
          res.setHeader('Content-Type', contentType);

          readStream = redisRStream(self.redisClient, filename);
          readStream.pipe(res);
        }
        else {
          res.setHeader('X-Cache', 'MISS');
          res.setHeader('X-Cache-Lookup', 'MISS');
          return cacheResponse();
        }
      });
    }

    fs.stat(cachepath, function (err, stats) {

      if (err) {
          if (err.code === 'ENOENT') {
              return cacheResponse();
          }
          return next(err);
      }

        // check if ttl has elapsed
        var ttl = options.ttl || config.get('caching.ttl');
        var lastMod = stats && stats.mtime && stats.mtime.valueOf();
        if (!(lastMod && (Date.now() - lastMod) / 1000 <= ttl)) return cacheResponse();

        fs.readFile(cachepath, {encoding: cacheEncoding}, function (err, resBody) {
            if (err) return next(err);

            // there are only two possible types javascript or json
            var dataType = query.callback ? 'text/javascript' : 'application/json';

            if (resBody === "") {
                return cacheResponse();
            }

            // allow query string param to bypass cache
            var noCache = query.cache && query.cache.toString().toLowerCase() === 'false';

            if (noCache) {
                res.setHeader('X-Cache', 'MISS');
                res.setHeader('X-Cache-Lookup', 'HIT');
                return next();
            }

            res.statusCode = 200;

            res.setHeader('Server', config.get('server.name'));
            res.setHeader('X-Cache', 'HIT');
            res.setHeader('X-Cache-Lookup', 'HIT');
            res.setHeader('content-type', dataType);
            res.setHeader('content-length', Buffer.byteLength(resBody));

            // notice resBody is already a string
            res.end(resBody);
        });
    });

    function cacheResponse() {

        // file is expired or does not exist, wrap res.end and res.write to save to cache
        var _end = res.end;
        var _write = res.write;

        var data = '';

        res.write = function (chunk) {

            // with this line, we get cache files with duplicate content
            //if (chunk) data += chunk;

            _write.apply(res, arguments);
        };

        res.end = function (chunk) {

            res.setHeader('X-Cache', 'MISS');
            res.setHeader('X-Cache-Lookup', 'MISS');

            // respond before attempting to cache
            _end.apply(res, arguments);

            if (chunk) data += chunk;

            // if response is not 200 don't cache
            if (res.statusCode !== 200) return;

            // TODO: do we need to grab a lock here?
            mkdirp(cacheDir, {}, function (err, made) {
                if (err) console.log(err.toString());

                fs.writeFile(cachepath, data, {encoding: cacheEncoding}, function (err) {
                    if (err) console.log(err.toString());
                });
            })

        };
        return next();
    }
  });
}
