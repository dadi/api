const acl = require('../model/acl')
const config = require('../../../config')
const help = require('../help')
const modelStore = require('../model/')
const schemaStore = require('../model/schemaStore')
const url = require('url')

const Collections = function(server) {
  server.app.routeMethods('/api/collections', {
    get: this.getAll.bind(this),
    post: this.post.bind(this)
  })

  server.app.routeMethods('/api/collections/:property/:collection', {
    delete: this.delete.bind(this),
    get: this.getCollection.bind(this)
  })

  server.app.routeMethods('/api/collections/:property/:collection/fields', {
    post: this.updateField.bind(this)
  })

  server.app.routeMethods(
    '/api/collections/:property/:collection/fields/:field',
    {
      delete: this.updateField.bind(this),
      put: this.updateField.bind(this)
    }
  )

  server.app.routeMethods('/api/collections/:property/:collection/settings', {
    put: this.putSettings.bind(this)
  })

  this.server = server
}

Collections.prototype._getFieldsProjection = function(req) {
  try {
    const {query} = url.parse(req.url, true)
    const fields = query.fields && JSON.parse(query.fields)
    const hasFieldProjection =
      typeof fields === 'object' &&
      Object.keys(fields).every((fieldName, index) => {
        if (fields[fieldName] !== 0 && fields[fieldName] !== 1) {
          return false
        }

        const nextFieldName = Object.keys(fields)[index + 1]

        if (
          nextFieldName !== undefined &&
          fields[fieldName] !== fields[nextFieldName]
        ) {
          return false
        }

        return true
      })

    if (hasFieldProjection) {
      return {
        fields: Object.keys(fields),
        type: fields[Object.keys(fields)[0]]
      }
    }
  } catch (_) {
    // no-op
  }
}

Collections.prototype.delete = async function(req, res, next) {
  if (!req.dadiApiClient.clientId) {
    return help.sendBackJSON(null, res, next)(
      acl.createError(req.dadiApiClient)
    )
  }

  const {collection, property} = req.params

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

Collections.prototype.getAll = async function(req, res, next) {
  if (!req.dadiApiClient.clientId) {
    return help.sendBackJSON(null, res, next)(
      acl.createError(req.dadiApiClient)
    )
  }

  const fieldsProjection = this._getFieldsProjection(req)

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
          fields: model.schema,
          property: model.property,
          name: (model.settings && model.settings.displayName) || model.name,
          slug: model.name,
          path: `/${model.property}/${model.name}`,
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

        if (fieldsProjection) {
          const {fields, type} = fieldsProjection

          return Object.keys(data).reduce((result, fieldName) => {
            if (
              (type === 1 && fields.includes(fieldName)) ||
              (type === 0 && !fields.includes(fieldName))
            ) {
              result[fieldName] = data[fieldName]
            }

            return result
          }, {})
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

Collections.prototype.getCollection = async function(req, res, next) {
  if (!req.dadiApiClient.clientId) {
    return help.sendBackJSON(null, res, next)(
      acl.createError(req.dadiApiClient)
    )
  }

  try {
    const fieldsProjection = this._getFieldsProjection(req)
    const {collection, property} = req.params
    const clientIsAdmin = acl.client.isAdmin(req.dadiApiClient)
    const access = await (clientIsAdmin
      ? {}
      : acl.access.get(req.dadiApiClient))
    const model = modelStore.get({
      name: collection,
      property
    })

    if (!model || !model.isListable) {
      return this.handleError(new Error('SCHEMA_NOT_FOUND'), res, next)
    }

    const {aclKey} = model
    const hasReadAccess = access[aclKey] && access[aclKey].read

    if (!clientIsAdmin && !hasReadAccess) {
      return this.handleError(new Error('SCHEMA_NOT_FOUND'), res, next)
    }

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

    const formattedData = fieldsProjection
      ? Object.keys(data).reduce((result, fieldName) => {
          const {fields, type} = fieldsProjection

          if (
            (type === 1 && fields.includes(fieldName)) ||
            (type === 0 && !fields.includes(fieldName))
          ) {
            result[fieldName] = data[fieldName]
          }

          return result
        }, {})
      : data

    return help.sendBackJSON(200, res, next)(null, formattedData)
  } catch (error) {
    return this.handleError(error, res, next)
  }
}

Collections.prototype.handleError = function(error, res, next) {
  switch (error.message) {
    case 'FIELD_ALREADY_EXISTS':
      return help.sendBackJSON(419, res, next)(null, {
        success: false,
        errors: [
          {
            code: 'ERROR_FIELD_EXISTS',
            field: error.field,
            message: 'already exists in the collection'
          }
        ]
      })

    case 'FIELD_NOT_FOUND':
      return help.sendBackJSON(404, res, next)(null, {
        success: false
      })

    case 'SCHEMA_EXISTS':
      return help.sendBackJSON(409, res, next)(null, {
        success: false,
        errors: [
          {
            code: 'ERROR_COLLECTION_EXISTS',
            message: 'The collection already exists'
          }
        ]
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

  const {fields = null, name, property, settings} = req.body

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

Collections.prototype.putSettings = async function(req, res, next) {
  if (!req.dadiApiClient.clientId) {
    return help.sendBackJSON(null, res, next)(
      acl.createError(req.dadiApiClient)
    )
  }

  const {collection, property} = req.params

  if (!property || !collection) {
    return this.handleError(new Error('SCHEMA_NOT_FOUND'), res, next)
  }

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

    const newSchema = await schemaStore.updateSettings({
      name: collection,
      property,
      settings: req.body
    })

    return help.sendBackJSON(200, res, next)(
      null,
      schemaStore.formatForOutput(newSchema)
    )
  } catch (error) {
    return this.handleError(error, res, next)
  }
}

Collections.prototype.updateField = async function(req, res, next) {
  if (!req.dadiApiClient.clientId) {
    return help.sendBackJSON(null, res, next)(
      acl.createError(req.dadiApiClient)
    )
  }

  const {method, params} = req
  const {collection, field, property} = params

  if (!property || !collection) {
    return this.handleError(new Error('SCHEMA_NOT_FOUND'), res, next)
  }

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

    let newSchema = null

    switch (method) {
      case 'DELETE': {
        newSchema = await schemaStore.deleteFields({
          fields: [field],
          name: collection,
          property
        })

        break
      }

      case 'POST': {
        const {name} = req.body
        const schema = Object.assign({}, req.body)

        // We don't want the `name` property in the field's schema.
        delete schema.name

        newSchema = await schemaStore.addFields({
          fields: {
            [name]: schema
          },
          name: collection,
          property
        })

        break
      }

      case 'PUT': {
        newSchema = await schemaStore.updateFields({
          fields: {
            [field]: req.body
          },
          name: collection,
          property
        })

        break
      }
    }

    return help.sendBackJSON(200, res, next)(
      null,
      schemaStore.formatForOutput(newSchema)
    )
  } catch (error) {
    return this.handleError(error, res, next)
  }
}

module.exports = server => new Collections(server)
