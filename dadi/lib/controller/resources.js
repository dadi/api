const acl = require('./../model/acl')
const help = require('./../help')

const Resources = function (server) {
  server.app.routeMethods('/api/resources', {
    get: this.get.bind(this)
  })
}

Resources.prototype.get = function (req, res, next) {
  let resources = acl.getResources()

  return help.sendBackJSON(200, res, next)(null, {
    results: Object.keys(resources).map(resource => {
      return Object.assign({name: resource}, resources[resource])
    })
  })
}

module.exports = server => new Resources(server)
