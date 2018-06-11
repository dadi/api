const acl = require('./../model/acl')
const help = require('./../help')

const Resources = function (server) {
  server.app.routeMethods('/api/resources', {
    get: this.get.bind(this)
  })
}

Resources.prototype.get = function (req, res, next) {
  if (!req.dadiApiClient.clientId) {
    return help.sendBackJSON(null, res, next)(
      acl.createError(req.dadiApiClient)
    )
  }

  let resources = acl.getResources()

  return help.sendBackJSON(200, res, next)(null, {
    results: Object.keys(resources).map(resource => {
      return Object.assign({name: resource}, resources[resource])
    })
  })
}

module.exports = server => new Resources(server)
