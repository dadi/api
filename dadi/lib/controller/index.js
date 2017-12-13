/*

Ok, this should create a component that takes a req, res, and next function
and looks at query string and/or body of the request and accesses a given model instance.
This should accept a model instance as an argument, and return an instance that has
POST, GET, and DELETE methods that can be accessed by the request router

This will only be used for *http://{url}/{version number}/{database name}/{collection name}*
type of endpoints

*http://{url}/{version number}/{endpoint name}* type endpoints should create a custom controller that
implements methods corresponding to the HTTP methods it needs to support

*/
var _ = require('underscore')
var debug = require('debug')('api:controller')
var path = require('path')
var url = require('url')

var config = require(path.join(__dirname, '/../../../config'))
var help = require(path.join(__dirname, '/../help'))

// helpers
var sendBackJSON = help.sendBackJSON
var sendBackJSONP = help.sendBackJSONP
var parseQuery = help.parseQuery

function ApiError (status, code, message, title) {
  var err = new Error()
  err.status = status
  err.code = code
  err.title = title || 'API Error'
  err.details = message
  return err
}

function prepareQueryOptions (options, modelSettings) {
  var response = { errors: [] }
  var queryOptions = {}
  var settings = modelSettings || {}

  if (options.page) {
    options.page = parseInt(options.page)
    if (options.page === 0) options.page = 1
  } else {
    options.page = 1
  }

  // ensure we have sane params
  if (options.skip) {
    if (!_.isFinite(options.skip)) {
      response.errors.push(new ApiError('Bad Request', 'Invalid Parameter', 'The `skip` parameter must a number', 'Invalid Skip Parameter Provided'))
    } else if (parseInt(options.skip) < 0) {
      response.errors.push(new ApiError('Bad Request', 'Invalid Parameter', 'The `skip` parameter must be greater than or equal to zero', 'Invalid Skip Parameter Provided'))
    }
  }

  if (options.page && options.page <= 0) {
    response.errors.push(new ApiError('Bad Request', 'Invalid Parameter', 'The `page` parameter must be greater than zero', 'Invalid Page Parameter Provided'))
  }

  // specified / default number of records to return
  let limit = options.count || settings.count

  if (_.isFinite(limit)) {
    limit = parseInt(limit)
  } else {
    limit = 50
  }

  // skip - passed or calculated from (page# x count)
  let skip = limit * (options.page - 1)
  if (options.skip) {
    skip += parseInt(options.skip)
  }

  queryOptions.limit = limit
  queryOptions.skip = skip
  queryOptions.page = parseInt(options.page)
  queryOptions.fields = {}

  // specified / default field limiters
  if (options.fields && help.isJSON(options.fields)) {
    _.extend(queryOptions.fields, JSON.parse(options.fields))
  }

  if (typeof modelSettings.fieldLimiters === 'object') {
    _.extend(queryOptions.fields, modelSettings.fieldLimiters)
  }

  // compose / reference fields
  if (options.compose) {
    queryOptions.compose = options.compose === 'true'
  }

  // history
  if (options.includeHistory) {
    queryOptions.includeHistory = options.includeHistory === 'true'

    if (options.historyFilters) {
      queryOptions.historyFilters = options.historyFilters
    }
  }

  // sorting
  var sort = {}
  var sortOptions = help.isJSON(options.sort)
  if (!sortOptions || _.isEmpty(sortOptions)) {
    var field = !sortOptions ? options.sort || settings.sort : settings.sort
    var order = (options.sortOrder || settings.sortOrder) === 'desc' ? -1 : 1
    if (field) sort[field] = order
  } else {
    sort = sortOptions
  }

  if (sort && !_.isEmpty(sort)) queryOptions.sort = sort

  response.queryOptions = queryOptions

  return response
}

var Controller = function (model) {
  if (!model) throw new Error('Model instance required')
  this.model = model
}

Controller.prototype.get = function (req, res, next) {
  var path = url.parse(req.url, true)
  var options = path.query

  // determine if this is jsonp
  var done = options.callback ? sendBackJSONP(options.callback, res, next) : sendBackJSON(200, res, next)
  var query = this.prepareQuery(req)
  var queryOptions = this.prepareQueryOptions(options)

  if (queryOptions.errors.length !== 0) {
    done = sendBackJSON(400, res, next)
    return done(null, queryOptions)
  } else {
    queryOptions = queryOptions.queryOptions
  }

  this.model.get(query, queryOptions, done, req)
}

Controller.prototype.prepareQueryOptions = function (options) {
  return prepareQueryOptions(options, this.model.settings)
}

function prepareQuery (req, model) {
  var path = url.parse(req.url, true)
  var apiVersion = path.pathname.split('/')[1]
  var options = path.query
  var query = parseQuery(options.filter)

  // Formatting query
  query = model.formatQuery(query)

  // remove filter params that don't exist in
  // the model schema
  if (!_.isArray(query)) {
    _.each(Object.keys(query), (key) => {
      if (!model.isKeyValid(key)) {
        delete query[key]
      } else {
        if (model.schema[key]) {
          var fieldType = model.schema[key].type

          help.transformQuery(query[key], fieldType)
        }
      }
    })
  }

  // if id is present in the url, add to the query
  if (req.params && req.params.id) {
    _.extend(query, { _id: req.params.id })
  }

  // add the apiVersion filter
  if (config.get('query.useVersionFilter')) {
    _.extend(query, { _apiVersion: apiVersion })
  }

  // add the model's default filters, if set
  if (typeof model.settings.defaultFilters === 'object') {
    _.extend(query, model.settings.defaultFilters)
  }

  return query
}

Controller.prototype.prepareQuery = function (req) {
  return prepareQuery(req, this.model)
}

Controller.prototype.post = function (req, res, next) {
  // internal fields
  var internals = {
    _apiVersion: req.url.split('/')[1]
  }

  var self = this

  var pathname = url.parse(req.url).pathname

  // remove id param if it's an update, so
  // we still get a valid handle on the model name
  // for clearing the cache
  pathname = pathname.replace('/' + req.params.id, '')

  debug('POST %s %o', pathname, req.params)

  // flush cache for POST requests
  help.clearCache(pathname, (err) => {})

  if (err) return next(err)

  // if id is present in the url, then this is an update
  if (req.params.id || req.body.update) {
    internals._lastModifiedAt = Date.now()
    internals._lastModifiedBy = req.client && req.client.clientId

    var query = {}
    var update = {}

    if (req.params.id) {
      query._id = req.params.id
      update = req.body
    } else {
      query = req.body.query
      update = req.body.update
    }

    // add the apiVersion filter
    if (config.get('query.useVersionFilter')) {
      query._apiVersion = internals._apiVersion
    }

    return self.model.update(query, update, internals, sendBackJSON(200, res, next), req)
  }

  // if no id is present, then this is a create
  internals._createdAt = Date.now()
  internals._createdBy = req.client && req.client.clientId

  self.model.create(req.body, internals, sendBackJSON(200, res, next), req)
}

Controller.prototype.put = function (req, res, next) {
  return this.post(req, res, next)
}

Controller.prototype.delete = function (req, res, next) {
  var query = req.params.id ? { _id: req.params.id } : req.body.query

  if (!query) return next()

  var self = this

  var pathname = url.parse(req.url).pathname

  // remove id param so we still get a valid handle
  // on the model name for clearing the cache
  pathname = pathname.replace('/' + req.params.id, '')

  // flush cache for DELETE requests
  help.clearCache(pathname, (err) => {})

  if (err) return next(err)

  self.model.delete(query, function (err, results) {
    if (err) return next(err)

    if (config.get('feedback')) {
      // send 200 with json message
      return help.sendBackJSON(200, res, next)(null, {
        status: 'success',
        message: 'Documents deleted successfully',
        deleted: results.deletedCount,
        totalCount: results.totalCount
      })
    }

    // send no-content success
    res.statusCode = 204
    res.end()
  }, req)
}

Controller.prototype.stats = function (req, res, next) {
  this.model.stats({}, function (err, stats) {
    if (err) return next(err)
    return help.sendBackJSON(200, res, next)(null, stats)
  })
}

Controller.prototype.count = function (req, res, next) {
  var options = url.parse(req.url, true).query

  var query = this.prepareQuery(req)
  var queryOptions = this.prepareQueryOptions(options)

  if (queryOptions.errors.length !== 0) {
    return sendBackJSON(400, res, next)(null, queryOptions)
  } else {
    queryOptions = queryOptions.queryOptions
  }

  this.model.count(query, queryOptions, function (err, stats) {
    if (err) return next(err)
    return help.sendBackJSON(200, res, next)(null, stats)
  })
}

module.exports = function (model) {
  return new Controller(model)
}

module.exports.Controller = Controller
module.exports.prepareQuery = prepareQuery
module.exports.prepareQueryOptions = prepareQueryOptions
