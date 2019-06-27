const acl = require('./../model/acl')
const formatError = require('@dadi/format-error')
const help = require('./../help')

const CacheFlush = function(server) {
  server.app.routeMethods('/api/flush', {
    post: this.post.bind(this)
  })
}

CacheFlush.prototype.post = function(req, res, next) {
  if (!acl.client.isAdmin(req.dadiApiClient)) {
    return help.sendBackJSON(null, res, next)(
      acl.createError(req.dadiApiClient)
    )
  }

  if (!req.body.path) {
    return help.sendBackJSON(400, res, next)(
      null,
      formatError.createApiError('0003')
    )
  }

  return help.clearCache(req.body.path, function(err) {
    help.sendBackJSON(200, res, next)(err, {
      result: 'success',
      message: 'Cache flush successful'
    })
  })
}

module.exports = server => new CacheFlush(server)
