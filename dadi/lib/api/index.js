var http = require('http');
var url = require('url');
var pathToRegexp = require('path-to-regexp');


var fs = require('fs');
var path = require('path');
var spdy = require('spdy');
var log = require(__dirname + '/../log');
var config = require(__dirname + '/../../../config');

var Api = function () {
    this.paths = {};
    this.all = [];
    this.errors = [];

    // always add default error handler in case the application doesn't define one
    this.errors.push(defaultError(this));

    // permanently bind context to listener
    this.listener = this.listener.bind(this);
};

/**
 *  Connects a handler to a specific path
 *  @param {String} path
 *  @param {Controller} handler
 *  @return undefined
 *  @api public
 */
Api.prototype.use = function (path, handler) {
    if (typeof path === 'function') {
        if (path.length === 4) return this.errors.push(path);
        return this.all.push(path);
    }

    this.paths[path] = {
        handler: handler,
        regex: pathToRegexp(path)
    };
};

/**
 *  Removes a handler or removes the handler attached to a specific path
 *  @param {String} path
 *  @return undefined
 *  @api public
 */
Api.prototype.unuse = function (path) {
    var indx;
    if (typeof path === 'function') {
        if (path.length === 4) {
            indx = this.errors.indexOf(path);
            return !!~indx && this.errors.splice(indx, 1);
        }
        indx = this.all.indexOf(path);
        return !!~indx && this.all.splice(indx, 1);
    }
    delete this.paths[path];
}

/**
 *  convenience method that creates ttp/2 server and attaches listener
 *  @param {Number} port
 *  @param {String} host
 *  @param {Number} backlog
 *  @param {Function} [done]
 *  @return http.Server
 *  @api public
 */
Api.prototype.listen = function (port, host, backlog, done) {
    if(config.get('server.http2.enabled'))
        return spdy.createServer({
            key: fs.readFileSync(path.join(config.get('server.http2.key_path'), '/localhost.key')),
            cert: fs.readFileSync(path.join(config.get('server.http2.key_path'), '/localhost.crt'))
          }, this.listener).listen(port, host, backlog, done);
    else {
        return http.createServer(this.listener).listen(port, host, backlog, done);
    }
};

/**
 *  listener function to be passed to node's `createServer`
 *  @param {http.IncomingMessage} req
 *  @param {http.ServerResponse} res
 *  @return undefined
 *  @api public
 */
Api.prototype.listener = function (req, res) {
    // clone the middleware stack
    var stack = this.all.slice(0);
    var path = url.parse(req.url).pathname;

    // get matching routes, and add req.params
    var matches = this._match(path, req);

    var doStack = function (i) {
        return function (err) {
            if (err) return errStack(0)(err);
            stack[i](req, res, doStack(++i));
        };
    };

    var self = this;
    var errStack = function (i) {
        return function (err) {
            self.errors[i](err, req, res, errStack(++i));
        };
    };

    // add path specific handlers
    stack = stack.concat(matches);

    // add 404 handler
    stack.push(notFound(req, res));

    // start going through the middleware/routes
    doStack(0)();
};

/**
 *  Check if any of the registered routes match the current url, if so populate `req.params`
 *  @param {String} path
 *  @param {http.IncomingMessage} req
 *  @return Array
 *  @api private
 */
Api.prototype._match = function (path, req) {
    var paths = this.paths;
    var matches = [];
    var handlers = [];

    // always add params object to avoid need for checking later
    req.params = {};

    Object.keys(paths).forEach(function (key) {
        var match = paths[key].regex.exec(path);
        if (!match) return;

        var keys = paths[key].regex.keys;

        handlers.push(paths[key].handler);

        match.forEach(function (k, i) {

            var keyOpts = keys[i] || {};
            if (match[i + 1] && keyOpts.name) req.params[keyOpts.name] = match[i + 1];
        });
    });

    return handlers;
};

module.exports = function () {
    return new Api();
};

module.exports.Api = Api;

// Default error handler, in case application doesn't define error handling
function defaultError(api) {
    return function (err, req, res) {

      var resBody;

      log.error({module: 'api'}, err);

      if (err.json) {
        resBody = JSON.stringify(err.json);
      }
      else {
        resBody = JSON.stringify(err);
      }

      res.statusCode = err.statusCode || 500;
      res.setHeader('content-type', 'application/json');
      res.setHeader('content-length', Buffer.byteLength(resBody));
      return res.end(resBody);
    }
}

// return a 404
function notFound(req, res) {
    return function () {
        res.statusCode = 404;
        res.end();
    }
}
