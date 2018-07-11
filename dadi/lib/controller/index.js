const config = require('./../../../config')
const help = require('./../help')
const url = require('url')

const ID_PATTERN = '[a-fA-F0-9-]*'

const Controller = function () {}

Controller.prototype._prepareQuery = function (req) {
  let path = url.parse(req.url, true)
  let apiVersion = path.pathname.split('/')[1]
  let options = path.query
  let query = help.parseQuery(options.filter)

  // Formatting query
  query = this.model.formatQuery(query)

  // Remove filter params that don't exist in
  // the model schema.
  // if (!Array.isArray(query)) {
  //   Object.keys(query).forEach(key => {
  //     if (!this.model.isKeyValid(key)) {
  //       delete query[key]
  //     }
  //   })
  // }

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

Controller.prototype.ID_PATTERN = ID_PATTERN

module.exports = function (model) {
  return new Controller(model)
}

module.exports.Controller = Controller
module.exports.ID_PATTERN = ID_PATTERN
