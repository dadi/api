const acl = require('./../model/acl')
const config = require('./../../../config')
const help = require('./../help')

const Collections = function (server) {
  server.app.routeMethods('/api/collections', {
    get: this.get.bind(this)
  })

  this.server = server
}

Collections.prototype.get = function (req, res, next) {
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
    let collections = Object.keys(this.server.components).filter(key => {
      if (this.server.components[key]._type !== this.server.COMPONENT_TYPE.COLLECTION) {
        return false
      }

      let aclKey = this.server.components[key].model.aclKey

      if (!clientIsAdmin && (!access[aclKey] || !access[aclKey].read)) {
        return false
      }

      return true
    }).map(key => {
      let model = this.server.components[key].model
      let parts = key.split('/')

      let data = {
        version: parts[1],
        database: parts[2],
        name: (model.settings && model.settings.displayName) || model.name,
        slug: model.name,
        path: key
      }

      if (model.settings) {
        if (model.settings.lastModifiedAt) {
          data.lastModifiedAt = model.settings.lastModifiedAt
        }

        if (model.settings.type) {
          data.type = model.settings.type
        }
      }

      return data
    }).sort((a, b) => {
      if (a.path < b.path) {
        return -1
      }

      if (a.path > b.path) {
        return 1
      }

      return 0
    })

    // Adding media buckets.
    let mediaBuckets = config.get('media.buckets').concat(config.get('media.defaultBucket'))
    let allowedMediaBuckets = mediaBuckets.filter(bucket => {
      if (clientIsAdmin) {
        return true
      }

      let matrix = access[`media:${bucket}`] || {}

      return matrix.read || matrix.create
    })
    let media = {
      buckets: allowedMediaBuckets,
      defaultBucket: allowedMediaBuckets.includes(config.get('media.defaultBucket'))
        ? config.get('media.defaultBucket')
        : null
    }

    help.sendBackJSON(200, res, next)(null, {
      collections,
      media
    })
  }).catch(err => {
    help.sendBackJSON(500, res, next)(err)
  })
}

module.exports = server => new Collections(server)
