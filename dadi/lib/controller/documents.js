const acl = require('./../model/acl')
const config = require('./../../../config')
const Controller = require('./index')
const debug = require('debug')('api:controller')
const help = require('./../help')
const model = require('../model')
const searchModel = require('./../model/search')
const url = require('url')
const workQueue = require('../workQueue')

const Collection = function (model, server) {
  if (!model) throw new Error('Model instance required')

  this.model = model
  this.server = server
}

Collection.prototype = new Controller()

Collection.prototype.count = workQueue.wrapForegroundJob(function (req, res, next) {
  let method = req.method && req.method.toLowerCase()

  if (method !== 'get') {
    return next()
  }

  let options = url.parse(req.url, true).query

  let query = this._prepareQuery(req)
  let queryOptions = this._prepareQueryOptions(options)

  if (queryOptions.errors.length !== 0) {
    return help.sendBackJSON(400, res, next)(null, queryOptions)
  }

  queryOptions = queryOptions.queryOptions

  this.model.count({
    client: req.dadiApiClient,
    options: queryOptions,
    query
  }).then(stats => {
    return help.sendBackJSON(200, res, next)(null, stats)
  }).catch(error => {
    return help.sendBackJSON(null, res, next)(error)
  })
})

Collection.prototype.delete = workQueue.wrapForegroundJob(function (req, res, next) {
  let query = req.params.id ? { _id: req.params.id } : req.body.query

  if (!query) return next()

  let pathname = url.parse(req.url).pathname

  // Remove id param so we still get a valid handle
  // on the model name for clearing the cache.
  pathname = pathname.replace('/' + req.params.id, '')

  // flush cache for DELETE requests
  help.clearCache(pathname)

  this.model.delete({
    client: req.dadiApiClient,
    description: req.body && req.body.description,
    query,
    req
  }).then(({deletedCount, totalCount}) => {
    if (config.get('feedback')) {
      // Send 200 with JSON payload.
      return help.sendBackJSON(200, res, next)(null, {
        status: 'success',
        message: 'Documents deleted successfully',
        deleted: deletedCount,
        totalCount
      })
    }

    // Send 200 with no content.
    res.statusCode = 204
    res.end()
  }).catch(error => {
    return help.sendBackJSON(200, res, next)(error)
  })
})

Collection.prototype.get = workQueue.wrapForegroundJob(function (req, res, next) {
  let options = this._getURLParameters(req.url)
  let callback = options.callback || this.model.settings.callback

  // Determine if this is JSONP.
  let done = callback
    ? help.sendBackJSONP(callback, res, next)
    : help.sendBackJSON(200, res, next)
  let query = this._prepareQuery(req)
  let queryOptions = this._prepareQueryOptions(options)

  if (queryOptions.errors.length !== 0) {
    done = help.sendBackJSON(400, res, next)

    return done(null, queryOptions)
  } else {
    queryOptions = queryOptions.queryOptions
  }

  return this.model.get({
    client: req.dadiApiClient,
    language: options.lang,
    query,
    options: queryOptions,
    req,
    version: req.params.id && options.version
  }).then(results => {
    return done(null, results, req)
  }).catch(error => {
    return done(error)
  })
})

Collection.prototype.post = workQueue.wrapForegroundJob(function (req, res, next) {
  // Add internal fields.
  let internals = {
    _apiVersion: req.url.split('/')[1]
  }
  let pathname = url.parse(req.url).pathname
  let path = url.parse(req.url, true)
  let options = path.query

  // Remove id param if it's an update, so we still
  // get a valid handle on the model name for clearing
  // the cache.
  pathname = pathname.replace('/' + req.params.id, '')

  debug('POST %s %o', pathname, req.params)

  // Flush cache for POST requests.
  help.clearCache(pathname)

  // If id is present in the url, then this is an update.
  if (req.params.id || req.body.update) {
    internals._lastModifiedBy = req.dadiApiClient && req.dadiApiClient.clientId

    let description
    let query = {}
    let update = {}

    if (req.params.id) {
      query._id = req.params.id
      update = req.body
    } else {
      description = req.body.description
      query = req.body.query
      update = req.body.update
    }

    // Add the apiVersion filter.
    if (config.get('query.useVersionFilter')) {
      query._apiVersion = internals._apiVersion
    }

    return this.model.update({
      client: req.dadiApiClient,
      compose: options.compose,
      description,
      internals,
      query,
      req,
      update
    }).then(result => {
      return help.sendBackJSON(200, res, next)(null, result)
    }).catch(error => {
      return help.sendBackJSON(500, res, next)(error)
    })
  }

  // if no id is present, then this is a create
  internals._createdBy = req.dadiApiClient && req.dadiApiClient.clientId

  return this.model.create({
    client: req.dadiApiClient,
    compose: options.compose,
    documents: req.body,
    internals,
    req
  }).then(result => {
    return help.sendBackJSON(200, res, next)(null, result)
  }).catch(error => {
    return help.sendBackJSON(200, res, next)(error)
  })
})

Collection.prototype.put = function (req, res, next) {
  return this.post(req, res, next)
}

Collection.prototype.registerRoutes = function (route, filePath) {
  // Creating config route.
  this.server.app.use(`${route}/config`, (req, res, next) => {
    if (!filePath) {
      return next()
    }

    let method = req.method && req.method.toLowerCase()

    if (method !== 'get') {
      return next()
    }

    // The client can read the schema if they have any type of access (i.e. create,
    // delete, read or update) to the collection resource.
    let aclKey = this.model.aclKey

    return acl.access.get(req.dadiApiClient, aclKey).then(access => {
      if (!access.create || !access.delete || !access.read || !access.update) {
        return help.sendBackJSON(401, res, next)(
          new Error('UNAUTHORISED')
        )
      }

      return help.sendBackJSON(200, res, next)(null, require(filePath))
    })
  })

  // Creating generic route.
  this.server.app.use(`${route}/:id(${this.ID_PATTERN})?/:action(count|search|stats|versions)?`, (req, res, next) => {
    try {
      // Map request method to controller method.
      let method = req.params.action || (req.method && req.method.toLowerCase())

      if (method && this[method]) {
        return this[method](req, res, next)
      }

      if (method === 'options') {
        return help.sendBackJSON(200, res, next)(null, null)
      }
    } catch (err) {
      help.sendBackErrorTrace(res, next)(err)
    }

    next()
  })
}

Collection.prototype.search = function (req, res, next) {
  const minimumQueryLength = config.get('search.minQueryLength')
  const path = url.parse(req.url, true)
  const {lang: language, q: query} = path.query
  const {errors, queryOptions} = this._prepareQueryOptions(path.query)

  if (!config.get('search.enabled')) {
    const error = new Error('Not Implemented')

    error.statusCode = 501
    error.json = {
      errors: [{
        message: `Search is disabled or an invalid data connector has been specified.`
      }]
    }

    return help.sendBackJSON(null, res, next)(error)
  }

  if (errors.length !== 0) {
    return help.sendBackJSON(400, res, next)(null, queryOptions)
  }

  if (typeof query !== 'string' || query.length < minimumQueryLength) {
    const error = new Error('Bad Request')

    error.statusCode = 400
    error.json = {
      errors: [{
        message: `Search query must be at least ${minimumQueryLength} characters.`
      }]
    }

    return help.sendBackJSON(null, res, next)(error)
  }

  return this.model.validateAccess({
    client: req.dadiApiClient,
    type: 'read'
  }).then(() => {
    return searchModel.find({
      collections: [this.model.name],
      fields: queryOptions.fields,
      language,
      modelFactory: model,
      query,
      sort: queryOptions.sort
    })
  }).then(response => {
    return help.sendBackJSON(200, res, next)(null, response)
  }).catch(error => {
    return help.sendBackJSON(null, res, next)(error)
  })
}

Collection.prototype.stats = workQueue.wrapForegroundJob(function (req, res, next) {
  let method = req.method && req.method.toLowerCase()

  if (method !== 'get') {
    return next()
  }

  this.model.getStats({
    client: req.dadiApiClient
  }).then(stats => {
    return help.sendBackJSON(200, res, next)(null, stats)
  }).catch(error => {
    return help.sendBackJSON(null, res, next)(error)
  })
})

Collection.prototype.unregisterRoutes = function (route) {
  this.server.app.unuse(`${route}/config`)
  this.server.app.unuse(`${route}/:id(${this.ID_PATTERN})?/:action(count|search|stats|versions)?`)
}

Collection.prototype.versions = workQueue.wrapForegroundJob(function (req, res, next) {
  let method = req.method && req.method.toLowerCase()

  if (method !== 'get') {
    return next()
  }

  this.model.getVersions({
    client: req.dadiApiClient,
    documentId: req.params.id
  }).then(response => {
    return help.sendBackJSON(200, res, next)(null, response)
  }).catch(error => {
    return help.sendBackJSON(null, res, next)(error)
  })
})

module.exports = function (model, server) {
  return new Collection(model, server)
}

module.exports.Controller = Collection
