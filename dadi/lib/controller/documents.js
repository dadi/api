const acl = require('./../model/acl')
const config = require('./../../../config')
const Controller = require('./index')
const help = require('./../help')
const modelStore = require('../model/')
const searchModel = require('./../model/search')
const url = require('url')
const workQueue = require('../workQueue')

const MAX_SEARCH_PAGE_SIZE = 50

const Collection = function(server) {
  this.server = server
}

Collection.prototype = new Controller()

Collection.prototype.config = async function(req, res, next) {
  const method = req.method && req.method.toLowerCase()

  if (method !== 'get') {
    return next()
  }

  const {collectionModel: model} = req

  if (!model) {
    return next()
  }

  const access = await acl.access.get(req.dadiApiClient, model.aclKey)

  // The client can read the schema if they have any type of access (i.e. create,
  // delete, read or update) to the collection resource.
  if (!access.create || !access.delete || !access.read || !access.update) {
    return help.sendBackJSON(401, res, next)(new Error('UNAUTHORISED'))
  }

  const response = {
    fields: model.schema,
    settings: model.settings
  }

  return help.sendBackJSON(200, res, next)(null, response)
}

Collection.prototype.count = workQueue.wrapForegroundJob(async function(
  req,
  res,
  next
) {
  const method = req.method && req.method.toLowerCase()

  if (method !== 'get') {
    return next()
  }

  const {collectionModel: model} = req

  if (!model) {
    return next()
  }

  const options = url.parse(req.url, true).query
  const query = this._prepareQuery(req, model)
  const queryOptions = this._prepareQueryOptions(options, model)

  if (queryOptions.errors.length !== 0) {
    return help.sendBackJSON(400, res, next)(null, queryOptions)
  }

  try {
    const stats = await model.count({
      client: req.dadiApiClient,
      options: queryOptions.queryOptions,
      query
    })

    return help.sendBackJSON(200, res, next)(null, stats)
  } catch (error) {
    return help.sendBackJSON(null, res, next)(error)
  }
})

Collection.prototype.delete = workQueue.wrapForegroundJob(async function(
  req,
  res,
  next
) {
  const {collectionModel: model} = req

  if (!model) {
    return next()
  }

  const {collection, id, property} = req.params
  const query = id ? {_id: id} : req.body.query

  if (!query) return next()

  // Flush cache for DELETE requests.
  help.clearCache(`/${property}/${collection}`)

  try {
    const {deletedCount, totalCount} = await model.delete({
      client: req.dadiApiClient,
      description: req.body && req.body.description,
      query,
      req
    })

    // Send 200 with JSON payload if `feedback` is enabled.
    if (config.get('feedback')) {
      return help.sendBackJSON(200, res, next)(null, {
        status: 'success',
        message: 'Documents deleted successfully',
        deleted: deletedCount,
        totalCount
      })
    }

    // Send 204 with no content if not.
    res.statusCode = 204
    res.end()
  } catch (error) {
    return help.sendBackJSON(200, res, next)(error)
  }
})

Collection.prototype.genericRoute = function(req, res, next) {
  try {
    // Map request method to controller method.
    const method = req.params.action || (req.method && req.method.toLowerCase())

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
}

Collection.prototype.get = workQueue.wrapForegroundJob(async function(
  req,
  res,
  next
) {
  const {collectionModel: model} = req

  if (!model) {
    return next()
  }

  const {id} = req.params
  const parsedUrl = url.parse(req.url, true)
  const {query: options} = parsedUrl
  const callback = options.callback || model.settings.callback

  // Determine if the client supplied a JSONP callback.
  const done = callback
    ? help.sendBackJSONP(callback, res, next)
    : help.sendBackJSON(200, res, next)
  const query = this._prepareQuery(req, model)
  const queryOptions = this._prepareQueryOptions(options, model)

  if (queryOptions.errors.length !== 0) {
    return help.sendBackJSON(400, res, next)(null, queryOptions)
  }

  try {
    const results = await model.get({
      client: req.dadiApiClient,
      language: options.lang,
      query,
      options: queryOptions.queryOptions,
      req,
      version: id && options.version
    })

    if (results.metadata) {
      results.metadata = this._addPaginationUrlsToMetadata(
        parsedUrl,
        results.metadata
      )
    }

    return done(null, results, req)
  } catch (error) {
    return done(error)
  }
})

Collection.prototype.hasCaching = function(req) {
  return Boolean(this.settings && this.settings.cache)
}

Collection.prototype.post = workQueue.wrapForegroundJob(async function(
  req,
  res,
  next
) {
  const {collectionModel: model} = req

  if (!model) {
    return next()
  }

  const {collection, id, property} = req.params
  const path = url.parse(req.url, true)
  const options = path.query

  // Flush cache for DELETE requests.
  help.clearCache(`/${property}/${collection}`)

  // We're looking at an update if there is a document ID present in the URL
  // or there is an `update` property in the body.
  if (id || req.body.update) {
    let description
    let query = {}
    let update = {}

    if (id) {
      query._id = id
      update = req.body
    } else {
      description = req.body.description
      query = req.body.query
      update = req.body.update
    }

    try {
      const result = await model.update({
        client: req.dadiApiClient,
        compose: options.compose,
        description,
        query,
        req,
        update
      })

      return help.sendBackJSON(200, res, next)(null, result)
    } catch (error) {
      return help.sendBackJSON(500, res, next)(error)
    }
  }

  try {
    const result = await model.create({
      client: req.dadiApiClient,
      compose: options.compose,
      documents: req.body,
      req
    })

    return help.sendBackJSON(200, res, next)(null, result)
  } catch (error) {
    return help.sendBackJSON(200, res, next)(error)
  }
})

Collection.prototype.put = function(req, res, next) {
  return this.post(req, res, next)
}

Collection.prototype.registerRoutes = function(route) {
  // Creating config route.
  this.server.app.use(`${route}/config`, this.config)

  // Creating generic route.
  this.server.app.use(
    `${route}/:id(${this.ID_PATTERN})?/:action(count|search|stats|versions)?`,
    this.genericRoute.bind(this)
  )
}

Collection.prototype.search = async function(req, res, next) {
  const {collectionModel: model} = req

  if (!model) {
    return next()
  }

  const minimumQueryLength = config.get('search.minQueryLength')
  const path = url.parse(req.url, true)
  const {lang: language, q: query} = path.query
  const {errors, queryOptions} = this._prepareQueryOptions(path.query, {
    settings: {
      count: 10
    }
  })

  if (!config.get('search.enabled')) {
    const error = new Error('Not Implemented')

    error.statusCode = 501
    error.json = {
      errors: [
        {
          message: `Search is disabled or an invalid data connector has been specified.`
        }
      ]
    }

    return help.sendBackJSON(null, res, next)(error)
  }

  if (errors.length !== 0) {
    return help.sendBackJSON(400, res, next)(null, queryOptions)
  }

  const requestErrors = []

  if (typeof query !== 'string' || query.length < minimumQueryLength) {
    requestErrors.push({
      message: `Search query must be at least ${minimumQueryLength} characters.`
    })
  }

  if (queryOptions.limit > MAX_SEARCH_PAGE_SIZE) {
    requestErrors.push({
      message: `Page size for search queries must not be larger than ${MAX_SEARCH_PAGE_SIZE} results.`
    })
  }

  if (requestErrors.length > 0) {
    const error = new Error('Bad Request')

    error.statusCode = 400
    error.json = {
      errors: requestErrors
    }

    return help.sendBackJSON(null, res, next)(error)
  }

  try {
    await model.validateAccess({
      client: req.dadiApiClient,
      type: 'read'
    })

    const response = await searchModel.find({
      client: req.dadiApiClient,
      collections: [`${model.property}/${model.name}`],
      fields: queryOptions.fields,
      language,
      modelFactory: modelStore,
      page: queryOptions.page,
      pageSize: queryOptions.limit,
      query
    })

    return help.sendBackJSON(200, res, next)(null, response)
  } catch (error) {
    return help.sendBackJSON(null, res, next)(error)
  }
}

Collection.prototype.stats = workQueue.wrapForegroundJob(async function(
  req,
  res,
  next
) {
  const {collectionModel: model} = req

  if (!model) {
    return next()
  }

  const method = req.method && req.method.toLowerCase()

  if (method !== 'get') {
    return next()
  }

  try {
    const stats = await model.getStats({
      client: req.dadiApiClient
    })

    return help.sendBackJSON(200, res, next)(null, stats)
  } catch (error) {
    return help.sendBackJSON(null, res, next)(error)
  }
})

Collection.prototype.unregisterRoutes = function(route) {
  this.server.app.unuse(`${route}/config`)
  this.server.app.unuse(
    `${route}/:id(${this.ID_PATTERN})?/:action(count|search|stats|versions)?`
  )
}

Collection.prototype.versions = workQueue.wrapForegroundJob(async function(
  req,
  res,
  next
) {
  const {collectionModel: model} = req

  if (!model) {
    return next()
  }

  const method = req.method && req.method.toLowerCase()

  if (method !== 'get') {
    return next()
  }

  try {
    const response = await model.getVersions({
      client: req.dadiApiClient,
      documentId: req.params.id
    })

    return help.sendBackJSON(200, res, next)(null, response)
  } catch (error) {
    return help.sendBackJSON(null, res, next)(error)
  }
})

module.exports = function(model, server) {
  return new Collection(model, server)
}

module.exports.Controller = Collection
