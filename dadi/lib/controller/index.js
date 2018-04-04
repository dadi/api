const debug = require('debug')('api:controller')
const path = require('path')
const url = require('url')

const config = require(path.join(__dirname, '/../../../config'))
const help = require(path.join(__dirname, '/../help'))

const sendBackJSON = help.sendBackJSON
const sendBackJSONP = help.sendBackJSONP
const parseQuery = help.parseQuery

const Controller = function (model) {
  if (!model) throw new Error('Model instance required')

  this.model = model
}

Controller.prototype._prepareQuery = function (req) {
  let path = url.parse(req.url, true)
  let apiVersion = path.pathname.split('/')[1]
  let options = path.query
  let query = parseQuery(options.filter)

  // Formatting query
  query = this.model.formatQuery(query)

  // Remove filter params that don't exist in
  // the model schema.
  if (!Array.isArray(query)) {
    Object.keys(query).forEach(key => {
      if (!this.model.isKeyValid(key)) {
        delete query[key]
      }
    })
  }

  // If id is present in the url, add to the query.
  if (req.params && req.params.id) {
    Object.assign(query, {
      _id: req.params.id
    })
  }

  // Add the apiVersion filter.
  if (config.get('query.useVersionFilter')) {
    Object.assign(query, {
      _apiVersion: apiVersion
    })
  }

  // add the model's default filters, if set
  if (typeof this.model.settings.defaultFilters === 'object') {
    Object.assign(query, this.model.settings.defaultFilters)
  }

  return query
}

Controller.prototype._prepareQueryOptions = function (options) {
  let response = { errors: [] }
  let queryOptions = {}
  let settings = this.model.settings || {}
  let parsedSkip

  if (options.page) {
    options.page = parseInt(options.page)

    if (options.page === 0) options.page = 1
  } else {
    options.page = 1
  }

  // Ensure we have sane params.
  if (options.skip) {
    parsedSkip = parseInt(options.slip)

    if (parsedSkip.toString() !== options.skip) {
      response.errors.push(
        Object.assign(
          new Error(),
          {
            status: 'Bad Request',
            code: 'Invalid Parameter',
            details: 'The `skip` parameter must a number',
            title: 'Invalid Skip Parameter Provided'
          }
        )
      )
    } else if (parsedSkip < 0) {
      response.errors.push(
        Object.assign(
          new Error(),
          {
            status: 'Bad Request',
            code: 'Invalid Parameter',
            details: 'The `skip` parameter must be greater than or equal to zero',
            title: 'Invalid Skip Parameter Provided'
          }
        )
      )
    }
  }

  if (options.page && options.page <= 0) {
    response.errors.push(
      Object.assign(
        new Error(),
        {
          status: 'Bad Request',
          code: 'Invalid Parameter',
          details: 'The `page` parameter must be greater than zero',
          title: 'Invalid Page Parameter Provided'
        }
      )
    )
  }

  // Specified / default number of records to return.
  let limit = parseInt(options.count || settings.count) || 50

  // Skip - passed or calculated from (page# x count).
  let skip = limit * (options.page - 1)

  if (options.skip) {
    skip += parsedSkip
  }

  queryOptions.limit = limit
  queryOptions.skip = skip
  queryOptions.page = parseInt(options.page)
  queryOptions.fields = {}

  // specified / default field limiters
  if (options.fields && help.isJSON(options.fields)) {
    Object.assign(queryOptions.fields, JSON.parse(options.fields))
  }

  if (typeof this.model.settings.fieldLimiters === 'object') {
    Object.assign(queryOptions.fields, this.model.settings.fieldLimiters)
  }

  // Compose / reference fields.
  if (options.compose) {
    queryOptions.compose = options.compose
  }

  // History.
  if (options.includeHistory) {
    queryOptions.includeHistory = options.includeHistory === 'true'

    if (options.historyFilters) {
      queryOptions.historyFilters = options.historyFilters
    }
  }

  // sorting
  let sort = {}
  let sortOptions = help.isJSON(options.sort)

  if (!sortOptions || !Object.keys(sortOptions).length) {
    let field = !sortOptions ? options.sort || settings.sort : settings.sort
    let order = (options.sortOrder || settings.sortOrder) === 'desc' ? -1 : 1
    if (field) sort[field] = order
  } else {
    sort = sortOptions
  }

  if (sort && Object.keys(sort).length) queryOptions.sort = sort

  response.queryOptions = queryOptions

  return response
}

Controller.prototype.count = function (req, res, next) {
  let options = url.parse(req.url, true).query

  let query = this._prepareQuery(req)
  let queryOptions = this._prepareQueryOptions(options)

  if (queryOptions.errors.length !== 0) {
    return sendBackJSON(400, res, next)(null, queryOptions)
  } else {
    queryOptions = queryOptions.queryOptions
  }

  this.model.count({
    query,
    options: queryOptions
  }).then(stats => {
    return help.sendBackJSON(200, res, next)(null, stats)
  }).catch(error => {
    return next(error)
  })
}

Controller.prototype.delete = function (req, res, next) {
  let query = req.params.id ? { _id: req.params.id } : req.body.query

  if (!query) return next()

  let pathname = url.parse(req.url).pathname

  // Remove id param so we still get a valid handle
  // on the model name for clearing the cache.
  pathname = pathname.replace('/' + req.params.id, '')

  // flush cache for DELETE requests
  help.clearCache(pathname, err => {
    if (err) return next(err)

    this.model.delete({
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
}

Controller.prototype.get = function (req, res, next) {
  let path = url.parse(req.url, true)
  let options = path.query

  // determine if this is jsonp
  let done = options.callback
    ? sendBackJSONP(options.callback, res, next)
    : sendBackJSON(200, res, next)
  let query = this._prepareQuery(req)
  let queryOptions = this._prepareQueryOptions(options)

  if (queryOptions.errors.length !== 0) {
    done = sendBackJSON(400, res, next)

    return done(null, queryOptions)
  } else {
    queryOptions = queryOptions.queryOptions
  }

  this.model.get({
    query,
    options: queryOptions
  }).then(results => {
    return done(null, results)
  }).catch(error => {
    return done(error)
  })
}

Controller.prototype.post = function (req, res, next) {
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
  help.clearCache(pathname, err => {
    if (err) return next(err)

    // If id is present in the url, then this is an update.
    if (req.params.id || req.body.update) {
      internals._lastModifiedBy = req.client && req.client.clientId

      let query = {}
      let update = {}

      if (req.params.id) {
        query._id = req.params.id
        update = req.body
      } else {
        query = req.body.query
        update = req.body.update
      }

      // Add the apiVersion filter.
      if (config.get('query.useVersionFilter')) {
        query._apiVersion = internals._apiVersion
      }

      return this.model.update({
        compose: options.compose,
        internals,
        query,
        req,
        update
      }).then(result => {
        return sendBackJSON(200, res, next)(null, result)
      }).catch(error => {
        return sendBackJSON(500, res, next)(error)
      })
    }

    // if no id is present, then this is a create
    internals._createdBy = req.client && req.client.clientId

    return this.model.create({
      compose: options.compose,
      documents: req.body,
      internals
    }).then(result => {
      return sendBackJSON(200, res, next)(null, result)
    }).catch(error => {
      return sendBackJSON(200, res, next)(error)
    })
  })
}

Controller.prototype.put = function (req, res, next) {
  return this.post(req, res, next)
}

Controller.prototype.stats = function (req, res, next) {
  this.model.getStats().then(stats => {
    return help.sendBackJSON(200, res, next)(null, stats)
  }).catch(error => {
    return next(error)
  })
}

module.exports = function (model) {
  return new Controller(model)
}

module.exports.Controller = Controller
