const acl = require('./../model/acl')
const fs = require('fs-extra')
const help = require('./../help')
const mkdirp = require('mkdirp')
const path = require('path')

const CreateEndpoint = function (server) {
  server.app.routeMethods('/:version/:endpointName/config', {
    post: this.post.bind(this)
  })

  this.server = server
}

CreateEndpoint.prototype.post = function (req, res, next) {
  let version = req.params.version
  let name = req.params.endpointName
  let dir = path.join(this.server.endpointPath, version)
  let filePath = path.join(dir, `endpoint.${name}.js`)

  // If the component already exists, pass it on to the next handler.
  if (this.server.components[`/${version}/${name}`]) {
    return next()
  }

  // Accessible to root users only.
  if (!acl.client.isAdmin(req.dadiApiClient)) {
    return help.sendBackJSON(null, res, next)(
      acl.createError(req.dadiApiClient)
    )
  }

  mkdirp(dir, {}, (err, made) => {
    if (err) return next(err)

    return fs.writeFile(filePath, req.body, err => {
      if (err) return next(err)

      help.sendBackJSON(200, res, next)(null, {
        success: true,
        message: `Endpoint "${version}:${name}" created`
      })
    })
  })
}

module.exports = server => new CreateEndpoint(server)
