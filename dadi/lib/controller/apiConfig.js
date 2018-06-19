const acl = require('./../model/acl')
const config = require('./../../../config')
const fs = require('fs-extra')
const help = require('./../help')
const path = require('path')

const ApiConfig = function (server) {
  server.app.routeMethods('/api/config', {
    get: this.get.bind(this),
    post: this.post.bind(this)
  })
}

ApiConfig.prototype.get = function (req, res, next) {
  if (!acl.client.isAdmin(req.dadiApiClient)) {
    return help.sendBackJSON(null, res, next)(
      acl.createError(req.dadiApiClient)
    )
  }

  return help.sendBackJSON(200, res, next)(null, config.getProperties())
}

ApiConfig.prototype.post = function (req, res, next) {
  if (!acl.client.isAdmin(req.dadiApiClient)) {
    return help.sendBackJSON(null, res, next)(
      acl.createError(req.dadiApiClient)
    )
  }

  let configPath = path.resolve(config.configPath())
  let newConfig = Object.assign({}, config.getProperties(), req.body || {})

  return fs.writeJson(configPath, newConfig, {
    spaces: 4
  }).then(() => {
    return help.sendBackJSON(200, res, next)(null, {
      success: true,
      message: 'Server restart required'
    })
  })
}

module.exports = server => new ApiConfig(server)
