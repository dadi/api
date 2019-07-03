const acl = require('../model/acl')
const config = require('../../../config')
const Controller = require('./index')
const help = require('../help')
const Model = require('../model')
const schemaStore = require('../model/schemaStore')
const searchModel = require('../model/search')
const url = require('url')
const workQueue = require('../workQueue')

const Collection = function(server) {
  this.server = server
}

Collection.prototype = new Controller()

Collection.prototype.count = workQueue.wrapForegroundJob(async function(
  req,
  res,
  next
) {
  const method = req.method && req.method.toLowerCase()

  if (method !== 'get') {
    return next()
  }

  const {collection, database: property} = req.params

  try {
    const {fields, settings} = await schemaStore.get({
      collection,
      property
    })
    const model = Model({
      name: collection,
      property,
      schema: fields,
      settings
    })
    const options = url.parse(req.url, true).query
    const queryOptions = this._prepareQueryOptions(options, model)

    const stats = await model.count({
      client: req.dadiApiClient,
      options: queryOptions.queryOptions,
      query: this._prepareQuery(req, model)
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
  const query = req.params.id ? {_id: req.params.id} : req.body.query

  if (!query) return next()

  const {collection, database: property} = req.params
  const cacheKey = `/${property}/${collection}`

  // Flush cache for DELETE requests.
  help.clearCache(cacheKey)

  try {
    const {fields, settings} = await schemaStore.get({
      collection,
      property
    })
    const model = Model({
      name: collection,
      property,
      schema: fields,
      settings
    })

    const {deletedCount, totalCount} = model.delete({
      client: req.dadiApiClient,
      description: req.body && req.body.description,
      query,
      req
    })

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
  } catch (error) {
    return help.sendBackJSON(200, res, next)(error)
  }
})

Collection.prototype.get = workQueue.wrapForegroundJob(async function(
  req,
  res,
  next
) {
  const {collection, database: property} = req.params
  const options = this._getURLParameters(req.url)

  try {
    const {fields, settings} = await schemaStore.get({
      collection,
      property
    })
    const model = Model({
      name: collection,
      property,
      schema: fields,
      settings
    })
    const callback = options.callback || settings.callback
    let done = callback
      ? help.sendBackJSONP(callback, res, next)
      : help.sendBackJSON(200, res, next)
    const query = this._prepareQuery(req, model)
    const queryOptions = this._prepareQueryOptions(options, model)

    if (queryOptions.errors.length !== 0) {
      done = help.sendBackJSON(400, res, next)

      return done(null, queryOptions)
    }

    const results = await model.get({
      client: req.dadiApiClient,
      language: options.lang,
      query,
      options: queryOptions.queryOptions,
      req,
      version: req.params.id && options.version
    })

    return done(null, results, req)
  } catch (error) {
    return help.sendBackJSON(200, res, next)(error)
  }
})

Collection.prototype.post = workQueue.wrapForegroundJob(async function(
  req,
  res,
  next
) {
  const {collection, database: property, version} = req.params
  const internals = {
    _apiVersion: version
  }
  const cacheKey = `/${property}/${collection}`
  const parsedUrl = url.parse(req.url, true)
  const {query: options} = parsedUrl

  // Flushing cache for POST requests.
  help.clearCache(cacheKey)

  try {
    const {fields, settings} = await schemaStore.get({
      collection,
      property
    })
    const model = Model({
      name: collection,
      property,
      schema: fields,
      settings
    })

    // This is an update if the URL contains a document ID or the body contains
    // an `update` property.
    if (req.params.id || req.body.update) {
      internals._lastModifiedBy =
        req.dadiApiClient && req.dadiApiClient.clientId

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

      const result = await model.update({
        client: req.dadiApiClient,
        compose: options.compose,
        description,
        internals,
        query,
        req,
        update
      })

      return help.sendBackJSON(200, res, next)(null, result)
    }

    internals._createdBy = req.dadiApiClient && req.dadiApiClient.clientId

    const result = await model.create({
      client: req.dadiApiClient,
      compose: options.compose,
      documents: req.body,
      internals,
      req
    })

    return help.sendBackJSON(200, res, next)(null, result)
  } catch (error) {
    console.log(error)
    return help.sendBackJSON(200, res, next)(error)
  }
})

Collection.prototype.put = function(req, res, next) {
  return this.post(req, res, next)
}

Collection.prototype.registerRoutes = async function(route) {
  this.server.app.use(`${route}/config`, async (req, res, next) => {
    const method = req.method && req.method.toLowerCase()

    if (method !== 'get') {
      return next()
    }

    const {collection, database: property} = req.params

    try {
      const {fields, settings, timestamp} = await schemaStore.get({
        collection,
        property
      })
      const model = Model({
        name: collection,
        property,
        schema: fields,
        settings
      })
      const aclKey = model.getAclKey()

      // The client can read the schema if they have any type of access (i.e. create,
      // delete, read or update) to the collection resource.
      const access = await acl.access.get(req.dadiApiClient, aclKey)

      if (!access.create || !access.delete || !access.read || !access.update) {
        return help.sendBackJSON(401, res, next)(new Error('UNAUTHORISED'))
      }

      const response = {
        collection,
        fields,
        property,
        settings,
        timestamp
      }

      return help.sendBackJSON(200, res, next)(null, response)
    } catch (error) {
      return help.sendBackJSON(404, res, next)(error)
    }
  })

  // Creating generic route.
  this.server.app.use(
    `${route}/:id(${this.ID_PATTERN})?/:action(count|search|stats|versions)?`,
    (req, res, next) => {
      try {
        // Map request method to controller method.
        const method =
          req.params.action || (req.method && req.method.toLowerCase())

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
  )
}

Collection.prototype.search = async function(req, res, next) {
  const {collection, database: property} = req.params
  const path = url.parse(req.url, true)
  const {lang: language, q: query} = path.query

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

  const minimumQueryLength = config.get('search.minQueryLength')

  if (typeof query !== 'string' || query.length < minimumQueryLength) {
    const error = new Error('Bad Request')

    error.statusCode = 400
    error.json = {
      errors: [
        {
          message: `Search query must be at least ${minimumQueryLength} characters.`
        }
      ]
    }

    return help.sendBackJSON(null, res, next)(error)
  }

  try {
    const {fields, settings} = await schemaStore.get({
      collection,
      property
    })
    const model = Model({
      name: collection,
      property,
      schema: fields,
      settings
    })
    const {errors, queryOptions} = this._prepareQueryOptions(path.query, model)

    if (errors.length !== 0) {
      return help.sendBackJSON(400, res, next)(null, queryOptions)
    }

    await model.validateAccess({
      client: req.dadiApiClient,
      type: 'read'
    })

    const response = await searchModel.find({
      client: req.dadiApiClient,
      collections: [`${property}/${collection}`],
      fields: queryOptions.fields,
      language,
      modelFactory: Model,
      query
    })

    return help.sendBackJSON(200, res, next)(null, response)
  } catch (error) {
    console.log(error)
    return help.sendBackJSON(null, res, next)(error)
  }
}

Collection.prototype.stats = workQueue.wrapForegroundJob(function(
  req,
  res,
  next
) {
  const method = req.method && req.method.toLowerCase()

  if (method !== 'get') {
    return next()
  }

  this.model
    .getStats({
      client: req.dadiApiClient
    })
    .then(stats => {
      return help.sendBackJSON(200, res, next)(null, stats)
    })
    .catch(error => {
      return help.sendBackJSON(null, res, next)(error)
    })
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
  const method = req.method && req.method.toLowerCase()

  if (method !== 'get') {
    return next()
  }

  const {collection, database: property} = req.params

  try {
    const {fields, settings} = await schemaStore.get({
      collection,
      property
    })
    const model = Model({
      name: collection,
      property,
      schema: fields,
      settings
    })

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
