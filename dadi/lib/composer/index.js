'use strict'

var _ = require('underscore')
var path = require('path')
var mediaModel = require(path.join(__dirname, '../model/media'))
var queryUtils = require(path.join(__dirname, '../model/utils'))

var help = require(path.join(__dirname, '/../help'))

var Composer = function (model) {
  this.model = model
}

Composer.prototype.setApiVersion = function (apiVersion) {
  this.apiVersion = apiVersion
}

Composer.prototype.compose = function (obj, callback) {
  if (_.isEmpty(obj)) return callback(obj)

  var docIdx = 0

  _.each(obj, (doc) => {
    this.composeOne(doc, (result) => {
      doc = result
      docIdx++

      if (docIdx === obj.length) {
        return callback(obj)
      }
    })
  })
}

Composer.prototype.composeOne = function (doc, callback) {
  var composable = this.getComposable(doc)

  if (_.isEmpty(composable)) return callback(doc)

  _.each(composable, (key, idx) => {
    var query = {}
    var returnArray = false
    var value = doc[key]

    if (!value) return callback(null)

    if (value.constructor === Object) {
      if (idx === composable.length - 1) {
        callback(doc)
      }
    } else {
      if (Array.isArray(value)) {
        query = { '_id': { '$in': _.map(value, function (val) { return val + '' }) } }
        returnArray = true
      } else {
        query = { '_id': value + '' }
      }

      // are specific fields required?
      var fields = {}
      var schemaFields = help.getFromObj(this.model.schema, key + '.settings.fields', [])

      _.each(schemaFields, (field) => {
        fields[field] = 1
      })

      // load correct model
      var model = this.getModel(key)

      if (!model) {
        callback(null)
      } else {
        // does the collection allow us to compose references beyond the first one
        // (i.e. the one that got us here) ?
        var compose = help.getFromObj(this.model.schema, key + '.settings.compose', false) || model.compose

        model.find(query, { 'compose': compose, 'fields': fields }, (err, result) => {
          if (err) console.log(err)

          let isMediaDocument = false

          if (result) {
            if (result.results.length === 1 && returnArray === false) {
              doc[key] = result.results[0]
            } else {
              doc[key] = result.results
            }

            if (result.results.length && result.results[0].apiVersion === 'media') {
              isMediaDocument = true
            }
          }

          // Are we composing a media document? If so, we need to format it
          // before returning. This should really go somewhere else, it needs
          // to be revisited! --eb 03/05/2017
          if (isMediaDocument) {
            doc[key] = mediaModel.formatDocuments(doc[key])
          }

          if (!doc.composed) doc.composed = {}
          doc.composed[key] = value

          // if an array, ensure the composed values appear
          // in the same order as the original array
          if (value.constructor.name === 'Array') {
            doc[key] = doc[key].sort((a, b) => {
              var aIndex = value.indexOf(a._id.toString())
              var bIndex = value.indexOf(b._id.toString())

              if (aIndex === bIndex) return 0
              return aIndex < bIndex ? -1 : 1
            })
          }

          if (idx === composable.length - 1) {
            callback(doc)
          }
        })
      }
    }
  })
}

/**
 * Given a pre-composed JSON document, creates or updates subdocuments according to
 * the Reference field settings contained in the schema
 *
 * @param {Object} doc - the JSON document being processed
 * @param {Object} req - the original HTTP request
 * @param {Function} callback - the function to call when finished. Accepts two arguments: `err`, `updatedDoc`
 */
Composer.prototype.createFromComposed = function (doc, req, callback) {
  var composable = this.getComposable(doc)

  if (_.isEmpty(composable)) return callback(null, doc)

  var queue = []

  _.each(composable, (key, idx) => {
    var model = this.getModel(key)
    var value = doc[key]

    if (Array.isArray(value)) {
      _.each(value, (val) => {
        if (val.constructor === Object) {
          queue.push(this.createOrUpdate(model, key, val, req))
        }
      })
    } else if (value.constructor === Object) {
      queue.push(this.createOrUpdate(model, key, value, req))
    }
  })

  Promise.all(queue).then((results) => {
    var allProperties = {}

    _.each(_.compact(results), (result) => {
      var key = Object.keys(result)[0]
      if (!allProperties[key]) {
        allProperties[key] = result[key]
      } else {
        allProperties[key] = [allProperties[key]]
        allProperties[key].push(result[key])
      }
    })

    doc = _.extend(doc, allProperties)

    return callback(null, doc)
  }).catch((err) => {
    // console.log('Promise error')
    return callback(err, null)
  })
}

/**
 * Creates a new document or updates an existing one
 *
 * @param {Model} model - the model instance for the collection
 * @param {string} field - the name Reference field containing the subdocument
 * @param {Object} obj - the subdocument that is the content of the Reference field
 * @param {Object} req - the original HTTP request
 */
Composer.prototype.createOrUpdate = function (model, field, obj, req) {
  console.log('> createOrUpdate', model.name, field, obj)
  return new Promise((resolve, reject) => {
    var internals = {
      apiVersion: this.apiVersion
    }

    if (obj._id) {
      internals.lastModifiedAt = Date.now()
      if (req && req.client) {
        internals.lastModifiedBy = req.client && req.client.clientId
      }

      var query = {
        _id: obj._id
      }

      var update = queryUtils.removeInternalFields(obj)

      // add the apiVersion filter
      // if (config.get('query.useVersionFilter')) {
      //   query.apiVersion = internals.apiVersion
      // }

      model.update(query, update, internals, (err, results) => {
        if (err) {
          return reject(err)
        }

        var newDoc = results && results.results && results.results[0]
        var result = {}
        result[field] = newDoc._id.toString()
        return resolve(result)
      })
    } else {
      // if no id is present, then this is a create
      internals.createdAt = Date.now()

      if (req && req.client) {
        internals.createdBy = req.client && req.client.clientId
      }

      model.create(obj, internals, (err, results) => {
        if (err) {
          return reject(err)
        }

        var newDoc = results && results.results && results.results[0]
        var result = {}
        result[field] = newDoc._id.toString()
        return resolve(result)
      })
    }
  })
}

/**
 * Returns an array of Reference field names from the schema for the specified document
 *
 * @param {Object} doc - the JSON document being processed
 * @returns {Array}
 */
Composer.prototype.getComposable = function (doc) {
  return Object.keys(this.model.schema).filter((key) => {
    return this.model.schema[key].type === 'Reference' && doc[key] && typeof doc[key] !== 'undefined'
  })
}

/**
 * Returns a model instance for the specified field
 *
 * @param {string} field - the name of the reference field
 */
Composer.prototype.getModel = function (field) {
  var Model = require(path.join(__dirname, '/../model/index.js'))

  // get the name of the collection specified by the Reference field
  // if not specified, return null and use the current model
  var collection = help.getFromObj(this.model.schema, field + '.settings', null)

  if (collection && collection.collection && collection.collection !== this.model.name) {
    return Model(collection.collection)
  } else {
    return Model(this.model.name)
  }
}

// exports
module.exports = function (model) {
  if (model) return new Composer(model)
}

module.exports.Composer = Composer
