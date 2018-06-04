const acl = require('./../model/acl')
const fs = require('fs-extra')
const help = require('./../help')
const path = require('path')

const CreateCollection = function (server) {
  server.app.routeMethods('/:version/:database/:collectionName/config', {
    post: this.post.bind(this)
  })

  this.server = server
}

CreateCollection.prototype.post = function (req, res, next) {
  // The hooks config endpoint also shares this structure, so if the
  // URL starts with /api, we move on to the next handler.
  if (req.params.version === 'api') return next()

  // Accessible to root users only.
  return acl.access.get(req.dadiApiClient).then(access => {
    if (!access.create) {
      return help.sendBackJSON(401, res, next)(
         new Error('UNAUTHORISED')
      )
    }

    let schema = req.body
    let validation = help.validateCollectionSchema(schema)

    if (!validation.success) {
      let err = new Error('Collection schema validation failed')

      err.statusCode = 400
      err.success = validation.success
      err.errors = validation.errors

      return next(err)
    }

    let params = req.params

    // Use params.collectionName as default, override if the schema supplies a 'model' property.
    let name = schema.model || params.collectionName

    schema.settings = schema.settings || {}
    schema.settings.lastModifiedAt = Date.now()

    let route = [
      '',
      params.version,
      params.database,
      name
    ].join('/')

    // If the component already exists, pass it on to the next handler.
    if (this.server.components[route]) {
      return next()
    }

    this.server.createDirectoryStructure(
      path.join(params.version, params.database)
    )

    let schemaPath = path.join(
      this.server.collectionPath,
      params.version,
      params.database,
      `collection.${name}.json`
    )

    try {
      fs.writeFile(schemaPath, JSON.stringify(schema, null, 2), err => {
        if (err) return next(err)

        help.sendBackJSON(201, res, next)(null, {
          success: true,
          message: `Collection created: ${name}`
        })
      })
    } catch (err) {
      next(err)
    }
  })
}

module.exports = server => new CreateCollection(server)
