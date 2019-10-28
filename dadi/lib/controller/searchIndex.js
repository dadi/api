const acl = require('../model/acl')
const config = require('../../../config')
const help = require('../help')
const log = require('@dadi/logger')
const modelStore = require('../model/')
const search = require('../model/search')

const SearchIndex = function(server) {
  this.server = server

  server.app.routeMethods('/api/index', {
    post: this.post.bind(this)
  })
}

SearchIndex.prototype.post = function(req, res, next) {
  if (!req.dadiApiClient.clientId) {
    return help.sendBackJSON(null, res, next)(
      acl.createError(req.dadiApiClient)
    )
  }

  // 404 if Search is not enabled
  if (config.get('search.enabled') !== true) {
    return next()
  }

  res.statusCode = 202
  res.end()

  const allModels = modelStore.getAll()
  const listableModels = Object.keys(allModels)
    .filter(key => allModels[key].isListable)
    .map(key => allModels[key])

  try {
    search.batchIndexCollections(listableModels)
  } catch (error) {
    log.error({module: 'batch index'}, error)
  }
}

module.exports = server => new SearchIndex(server)
