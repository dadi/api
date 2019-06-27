const acl = require('./../model/acl')
const config = require('./../../../config')
const help = require('./../help')

const ApiConfig = function(server) {
  server.app.routeMethods('/api/config', {
    get: this.get.bind(this)
  })
}

ApiConfig.prototype.get = function(req, res, next) {
  if (!acl.client.isAdmin(req.dadiApiClient)) {
    return help.sendBackJSON(null, res, next)(
      acl.createError(req.dadiApiClient)
    )
  }

  return help.sendBackJSON(200, res, next)(null, config.getProperties())
}

module.exports = server => new ApiConfig(server)
