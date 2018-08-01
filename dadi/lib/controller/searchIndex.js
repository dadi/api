const acl = require('./../model/acl')
const config = require('./../../../config')
const help = require('./../help')

const SearchIndex = function (server) {
  this.server = server

  server.app.routeMethods('/api/index', {
    post: this.post.bind(this)
  })
}

SearchIndex.prototype.post = function (req, res, next) {
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
  res.end(JSON.stringify({'message': 'Indexing started'}))

  try {
    Object.keys(this.server.components).forEach(key => {
      let value = this.server.components[key]

      let hasModel = Object.keys(value).includes('model') &&
        value.model.constructor.name === 'Model'

      if (hasModel) {
        value.model.searchHandler.batchIndex()
      }
    })
  } catch (err) {
    console.log(err)
  }
}

module.exports = server => new SearchIndex(server)
