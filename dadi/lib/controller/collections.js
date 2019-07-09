const acl = require('../model/acl')
const config = require('../../../config')
const help = require('../help')
const modelStore = require('../model/')
const schemaStore = require('../model/schemaStore')

const Collections = function(server) {
  server.app.routeMethods('/api/collections', {
    get: this.get.bind(this),
    post: this.post.bind(this)
  })

  this.server = server
}

Collections.prototype.get = async function(req, res, next) {
  if (!req.dadiApiClient.clientId) {
    return help.sendBackJSON(null, res, next)(
      acl.createError(req.dadiApiClient)
    )
  }

  try {
    const clientIsAdmin = acl.client.isAdmin(req.dadiApiClient)
    const access = await (clientIsAdmin
      ? {}
      : acl.access.get(req.dadiApiClient))
    const models = modelStore.getAll()
    const collections = Object.keys(models)
      .filter(key => {
        const model = models[key]
        const {aclKey} = model

        if (!model.isListable) return false

        return clientIsAdmin || (access[aclKey] && access[aclKey].read)
      })
      .map(key => {
        const model = models[key]
        const data = {
          version: model.version,
          property: model.property,
          name: (model.settings && model.settings.displayName) || model.name,
          slug: model.name,
          path: `/${model.version}/${model.property}/${model.name}`,
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

    return help.sendBackJSON(200, res, next)(null, {
      collections,
      media
    })
  } catch (error) {
    help.sendBackJSON(500, res, next)(error)
  }
}

Collections.prototype.post = async function(req, res, next) {
  const {fields, name, property, settings, version} = req.body

  if (
    typeof fields !== 'object' ||
    Object.keys(fields).length === 0 ||
    typeof name !== 'string' ||
    name.trim().length === 0 ||
    typeof property !== 'string' ||
    property.trim().length === 0 ||
    (settings && typeof settings !== 'object') ||
    typeof version !== 'string' ||
    version.trim().length === 0
  ) {
    return help.sendBackJSON(400, res, next)(null, {
      success: false,
      errors: [
        'Invalid input. Expected: {"fields": Object, "name": String, "property": String, "settings": Object (optional), version": String}'
      ]
    })
  }

  try {
    const {results: existingSchemas} = await schemaStore.find({
      name,
      property,
      version
    })

    if (existingSchemas.length > 0) {
      return help.sendBackJSON(409, res, next)(null, {
        success: false,
        errors: ['The collection already exists']
      })
    }

    const results = await schemaStore.create({
      fields,
      name,
      settings,
      property,
      version
    })

    return help.sendBackJSON(200, res, next)(null, {
      results
    })
  } catch (error) {
    return help.sendBackJSON(500, res, next)(error)
  }
}

module.exports = server => new Collections(server)
