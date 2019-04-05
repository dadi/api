const config = require('./../../../config')
const help = require('./../help')
const searchModel = require('./../model/search')
const url = require('url')

const ID_PATTERN = '[a-fA-F0-9-]*'

const Controller = function () {}

Controller.prototype._getURLParameters = function (requestUrl) {
  let parsedUrl = url.parse(requestUrl, true)

  return parsedUrl.query
}

Controller.prototype._prepareQuery = function (req) {
  let path = url.parse(req.url, true)
  let apiVersion = path.pathname.split('/')[1]
  let options = this._getURLParameters(req.url)
  let query = help.parseQuery(options.filter)

  // Formatting query
  query = this.model.formatQuery(query)

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

  // `q` represents a search query, e.g. `?q=foo bar baz`.
  if (options.q) {
    queryOptions.search = options.q
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

Controller.prototype.ID_PATTERN = ID_PATTERN

/**
 * Handle collection search endpoints
 * Example: /1.0/library/books/search?q=title
 */
Controller.prototype.search = function (req, res, next) {
  const minimumQueryLength = config.get('search.minQueryLength')
  const path = url.parse(req.url, true)
  const {q: query} = path.query
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

  return searchModel.find(query, [this.model.name]).then(collections => {
    const documents = collections[this.model.name]
    const documentIds = documents.map(({_id}) => _id)
    
    return this.model.find({
      query: {
        _id: {
          '$containsAny': documentIds
        }
      }
    }).then(({results}) => {
      return help.sendBackJSON(200, res, next)(null, results)
    })
  }).catch(error => {
    return help.sendBackJSON(null, res, next)(error)
  })
}

module.exports = function (model) {
  return new Controller(model)
}

module.exports.Controller = Controller
module.exports.ID_PATTERN = ID_PATTERN
