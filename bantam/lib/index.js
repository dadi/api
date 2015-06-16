var fs = require('fs');
var path = require('path');
var bodyParser = require('body-parser');
var _ = require('underscore');
var controller = require(__dirname + '/controller');
var model = require(__dirname + '/model');
var api = require(__dirname + '/api');
var auth = require(__dirname + '/auth');
var cache = require(__dirname + '/cache');
var monitor = require(__dirname + '/monitor');
var logger = require(__dirname + '/log');
var help = require(__dirname + '/help');

var configPath = path.resolve(__dirname + '/../../config.json');
var config = require(configPath);

// add an optional id component to the path, that is formatted to be matched by the `path-to-regexp` module
var idParam = ':id([a-fA-F0-9]{24})?';

var Server = function () {
    this.components = {};
    this.monitors = {};
};

Server.prototype.start = function (options, done) {
    var self = this;

    this.readyState = 2;
    options || (options = {});

    // create app
    var app = this.app = api();

    // add necessary middlewares in order below here...

    app.use(bodyParser.json());
    app.use(bodyParser.urlencoded({ extended: false }));
    app.use(bodyParser.text());

    // configure authentication middleware
    auth(self);

    // example request logging middleware
    app.use(function (req, res, next) {
        var start = Date.now();
        var _end = res.end;
        res.end = function () {
            var duration = Date.now() - start;

            // log the request method and url, and the duration
            logger.prod(req.method
                + ' ' + req.url
                + ' ' + res.statusCode
                + ' ' + duration + 'ms');
            _end.apply(res, arguments);
        };
        next();
    });

    this.loadConfigApi();

    // caching layer
    cache(self);

    // start listening
    var server = this.server = app.listen(config.server.port, config.server.host);

    server.on('listening', function (e) {
      logger.prod('Started server on ' + config.server.host + ':' + config.server.port);
    });

    server.on('error', function (e) {
      if (e.code == 'EADDRINUSE') {
        console.log('Error ' + e.code + ': Address ' + config.server.host + ':' + config.server.port + ' is already in use, is something else listening on port ' + config.server.port + '?\n\n');
        process.exit(0);
      }
    });

    this.loadApi(options);

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

Server.prototype.loadApi = function (options) {
    options || (options = {});

    var self = this;
    var collectionPath = this.collectionPath = options.collectionPath || __dirname + '/../../workspace/collections';
    var endpointPath = this.endpointPath = options.endpointPath || __dirname + '/../../workspace/endpoints';

    // Load initial api descriptions
    this.updateVersions(collectionPath);

    this.addMonitor(collectionPath, function (versionName) {
        if (path) return self.updateDatabases(path.join(collectionPath, versionName));
        self.updateVersions(collectionPath);
    });

    this.updateEndpoints(endpointPath);

    this.addMonitor(endpointPath, function (endpointFile) {
        var filepath = path.join(endpointPath, endpointFile);

        // need to ensure filepath exists since this could be a removal
        if (endpointFile && fs.existsSync(filepath)) {
            return self.addEndpointResource({
                endpoint: endpointFile,
                filepath: filepath
            });
        }
        self.updateEndpoints(endpointPath);
    });
};

Server.prototype.loadConfigApi = function () {
    var self = this;

    // allow getting main config from API
    this.app.use('/serama/config', function (req, res, next) {
        var method = req.method && req.method.toLowerCase();

        if (method === 'get') return help.sendBackJSON(200, res, next)(null, config);

        if (method === 'post') {

            // update the config file
            var newConfig = _.extend({}, config, req.body);

            return fs.writeFile(configPath, JSON.stringify(newConfig), function (err) {
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
        var method = req.method && req.method.toLowerCase();
        if (method !== 'post') return next();

        var schemaString = typeof req.body === 'object' ? JSON.stringify(req.body, null, 4) : req.body;
        if (typeof schemaString !== 'string') {
            var err = new Error('Bad Syntax');
            err.statusCode = 400;
            return next(err);
        }

        var validation = help.validateCollectionSchema(JSON.parse(schemaString));

        if (!validation.success) {
            var err = new Error('Collection schema validation failed');
            err.statusCode = 400;
            err.json = validation;
            return next(err);
        }

        var params = req.params;

        var route = ['', params.version, params.database, params.collectionName, idParam].join('/');

        // create schema
        if (!self.components[route]) {
            self.createDirectoryStructure(path.join(params.version, params.database));

            var schemaPath = path.join(
                self.collectionPath,
                params.version,
                params.database,
                'collection.' + params.collectionName + '.json'
            );

            try {

                fs.writeFileSync(schemaPath, schemaString);

                res.statusCode = 200;
                res.setHeader('content-type', 'application/json');
                res.end(JSON.stringify({
                    result: 'success',
                    message: params.collectionName + ' collection created'
                }));

            }
            catch (err) {
                return next(err);
            }
        }

        next();
    });

    this.app.use('/endpoints/:endpointName/config', function (req, res, next) {
        var method = req.method && req.method.toLowerCase();
        if (method !== 'post') return next();

        var name = req.params.endpointName;
        if (!self.components['/endpoints/' + name]) {
            var filepath = path.join(self.endpointPath, 'endpoint.' + name + '.js');

            return fs.writeFile(filepath, req.body, function (err) {
                if (err) return next(err);

                res.statusCode = 200;
                res.setHeader('content-type', 'application/json');
                res.end(JSON.stringify({
                    result: 'success',
                    message: req.params.endpointName + ' endpoint created'
                }));
            });
        }

        next();
    });
};

Server.prototype.updateVersions = function (versionsPath) {
    var self = this;

    // Load initial api descriptions
    var versions = fs.readdirSync(versionsPath);

    versions.forEach(function (version) {
        if (version.indexOf('.') === 0) return;

        var dirname = path.join(versionsPath, version);
        self.updateDatabases(dirname);

        self.addMonitor(dirname, function (databaseName) {
            if (databaseName) return self.updateCollections(path.join(dirname, databaseName));
            self.updateDatabases(dirname);
        });
    });
};

Server.prototype.updateDatabases = function (databasesPath) {
    var self = this;
    var databases;
    try {
        databases = fs.readdirSync(databasesPath);
    } catch (e) {
        logger.prod(databasesPath + ' does not exist');
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
        var name = collection.slice(collection.indexOf('.') + 1, collection.indexOf('.json'));

        self.addCollectionResource({
            route: ['', version, database, name, idParam].join('/'),
            filepath: cpath,
            name: name
        });
    });
};

Server.prototype.addCollectionResource = function (options) {

    // get the schema
    var schema = require(options.filepath);
    var fields = help.getFieldsFromSchema(schema);

    // With each schema we create a model.
    // With each model we create a controller, that acts as a component of the REST api.
    // We then add the component to the api by adding a route to the app and mapping
    // `req.method` to component methods
    var mod = model(options.name, JSON.parse(fields), null, schema.settings);
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

    logger.prod('Initial ' + options.name + ' Schema loaded');
};

Server.prototype.updateEndpoints = function (endpointsPath) {
    var self = this;
    var endpoints = fs.readdirSync(endpointsPath);

    endpoints.forEach(function (endpoint) {
        self.addEndpointResource({
            endpoint: endpoint,
            filepath: path.join(endpointsPath, endpoint)
        });
    });

};

Server.prototype.addEndpointResource = function (options) {
    var endpoint = options.endpoint
    if (endpoint.indexOf('.') === 0) return;

    var self = this;
    var name = endpoint.slice(endpoint.indexOf('.') + 1, endpoint.indexOf('.js'));
    var filepath = options.filepath;

    // keep reference to component so hot loading component can be
    // done by changing reference value
    var opts = {
        route: '/endpoints/' + name,
        component: require(filepath),
        filepath: filepath
    };

    self.addComponent(opts);

    // if this endpoint's file is changed hot update the api
    self.addMonitor(filepath, function (filename) {
        delete require.cache[filepath];
        try {
            opts.component = require(filepath);
        } catch (e) {

            // if file was removed "un-use" this component
            if (e && e.code === 'ENOENT') {
                self.removeMonitor(filepath);
                self.removeComponent(opts.route);
            }
        }
    });

    logger.prod('Endpoint ' + name + ' loaded');
}

Server.prototype.addComponent = function (options) {

    // only add a route once
    if (this.components[options.route]) return;

    this.components[options.route] = options.component;

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
	    var schemaString = typeof req.body === 'object' ? JSON.stringify(req.body, null, 4) : req.body;
            return fs.writeFile(options.filepath, schemaString, function (err) {
                help.sendBackJSON(200, res, next)(err, {result: 'success'});
            });
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
        // map request method to controller method
        var method = req.method && req.method.toLowerCase();
        if (method && options.component[method]) return options.component[method](req, res, next);

        next();
    });
};

Server.prototype.removeComponent = function (route) {
    this.app.unuse(route);
    delete this.components[route];
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
