const acl = require('./../model/acl')
const help = require('./../help')
const pathToRegexp = require('path-to-regexp')

const Endpoints = function (server) {
  server.app.routeMethods('/api/endpoints', {
    get: this.get.bind(this)
  })

  this.server = server
}

Endpoints.prototype.get = function (req, res, next) {
  if (!req.dadiApiClient.clientId) {
    return help.sendBackJSON(null, res, next)(
      acl.createError(req.dadiApiClient)
    )
  }

  let clientIsAdmin = acl.client.isAdmin(req.dadiApiClient)
  let accessCheck

  if (!clientIsAdmin) {
    accessCheck = acl.access.get(req.dadiApiClient)
  }

  return Promise.resolve(accessCheck).then((access = {}) => {
    let endpoints = Object.keys(this.server.components).filter(key => {
      if (this.server.components[key]._type !== this.server.COMPONENT_TYPE.CUSTOM_ENDPOINT) {
        return false
      }

      let aclKey = this.server.components[key].aclKey

      if (!clientIsAdmin && (!access[aclKey] || !access[aclKey].read)) {
        return false
      }

      return true
    }).map(key => {
      let parts = key.split('/')
      let endpoint = {
        name: this.server.components[key].getDisplayName() || parts[2],
        path: key,
        version: parts[1]
      }
      let regexp = pathToRegexp(key)

      if (regexp.keys.length > 0) {
        endpoint.params = regexp.keys
      }

      return endpoint
    }).sort((a, b) => {
      if (a.path < b.path) {
        return -1
      }

      return 1
    })

    return help.sendBackJSON(200, res, next)(null, {
      endpoints
    })
  }).catch(err => {
    help.sendBackJSON(500, res, next)(err)
  })
}

module.exports = server => new Endpoints(server)
