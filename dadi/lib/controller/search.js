const acl = require('./../model/acl')
const CollectionModel = require('./../model/index')
const config = require('./../../../config')
const help = require('./../help')
const searchModel = require('./../model/search')
const url = require('url')

const Search = function (server, modelFactory) {
  server.app.routeMethods('/api/search', {
    get: this.get.bind(this)
  })
}

/**
 * Handle collection search endpoints
 * Example: /1.0/library/books/search?q=title
 */
Search.prototype.get = function (req, res, next) {
  const {query: options} = url.parse(req.url, true)
  const {collections, page = 1, q: query} = options
  const minimumQueryLength = config.get('search.minQueryLength')

  if (!config.get('search.enabled')) {
    const error = new Error('Not Implemented')

    error.statusCode = 501
    error.json = {
      success: false,
      errors: [{
        message: `Search is disabled or an invalid data connector has been specified.`
      }]
    }

    return help.sendBackJSON(null, res, next)(error)
  }

  if (typeof query !== 'string' || query.length < minimumQueryLength) {
    const error = new Error('Bad Request')

    error.statusCode = 400
    error.json = {
      success: false,
      errors: [{
        message: `Search query must be at least ${minimumQueryLength} characters.`
      }]
    }

    return help.sendBackJSON(null, res, next)(error)
  }

  let aclCheck = Promise.resolve()
  let searchCollections = (collections || '').split(',')

  // If the client is not an admin, we must first find out what collections they
  // have read permissions for.
  if (!acl.client.isAdmin(req.dadiApiClient)) {
    aclCheck = acl.access.get(req.dadiApiClient).then(resources => {
      const allowedResources = Object.keys(resources).filter(key => {
        return Boolean(resources[key].read)
      })
      const allowedModels = allowedResources.map(aclKey => {
        return CollectionModel.getByAclKey(aclKey)
      })

      return allowedModels.filter(Boolean)
    })
  }

  // At this point, `collections` contains either an array of the names of
  // the collections that the user has access to, or `undefined` if we're
  // dealing with an admin user that can access everything.
  return aclCheck.then(collections => {
    if (searchCollections.length > 0) {
      // If `collections` isn't undefined, then it holds the set of collections
      // which the user has access to. As such, `searchCollections` becomes the
      // intersection between itself and `collections`.
      if (collections !== undefined) {
        searchCollections = searchCollections.filter(collection => {
          return collections.includes(collection)
        })
      }
    }

    return searchModel.find({
      collections: searchCollections,
      modelFactory: CollectionModel,
      page,
      query
    })
  }).then(results => {
    return help.sendBackJSON(200, res, next)(null, results)
  }).catch(error => {
    return help.sendBackJSON(null, res, next)(error)
  })
}

module.exports = server => new Search(server)
