const acl = require('./../model/acl')
const config = require('./../../../config')
const help = require('./../help')

const Collections = function(server) {
  server.app.routeMethods('/api/collections', {
    get: this.get.bind(this)
  })

  this.server = server
}

Collections.prototype.get = function(req, res, next) {
  if (!req.dadiApiClient.clientId) {
    return help.sendBackJSON(null, res, next)(
      acl.createError(req.dadiApiClient)
    )
  }

  const clientIsAdmin = acl.client.isAdmin(req.dadiApiClient)
  let accessCheck

  if (!clientIsAdmin) {
    accessCheck = acl.access.get(req.dadiApiClient)
  }

  return Promise.resolve(accessCheck)
    .then((access = {}) => {
      const collections = Object.keys(this.server.components)
        .filter(key => {
          if (
            this.server.components[key]._type !==
            this.server.COMPONENT_TYPE.COLLECTION
          ) {
            return false
          }

          const aclKey = this.server.components[key].model.getAclKey()

          if (!clientIsAdmin && (!access[aclKey] || !access[aclKey].read)) {
            return false
          }

          return true
        })
        .map(key => {
          const model = this.server.components[key].model
          const parts = key.split('/')

          const data = {
            version: parts[1],
            database: parts[2],
            name: (model.settings && model.settings.displayName) || model.name,
            slug: model.name,
            path: key,
            fields: model.schema,
            settings: Object.assign({}, model.settings, {
              database: undefined
            })
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
        })
        .sort((a, b) => {
          if (a.path < b.path) {
            return -1
          }

          if (a.path > b.path) {
            return 1
          }

          return 0
        })

      // Adding media buckets.
      const mediaBuckets = config
        .get('media.buckets')
        .concat(config.get('media.defaultBucket'))
      const allowedMediaBuckets = mediaBuckets.filter(bucket => {
        if (clientIsAdmin) {
          return true
        }

        const matrix = access[`media:${bucket}`] || {}

        return matrix.read || matrix.create
      })
      const media = {
        buckets: allowedMediaBuckets,
        defaultBucket: allowedMediaBuckets.includes(
          config.get('media.defaultBucket')
        )
          ? config.get('media.defaultBucket')
          : null
      }

      help.sendBackJSON(200, res, next)(null, {
        collections,
        media
      })
    })
    .catch(err => {
      help.sendBackJSON(500, res, next)(err)
    })
}

module.exports = server => new Collections(server)
