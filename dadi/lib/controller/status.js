const acl = require('./../model/acl')
const config = require('./../../../config')
const dadiStatus = require('@dadi/status')
const help = require('./../help')
const site = require('../../../package.json').name
const version = require('../../../package.json').version

const StatusEndpoint = function (server) {
  server.app.routeMethods('/api/status', {
    post: this.post.bind(this)
  })
}

StatusEndpoint.prototype.post = function (req, res, next) {
  if (!req.dadiApiClient.clientId) {
    return help.sendBackJSON(null, res, next)(
      acl.createError(req.dadiApiClient)
    )
  }

  if (config.get('status.enabled') === false) {
    return next()
  }

  let params = {
    site,
    package: '@dadi/api',
    version,
    healthCheck: {
      authorization: req.headers.authorization,
      baseUrl: `http://${config.get('server.host')}:${config.get('server.port')}`,
      routes: config.get('status.routes')
    }
  }

  dadiStatus(params, (err, data) => {
    help.sendBackJSON(200, res, next)(err, data)
  })
}

module.exports = server => new StatusEndpoint(server)
