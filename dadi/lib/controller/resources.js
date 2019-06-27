const acl = require('./../model/acl')
const help = require('./../help')

const Resources = function(server) {
  server.app.routeMethods('/api/resources', {
    get: this.get.bind(this)
  })
}

Resources.prototype.get = function(req, res, next) {
  if (!req.dadiApiClient.clientId) {
    return help.sendBackJSON(null, res, next)(
      acl.createError(req.dadiApiClient)
    )
  }

  const clientIsAdmin = acl.client.isAdmin(req.dadiApiClient)

  return acl.access
    .get(req.dadiApiClient)
    .then(access => {
      return Object.keys(access).filter(resource => {
        return Object.keys(access[resource]).some(accessType => {
          return Boolean(access[resource][accessType])
        })
      })
    })
    .then(allowedResources => {
      const resources = acl.getResources()
      const results = Object.keys(resources)
        .filter(resource => {
          return clientIsAdmin || allowedResources.includes(resource)
        })
        .map(resource => {
          return Object.assign({name: resource}, resources[resource])
        })

      return help.sendBackJSON(200, res, next)(null, {
        results
      })
    })
}

module.exports = server => new Resources(server)
