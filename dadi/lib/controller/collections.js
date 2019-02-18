const acl = require('./../model/acl')
const config = require('./../../../config')
const help = require('./../help')
const schema = require('./../model/schema')

const Collections = function (server) {
  acl.registerResource(
    'collections'
  )

  server.app.routeMethods('/api/collections', {
    get: this.get.bind(this)
  })

  server.app.routeMethods('/api/collections/:version?/:database?/:collection?', {
    delete: this.delete.bind(this),
    get: this.get.bind(this)
  })

  server.app.routeMethods('/api/collections/:version/:database/:collection', {
    post: this.post.bind(this)
  })

  server.app.routeMethods('/api/collections/:version/:database/:collection/:type', {
    put: this.put.bind(this)
  })

  this.server = server
}

/**
 * Delete a collection schema from the database.
 * Usage: DELETE /api/collections/version/database/collection
 *
 * @param  {IncomingMessage} req
 * @param  {ServerResponse} res
 * @param  {Function} next
 */
Collections.prototype.delete = function (req, res, next) {
  let collection = {
    database: req.params.database,
    name: req.params.collection,
    version: req.params.version
  }

  return acl.access.get(req.dadiApiClient, 'collections').then(access => {
    if (access.delete !== true) {
      return Promise.reject(
        acl.createError(req.dadiApiClient)
      )
    }
  }).then(() => {
    return schema.get(collection)
  }).then(collections => {
    if (collections.results.length === 0) {
      return Promise.reject(
        new Error('COLLECTION_NOT_FOUND')
      )
    }

    return schema.delete(collection)
  }).then(response => {
    this.server.unloadCollection(collection)

    help.sendBackJSON(204, res, next)(null, null)
  }).catch(this.handleError(res, next))
}

/**
 * Get all collections or a specific collection from the database.
 * Usage: GET /api/collections (optionally add /version/database/collection)
 *
 * @param  {IncomingMessage} req
 * @param  {ServerResponse} res
 * @param  {Function} next
 */
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
    // if (!clientIsAdmin && access.read !== true) {
    //   return Promise.reject(
    //     acl.createError(req.dadiApiClient)
    //   )
    // }

    console.log(access)

    let collections = Object.keys(this.server.components).filter(key => {
      if (this.server.components[key]._type !== this.server.COMPONENT_TYPE.COLLECTION) {
        return false
      }

      let aclKey = this.server.components[key].model.aclKey

      console.log(aclKey)

      if (!clientIsAdmin && (!access[aclKey] || !access[aclKey].read)) {
        return false
      }

      return true
    }).map(key => {
      // If a specific collection is requested, return false for all others.
      if (req.params.version && req.params.database && req.params.collection) {
        if (key !== `/${req.params.version}/${req.params.database}/${req.params.collection}`) {
          return false
        }
      }

      let model = this.server.components[key].model
      let parts = key.split('/')

      let data = {
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
    .filter(Boolean)
    .sort((a, b) => {
      if (a.path === b.path) {
        return 0
      }

      return (a.path < b.path) ? -1 : 1
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

Collections.prototype.handleError = function (res, next) {
  return err => {
    switch (err.message) {
      case 'INVALID_FIELDS':
        return help.sendBackJSON(400, res, next)(null, {
          success: false,
          errors: err.data.map(field => `Invalid field: ${field}`)
        })

      case 'MISSING_FIELDS':
        return help.sendBackJSON(400, res, next)(null, {
          success: false,
          errors: err.data.map(field => `Missing field: ${field}`)
        })

      case 'INVALID_FIELD_TYPE':
        return help.sendBackJSON(400, res, next)(null, {
          success: false,
          errors: [`Invalid type: ${err.data}`]
        })

      case 'FORBIDDEN':
      case 'UNAUTHORISED':
        return help.sendBackJSON(null, res, next)(err)

      case 'COLLECTION_EXISTS':
        return help.sendBackJSON(409, res, next)(null, {
          success: false,
          errors: ['The collection already exists']
        })

      case 'COLLECTION_NOT_FOUND':
        return help.sendBackJSON(404, res, next)(null, null)

      default:
        return help.sendBackJSON(400, res, next)(null, {
          success: false,
          errors: ['Could not perform operation']
        })
    }
  }
}

/**
 * Create a collection in the database.
 * Usage: POST /api/collections/version/database/collection
 * Example:
 * {
 *   "fields": {
 *   },
 *   "settings": {
 *   }
 * }
 *
 * @param  {IncomingMessage} req
 * @param  {ServerResponse} res
 * @param  {Function} next
 */
Collections.prototype.post = function (req, res, next) {
  if (typeof req.body.fields !== 'object' || typeof req.body.settings !== 'object') {
    return help.sendBackJSON(400, res, next)(null, {
      success: false,
      errors: ['Invalid input. Expected: {"fields": Object, "settings": Object}']
    })
  }

  return acl.access.get(req.dadiApiClient, 'collections').then(access => {
    if (access.create !== true) {
      return Promise.reject(
        acl.createError(req.dadiApiClient)
      )
    }

    let collection = {
      database: req.params.database,
      name: req.params.collection,
      version: req.params.version,
      ...req.body
    }

    return schema.create(collection)
      .then(({results}) => {
        this.server.loadCollections(results[0].name)

        return help.sendBackJSON(201, res, next)(null, {
          results
        })
      })
  }).catch(this.handleError(res, next))
}

/**
 * Update a specific collection in the database. Specify final "type" parameter as
 * "fields" or "settings".
 * Usage: PUT /api/collections/version/database/collection/fields|settings
 *
 * @param  {IncomingMessage} req
 * @param  {ServerResponse} res
 * @param  {Function} next
 */
Collections.prototype.put = function (req, res, next) {
  if (!['fields', 'settings'].includes(req.params.type)) {
    help.sendBackJSON(404, res, next)(null)
  }

  return acl.access.get(req.dadiApiClient, 'collections').then(access => {
    if (access.update !== true) {
      return Promise.reject(
        acl.createError(req.dadiApiClient)
      )
    }
  }).then(() => {
    let collection = {
      database: req.params.database,
      name: req.params.collection,
      version: req.params.version
    }

    return schema.update(collection, req.body, req.params.type)
      .then(({results}) => {
        this.server.loadCollections(results[0].name)

        help.sendBackJSON(200, res, next)(null, {results})
      })
  }).catch(this.handleError(res, next))
}

module.exports = server => new Collections(server)
