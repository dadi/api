var site = require('../../package.json').name
var version = require('../../package.json').version
var nodeVersion = Number(process.version.match(/^v(\d+\.\d+)/)[1])

var bodyParser = require('body-parser')
var chokidar = require('chokidar')
var cluster = require('cluster')
var colors = require('colors') // eslint-disable-line
var parsecomments = require('parse-comments')
var formatError = require('@dadi/format-error')
var fs = require('fs')
var jwt = require('jsonwebtoken')
var mkdirp = require('mkdirp')
var path = require('path')
var pathToRegexp = require('path-to-regexp')
var stackTrace = require('stack-trace')
var url = require('url')
var _ = require('underscore')

var api = require(path.join(__dirname, '/api'))
var auth = require(path.join(__dirname, '/auth'))
var cache = require(path.join(__dirname, '/cache'))
var controller = require(path.join(__dirname, '/controller'))
var MediaController = require(path.join(__dirname, '/controller/media'))
var dadiStatus = require('@dadi/status')
var help = require(path.join(__dirname, '/help'))
var log = require('@dadi/logger')
var model = require(path.join(__dirname, '/model'))
var monitor = require(path.join(__dirname, '/monitor'))
var search = require(path.join(__dirname, '/search'))

var config = require(path.join(__dirname, '/../../config'))
var configPath = path.resolve(config.configPath())

log.init(config.get('logging'), {}, process.env.NODE_ENV)

if (config.get('env') !== 'test') {
  // add timestamps in front of log messages
  require('console-stamp')(console, 'yyyy-mm-dd HH:MM:ss.l')
}

// add an optional id component to the path, that is formatted to be matched by the `path-to-regexp` module
var idParam = ':id([a-fA-F0-9]{24})?'

var Server = function () {
  this.components = {}
  this.monitors = {}
  this.docs = {}

  log.info({module: 'server'}, 'Server logging started.')
}

Server.prototype.run = function (done) {
  require('console-stamp')(console, 'yyyy-mm-dd HH:MM:ss.l')

  if (config.get('cluster')) {
    if (cluster.isMaster) {
      var numWorkers = require('os').cpus().length
      log.info('Starting DADI API in cluster mode, using ' + numWorkers + ' workers.')
      log.info('Master cluster setting up ' + numWorkers + ' workers...')

      // Start new workers
      for (var i = 0; i < numWorkers; i++) {
        cluster.fork()
      }

      // New worker alive
      cluster.on('online', function (worker) {
        log.info('Worker ' + worker.process.pid + ' is online')
      })

      // Handle a thread exit, start a new worker
      cluster.on('exit', function (worker, code, signal) {
        log.info('Worker ' + worker.process.pid + ' died with code: ' + code + ', and signal: ' + signal)
        log.info('Starting a new worker')

        cluster.fork()
      })

      // Watch the current directory for a "restart.api" file
      var watcher = chokidar.watch(process.cwd(), {
        depth: 1,
        ignored: /(^|[/\\])\../,  // ignores dotfiles, see https://regex101.com/r/7VuO4e/1
        ignoreInitial: true
      })

      watcher.on('add', function (filePath) {
        if (path.basename(filePath) === 'restart.api') {
          log.info('Shutdown requested')
          fs.unlinkSync(filePath)
          restartWorkers()
        }
      })

    // watcher.on('change', function(filePath) {
    //   if (/config\.(.*)\.json/.test(path.basename(filePath))) {
    //     log.info('Shutdown requested')
    //     restartWorkers()
    //   }
    // })
    } else {
      // Start Workers
      this.start(function () {
        log.info('Process ' + process.pid + ' is listening for incoming requests')

        process.on('message', function (message) {
          if (message.type === 'shutdown') {
            log.info('Process ' + process.pid + ' is shutting down...')

            process.exit(0)
          }
        })
      })
    }
  } else {
    // Single thread start
    log.info('Starting DADI API in single thread mode.')

    this.start(function () {
      log.info('Process ' + process.pid + ' is listening for incoming requests')
    })
  }

  function restartWorkers () {
    var wid
    var workerIds = []

    for (wid in cluster.workers) {
      workerIds.push(wid)
    }

    workerIds.forEach(function (wid) {
      if (cluster.workers[wid]) {
        cluster.workers[wid].send({
          type: 'shutdown',
          from: 'master'
        })

        setTimeout(function () {
          if (cluster.workers[wid]) {
            cluster.workers[wid].kill('SIGKILL')
          }
        }, 5000)
      }
    })
  }
}

Server.prototype.start = function (done) {
  var self = this
  this.readyState = 2

  var defaultPaths = {
    collections: path.join(__dirname, '/../../workspace/collections'),
    endpoints: path.join(__dirname, '/../../workspace/endpoints')
  }

  var options = {}
  this.loadPaths(config.get('paths') || defaultPaths, function (paths) {
    options = paths
  })

  // create app
  var app = this.app = api()

  // add necessary middlewares in order below here...

  app.use((req, res, next) => {
    var FAVICON_REGEX = /\/(favicon|(apple-)?touch-icon(-i(phone|pad))?(-\d{2,}x\d{2,})?(-precomposed)?)\.(jpe?g|png|ico|gif)$/i

    if (FAVICON_REGEX.test(req.url)) {
      res.statusCode = 204
      res.end()
    } else {
      next()
    }
  })

  app.use(bodyParser.json({ limit: '50mb' }))
  app.use(bodyParser.urlencoded({ extended: false, limit: '50mb' }))
  app.use(bodyParser.text({ limit: '50mb' }))

  // update configuration based on domain
  var domainConfigLoaded
  app.use(function (req, res, next) {
    if (domainConfigLoaded) return next()
    config.updateConfigDataForDomain(req.headers.host)
    domainConfigLoaded = true
    return next()
  })

  // configure authentication middleware
  auth(self)

  // request logging middleware
  app.use(log.requestLogger)

  this.loadConfigApi()

  // caching layer
  cache(self).init()

  // search layer
  search(self)

  // start listening
  var server = this.server = app.listen()

  server.on('listening', function () { onListening(this) })
  server.on('error', onError)

  this.loadApi(options)

  this.loadCollectionRoute()
  this.loadEndpointsRoute()
  this.loadHooksRoute()

  this.readyState = 1

  // this is all sync, so callback isn't really necessary.
  done && done()
}

// this is mostly needed for tests
Server.prototype.stop = function (done) {
  var self = this
  this.readyState = 3

  Object.keys(this.monitors).forEach(this.removeMonitor.bind(this))

  Object.keys(this.components).forEach(this.removeComponent.bind(this))

  this.server.close(function (err) {
    self.readyState = 0
    done && done(err)
  })
}

Server.prototype.loadPaths = function (paths, done) {
  var self = this
  var options = {}

  options.collectionPath = path.resolve(paths.collections || path.join(__dirname, '/../../workspace/collections'))
  options.endpointPath = path.resolve(paths.endpoints || path.join(__dirname, '/../../workspace/endpoints'))
  options.hookPath = path.resolve(paths.hooks || path.join(__dirname, '/../../workspace/hooks'))

  var idx = 0

  _.each(options, function (path, key) {
    try {
      var stats = fs.statSync(path) // eslint-disable-line
    } catch (err) {
      if (err.code === 'ENOENT') {
        self.ensureDirectories(options, function () {
          //
        })
      }
    }

    idx++

    if (idx === Object.keys(options).length) return done(options)
  })
}

Server.prototype.loadApi = function (options) {
  var self = this
  var collectionPath = this.collectionPath = options.collectionPath || path.join(__dirname, '/../../workspace/collections')
  var endpointPath = this.endpointPath = options.endpointPath || path.join(__dirname, '/../../workspace/endpoints')
  var hookPath = this.hookPath = options.hookPath || path.join(__dirname, '/../../workspace/hooks')

  self.updateHooks(hookPath)
  self.addMonitor(hookPath, function (hook) {
    self.updateHooks(hookPath)
  })

  // Load initial api descriptions
  this.updateVersions(collectionPath)

  this.addMonitor(collectionPath, function (versionName) {
    if (path) return self.updateDatabases(path.join(collectionPath, versionName))
    self.updateVersions(collectionPath)
  })

  // this.updateEndpoints(endpointPath)
  this.updateVersions(endpointPath)

  this.addMonitor(endpointPath, function (endpointFile) {
    self.updateVersions(endpointPath)
  })

  this.app.use('/api/flush', function (req, res, next) {
    var method = req.method && req.method.toLowerCase()
    if (method !== 'post') return next()

    if (!req.body.path) {
      return help.sendBackJSON(400, res, next)(null, formatError.createApiError('0003'))
    }

    return help.clearCache(req.body.path, function (err) {
      help.sendBackJSON(200, res, next)(err, {
        result: 'success',
        message: 'Cache flush successful'
      })
    })
  })

  this.app.use('/api/status', function (req, res, next) {
    var method = req.method && req.method.toLowerCase()
    var authorization = req.headers.authorization

    if (method !== 'post' || config.get('status.enabled') === false) {
      return next()
    } else {
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

      dadiStatus(params, function (err, data) {
        if (err) return next(err)
        var resBody = JSON.stringify(data, null, 2)

        res.statusCode = 200
        res.setHeader('Content-Type', 'application/json')
        res.setHeader('content-length', Buffer.byteLength(resBody))
        return res.end(resBody)
      })
    }
  })

// need to ensure filepath exists since this could be a removal
//     if (endpointFile && fs.existsSync(filepath)) {
//         return self.addEndpointResource({
//             endpoint: endpointFile,
//             filepath: filepath
//         })
//     }
//     self.updateEndpoints(endpointPath)
// })
}

Server.prototype.loadConfigApi = function () {
  var self = this

  // allow getting main config from API
  this.app.use('/api/config', function (req, res, next) {
    var method = req.method && req.method.toLowerCase()

    if (method === 'get') return help.sendBackJSON(200, res, next)(null, config.getProperties())

    if (method === 'post') {
      // update the config file
      var newConfig = _.extend({}, config.getProperties(), req.body)

      return fs.writeFile(configPath, JSON.stringify(newConfig, null, 4), function (err) {
        help.sendBackJSON(200, res, next)(err, {
          result: 'success',
          message: 'server restart required'
        })
      })
    }

    next()
  })

  // listen for requests to add to the API
  this.app.use('/:version/:database/:collectionName/config', function (req, res, next) {
    // collection and endpoint paths now have the same structure
    // i.e. /version/database/collection and /endpoints/version/endpoint
    // so test here for `endpoints` in the request url, processing the next
    // handler if required.
    if (url.parse(req.url).pathname.indexOf('endpoints') > 0) return next()

    var method = req.method && req.method.toLowerCase()
    if (method !== 'post') return next()

    // console.log(req)

    try {
      var schema = typeof req.body === 'object' ? req.body : JSON.parse(req.body)
    } catch (err) {
      var error = new Error('Bad Syntax')
      error.statusCode = 400
      return next(error)
    }

    var validation = help.validateCollectionSchema(schema)

    if (!validation.success) {
      var err = new Error('Collection schema validation failed')
      err.statusCode = 400
      err.success = validation.success
      err.errors = validation.errors
      return next(err)
    }

    var params = req.params

    // use params.collectionName as default, override if the schema supplies a 'model' property
    var name = params.collectionName
    if (schema.hasOwnProperty('model')) name = schema.model

    schema.settings.lastModifiedAt = Date.now()

    var route = ['', params.version, params.database, name, idParam].join('/')

    // create schema
    if (!self.components[route]) {
      self.createDirectoryStructure(path.join(params.version, params.database))

      var schemaPath = path.join(
        self.collectionPath,
        params.version,
        params.database,
        'collection.' + name + '.json'
      )

      try {
        fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2))

        res.statusCode = 200
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({
          result: 'success',
          message: name + ' collection created'
        }))
      } catch (err) {
        return next(err)
      }
    } else {
      next()
    }
  })

  this.app.use('/:version/:endpointName/config', function (req, res, next) {
    var method = req.method && req.method.toLowerCase()
    if (method !== 'post') return next()

    var version = req.params.version
    var name = req.params.endpointName

    var dir = path.join(self.endpointPath, version)
    var filepath = path.join(dir, 'endpoint.' + name + '.js')

    mkdirp(dir, {}, function (err, made) {
      if (err) console.log(err)

      return fs.writeFile(filepath, req.body, function (err) {
        if (err) return next(err)

        var message = 'Endpoint "' + version + ':' + name + '" created'

        res.statusCode = 200
        res.setHeader('content-type', 'application/json')
        res.end(JSON.stringify({
          result: 'success',
          message: message
        }))
      })
    })
  })
}

// route to retrieve list of collections
Server.prototype.loadCollectionRoute = function () {
  var self = this

  this.app.use('/api/collections', function (req, res, next) {
    var method = req.method && req.method.toLowerCase()

    if (method !== 'get') return help.sendBackJSON(400, res, next)(null, {'error': 'Invalid method'})

    var data = {}
    var collections = []

    // Adding normal document collections
    _.each(self.components, function (value, key) {
      var model
      var name = null
      var slug
      var parts = _.compact(key.split('/'))

      var hasModel = _.contains(Object.keys(value), 'model')
      var hasGetMethod = _.contains(Object.keys(value), 'get')

      if (hasModel && !hasGetMethod) {
        model = value.model

        if (model.hasOwnProperty('name')) {
          name = model.name
          slug = model.name
        }

        var collection = {
          version: parts[0],
          database: parts[1],
          name: name,
          slug: slug,
          path: '/' + [parts[0], parts[1], slug].join('/')
        }

        if (model.hasOwnProperty('settings')) {
          if (model.settings.hasOwnProperty('displayName')) collection.name = model.settings.displayName
          if (model.settings.hasOwnProperty('lastModifiedAt')) collection.lastModifiedAt = model.settings.lastModifiedAt
          if (model.settings.hasOwnProperty('type')) collection.type = model.settings.type
        }

        const collectionAlreadyAdded = collections.some(collectionInArray => {
          return collectionInArray.name === collection.name &&
            collectionInArray.version === collection.version &&
            collectionInArray.database === collection.database
        })

        if (!collectionAlreadyAdded) {
          collections.push(collection)
        }
      }
    })

    data.collections = _.sortBy(collections, 'path')

    // Adding media collections. For now, this will contain a single entry, but
    // it's still worth keeping it as an array in case we support multiple media
    // collections in the future, avoiding breaking changes.
    // var mediaCollections = []
    //
    // if (config.get('media.enabled')) {
    //   mediaCollections = [Object.assign({}, MediaModel.Schema, {
    //     name: config.get('media.collection')
    //   })]
    // }
    //
    // data.mediaCollections = mediaCollections

    return help.sendBackJSON(200, res, next)(null, data)
  })
}

// route to retrieve list of endpoints
Server.prototype.loadEndpointsRoute = function () {
  var self = this

  this.app.use('/api/endpoints', function (req, res, next) {
    var method = req.method && req.method.toLowerCase()

    if (method !== 'get') return help.sendBackJSON(400, res, next)(null, {'error': 'Invalid method'})

    var data = {}
    var endpoints = []

    _.each(self.components, function (value, key) {
      var model
      var parts = _.compact(key.split('/'))
      var name = parts[1]

      var hasModel = _.contains(Object.keys(value), 'model')
      var hasGetMethod = _.contains(Object.keys(value), 'get')

      if (hasModel) {
        model = value.model

        if (model.hasOwnProperty('settings') && model.settings.hasOwnProperty('displayName')) {
          name = model.settings.displayName
        }
      }

      if (hasGetMethod) {
        // an endpoint
        var endpoint = {
          name: name,
          version: parts[0],
          path: key
        }

        if (pathToRegexp(key).keys.length > 0) endpoint.params = pathToRegexp(key).keys

        endpoints.push(endpoint)
      }
    })

    data.endpoints = _.sortBy(endpoints, 'path')

    return help.sendBackJSON(200, res, next)(null, data)
  })
}

// route to retrieve list of available hooks
Server.prototype.loadHooksRoute = function () {
  var self = this

  this.app.use('/api/hooks', function (req, res, next) {
    var method = req.method && req.method.toLowerCase()
    if (method !== 'get') return help.sendBackJSON(400, res, next)(null, {'error': 'Invalid method'})

    var data = {}
    var hooks = []

    _.each(self.components, function (value, key) {
      if (key.indexOf('hook:') === 0) {
        var hook = {
          name: key.replace('hook:', '')
        }

        var docs = self.docs[key]
        if (docs && docs[0]) {
          hook.description = docs[0].description
          hook.params = docs[0].params
          hook.returns = docs[0].returns
        }

        hooks.push(hook)
      }
    })

    data.hooks = _.sortBy(hooks, 'name')

    return help.sendBackJSON(200, res, next)(null, data)
  })

  this.app.use('/api/hooks/:hook/config', function (req, res, next) {
    var method = req.method && req.method.toLowerCase()
    if (method !== 'get') return help.sendBackJSON(400, res, next)(null, {'error': 'Invalid method'})

    _.each(self.components, function (value, key) {
      if (key.indexOf('hook:') === 0) {
        var hook = key.replace('hook:', '')

        if (hook === req.params.hook) {
          var content = fs.readFileSync(value)
          return help.sendBackText(200, res, next)(null, content.toString())
        }
      }
    })

    return help.sendBackJSON(404, res, next)(null, {})
  })
}

Server.prototype.updateVersions = function (versionsPath) {
  var self = this

  // Load initial api descriptions
  var versions = fs.readdirSync(versionsPath)

  versions.forEach(function (version) {
    if (version.indexOf('.') === 0) return

    var dirname = path.join(versionsPath, version)

    if (dirname.indexOf('collections') > 0) {
      self.updateDatabases(dirname)

      self.addMonitor(dirname, function (databaseName) {
        if (databaseName) return self.updateCollections(path.join(dirname, databaseName))
        self.updateDatabases(dirname)
      })
    } else {
      self.updateEndpoints(dirname)

      self.addMonitor(dirname, function (endpoint) {
        self.updateEndpoints(dirname)
      })
    }
  })
}

Server.prototype.updateDatabases = function (databasesPath) {
  var self = this
  var databases
  try {
    databases = fs.readdirSync(databasesPath)
  } catch (e) {
    log.warn({module: 'server'}, databasesPath + ' does not exist')
    return
  }

  databases.forEach(function (database) {
    if (database.indexOf('.') === 0) return

    var dirname = path.join(databasesPath, database)
    self.updateCollections(dirname)

    self.addMonitor(dirname, function (collectionFile) {
      self.updateCollections(dirname)
    })
  })
}

Server.prototype.updateCollections = function (collectionsPath) {
  if (!fs.existsSync(collectionsPath)) return
  if (!fs.lstatSync(collectionsPath).isDirectory()) return

  var self = this
  var collections = fs.readdirSync(collectionsPath)

  collections.forEach(function (collection) {
    if (collection.indexOf('.') === 0) return

    // parse the url out of the directory structure
    var cpath = path.join(collectionsPath, collection)
    var dirs = cpath.split(path.sep)
    var version = dirs[dirs.length - 3]
    var database = dirs[dirs.length - 2]

    // collection should be json file containing schema

    // get the schema
    var schema = require(cpath)
    var name = collection.slice(collection.indexOf('.') + 1, collection.indexOf('.json'))

    // override the default name using the supplied property
    if (schema.hasOwnProperty('model')) name = schema.model

    self.addCollectionResource({
      route: ['', version, database, name, idParam].join('/'),
      filepath: cpath,
      name: name,
      schema: schema,
      database: database
    })
  })
}

Server.prototype.addCollectionResource = function (options) {
  var fields = help.getFieldsFromSchema(options.schema)

  // With each schema we create a model.
  // With each model we create a controller, that acts as a component of the REST api.
  // We then add the component to the api by adding a route to the app and mapping
  // `req.method` to component methods

  var enableCollectionDatabases = config.get('database.enableCollectionDatabases')
  var database = enableCollectionDatabases ? options.database : null

  var settings = options.schema.settings
  var mod
  var control

  mod = model(options.name, JSON.parse(fields), null, settings, database)

  if (settings.type && settings.type === 'mediaCollection') {
    control = MediaController(mod)
  } else {
    control = controller(mod)
  }

  this.addComponent({
    route: options.route,
    component: control,
    filepath: options.filepath
  })

  var self = this

  // watch the schema's file and update it in place
  this.addMonitor(options.filepath, function (filename) {
    // invalidate schema file cache then reload
    delete require.cache[options.filepath]
    try {
      var schemaObj = require(options.filepath)
      var fields = help.getFieldsFromSchema(schemaObj)
      // This leverages the fact that Javscript's Object keys are references
      self.components[options.route].model.schema = JSON.parse(fields)
      self.components[options.route].model.settings = schemaObj.settings
    } catch (e) {
      // if file was removed "un-use" this component
      if (e && e.code === 'ENOENT') {
        self.removeMonitor(options.filepath)
        self.removeComponent(options.route)
      }
    }
  })

  log.info({module: 'server'}, 'Collection loaded: ' + options.name)
}

Server.prototype.updateEndpoints = function (endpointsPath) {
  var self = this
  var endpoints = fs.readdirSync(endpointsPath)

  endpoints.forEach(function (endpoint) {
    // parse the url out of the directory structure
    var cpath = path.join(endpointsPath, endpoint)
    var dirs = cpath.split(path.sep)
    var version = dirs[dirs.length - 2]

    self.addEndpointResource({
      version: version,
      endpoint: endpoint,
      filepath: path.join(endpointsPath, endpoint)
    })
  })
}

Server.prototype.addEndpointResource = function (options) {
  var endpoint = options.endpoint
  if (endpoint.indexOf('.') === 0 || endpoint.indexOf('endpoint.') !== 0) return

  var self = this
  var name = endpoint.slice(endpoint.indexOf('.') + 1, endpoint.indexOf('.js'))
  var filepath = options.filepath
  delete require.cache[filepath]

  try {
    // keep reference to component so hot loading component can be
    // done by changing reference value

    var content = fs.readFileSync(filepath).toString()

    var opts = {
      route: '/' + options.version + '/' + name,
      component: require(filepath),
      docs: parsecomments(content),
      filepath: filepath
    }

    self.addComponent(opts)
  } catch (e) {
    console.log(e)
  }

  // if this endpoint's file is changed hot update the api
  self.addMonitor(filepath, function (filename) {
    delete require.cache[filepath]

    try {
      opts.component = require(filepath)
    } catch (e) {
      // if file was removed "un-use" this component
      if (e && e.code === 'ENOENT') {
        self.removeMonitor(filepath)
        self.removeComponent(opts.route)
      }
    }
  })

  log.info({module: 'server'}, 'Endpoint loaded: ' + name)
}

Server.prototype.updateHooks = function (hookPath) {
  var self = this
  var hooks = fs.readdirSync(hookPath)

  hooks.forEach(function (hook) {
    self.addHook({
      hook: hook,
      filepath: path.join(hookPath, hook)
    })
  })
}

Server.prototype.addHook = function (options) {
  if (path.extname(options.filepath) !== '.js') return
  var hook = options.hook

  var self = this
  var name = hook.replace('.js', '')
  var filepath = options.filepath
  delete require.cache[filepath]

  try {
    var content = fs.readFileSync(filepath).toString()

    var opts = {
      route: 'hook:' + name,
      component: filepath,
      docs: parsecomments(content),
      filepath: filepath
    }

    self.addComponent(opts)
  } catch (e) {
    console.log(e)
  }

  self.addMonitor(filepath, function (filename) {
    delete require.cache[filepath]

    try {
      opts.component = require(filepath)
    } catch (e) {
      // if file was removed "un-use" this component
      if (e && e.code === 'ENOENT') {
        self.removeMonitor(filepath)
        self.removeComponent(opts.route)
      }
    }
  })

  log.info({module: 'server'}, 'Hook loaded: ' + name)
}

Server.prototype.addComponent = function (options) {
  // check if the endpoint is supplying a custom config block
  if (options.component.config && typeof options.component.config === 'function') {
    var componentConfig = options.component.config()
    if (componentConfig && componentConfig.route) {
      options.route = componentConfig.route
    }
  }

  // remove it before reloading
  if (this.components[options.route]) {
    this.removeComponent(options.route)
  }

  // add controller and documentation
  this.components[options.route] = options.component
  this.docs[options.route] = options.docs

  this.app.use(options.route + '/count', function (req, res, next) {
    var method = req.method && req.method.toLowerCase()

    // call controller stats method
    if (method === 'get') {
      return options.component['count'](req, res, next)
    } else {
      next()
    }
  })

  this.app.use(options.route + '/stats', function (req, res, next) {
    var method = req.method && req.method.toLowerCase()

    // call controller stats method
    if (method === 'get') {
      return options.component['stats'](req, res, next)
    } else {
      next()
    }
  })

  this.app.use(options.route + '/config', function (req, res, next) {
    var method = req.method && req.method.toLowerCase()

    // send schema
    if (method === 'get' && options.filepath) {
      // only allow getting collection endpoints
      if (options.filepath.slice(-5) === '.json') {
        return help.sendBackJSON(200, res, next)(null, require(options.filepath))
      }
    // continue
    }

    // set schema
    if (method === 'post' && options.filepath) {
      var schema = typeof req.body === 'object' ? req.body : JSON.parse(req.body)
      schema.settings.lastModifiedAt = Date.now()

      return fs.writeFile(options.filepath, JSON.stringify(schema, null, 2), function (err) {
        help.sendBackJSON(200, res, next)(err, {result: 'success'})
      })
    }

    // delete schema
    if (method === 'delete' && options.filepath) {
      // only allow removing collection type endpoints
      if (options.filepath.slice(-5) === '.json') {
        return fs.unlink(options.filepath, function (err) {
          help.sendBackJSON(200, res, next)(err, {result: 'success'})
        })
      }
    // continue
    }

    next()
  })

  var isMedia = options.component.model &&
    options.component.model.settings &&
    options.component.model.settings.type &&
    options.component.model.settings.type === 'mediaCollection'

  if (!isMedia) {
    this.app.use(options.route, function (req, res, next) {
      try {
        // map request method to controller method
        var method = req.method && req.method.toLowerCase()

        if (method && options.component[method]) return options.component[method](req, res, next)

        if (method && (method === 'options')) return help.sendBackJSON(200, res, next)(null, null)
      } catch (err) {
        var trace = stackTrace.parse(err)

        if (trace) {
          var stack = 'Error "' + err + '"\n'
          for (var i = 0; i < trace.length; i++) {
            stack += '  at ' + trace[i].methodName + ' (' + trace[i].fileName + ':' + trace[i].lineNumber + ':' + trace[i].columnNumber + ')\n'
          }
          var error = new Error()
          error.statusCode = 500
          error.json = { 'error': stack }

          console.log(stack)
          return next(error)
        } else {
          return next(err)
        }
      }

      next()
    })
  }

  if (isMedia) {
    var mediaRoute = options.route.replace('/' + idParam, '')
    this.components[mediaRoute] = options.component
    this.components[mediaRoute + '/:token+'] = options.component
    this.components[mediaRoute + '/:filename(.*png|.*jpg|.*gif|.*bmp|.*tiff)'] = options.component

    if (options.component.setRoute) {
      options.component.setRoute(mediaRoute)
    }

    // GET media
    this.app.use(mediaRoute, (req, res, next) => {
      var method = req.method && req.method.toLowerCase()
      if (method !== 'get') return next()

      if (options.component[method]) {
        return options.component[method](req, res, next)
      }
    })

    // GET media/filename
    this.app.use(mediaRoute + '/:filename(.*png|.*jpg|.*gif|.*bmp|.*tiff)', (req, res, next) => {
      if (options.component.getFile) {
        return options.component.getFile(req, res, next, mediaRoute)
      }
    })

    // POST media/sign
    this.app.use(mediaRoute + '/sign', (req, res, next) => {
      var method = req.method && req.method.toLowerCase()
      if (method !== 'post') return next()

      try {
        var token = this._signToken(req.body)
      } catch (err) {
        if (err) {
          err.statusCode = 400
          return next(err)
        }
      }

      help.sendBackJSON(200, res, next)(null, {
        url: `${mediaRoute}/${token}`
      })
    })

    // POST media (upload)
    this.app.use(mediaRoute + '/:token?', (req, res, next) => {
      var method = req.method && req.method.toLowerCase()
      if (method !== 'post') return next()

      var settings = options.component.model.settings

      if (settings.signUploads && !req.params.token) {
        var err = {
          name: 'NoTokenError',
          statusCode: 400
        }

        return next(err)
      }

      if (req.params.token) {
        jwt.verify(req.params.token, config.get('media.tokenSecret'), (err, payload) => {
          if (err) {
            if (err.name === 'TokenExpiredError') {
              err.statusCode = 400
            }

            return next(err)
          }

          if (options.component.setPayload) {
            options.component.setPayload(payload)
          }

          return options.component[method](req, res, next)
        })
      } else {
        return options.component[method](req, res, next)
      }
    })
  }
}

Server.prototype.removeComponent = function (route) {
  this.app.unuse(route)
  delete this.components[route]

  // remove documentation by path
  delete this.docs[route]
}

/**
 * Generates a JSON Web Token representing the specified object
 *
 * @param {Object} obj - a JSON object containing key:value pairs to be encoded into a token
 * @returns {string} JSON Web Token
 */
Server.prototype._signToken = function (obj) {
  return jwt.sign(obj, config.get('media.tokenSecret'), { expiresIn: obj.expiresIn || config.get('media.tokenExpiresIn') })
}

Server.prototype.addMonitor = function (filepath, callback) {
  filepath = path.normalize(filepath)

  // only add one watcher per path
  if (this.monitors[filepath]) return

  var m = monitor(filepath)
  m.on('change', callback)
  this.monitors[filepath] = m
}

Server.prototype.removeMonitor = function (filepath) {
  this.monitors[filepath] && this.monitors[filepath].close()
  delete this.monitors[filepath]
}

// Synchronously create directory structure to match path
Server.prototype.createDirectoryStructure = function (dpath) {
  var self = this

  var directories = dpath.split(path.sep)
  var npath = self.collectionPath
  directories.forEach(function (dirname) {
    npath = path.join(npath, dirname)
    try {
      fs.mkdirSync(npath)
    } catch (err) {}
  })
}

/**
 *  Create workspace directories if they don't already exist
 *
 *  @param {Object} options Object containing workspace paths
 *  @return
 *  @api public
 */
Server.prototype.ensureDirectories = function (options, done) {
  // create workspace directories if they don't exist
  // permissions default to 0755
  var _0755 = parseInt('0755', 8)

  var idx = 0
  _.each(options, function (dir) {
    mkdirp(dir, _0755, function (err, made) {
      if (err) {
        log.debug({module: 'server'}, err)
        console.log(err)
      }

      if (made) {
        log.debug({module: 'server'}, 'Created directory ' + made)
        console.log('Created directory ' + made)
      }

      idx++

      if (idx === Object.keys(options).length) return done()
    })
  })
}

/**
 *  expose VERB type methods for adding routes and middlewares
 *  @param {String} [route] optional
 *  @param {function} callback, any number of callback to be called in order
 *  @return undefined
 *  @api public
 */
Server.prototype.options = buildVerbMethod('options')
Server.prototype.get = buildVerbMethod('get')
Server.prototype.head = buildVerbMethod('head')
Server.prototype.post = buildVerbMethod('post')
Server.prototype.put = buildVerbMethod('put')
Server.prototype.delete = buildVerbMethod('delete')
Server.prototype.trace = buildVerbMethod('trace')

// singleton
module.exports = new Server()

// generate a method for http request methods matching `verb`
// if a route is passed, the node module `path-to-regexp` is
// used to create the RegExp that will test requests for this route
function buildVerbMethod (verb) {
  return function () {
    var args = [].slice.call(arguments, 0)
    var route = typeof arguments[0] === 'string' ? args.shift() : null

    var handler = function (req, res, next) {
      if (!(req.method && req.method.toLowerCase() === verb)) {
        next()
      }

      // push the next route on to the bottom of callback stack in case none of these callbacks send a response
      args.push(next)
      var doCallbacks = function (i) {
        return function (err) {
          if (err) return next(err)

          args[i](req, res, doCallbacks(++i))
        }
      }

      doCallbacks(0)()
    }

    // if there is a route provided, only call for matching requests
    if (route) {
      return this.app.use(route, handler)
    }

    // if no route is provided, call this for all requests
    this.app.use(handler)
  }
}

function onListening (server) {
  var env = config.get('env')

  var address = server.address()

  var startText = '\n\n'
  startText += '  ----------------------------\n'
  startText += '  ' + config.get('app.name').green + '\n'
  startText += "  Started 'DADI API'\n"
  startText += '  ----------------------------\n'
  startText += '  Server:      '.green + address.address + ':' + address.port + '\n'
  startText += '  Version:     '.green + version + '\n'
  startText += '  Node.JS:     '.green + nodeVersion + '\n'
  startText += '  Environment: '.green + env + '\n'
  startText += '  ----------------------------\n'

  startText += '\n\n  Copyright ' + String.fromCharCode(169) + ' 2015-' + new Date().getFullYear() + ' DADI+ Limited (https://dadi.tech)'.white + '\n'

  if (env !== 'test') {
    console.log(startText)
  }
}

function onError (err) {
  if (err.code === 'EADDRINUSE') {
    console.log('Error ' + err.code + ': Address ' + config.get('server.host') + ':' + config.get('server.port') + ' is already in use, is something else listening on port ' + config.get('server.port') + '?\n\n')
    process.exit(0)
  }
}
