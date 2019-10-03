const help = require('./../help')
const url = require('url')

const ID_PATTERN = '[a-fA-F0-9-]*'

const Controller = function() {}

Controller.prototype._addPaginationUrlsToMetadata = function(
  parsedUrl,
  metadata
) {
  let urls = {}

  if (metadata.nextPage) {
    const nextPageUrl = Object.assign({query: {}}, parsedUrl, {
      search: undefined
    })

    nextPageUrl.query.page = metadata.nextPage

    urls.nextPageUrl = decodeURIComponent(url.format(nextPageUrl))
  }

  if (metadata.prevPage) {
    const prevPageUrl = Object.assign({query: {}}, parsedUrl, {
      search: undefined
    })

    prevPageUrl.query.page = metadata.prevPage

    urls.prevPageUrl = decodeURIComponent(url.format(prevPageUrl))
  }

  return Object.assign({}, metadata, urls)
}

Controller.prototype._prepareQuery = function(req, model) {
  const {query: options} = url.parse(req.url, true)
  let query = help.parseQuery(options.filter)

  // Formatting query
  query = model.formatQuery(query)

  // If id is present in the url, add to the query.
  if (req.params && req.params.id) {
    Object.assign(query, {
      _id: req.params.id
    })
  }

  // add the model's default filters, if set
  if (typeof model.settings.defaultFilters === 'object') {
    Object.assign(query, model.settings.defaultFilters)
  }

  return query
}

Controller.prototype._prepareQueryOptions = function(options, model) {
  const response = {errors: []}
  const queryOptions = {}
  const settings = model.settings || {}
  let parsedSkip

  if (options.page) {
    options.page = parseInt(options.page)

    if (options.page === 0) options.page = 1
  } else {
    options.page = 1
  }

  // Ensure we have sane params.
  if (options.skip) {
    parsedSkip = parseInt(options.skip)

    if (parsedSkip.toString() !== options.skip) {
      response.errors.push(
        Object.assign(new Error(), {
          status: 'Bad Request',
          code: 'Invalid Parameter',
          details: 'The `skip` parameter must a number',
          title: 'Invalid Skip Parameter Provided'
        })
      )
    } else if (parsedSkip < 0) {
      response.errors.push(
        Object.assign(new Error(), {
          status: 'Bad Request',
          code: 'Invalid Parameter',
          details: 'The `skip` parameter must be greater than or equal to zero',
          title: 'Invalid Skip Parameter Provided'
        })
      )
    }
  }

  if (options.page && options.page <= 0) {
    response.errors.push(
      Object.assign(new Error(), {
        status: 'Bad Request',
        code: 'Invalid Parameter',
        details: 'The `page` parameter must be greater than zero',
        title: 'Invalid Page Parameter Provided'
      })
    )
  }

  // `q` represents a search query, e.g. `?q=foo bar baz`.
  if (options.q) {
    queryOptions.search = options.q
  }

  // Specified / default number of records to return.
  const limit = parseInt(options.count || settings.count) || 50

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

  if (typeof model.settings.fieldLimiters === 'object') {
    Object.assign(queryOptions.fields, model.settings.fieldLimiters)
  }

  // Compose / reference fields.
  if (options.compose) {
    queryOptions.compose = options.compose
  }

  // sorting
  let sort = {}
  const sortOptions = help.isJSON(options.sort)

  if (!sortOptions || !Object.keys(sortOptions).length) {
    const field = !sortOptions ? options.sort || settings.sort : settings.sort
    const order = (options.sortOrder || settings.sortOrder) === 'desc' ? -1 : 1

    if (field) sort[field] = order
  } else {
    sort = sortOptions
  }

  if (sort && Object.keys(sort).length) queryOptions.sort = sort

  response.queryOptions = queryOptions

  return response
}

Controller.prototype.ID_PATTERN = ID_PATTERN

module.exports = function() {
  return new Controller()
}

module.exports.Controller = Controller
module.exports.ID_PATTERN = ID_PATTERN
