var site = require('../../package.json').name;
var version = require('../../package.json').version;
var nodeVersion = Number(process.version.match(/^v(\d+\.\d+)/)[1]);

var bodyParser = require('body-parser');
var colors = require('colors');
var parsecomments = require('parse-comments');
var fs = require('fs');
var mkdirp = require('mkdirp');
var path = require('path');
var pathToRegexp = require('path-to-regexp');
var stackTrace = require('stack-trace');
var url = require('url');
var _ = require('underscore');

var controller = require(__dirname + '/controller');
var model = require(__dirname + '/model');
var search = require(__dirname + '/search');
var api = require(__dirname + '/api');
var auth = require(__dirname + '/auth');
var cache = require(__dirname + '/cache');
var monitor = require(__dirname + '/monitor');
var log = require(__dirname + '/log');
var help = require(__dirname + '/help');
var dadiStatus = require('@dadi/status');

var config = require(__dirname + '/../../config');
var configPath = path.resolve(config.configPath());

if (config.get('env') !== 'test') {
  // add timestamps in front of log messages
  require('console-stamp')(console, 'yyyy-mm-dd HH:MM:ss.l');
}

// add an optional id component to the path, that is formatted to be matched by the `path-to-regexp` module
var idParam = ':id([a-fA-F0-9]{24})?';

var Server = function () {
  this.components = {};
  this.monitors = {};
  this.docs = {};

  log.info({module: 'server'}, 'Server logging started.');
};

Server.prototype.start = function (done) {
    var self = this;
    this.readyState = 2;

    var defaultPaths = {
      collections: __dirname + '/../../workspace/collections',
      endpoints: __dirname + '/../../workspace/endpoints'
    };

    var options = {};
    this.loadPaths(config.get('paths') || defaultPaths, function(paths) {
      options = paths;
    });

    // create app
    var app = this.app = api();

    // add necessary middlewares in order below here...

    app.use(bodyParser.json({ limit: '50mb' }));
    app.use(bodyParser.urlencoded({ extended: false, limit: '50mb' }));
    app.use(bodyParser.text({ limit: '50mb' }));

    // update configuration based on domain
    var domainConfigLoaded;
    app.use(function(req, res, next) {
      if (domainConfigLoaded) return next();
      config.updateConfigDataForDomain(req.headers.host);
      domainConfigLoaded = true;
      return next();
    });

    // configure authentication middleware
    auth(self);

    // request logging middleware
    app.use(log.requestLogger);

    this.loadConfigApi();

    // caching layer
    cache(self).init();

    // search layer
    search(self);

    // start listening
    var server = this.server = app.listen(config.get('server.port'), config.get('server.host'));

    server.on('listening', function() { onListening(this) });
    server.on('error', onError);

    this.loadApi(options);

    this.loadCollectionRoute();
    this.loadEndpointsRoute();

    this.readyState = 1;

    // this is all sync, so callback isn't really necessary.
    done && done();
};

// this is mostly needed for tests
Server.prototype.stop = function (done) {
    var self = this;
    this.readyState = 3;

    Object.keys(this.monitors).forEach(this.removeMonitor.bind(this));

    Object.keys(this.components).forEach(this.removeComponent.bind(this));

    this.server.close(function (err) {
        self.readyState = 0;
        done && done(err);
    });
};

Server.prototype.loadPaths = function(paths, done) {

  var self = this;
  var options = {};

  options.collectionPath = path.resolve(paths.collections || __dirname + '/../../workspace/collections');
  options.endpointPath = path.resolve(paths.endpoints || __dirname + '/../../workspace/endpoints');

  var idx = 0;

  _.each(options, function(path, key) {
    try {
      var stats = fs.statSync(path);
    }
    catch (err) {
      if (err.code === 'ENOENT') {
        self.ensureDirectories(options, function() {
          //
        });
      }
    }

    idx++;

    if (idx === Object.keys(options).length) return done(options);
  });
}

Server.prototype.loadApi = function (options) {

    var self = this;
    var collectionPath = this.collectionPath = options.collectionPath || __dirname + '/../../workspace/collections';
    var endpointPath = this.endpointPath = options.endpointPath || __dirname + '/../../workspace/endpoints';

    // Load initial api descriptions
    this.updateVersions(collectionPath);

    this.addMonitor(collectionPath, function (versionName) {
        if (path) return self.updateDatabases(path.join(collectionPath, versionName));
        self.updateVersions(collectionPath);
    });

    //this.updateEndpoints(endpointPath);
    this.updateVersions(endpointPath);

    this.addMonitor(endpointPath, function (endpointFile) {
        self.updateVersions(endpointPath);
    });

    this.app.use('/api/flush', function (req, res, next) {
        var method = req.method && req.method.toLowerCase();
        if (method !== 'post') return next();

        var pathname = req.body.path;

        return help.clearCache(pathname, function (err) {
            help.sendBackJSON(200, res, next)(err, {
                result: 'success',
                message: 'Succeed to clear'
            });
        });

        next();
    });

    this.app.use('/api/status', function (req, res, next) {
      var method = req.method && req.method.toLowerCase();
      var authorization = req.headers.authorization;

      if (method !== 'post' || config.get('status.enabled') === false) {
        return next();
      }
      else {
        var params = {
          site: site,
          package: '@dadi/api',
          version: version,
          healthCheck: {
            authorization: authorization,
            baseUrl: 'http://' + config.get('server.host') + ':' + config.get('server.port'),
            routes: config.get('status.routes')
          }
        }

        dadiStatus(params, function(err, data) {
          if (err) return next(err);
          var resBody = JSON.stringify(data, null, 2);

          res.statusCode = 200;
          res.setHeader('Content-Type', 'application/json');
          res.setHeader('content-length', Buffer.byteLength(resBody));
          return res.end(resBody);
        })
      }
    })

        // need to ensure filepath exists since this could be a removal
    //     if (endpointFile && fs.existsSync(filepath)) {
    //         return self.addEndpointResource({
    //             endpoint: endpointFile,
    //             filepath: filepath
    //         });
    //     }
    //     self.updateEndpoints(endpointPath);
    // });
};

Server.prototype.loadConfigApi = function () {
    var self = this;

    // allow getting main config from API
    this.app.use('/api/config', function (req, res, next) {
        var method = req.method && req.method.toLowerCase();

        if (method === 'get') return help.sendBackJSON(200, res, next)(null, config.getProperties());

        if (method === 'post') {

            // update the config file
            var newConfig = _.extend({}, config.getProperties(), req.body);

            return fs.writeFile(configPath, JSON.stringify(newConfig, null, 4), function (err) {
                help.sendBackJSON(200, res, next)(err, {
                    result: 'success',
                    message: 'server restart required'
                });
            });
        }

        next();
    });

    // listen for requests to add to the API
    this.app.use('/:version/:database/:collectionName/config', function (req, res, next) {

        // collection and endpoint paths now have the same structure
        // i.e. /version/database/collection and /endpoints/version/endpoint
        // so test here for `endpoints` in the request url, processing the next
        // handler if required.
        if (url.parse(req.url).pathname.indexOf('endpoints') > 0) return next();

        var method = req.method && req.method.toLowerCase();
        if (method !== 'post') return next();

        //console.log(req)

        try {
          var schema = typeof req.body === 'object' ? req.body : JSON.parse(req.body)
        }
        catch(err) {
          var err = new Error('Bad Syntax');
          err.statusCode = 400;
          return next(err);
        }

        var validation = help.validateCollectionSchema(schema);

        if (!validation.success) {
            var err = new Error('Collection schema validation failed');
            err.statusCode = 400;
            err.json = validation;
            return next(err);
        }

        var params = req.params;

        // use params.collectionName as default, override if the schema supplies a 'model' property
        var name = params.collectionName;
        if (schema.hasOwnProperty("model")) name = schema.model;

        schema.settings.lastModifiedAt = Date.now()

        var route = ['', params.version, params.database, name, idParam].join('/');

        // create schema
        if (!self.components[route]) {
            self.createDirectoryStructure(path.join(params.version, params.database));

            var schemaPath = path.join(
                self.collectionPath,
                params.version,
                params.database,
                'collection.' + name + '.json'
            );

            try {
                fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2))

                res.statusCode = 200;
                res.setHeader('content-type', 'application/json');
                res.end(JSON.stringify({
                    result: 'success',
                    message: name + ' collection created'
                }));

            }
            catch (err) {
                return next(err);
            }
        }
	else {
            next();
	}
    });

    this.app.use('/:version/:endpointName/config', function (req, res, next) {

        var method = req.method && req.method.toLowerCase();
        if (method !== 'post') return next();

        var version = req.params.version;
        var name = req.params.endpointName;

        var dir = path.join(self.endpointPath, version);
        var filepath = path.join(dir, 'endpoint.' + name + '.js');

        mkdirp(dir, {}, function (err, made) {

            return fs.writeFile(filepath, req.body, function (err) {

                if (err) return next(err);

                var message = 'Endpoint "' + version + ':' + name + '" created';

                res.statusCode = 200;
                res.setHeader('content-type', 'application/json');
                res.end(JSON.stringify({
                    result: 'success',
                    message: message
                }));
            });

        });

    });
};

// route to retrieve list of collections
Server.prototype.loadCollectionRoute = function() {
  var self = this;

  this.app.use('/api/collections', function (req, res, next) {

    var method = req.method && req.method.toLowerCase();

    if (method !== 'get') return help.sendBackJSON(400, res, next)(null, {"error":"Invalid method"});

    var data = {};
    var collections = [];

    _.each(self.components, function (value, key) {
      var model
      var name = null
      var slug
      var parts = _.compact(key.split('/'));

      var hasModel = _.contains(Object.keys(value), 'model')
      var hasGetMethod = _.contains(Object.keys(value), 'get')

      if (hasModel && !hasGetMethod) {
        model = value.model

        if (model.hasOwnProperty("name")) {
          name = model.name;
          slug = model.name;
        }

        if (model.hasOwnProperty("settings") && model.settings.hasOwnProperty("displayName")) {
          name = model.settings.displayName;
        }

        var collection = {
          version: parts[0],
          database: parts[1],
          name: name,
          slug: slug,
          path: "/" + [parts[0], parts[1], slug].join("/")
        }
        
        if (model.settings.lastModifiedAt) collection.lastModifiedAt = model.settings.lastModifiedAt

        collections.push(collection)
      }
    });

    data.collections = _.sortBy(collections, 'path');

    return help.sendBackJSON(200, res, next)(null, data);
  });
}

// route to retrieve list of endpoints
Server.prototype.loadEndpointsRoute = function() {
  var self = this;

  this.app.use('/api/endpoints', function (req, res, next) {

    var method = req.method && req.method.toLowerCase();

    if (method !== 'get') return help.sendBackJSON(400, res, next)(null, {"error":"Invalid method"});

    var data = {};
    var endpoints = [];

    _.each(self.components, function (value, key) {
      var model
      var name = null
      var parts = _.compact(key.split('/'));

      var hasModel = _.contains(Object.keys(value), 'model')
      var hasGetMethod = _.contains(Object.keys(value), 'get')

      if (hasModel) {
        model = value.model

        if (model.hasOwnProperty("settings") && model.settings.hasOwnProperty("displayName")) {
          name = model.settings.displayName;
        }
      }

      if (hasGetMethod) {
        // an endpoint
        var endpoint = {
          version: parts[0],
          path: key
        }

        if (name) endpoint.name = name
        if (pathToRegexp(key).keys.length > 0) endpoint.params = pathToRegexp(key).keys

        endpoints.push(endpoint)
      }
    });

    data.endpoints = _.sortBy(endpoints, 'path');

    return help.sendBackJSON(200, res, next)(null, data);
  });
}

Server.prototype.updateVersions = function (versionsPath) {
    var self = this;

    // Load initial api descriptions
    var versions = fs.readdirSync(versionsPath);

    versions.forEach(function (version) {
        if (version.indexOf('.') === 0) return;

        var dirname = path.join(versionsPath, version);

        if (dirname.indexOf("collections") > 0) {

            self.updateDatabases(dirname);

            self.addMonitor(dirname, function (databaseName) {
                if (databaseName) return self.updateCollections(path.join(dirname, databaseName));
                self.updateDatabases(dirname);
            });
        }
        else {
            self.updateEndpoints(dirname);

            self.addMonitor(dirname, function (endpoint) {
                self.updateEndpoints(dirname);
            });
        }
    });
};

Server.prototype.updateDatabases = function (databasesPath) {
    var self = this;
    var databases;
    try {
        databases = fs.readdirSync(databasesPath);
    } catch (e) {
        log.warn({module: 'server'}, databasesPath + ' does not exist');
        return;
    }

    databases.forEach(function (database) {
        if (database.indexOf('.') === 0) return;

        var dirname = path.join(databasesPath, database);
        self.updateCollections(dirname);

        self.addMonitor(dirname, function (collectionFile) {
            self.updateCollections(dirname);
        });
    });
};

Server.prototype.updateCollections = function (collectionsPath) {

  if (!fs.existsSync(collectionsPath)) return;
  if (!fs.lstatSync(collectionsPath).isDirectory()) return;

  var self = this;
  var collections = fs.readdirSync(collectionsPath);

  collections.forEach(function (collection) {
    if (collection.indexOf('.') === 0) return;

    // parse the url out of the directory structure
    var cpath = path.join(collectionsPath, collection);
    var dirs = cpath.split('/');
    var version = dirs[dirs.length - 3];
    var database = dirs[dirs.length - 2];

    // collection should be json file containing schema

    // get the schema
    var schema = require(cpath);
    var name = collection.slice(collection.indexOf('.') + 1, collection.indexOf('.json'));

    // override the default name using the supplied property
    if (schema.hasOwnProperty("model")) name = schema.model;

    self.addCollectionResource({
      route: ['', version, database, name, idParam].join('/'),
      filepath: cpath,
      name: name,
      schema: schema,
      database: database
    });
  });
};

Server.prototype.addCollectionResource = function (options) {

    var fields = help.getFieldsFromSchema(options.schema);

    // With each schema we create a model.
    // With each model we create a controller, that acts as a component of the REST api.
    // We then add the component to the api by adding a route to the app and mapping
    // `req.method` to component methods

    var enableCollectionDatabases = config.get('database.enableCollectionDatabases');
    var database = enableCollectionDatabases ? options.database : null;
    var mod = model(options.name, JSON.parse(fields), null, options.schema.settings, database);
    var control = controller(mod);

    this.addComponent({
        route: options.route,
        component: control,
        filepath: options.filepath
    });

    var self = this;

    // watch the schema's file and update it in place
    this.addMonitor(options.filepath, function (filename) {

        // invalidate schema file cache then reload
        delete require.cache[options.filepath];
        try {
	    var schemaObj = require(options.filepath);
    	    var fields = help.getFieldsFromSchema(schemaObj);
            // This leverages the fact that Javscript's Object keys are references
            self.components[options.route].model.schema = JSON.parse(fields);
            self.components[options.route].model.settings = schemaObj.settings;
        } catch (e) {

            // if file was removed "un-use" this component
            if (e && e.code === 'ENOENT') {
                self.removeMonitor(options.filepath);
                self.removeComponent(options.route);
            }
        }
    });

    log.info({module: 'server'}, 'Collection loaded: ' + options.name);
};

Server.prototype.updateEndpoints = function (endpointsPath) {
    var self = this;
    var endpoints = fs.readdirSync(endpointsPath);

    endpoints.forEach(function (endpoint) {

        // parse the url out of the directory structure
        var cpath = path.join(endpointsPath, endpoint);
        var dirs = cpath.split('/');
        var version = dirs[dirs.length - 2];

        self.addEndpointResource({
            version: version,
            endpoint: endpoint,
            filepath: path.join(endpointsPath, endpoint)
        });
    });

};

Server.prototype.addEndpointResource = function (options) {
    var endpoint = options.endpoint;
    if (endpoint.indexOf('.') === 0 || endpoint.indexOf('endpoint.') !== 0) return;

    var self = this;
    var name = endpoint.slice(endpoint.indexOf('.') + 1, endpoint.indexOf('.js'));
    var filepath = options.filepath;

    try {
        // keep reference to component so hot loading component can be
        // done by changing reference value

        var content = fs.readFileSync(filepath).toString();

        var opts = {
            route: '/' + options.version + '/' + name,
            component: require(filepath),
            docs: parsecomments(content),
            filepath: filepath
        };

        self.addComponent(opts);
    }
    catch (e) {
        console.log(e);
    }

    // if this endpoint's file is changed hot update the api
    self.addMonitor(filepath, function (filename) {
      delete require.cache[filepath];

      try {
          opts.component = require(filepath);
      }
      catch (e) {
        // if file was removed "un-use" this component
        if (e && e.code === 'ENOENT') {
          self.removeMonitor(filepath);
          self.removeComponent(opts.route);
        }
      }
    });

    log.info({module: 'server'}, 'Endpoint loaded: ' + name);
}

Server.prototype.addComponent = function (options) {

    // check if the endpoint is supplying a custom config block
    if (options.component.config && typeof options.component.config === 'function') {
        var config = options.component.config();
        if (config && config.route) {
            options.route = config.route;
        }
    }

    // only add a route once
    if (this.components[options.route]) return;

    this.components[options.route] = options.component;

    // add documentation by path
    this.docs[options.route] = options.docs;

    this.app.use(options.route +'/stats', function (req, res, next) {
      var method = req.method && req.method.toLowerCase();

      // call controller stats method
      if (method === 'get') {
         return options.component['stats'](req, res, next);
      }
      else {
        next();
      }
    })

    this.app.use(options.route +'/config', function (req, res, next) {
        var method = req.method && req.method.toLowerCase();

        // send schema
        if (method === 'get' && options.filepath) {

            // only allow getting collection endpoints
            if (options.filepath.slice(-5) === '.json') {
                return help.sendBackJSON(200, res, next)(null, require(options.filepath));
            }
            // continue
        }

        // set schema
        if (method === 'post' && options.filepath) {
          var schema = typeof req.body === 'object' ? req.body : JSON.parse(req.body)
          schema.settings.lastModifiedAt = Date.now()

	        return fs.writeFile(options.filepath, JSON.stringify(schema, null, 2), function (err) {
            help.sendBackJSON(200, res, next)(err, {result: 'success'});
          })
        }

        // delete schema
        if (method === 'delete' && options.filepath) {

            // only allow removing collection type endpoints
            if (options.filepath.slice(-5) === '.json') {
                return fs.unlink(options.filepath, function (err) {
                    help.sendBackJSON(200, res, next)(err, {result: 'success'});
                });
            }
            // continue
        }

        next();
    });

    this.app.use(options.route, function (req, res, next) {

        try {
            // map request method to controller method
            var method = req.method && req.method.toLowerCase();

            if (method && options.component[method]) return options.component[method](req, res, next);

            if (method && (method === 'options')) return help.sendBackJSON(200, res, next)(null, null);
        }
        catch (err) {
            var trace = stackTrace.parse(err);

            if (trace) {
                var stack = 'Error "' + err + '"\n';
                for (var i = 0; i < trace.length; i++) {
                    stack += '  at ' + trace[i].methodName + ' (' + trace[i].fileName + ':' + trace[i].lineNumber + ':' + trace[i].columnNumber + ')\n';
                };
                var error = new Error();
                error.statusCode = 500;
                error.json = { 'error': stack };

                console.log(stack);
                return next(error);
            }
            else {
                return next(err);
            }
        }

        next();
    });
};

Server.prototype.removeComponent = function (route) {
    this.app.unuse(route);
    delete this.components[route];

    // remove documentation by path
    delete this.docs[route];
};

Server.prototype.addMonitor = function (filepath, callback) {
    filepath = path.normalize(filepath);

    // only add one watcher per path
    if (this.monitors[filepath]) return;

    var m = monitor(filepath);
    m.on('change', callback);
    this.monitors[filepath] = m;
};

Server.prototype.removeMonitor = function (filepath) {
    this.monitors[filepath] && this.monitors[filepath].close();
    delete this.monitors[filepath];
};

// Synchronously create directory structure to match path
Server.prototype.createDirectoryStructure = function (dpath) {
    var self = this;

    var directories = dpath.split(path.sep);
    var npath = self.collectionPath;
    directories.forEach(function (dirname) {
        npath = path.join(npath, dirname);
        try {
            fs.mkdirSync(npath);
        } catch (err) {}
    });
};

/**
 *  Create workspace directories if they don't already exist
 *
 *  @param {Object} options Object containing workspace paths
 *  @return
 *  @api public
 */
Server.prototype.ensureDirectories = function (options, done) {
    var self = this;

    // create workspace directories if they don't exist
    // permissions default to 0755
    var _0755 = parseInt('0755', 8);

    var idx = 0;
    _.each(options, function(dir) {

      mkdirp(dir, _0755, function (err, made) {

        if (err) {
          log.debug({module: 'server'}, err);
          console.log(err);
        }

        if (made) {
          log.debug({module: 'server'}, 'Created directory ' + made);
          console.log('Created directory ' + made);
        }

        idx++;

        if (idx === Object.keys(options).length) return done();
      });
    });
};

/**
 *  expose VERB type methods for adding routes and middlewares
 *  @param {String} [route] optional
 *  @param {function} callback, any number of callback to be called in order
 *  @return undefined
 *  @api public
 */
Server.prototype.options = buildVerbMethod('options');
Server.prototype.get = buildVerbMethod('get');
Server.prototype.head = buildVerbMethod('head');
Server.prototype.post = buildVerbMethod('post');
Server.prototype.put = buildVerbMethod('put');
Server.prototype.delete = buildVerbMethod('delete');
Server.prototype.trace = buildVerbMethod('trace');

// singleton
module.exports = new Server();

// generate a method for http request methods matching `verb`
// if a route is passed, the node module `path-to-regexp` is
// used to create the RegExp that will test requests for this route
function buildVerbMethod(verb) {
    return function () {
        var args = [].slice.call(arguments, 0);
        var route = typeof arguments[0] === 'string' ? args.shift() : null;

        var handler = function (req, res, next) {
            if (!(req.method && req.method.toLowerCase() === verb)) {
                next();
            }

            // push the next route on to the bottom of callback stack in case none of these callbacks send a response
            args.push(next);
            var doCallbacks = function (i) {
                return function (err) {
                    if (err) return next(err);

                    args[i](req, res, doCallbacks(++i));
                }
            }

            doCallbacks(0)();
        };

        // if there is a route provided, only call for matching requests
        if (route) {
            return this.app.use(route, handler);
        }

        // if no route is provided, call this for all requests
        this.app.use(handler);
    };
}

function onListening(server) {
  var env = config.get('env');

  var address = server.address()

  if (env !== 'test') {
    var message = "Started DADI API '" + config.get('app.name') + "' (" + version + ", Node.JS v" + nodeVersion + ", " + env + " mode) on " + address.address + ":" + address.port;
    var startText = '\n\n';
    startText += '  ----------------------------\n';
    startText += '  ' + config.get('app.name').green + '\n';
    startText += '  Started \'DADI API\'\n';
    startText += '  ----------------------------\n';
    startText += '  Server:      '.green + address.address + ':' + address.port + '\n';
    startText += '  Version:     '.green + version + '\n';
    startText += '  Node.JS:     '.green + nodeVersion + '\n';
    startText += '  Environment: '.green + env + '\n';
    startText += '  ----------------------------\n';

    startText += '\n\n  Copyright ' + String.fromCharCode(169) + ' 2015 DADI+ Limited (https://dadi.tech)'.white +'\n';

    console.log(startText)
  }
}

function onError(err) {
  if (err.code == 'EADDRINUSE') {
    console.log('Error ' + err.code + ': Address ' + config.get('server.host') + ':' + config.get('server.port') + ' is already in use, is something else listening on port ' + config.get('server.port') + '?\n\n');
    process.exit(0);
  }
}
