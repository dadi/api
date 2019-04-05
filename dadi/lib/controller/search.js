const acl = require('./../model/acl')
const CollectionModel = require('./../model/index')
const config = require('./../../../config')
const help = require('./../help')
const searchModel = require('./../model/search')
const url = require('url')

const Search = function (server, modelFactory) {
  server.app.routeMethods('/search', {
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
  const collectionsArray = (collections || '').split(',')
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

  if (!acl.client.isAdmin(req.dadiApiClient)) {
    const aclKeys = collectionsArray.reduce((keys, collection) => {
      const model = CollectionModel(collection)

      if (model) {
        keys[collection] = model.getAclKey()
      }

      return keys
    }, {})

    aclCheck = acl.access.get(req.dadiApiClient).then(resources => {
      return Object.keys(aclKeys).filter(collection => {
        const key = aclKeys[collection]

        return resources[key] && resources[key].read
      })
    })
  }

  return aclCheck.then(collections => {
    return searchModel.find({
      collections,
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
