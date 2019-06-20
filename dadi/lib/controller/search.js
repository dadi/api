const acl = require('./../model/acl')
const CollectionModel = require('./../model/index')
const config = require('./../../../config')
const help = require('./../help')
const searchModel = require('./../model/search')
const url = require('url')

const Search = function (server, modelFactory) {
  searchModel.initialise()

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
  const {
    collections,
    lang: language,
    page = 1,
    q: query
  } = options
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
  let requestCollections = typeof collections === 'string'
    ? collections.split(',')
    : []

  // (!) TO DO: We're currently treating collection names inconsistently
  // across the application. ACL keys contain the database name and the
  // collection name, but models are summoned by the name of the collection
  // only. This will need to be standardised at some point, if we want a
  // multi-database setup to work without any naming conflicts. Until then,
  // and to avoid breaking changes in the future, the `collections` parameter
  // in the search endpoint is already expecting a format in which the database
  // name is included (e.g. dbName_collectionName), which we must translate
  // into the collection name until the models accept the new format.
  requestCollections = requestCollections.map(aclKey => {
    return aclKey.split('_')[1]
  })

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

      return allowedModels
        .filter(Boolean)
        .map(collection => collection.name)
    })
  }

  // At this point, `collections` contains either an array of the names of
  // the collections that the user has access to, or `undefined` if we're
  // dealing with an admin user that can access everything.
  return aclCheck.then(allowedCollections => {
    let searchCollections = []

    if (requestCollections.length > 0) {
      // If `allowedCollections` is undefined, it means that the user can
      // access any collection, so we'll search on `requestCollections`.
      // If `allowedCollections` isn't undefined, then it holds the set of
      // collections which the user has access to. As such, we'll search on
      // the intersection between `allowedCollections` and `requestCollections`.
      if (allowedCollections === undefined) {
        searchCollections = requestCollections
      } else {
        searchCollections = requestCollections.filter(collection => {
          return allowedCollections.includes(collection)
        })
      }
    } else {
      searchCollections = allowedCollections === undefined
        ? undefined
        : allowedCollections
    }

    return searchModel.find({
      client: req.dadiApiClient,
      collections: searchCollections,
      language,
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
