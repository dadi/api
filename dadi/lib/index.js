var nodeVersion = Number(process.version.match(/^v(\d+\.\d+)/)[1])
var version = require('../../package.json').version

var bodyParser = require('body-parser')
var chokidar = require('chokidar')
var cluster = require('cluster')
var colors = require('colors') // eslint-disable-line
var debug = require('debug')('api:server')
var parsecomments = require('parse-comments')
var fs = require('fs')
var mkdirp = require('mkdirp')
var path = require('path')
var _ = require('underscore')

var acl = require(path.join(__dirname, '/model/acl'))
var api = require(path.join(__dirname, '/api'))
var AuthMiddleware = require(path.join(__dirname, '/auth'))
var cache = require(path.join(__dirname, '/cache'))
var Connection = require(path.join(__dirname, '/model/connection'))
var cors = require(path.join(__dirname, '/cors'))
var ApiConfigController = require(path.join(__dirname, '/controller/apiConfig'))
var CacheFlushController = require(path.join(__dirname, '/controller/cacheFlush'))
var ClientsController = require(path.join(__dirname, '/controller/clients'))
var CollectionsController = require(path.join(__dirname, '/controller/collections'))
var DocumentController = require(path.join(__dirname, '/controller/documents'))
var FeatureQueryHandler = require(path.join(__dirname, '/controller/featureQueryHandler'))
var EndpointController = require(path.join(__dirname, '/controller/endpoint'))
var EndpointsController = require(path.join(__dirname, '/controller/endpoints'))
var HooksController = require(path.join(__dirname, '/controller/hooks'))
var LanguagesController = require(path.join(__dirname, '/controller/languages'))
var MediaController = require(path.join(__dirname, '/controller/media'))
var ResourcesController = require(path.join(__dirname, '/controller/resources'))
var RolesController = require(path.join(__dirname, '/controller/roles'))
var SearchIndexController = require(path.join(__dirname, '/controller/searchIndex'))
var StatusEndpointController = require(path.join(__dirname, '/controller/status'))
var dadiBoot = require('@dadi/boot')
var help = require(path.join(__dirname, '/help'))
var Model = require(path.join(__dirname, '/model'))
var mediaModel = require(path.join(__dirname, '/model/media'))
var monitor = require(path.join(__dirname, '/monitor'))

var config = require(path.join(__dirname, '/../../config'))

var log = require('@dadi/logger')
log.init(config.get('logging'), {}, process.env.NODE_ENV)

if (config.get('env') !== 'test') {
  // add timestamps in front of log messages
  require('console-stamp')(console, 'yyyy-mm-dd HH:MM:ss.l')
}

// add an optional id component to the path, that is formatted to be matched by the `path-to-regexp` module
// var idParam = ':id([a-fA-F0-9-]*)?'
// TODO: allow configurable id param?

var Server = function () {
  this.COMPONENT_TYPE = {
    COLLECTION: 1,
    CUSTOM_ENDPOINT: 2,
    MEDIA_COLLECTION: 3
  }

  this.components = {}
  this.monitors = {}
  this.docs = {}
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

            if (config.get('env') !== 'test') {
              dadiBoot.stopped()
            }

            process.exit(0)
          }
        })
      })
    }
  } else {
    // Single thread start
    debug('Starting DADI API in single thread mode')

    this.start(function () {
      debug('Process ' + process.pid + ' is listening for incoming requests')
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
  this.readyState = 2

  // Initialise the ACL.
  acl.connect()

  if (config.get('env') !== 'test') {
    dadiBoot.start(require('../../package.json'))
  }

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

  app.use(bodyParser.json({ limit: '50mb',
    type: req => {
      let contentType = req.headers['content-type'] || ''
      if (['text/plain', 'text/plain; charset=utf-8', 'application/json', 'application/json; charset=utf-8'].includes(contentType.toLowerCase())) {
        let parts = req.url.split('/').filter(Boolean)

        // don't allow parsing into JSON if:
        if (
          parts[parts.length - 1] === 'config' && // if it's a config URL
          (parts.length === 3 || // and it's an endpoint file being posted
          parts.includes('hooks')) // or it's a hook file being posted
        ) {
          return false
        }

        // else allow parsing into JSON
        return true
      } else {
        // not a content-type that supports JSON
        return false
      }
    }
  }))
  app.use(bodyParser.urlencoded({ extended: true, limit: '50mb' }))
  app.use(bodyParser.text({ limit: '50mb' }))

  cors(this)

  // update configuration based on domain
  var domainConfigLoaded
  app.use(function (req, res, next) {
    if (domainConfigLoaded) return next()
    config.updateConfigDataForDomain(req.headers.host)
    domainConfigLoaded = true
    return next()
  })

  // Attach feature query handler.
  FeatureQueryHandler(app)

  // configure authentication middleware
  AuthMiddleware(app)

  // request logging middleware
  app.use(log.requestLogger)

  this.loadConfigApi()

  // caching layer
  cache(this).init()

  // start listening
  var server = this.server = app.listen()

  server.on('listening', function () { onListening(this) })
  server.on('error', onError)

  this.loadApi(options)

  ClientsController(this)
  CollectionsController(this)
  EndpointsController(this)
  HooksController(this, options.hookPath)
  LanguagesController(this)
  ResourcesController(this)
  RolesController(this)
  SearchIndexController(this)

  this.readyState = 1

  // this is all sync, so callback isn't really necessary.
  done && done()
}

// this is mostly needed for tests
Server.prototype.stop = function (done) {
  var self = this
  this.readyState = 3

  Object.keys(this.monitors).forEach(this.removeMonitor.bind(this))

  Object.keys(this.components).forEach(route => {
    this.removeComponent(route, this.components[route])
  })

  this.server.close(function (err) {
    self.readyState = 0

    Connection.resetConnections().then(() => {
      if (typeof done === 'function') {
        done(err)
      }
    })
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

  this.loadMediaCollections()

  CacheFlushController(this)
  StatusEndpointController(this)

  this.app.use('/hello', function (req, res, next) {
    var method = req.method && req.method.toLowerCase()

    if (method !== 'get') {
      return next()
    }

    res.statusCode = 200
    return res.end('Welcome to API')
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
  ApiConfigController(this)
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

  var collections = fs.readdirSync(collectionsPath)
  var mediaBuckets = config.get('media.buckets')
  var defaultMediaBucket = config.get('media.defaultBucket')

  // Loading collections
  collections.forEach(collection => {
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

    if (name === defaultMediaBucket || mediaBuckets.indexOf(name) !== -1) {
      throw new Error(`Naming conflict: '${name}' is defined as both a collection and media bucket`)
    }

    // override the default name using the supplied property
    if (schema.hasOwnProperty('model')) name = schema.model

    this.addCollectionResource({
      route: `/${version}/${database}/${name}`,
      filepath: cpath,
      name: name,
      schema: schema,
      database: database
    })
  })
}

Server.prototype.loadMediaCollections = function () {
  var mediaBuckets = config.get('media.buckets')
  var defaultMediaBucket = config.get('media.defaultBucket')

  // Loading media collections
  var mediaSchema = mediaModel.getSchema()

  // Adding default media bucket (on root URL)
  this.addMediaCollectionResource({
    route: '/media',
    name: defaultMediaBucket,
    schema: mediaSchema,
    database: 'media'
  })

  // Adding default media bucket (on its own endpoint)
  this.addMediaCollectionResource({
    route: ['', 'media', defaultMediaBucket].join('/'),
    name: defaultMediaBucket,
    schema: mediaSchema,
    database: 'media'
  })

  mediaBuckets.forEach(mediaCollection => {
    this.addMediaCollectionResource({
      route: ['', 'media', mediaCollection].join('/'),
      name: mediaCollection,
      schema: mediaSchema,
      database: 'media'
    })
  })
}

/**
 * With each schema we create a model.
 * With each model we create a controller, that acts as a component of the REST api.
 * We then add the component to the api by adding a route to the app and mapping
 * req.method` to component methods
 */
Server.prototype.addCollectionResource = function (options) {
  let fields = help.getFieldsFromSchema(options.schema)
  let settings = Object.assign({}, options.schema.settings, { database: options.database })
  let model = Model(options.name, JSON.parse(fields), null, settings, settings.database)
  let isMediaCollection = settings.type && settings.type === 'mediaCollection'
  let controller = isMediaCollection
    ? MediaController(model, this)
    : DocumentController(model, this)
  let componentType = isMediaCollection
    ? this.COMPONENT_TYPE.MEDIA_COLLECTION
    : this.COMPONENT_TYPE.COLLECTION

  this.addComponent({
    route: options.route,
    component: controller,
    filepath: options.filepath
  }, componentType)

  acl.registerResource(
    model.aclKey,
    `${options.database}/${options.name} collection`
  )

  // Watch the schema's file and update it in place.
  this.addMonitor(options.filepath, filename => {
    // Invalidate schema file cache then reload.
    delete require.cache[options.filepath]

    try {
      let schemaObj = require(options.filepath)
      let fields = help.getFieldsFromSchema(schemaObj)

      this.components[options.route].model.schema = JSON.parse(fields)
      this.components[options.route].model.settings = schemaObj.settings
    } catch (e) {
      // If file was removed, "un-use" this component.
      if (e && e.code === 'ENOENT') {
        this.removeMonitor(options.filepath)
        this.removeComponent(options.route, controller)
      }
    }
  })
}

Server.prototype.addMediaCollectionResource = function (options) {
  let aclKey = `media:${options.name}`
  let model = Model(
    options.name,
    options.schema.fields,
    null,
    Object.assign({}, options.schema.settings, {
      aclKey
    })
  )
  let controller = MediaController(model, this)

  acl.registerResource(
    aclKey,
    `${options.name} media bucket`
  )

  this.addComponent({
    route: options.route,
    component: controller
  }, this.COMPONENT_TYPE.MEDIA_COLLECTION)

  if (config.get('env') !== 'test') {
    debug('collection loaded: %s', options.name)
  }
}

Server.prototype.updateEndpoints = function (endpointsPath) {
  let endpoints = fs.readdirSync(endpointsPath)

  endpoints.forEach(endpoint => {
    // Parse the url out of the directory structure.
    let filePath = path.join(endpointsPath, endpoint)
    let directories = filePath.split(path.sep)
    let version = directories[directories.length - 2]

    this.addEndpointResource({
      version,
      endpoint,
      filepath: filePath
    })
  })
}

Server.prototype.addEndpointResource = function (options) {
  let endpoint = options.endpoint

  if ((endpoint.indexOf('.') === 0 || endpoint.indexOf('endpoint.') !== 0)) {
    return
  }

  let name = endpoint.slice(endpoint.indexOf('.') + 1, endpoint.indexOf('.js'))
  let aclKey = `endpoint:${options.version}_${name}`
  let filepath = options.filepath
  let route = `/${options.version}/${name}`
  let component

  delete require.cache[filepath]

  try {
    fs.readFile(filepath, 'utf8', (err, content) => {
      if (err) {
        return console.log(err)
      }

      acl.registerResource(
        aclKey,
        `${options.version}/${name} custom endpoint`
      )

      component = EndpointController(
        require(filepath),
        this,
        aclKey
      )

      this.addComponent({
        aclKey,
        docs: parsecomments(content),
        component,
        filepath,
        route
      }, this.COMPONENT_TYPE.CUSTOM_ENDPOINT)
    })
  } catch (e) {
    console.log(e)
  }

  this.addMonitor(filepath, filename => {
    delete require.cache[filepath]

    try {
      require(filepath)
    } catch (e) {
      // If file was removed, "un-use" this component.
      if (e && e.code === 'ENOENT') {
        this.removeMonitor(filepath)
        this.removeComponent(route, component)
      }
    }
  })

  if (config.get('env') !== 'test') {
    debug('endpoint loaded: %s', name)
  }
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
    } catch (err) {
      // if file was removed "un-use" this component
      self.removeMonitor(filepath)
      self.removeComponent(opts.route)
    }
  })

  if (config.get('env') !== 'test') debug('hook loaded: %s', name)
}

Server.prototype.addComponent = function (options, type) {
  // Check if the endpoint is supplying a custom config block.
  if (typeof options.component.getConfig === 'function') {
    let componentConfig = options.component.getConfig()

    if (componentConfig && componentConfig.route) {
      options.route = componentConfig.route
    }
  }

  // Remove it before reloading.
  if (this.components[options.route]) {
    this.removeComponent(options.route, options.component)
  }

  options.component._type = type

  // Add controller.
  this.components[options.route] = options.component

  // Add documentation.
  this.docs[options.route] = options.docs

  // Let the controller register the routes it needs.
  if (typeof options.component.registerRoutes === 'function') {
    options.component.registerRoutes(options.route, options.filepath)
  }
}

Server.prototype.removeComponent = function (route, component) {
  if (this.app.paths[route]) {
    this.app.unuse(route)
  }

  if (component && (typeof component.unregisterRoutes === 'function')) {
    component.unregisterRoutes(route)
  }

  delete this.components[route]

  // remove documentation by path
  delete this.docs[route]
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
  const address = server.address()
  const env = config.get('env')

  if (env !== 'test') {
    dadiBoot.started({
      server: `${config.get('server.protocol')}://${address.address}:${address.port}`,
      header: {
        app: config.get('app.name')
      },
      body: {
        'Protocol': config.get('server.protocol'),
        'Version': version,
        'Node.js': nodeVersion,
        'Environment': env
      },
      footer: {}
    })

    let pkg
    try {
      pkg = require(path.join(process.cwd(), 'package.json'))

      require('@dadi/et')({
        package: {
          name: pkg.name
        },
        productPackage: {
          name: require('../../package.json').name,
          version: require('../../package.json').version
        },
        customData: {},
        event: 'boot',
        environment: config.get('env')
      })
    } catch (err) {
      console.log(err)
    }
  }
}

function onError (err) {
  if (err.code === 'EADDRINUSE') {
    console.log('Error ' + err.code + ': Address ' + config.get('server.host') + ':' + config.get('server.port') + ' is already in use, is something else listening on port ' + config.get('server.port') + '?\n\n')
    process.exit(1)
  }
}
