const acl = require('./../model/acl')
const help = require('./../help')

const Endpoint = function (component, server, aclKey) {
  this.aclKey = aclKey
  this.component = component
  this.server = server
}

Endpoint.prototype.getAccessTypeForMethod = function (method) {
  switch (method) {
    case 'delete':
      return 'delete'

    case 'options':
      return null

    case 'post':
      return 'create'

    case 'put':
      return 'update'

    case 'get':
    default:
      return 'read'
  }
}

Endpoint.prototype.getConfig = function () {
  if (typeof this.component.config === 'function') {
    return this.component.config()
  }
}

Endpoint.prototype.getDisplayName = function () {
  return (
    this.component.model &&
    this.component.model.settings &&
    this.component.model.settings.displayName
  )
}

Endpoint.prototype.isAuthenticated = function () {
  return (
    this.component.model &&
    this.component.model.settings &&
    this.component.model.settings.authenticate === false
  )
}

Endpoint.prototype.registerRoutes = function (route, filePath) {
  this.server.app.use(route, (req, res, next) => {
    try {
      // Map request method to controller method.
      const method = req.method && req.method.toLowerCase()

      if (this.component[method]) {
        const accessTypeForMethod = this.getAccessTypeForMethod(method)
        let aclCheck

        // If the method is OPTIONS *or* the custom endpoint has explicitly
        // said this is an unauthenticated endpoint, we'll skip the ACL check.
        if ((method === 'options') || this.isAuthenticated()) {
          aclCheck = Promise.resolve()
        } else {
          aclCheck = acl.access.get(req.dadiApiClient, this.aclKey).then(access => {
            if (!access[accessTypeForMethod]) {
              return help.sendBackJSON(401, res, next)(
                new Error('UNAUTHORISED')
              )
            }
          })
        }

        return aclCheck.then(() => this.component[method](req, res, next))
      }

      if (method === 'options') {
        return help.sendBackJSON(200, res, next)(null, null)
      }
    } catch (err) {
      help.sendBackErrorTrace(res, next)(err)
    }

    next()
  })
}

Endpoint.prototype.unregisterRoutes = function (route) {
  this.server.app.unuse(`${route}/config`)
  this.server.app.unuse(route)
}

module.exports = (component, server, aclKey) => new Endpoint(component, server, aclKey)
