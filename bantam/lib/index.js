var fs = require('fs');
var path = require('path');
var controller = require(__dirname + '/controller');
var model = require(__dirname + '/model');
var api = require(__dirname + '/api');
var auth = require(__dirname + '/auth');
var cache = require(__dirname + '/cache')();
var monitor = require(__dirname + '/monitor');
var logger = require(__dirname + '/log');
var bodyParser = require('body-parser');

var config = require(__dirname + '/../../config');

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

    // configure authentication after bodyParser middleware
    auth(app);

    // caching layer
    app.use(cache);

    // start listening
    var server = this.server = app.listen(config.server.port, config.server.host);
    logger.prod('Started server on ' + config.server.host + ':' + config.server.port);

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
    var collectionPath = options.collectionPath || __dirname + '/../../workspace/collections';
    var endpointPath = options.endpointPath || __dirname + '/../../workspace/endpoints';

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
            route: ['', version, database, name, ':id?'].join('/'),
            filepath: cpath,
            name: name
        });
    });
};

Server.prototype.addCollectionResource = function (options) {

    // get the schema
    var schema = require(options.filepath);

    // With each schema we create a model.
    // With each model we create a controller, that acts as a component of the REST api.
    // We then add the componenet to the api by adding a route to the app and mapping
    // `req.method` to component methods
    var mod = model(options.name, schema.fields, null, schema.settings);
    var control = controller(mod);

    this.addComponent({
        route: options.route,
        component: control
    });

    var self = this;

    // watch the schema's file and update it in place
    this.addMonitor(options.filepath, function (filename) {

        // invalidate schema file cache then reload
        delete require.cache[options.filepath];
        try {

            // This leverages the fact that Javscript's Object keys are references
            self.components[options.route].model.schema = require(options.filepath).fields;
            self.components[options.route].model.settings = require(options.filepath).settings;
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
        component: require(filepath)
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

// singleton
module.exports = new Server();
