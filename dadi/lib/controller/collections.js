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

  server.app.routeMethods('/api/collections', {
    post: this.post.bind(this)
  })

  server.app.routeMethods('/api/collections/:version/:database/:collection/fields', {
    put: this.updateFields.bind(this)
  })

  this.server = server
}

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
    console.log('access :', access);
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
 * {
 *   "name": "school",
 *   "version": "1.0",
 *   "database": "industries",
 *   "fields": {
 *   },
 *   "settings": {
 *   }
 * }
 */
Collections.prototype.post = function (req, res, next) {
  if (typeof req.body.name !== 'string') {
    return help.sendBackJSON(400, res, next)(null, {
      success: false,
      errors: ['Invalid input. Expected: {"name": String}']
    })
  }

  return acl.access.get(req.dadiApiClient, 'collections').then(access => {
    if (access.create !== true) {
      return Promise.reject(
        acl.createError(req.dadiApiClient)
      )
    }

    return schema.create(req.body)
      .then(({results}) => {
        this.server.loadCollections(results[0].name)

        return help.sendBackJSON(201, res, next)(null, {
          results
        })
      })
  }).catch(this.handleError(res, next))
}

Collections.prototype.updateFields = function (req, res, next) {
  // if (typeof req.body.name !== 'string') {
  //   return help.sendBackJSON(400, res, next)(null, {
  //     success: false,
  //     errors: ['Invalid input. Expected: {"name": String, "collection": String}']
  //   })
  // }

//   if (!acl.hasResource(req.body.name)) {
//     return help.sendBackJSON(400, res, next)(null, {
//       success: false,
//       errors: [`Invalid resource: ${req.body.name}`]
//     })
//   }

  return schema.fieldAdd(
    req.params.schema,
    req.body
  ).then(({results}) => {
    help.sendBackJSON(201, res, next)(null, {results})
  }).catch(this.handleError(res, next))
}

module.exports = server => new Collections(server)
