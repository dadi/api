const nodeVersion = Number(process.version.match(/^v(\d+\.\d+)/)[1])
const version = require('../../package.json').version

const bodyParser = require('body-parser')
const chokidar = require('chokidar')
const cluster = require('cluster')
var colors = require('colors') // eslint-disable-line
const debug = require('debug')('api:server')
const ParseComments = require('parse-comments')
const fs = require('fs')
const mkdirp = require('mkdirp')
const path = require('path')

const acl = require(path.join(__dirname, '/model/acl'))
const api = require(path.join(__dirname, '/api'))
const AuthMiddleware = require(path.join(__dirname, '/auth'))
const cache = require(path.join(__dirname, '/cache'))
const Connection = require(path.join(__dirname, '/model/connection'))
const cors = require(path.join(__dirname, '/cors'))
const ApiConfigController = require(path.join(
  __dirname,
  '/controller/apiConfig'
))
const CacheFlushController = require(path.join(
  __dirname,
  '/controller/cacheFlush'
))
const ClientsController = require(path.join(__dirname, '/controller/clients'))
const CollectionsController = require(path.join(
  __dirname,
  '/controller/collections'
))
const DocumentController = require(path.join(
  __dirname,
  '/controller/documents'
))
const FeatureQueryHandler = require(path.join(
  __dirname,
  '/controller/featureQueryHandler'
))
const EndpointController = require(path.join(__dirname, '/controller/endpoint'))
const EndpointsController = require(path.join(
  __dirname,
  '/controller/endpoints'
))
const HooksController = require(path.join(__dirname, '/controller/hooks'))
const LanguagesController = require(path.join(
  __dirname,
  '/controller/languages'
))
const MediaController = require(path.join(__dirname, '/controller/media'))
const ResourcesController = require(path.join(
  __dirname,
  '/controller/resources'
))
const RolesController = require(path.join(__dirname, '/controller/roles'))
const SearchController = require(path.join(__dirname, '/controller/search'))
const SearchIndexController = require(path.join(
  __dirname,
  '/controller/searchIndex'
))
const StatusEndpointController = require(path.join(
  __dirname,
  '/controller/status'
))
const dadiBoot = require('@dadi/boot')
const Model = require(path.join(__dirname, '/model'))
const mediaModel = require(path.join(__dirname, '/model/media'))
const monitor = require(path.join(__dirname, '/monitor'))

const config = require(path.join(__dirname, '/../../config'))

const log = require('@dadi/logger')

log.init(config.get('logging'), {}, process.env.NODE_ENV)

if (config.get('env') !== 'test') {
  // add timestamps in front of log messages
  require('console-stamp')(console, 'yyyy-mm-dd HH:MM:ss.l')
}

// add an optional id component to the path, that is formatted to be matched by the `path-to-regexp` module
// var idParam = ':id([a-fA-F0-9-]*)?'
// TODO: allow configurable id param?

const Server = function() {
  this.COMPONENT_TYPE = {
    COLLECTION: 1,
    CUSTOM_ENDPOINT: 2,
    MEDIA_COLLECTION: 3
  }

  this.components = {}
  this.monitors = {}
  this.docs = {}
}

Server.prototype.run = function(done) {
  require('console-stamp')(console, 'yyyy-mm-dd HH:MM:ss.l')

  if (config.get('cluster')) {
    if (cluster.isMaster) {
      const numWorkers = require('os').cpus().length

      log.info(
        'Starting DADI API in cluster mode, using ' + numWorkers + ' workers.'
      )
      log.info('Master cluster setting up ' + numWorkers + ' workers...')

      // Start new workers
      for (let i = 0; i < numWorkers; i++) {
        cluster.fork()
      }

      // New worker alive
      cluster.on('online', function(worker) {
        log.info('Worker ' + worker.process.pid + ' is online')
      })

      // Handle a thread exit, start a new worker
      cluster.on('exit', function(worker, code, signal) {
        log.info(
          'Worker ' +
            worker.process.pid +
            ' died with code: ' +
            code +
            ', and signal: ' +
            signal
        )
        log.info('Starting a new worker')

        cluster.fork()
      })

      // Watch the current directory for a "restart.api" file
      const watcher = chokidar.watch(process.cwd(), {
        depth: 1,
        ignored: /(^|[/\\])\../, // ignores dotfiles, see https://regex101.com/r/7VuO4e/1
        ignoreInitial: true
      })

      watcher.on('add', function(filePath) {
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
      this.start(function() {
        log.info(
          'Process ' + process.pid + ' is listening for incoming requests'
        )

        process.on('message', function(message) {
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

    this.start(function() {
      debug('Process ' + process.pid + ' is listening for incoming requests')
    })
  }

  function restartWorkers() {
    let wid
    const workerIds = []

    for (wid in cluster.workers) {
      workerIds.push(wid)
    }

    workerIds.forEach(function(wid) {
      if (cluster.workers[wid]) {
        cluster.workers[wid].send({
          type: 'shutdown',
          from: 'master'
        })

        setTimeout(function() {
          if (cluster.workers[wid]) {
            cluster.workers[wid].kill('SIGKILL')
          }
        }, 5000)
      }
    })
  }
}

Server.prototype.start = function(done) {
  this.readyState = 2

  // Initialise the ACL.
  acl.connect()

  if (config.get('env') !== 'test') {
    dadiBoot.start(require('../../package.json'))
  }

  const defaultPaths = {
    collections: path.join(__dirname, '/../../workspace/collections'),
    endpoints: path.join(__dirname, '/../../workspace/endpoints')
  }

  let options = {}

  this.loadPaths(config.get('paths') || defaultPaths, function(paths) {
    options = paths
  })

  // create app
  const app = (this.app = api())

  // add necessary middlewares in order below here...

  app.use((req, res, next) => {
    const FAVICON_REGEX = /\/(favicon|(apple-)?touch-icon(-i(phone|pad))?(-\d{2,}x\d{2,})?(-precomposed)?)\.(jpe?g|png|ico|gif)$/i

    if (FAVICON_REGEX.test(req.url)) {
      res.statusCode = 204
      res.end()
    } else {
      next()
    }
  })

  app.use(
    bodyParser.json({
      limit: '50mb',
      type: req => {
        const contentType = req.headers['content-type'] || ''

        if (
          [
            'text/plain',
            'text/plain; charset=utf-8',
            'application/json',
            'application/json; charset=utf-8'
          ].includes(contentType.toLowerCase())
        ) {
          const parts = req.url.split('/').filter(Boolean)

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
        }

        // not a content-type that supports JSON
        return false
      }
    })
  )
  app.use(bodyParser.urlencoded({extended: true, limit: '50mb'}))
  app.use(bodyParser.text({limit: '50mb'}))

  cors(this)

  // update configuration based on domain
  let domainConfigLoaded

  app.use(function(req, res, next) {
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
  const server = (this.server = app.listen())

  server.on('listening', function() {
    onListening(this)
  })
  server.on('error', onError)

  this.loadApi(options)

  ClientsController(this)
  CollectionsController(this)
  EndpointsController(this)
  HooksController(this, options.hookPath)
  LanguagesController(this)
  ResourcesController(this)
  RolesController(this)
  SearchController(this)
  SearchIndexController(this)

  this.readyState = 1

  // this is all sync, so callback isn't really necessary.
  done && done()
}

// this is mostly needed for tests
Server.prototype.stop = function(done) {
  const self = this

  this.readyState = 3

  Object.keys(this.monitors).forEach(this.removeMonitor.bind(this))

  Object.keys(this.components).forEach(route => {
    this.removeComponent(route, this.components[route])
  })

  this.server.close(function(err) {
    self.readyState = 0

    Connection.resetConnections().then(() => {
      if (typeof done === 'function') {
        done(err)
      }
    })
  })
}

Server.prototype.loadPaths = function(paths, done) {
  const self = this
  const options = {}

  options.collectionPath = path.resolve(
    paths.collections || path.join(__dirname, '/../../workspace/collections')
  )
  options.endpointPath = path.resolve(
    paths.endpoints || path.join(__dirname, '/../../workspace/endpoints')
  )
  options.hookPath = path.resolve(
    paths.hooks || path.join(__dirname, '/../../workspace/hooks')
  )

  let idx = 0

  Object.keys(options).forEach(key => {
    try {
      var stats = fs.statSync(options[key]) // eslint-disable-line
    } catch (err) {
      if (err.code === 'ENOENT') {
        self.ensureDirectories(options, function() {
          //
        })
      }
    }

    idx++

    if (idx === Object.keys(options).length) return done(options)
  })
}

Server.prototype.loadApi = function(options) {
  const self = this
  const collectionPath = (this.collectionPath =
    options.collectionPath ||
    path.join(__dirname, '/../../workspace/collections'))
  const endpointPath = (this.endpointPath =
    options.endpointPath || path.join(__dirname, '/../../workspace/endpoints'))
  const hookPath = (this.hookPath =
    options.hookPath || path.join(__dirname, '/../../workspace/hooks'))

  self.updateHooks(hookPath)
  self.addMonitor(hookPath, function(hook) {
    self.updateHooks(hookPath)
  })

  // Load initial api descriptions
  this.updateVersions(collectionPath)

  this.addMonitor(collectionPath, function(versionName) {
    if (path)
      return self.updateDatabases(path.join(collectionPath, versionName))
    self.updateVersions(collectionPath)
  })

  // this.updateEndpoints(endpointPath)
  this.updateVersions(endpointPath)

  this.addMonitor(endpointPath, function(endpointFile) {
    self.updateVersions(endpointPath)
  })

  this.loadMediaCollections()

  CacheFlushController(this)
  StatusEndpointController(this)

  this.app.use('/hello', function(req, res, next) {
    const method = req.method && req.method.toLowerCase()

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

Server.prototype.loadConfigApi = function() {
  ApiConfigController(this)
}

Server.prototype.updateVersions = function(versionsPath) {
  const self = this

  // Load initial api descriptions
  const versions = fs.readdirSync(versionsPath)

  versions.forEach(function(version) {
    if (version.indexOf('.') === 0) return

    const dirname = path.join(versionsPath, version)

    if (dirname.indexOf('collections') > 0) {
      self.updateDatabases(dirname)

      self.addMonitor(dirname, function(databaseName) {
        if (databaseName)
          return self.updateCollections(path.join(dirname, databaseName))
        self.updateDatabases(dirname)
      })
    } else {
      self.updateEndpoints(dirname)

      self.addMonitor(dirname, function(endpoint) {
        self.updateEndpoints(dirname)
      })
    }
  })
}

Server.prototype.updateDatabases = function(databasesPath) {
  const self = this
  let databases

  try {
    databases = fs.readdirSync(databasesPath)
  } catch (e) {
    log.warn({module: 'server'}, databasesPath + ' does not exist')

    return
  }

  databases.forEach(function(database) {
    if (database.indexOf('.') === 0) return

    const dirname = path.join(databasesPath, database)

    self.updateCollections(dirname)

    self.addMonitor(dirname, function(collectionFile) {
      self.updateCollections(dirname)
    })
  })
}

Server.prototype.updateCollections = function(collectionsPath) {
  if (!fs.existsSync(collectionsPath)) return
  if (!fs.lstatSync(collectionsPath).isDirectory()) return

  const collections = fs.readdirSync(collectionsPath)
  const mediaBuckets = config.get('media.buckets')
  const defaultMediaBucket = config.get('media.defaultBucket')

  // Loading collections
  collections.forEach(collection => {
    if (collection.indexOf('.') === 0) return

    // parse the url out of the directory structure
    const cpath = path.join(collectionsPath, collection)
    const dirs = cpath.split(path.sep)
    const version = dirs[dirs.length - 3]
    const database = dirs[dirs.length - 2]

    // collection should be json file containing schema

    // get the schema
    const schema = require(cpath)
    let name = collection.slice(
      collection.indexOf('.') + 1,
      collection.indexOf('.json')
    )

    if (name === defaultMediaBucket || mediaBuckets.indexOf(name) !== -1) {
      throw new Error(
        `Naming conflict: '${name}' is defined as both a collection and media bucket`
      )
    }

    // override the default name using the supplied property
    if (schema.model) {
      name = schema.model
    }

    this.addCollectionResource({
      route: `/${version}/${database}/${name}`,
      filepath: cpath,
      name,
      schema,
      database
    })
  })
}

Server.prototype.loadMediaCollections = function() {
  const mediaBuckets = config.get('media.buckets')
  const defaultMediaBucket = config.get('media.defaultBucket')

  // Loading media collections
  const mediaSchema = mediaModel.getSchema()

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
Server.prototype.addCollectionResource = function(options) {
  const fields = Object.assign({}, options.schema.fields)
  const settings = Object.assign({}, options.schema.settings, {
    database: options.database
  })
  const model = Model(options.name, fields, null, settings, settings.database)
  const isMediaCollection = settings.type && settings.type === 'mediaCollection'
  const controller = isMediaCollection
    ? MediaController(model, this)
    : DocumentController(model, this)
  const componentType = isMediaCollection
    ? this.COMPONENT_TYPE.MEDIA_COLLECTION
    : this.COMPONENT_TYPE.COLLECTION

  this.addComponent(
    {
      route: options.route,
      component: controller,
      filepath: options.filepath
    },
    componentType
  )

  acl.registerResource(
    model.aclKey,
    `${options.database}/${options.name} collection`
  )

  // Watch the schema's file and update it in place.
  this.addMonitor(options.filepath, filename => {
    // Invalidate schema file cache then reload.
    delete require.cache[options.filepath]

    try {
      const schemaObj = require(options.filepath)
      const parsedSchema = JSON.parse(schemaObj)

      this.components[options.route].model.schema = parsedSchema.fields
      this.components[options.route].model.settings = parsedSchema.settings
    } catch (e) {
      // If file was removed, "un-use" this component.
      if (e && e.code === 'ENOENT') {
        this.removeMonitor(options.filepath)
        this.removeComponent(options.route, controller)
      }
    }
  })
}

Server.prototype.addMediaCollectionResource = function(options) {
  const aclKey = `media:${options.name}`
  const model = Model(
    options.name,
    options.schema.fields,
    null,
    Object.assign({}, options.schema.settings, {
      aclKey
    })
  )
  const controller = MediaController(model, this)

  acl.registerResource(aclKey, `${options.name} media bucket`)

  this.addComponent(
    {
      route: options.route,
      component: controller
    },
    this.COMPONENT_TYPE.MEDIA_COLLECTION
  )

  if (config.get('env') !== 'test') {
    debug('collection loaded: %s', options.name)
  }
}

Server.prototype.updateEndpoints = function(endpointsPath) {
  const endpoints = fs.readdirSync(endpointsPath)

  endpoints.forEach(endpoint => {
    // Parse the url out of the directory structure.
    const filePath = path.join(endpointsPath, endpoint)
    const directories = filePath.split(path.sep)
    const version = directories[directories.length - 2]

    this.addEndpointResource({
      version,
      endpoint,
      filepath: filePath
    })
  })
}

Server.prototype.addEndpointResource = function(options) {
  const endpoint = options.endpoint

  if (endpoint.indexOf('.') === 0 || endpoint.indexOf('endpoint.') !== 0) {
    return
  }

  const name = endpoint.slice(
    endpoint.indexOf('.') + 1,
    endpoint.indexOf('.js')
  )
  const aclKey = `endpoint:${options.version}_${name}`
  const filepath = options.filepath
  const route = `/${options.version}/${name}`
  let component

  delete require.cache[filepath]

  try {
    fs.readFile(filepath, 'utf8', (err, content) => {
      if (err) {
        return console.log(err)
      }

      acl.registerResource(aclKey, `${options.version}/${name} custom endpoint`)

      component = EndpointController(require(filepath), this, aclKey)

      this.addComponent(
        {
          aclKey,
          docs: new ParseComments().parse(content),
          component,
          filepath,
          route
        },
        this.COMPONENT_TYPE.CUSTOM_ENDPOINT
      )
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

Server.prototype.updateHooks = function(hookPath) {
  const self = this
  const hooks = fs.readdirSync(hookPath)

  hooks.forEach(function(hook) {
    self.addHook({
      hook,
      filepath: path.join(hookPath, hook)
    })
  })
}

Server.prototype.addHook = function(options) {
  if (path.extname(options.filepath) !== '.js') return
  const hook = options.hook

  const self = this
  const name = hook.replace('.js', '')
  const filepath = options.filepath

  let opts = {}

  delete require.cache[filepath]

  try {
    const content = fs.readFileSync(filepath).toString()

    opts = {
      route: 'hook:' + name,
      component: filepath,
      docs: new ParseComments().parse(content),
      filepath
    }

    self.addComponent(opts)
  } catch (e) {
    console.log(e)
  }

  self.addMonitor(filepath, function(filename) {
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

Server.prototype.addComponent = function(options, type) {
  // Check if the endpoint is supplying a custom config block.
  if (typeof options.component.getConfig === 'function') {
    const componentConfig = options.component.getConfig()

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

Server.prototype.removeComponent = function(route, component) {
  if (this.app.paths[route]) {
    this.app.unuse(route)
  }

  if (component && typeof component.unregisterRoutes === 'function') {
    component.unregisterRoutes(route)
  }

  delete this.components[route]

  // remove documentation by path
  delete this.docs[route]
}

Server.prototype.addMonitor = function(filepath, callback) {
  filepath = path.normalize(filepath)

  // only add one watcher per path
  if (this.monitors[filepath]) return

  const m = monitor(filepath)

  m.on('change', callback)
  this.monitors[filepath] = m
}

Server.prototype.removeMonitor = function(filepath) {
  this.monitors[filepath] && this.monitors[filepath].close()
  delete this.monitors[filepath]
}

// Synchronously create directory structure to match path
Server.prototype.createDirectoryStructure = function(dpath) {
  const self = this

  const directories = dpath.split(path.sep)
  let npath = self.collectionPath

  directories.forEach(function(dirname) {
    npath = path.join(npath, dirname)
    try {
      fs.mkdirSync(npath)
    } catch (err) {
      // noop
    }
  })
}

/**
 *  Create workspace directories if they don't already exist
 *
 *  @param {Object} options Object containing workspace paths
 *  @return
 *  @api public
 */
Server.prototype.ensureDirectories = function(options, done) {
  // create workspace directories if they don't exist
  // permissions default to 0755
  const _0755 = parseInt('0755', 8)

  let idx = 0

  Object.keys(options).forEach(dir => {
    mkdirp(options[dir], _0755, (err, made) => {
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
function buildVerbMethod(verb) {
  return function() {
    const args = [].slice.call(arguments, 0)
    const route = typeof arguments[0] === 'string' ? args.shift() : null

    const handler = function(req, res, next) {
      if (!(req.method && req.method.toLowerCase() === verb)) {
        next()
      }

      // push the next route on to the bottom of callback stack in case none of these callbacks send a response
      args.push(next)

      const doCallbacks = function(i) {
        return function(err) {
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

function onListening(server) {
  const address = server.address()
  const env = config.get('env')

  if (env !== 'test') {
    dadiBoot.started({
      server: `${config.get('server.protocol')}://${address.address}:${
        address.port
      }`,
      header: {
        app: config.get('app.name')
      },
      body: {
        Protocol: config.get('server.protocol'),
        Version: version,
        'Node.js': nodeVersion,
        Environment: env
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

function onError(err) {
  if (err.code === 'EADDRINUSE') {
    console.log(
      'Error ' +
        err.code +
        ': Address ' +
        config.get('server.host') +
        ':' +
        config.get('server.port') +
        ' is already in use, is something else listening on port ' +
        config.get('server.port') +
        '?\n\n'
    )
    process.exit(1)
  }
}
