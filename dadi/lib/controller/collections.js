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

  server.app.routeMethods('/api/collections/:collection*', {
    delete: this.delete.bind(this),
    put: this.put.bind(this)
  })

  this.server = server
}

Collections.prototype.delete = async function(req, res, next) {
  if (!req.dadiApiClient.clientId) {
    return help.sendBackJSON(null, res, next)(
      acl.createError(req.dadiApiClient)
    )
  }

  const [property, collection] = (req.params.collection || '').split('/')

  if (!property || !collection) {
    return this.handleError(new Error('SCHEMA_NOT_FOUND'), res, next)
  }

  try {
    const clientIsAdmin = acl.client.isAdmin(req.dadiApiClient)
    const access = await (clientIsAdmin
      ? {}
      : acl.access.get(req.dadiApiClient, 'collections'))

    // To delete a collection, the client needs to be an admin or have `delete`
    // access to the `collections` resource.
    if (!clientIsAdmin && !access.delete) {
      return help.sendBackJSON(null, res, next)(
        acl.createError(req.dadiApiClient)
      )
    }

    const deletedCount = await schemaStore.delete({
      name: collection,
      property
    })

    if (deletedCount === 0) {
      return this.handleError(new Error('SCHEMA_NOT_FOUND'), res, next)
    }

    return help.sendBackJSON(204, res, next)(null, null)
  } catch (error) {
    return this.handleError(error, res, next)
  }
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
          property: model.property,
          name: (model.settings && model.settings.displayName) || model.name,
          slug: model.name,
          path: `/${model.property}/${model.name}`,
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
    return this.handleError(error, res, next)
  }
}

Collections.prototype.handleError = function(error, res, next) {
  switch (error.message) {
    case 'SCHEMA_EXISTS':
      return help.sendBackJSON(409, res, next)(null, {
        success: false,
        errors: ['The collection already exists']
      })

    case 'SCHEMA_NOT_FOUND':
      return help.sendBackJSON(404, res, next)(null, {
        success: false
      })

    case 'VALIDATION_ERROR':
      return help.sendBackJSON(400, res, next)(null, {
        success: false,
        errors: error.errors
      })

    default:
      return help.sendBackJSON(500, res, next)(error)
  }
}

Collections.prototype.post = async function(req, res, next) {
  if (!req.dadiApiClient.clientId) {
    return help.sendBackJSON(null, res, next)(
      acl.createError(req.dadiApiClient)
    )
  }

  const {fields, name, property, settings} = req.body

  try {
    const clientIsAdmin = acl.client.isAdmin(req.dadiApiClient)
    const access = await (clientIsAdmin
      ? {}
      : acl.access.get(req.dadiApiClient, 'collections'))

    // To create a collection, the client needs to be an admin or have `create`
    // access to the `collections` resource.
    if (!clientIsAdmin && !access.create) {
      return help.sendBackJSON(null, res, next)(
        acl.createError(req.dadiApiClient)
      )
    }

    const results = await schemaStore.create({
      fields,
      name,
      settings,
      property
    })

    return help.sendBackJSON(200, res, next)(null, {
      results: schemaStore.formatForOutput(results)
    })
  } catch (error) {
    return this.handleError(error, res, next)
  }
}

Collections.prototype.put = async function(req, res, next) {
  if (!req.dadiApiClient.clientId) {
    return help.sendBackJSON(null, res, next)(
      acl.createError(req.dadiApiClient)
    )
  }

  const [property, collection] = (req.params.collection || '').split('/')

  if (!property || !collection) {
    return this.handleError(new Error('SCHEMA_NOT_FOUND'), res, next)
  }

  const {fields, settings} = req.body

  try {
    const clientIsAdmin = acl.client.isAdmin(req.dadiApiClient)
    const access = await (clientIsAdmin
      ? {}
      : acl.access.get(req.dadiApiClient, 'collections'))

    // To update a collection, the client needs to be an admin or have `update`
    // access to the `collections` resource.
    if (!clientIsAdmin && !access.update) {
      return help.sendBackJSON(null, res, next)(
        acl.createError(req.dadiApiClient)
      )
    }

    const newSchema = await schemaStore.update({
      fields,
      name: collection,
      property,
      settings
    })

    if (newSchema === null) {
      return this.handleError(new Error('SCHEMA_NOT_FOUND'), res, next)
    }

    return help.sendBackJSON(200, res, next)(null, {
      results: [schemaStore.formatForOutput(newSchema)]
    })
  } catch (error) {
    return this.handleError(error, res, next)
  }
}

module.exports = server => new Collections(server)
