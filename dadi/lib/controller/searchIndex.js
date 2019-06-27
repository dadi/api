const acl = require('../model/acl')
const config = require('../../../config')
const help = require('../help')
const log = require('@dadi/logger')
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

  res.statusCode = 204
  res.end()

  const models = Object.keys(this.server.components)
    .map(key => {
      const component = this.server.components[key]
      const hasModel =
        component.model && component.model.constructor.name === 'Model'

      return hasModel ? component.model : null
    })
    .filter(Boolean)

  try {
    search.batchIndexCollections(models)
  } catch (error) {
    log.error({module: 'batch index'}, error)
  }
}

module.exports = server => new SearchIndex(server)
