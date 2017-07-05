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

/**
 *
 * @param {Array} obj - an array of documents
 */
Composer.prototype.compose = function (obj, callback) {
  if (_.isEmpty(obj)) return callback(obj)

  // determine composable fields from all documents in the set
  var composable = this.getComposable(obj)

  if (_.isEmpty(composable)) return callback(obj)

  // for each composable field (Reference fields)
  //   get array of id values from all documents
  //   get fields required from schema
  //   query model using array of ids and fields object
  //   populate each document's composable property with results

  // a clone of the passed in object
  var composeCopy = queryUtils.snapshot(obj)

  var queue = []
  var data = {}

  for (var i = 0; i < composable.length; i++) {
    var field = composable[i]
    var ids = _.uniq(_.compact(_.pluck(composeCopy, field)))

    if (Array.isArray(ids[0])) {
      ids = _.flatten(ids)
    }

    // remove any remaining null values
    ids = _.compact(ids)

    var fields = this.getFields(field)
    var query = { '_id': { '$in': _.map(ids, id => { return id.toString() }) } }
    var model = this.getModel(field)

    if (model) {
      var compose = this.getComposeValue(field, model)

      queue.push(
        new Promise((resolve, reject) => {
          var f = field

          model.find(query, { 'compose': compose, 'fields': fields }, (err, result) => {
            if (err) return reject(err)

            data[f] = result.results
            return resolve()
          })
        })
      )
    }
  }

  Promise.all(queue).then(results => {
    var fields = Object.keys(data)
    var fieldNum = 0

    fields.forEach(field => {
      var docIdx = 0
      fieldNum++

      // reference the correct database results within the data object
      var fieldData = data[field]

      // populate each document's composable property with results
      composeCopy.forEach(document => {
        var isArray = Array.isArray(document[field])
        var originalValue = isArray ? document[field] : [document[field]]

        // add the composed property indicating original values
        if (!document.composed) document.composed = {}
        document.composed[field] = isArray ? originalValue : originalValue[0]

        if (isArray) {
          document[field] = []
        }

        docIdx++

        var idx = 0

        // handles empty array
        if (originalValue.length === 0 && fieldNum === fields.length && docIdx === obj.length) {
          return callback(obj)
        } else {
          _.each(originalValue, (id) => {
            var results = _.filter(fieldData, r => { return id && r._id.toString() === id.toString() })

            // Are we composing media documents? If so, we need to format them
            // before returning. This should really go somewhere else, it needs
            // to be revisited! --eb 03/05/2017
            if (results.length && results[0].apiVersion === 'media') {
              results[0] = mediaModel.formatDocuments(results[0])
            }

            if (isArray) {
              if (_.isEmpty(results)) {
                // no results, add the original id value to the array
                document[field].push(id)
              } else {
                document[field].push(results[0])
              }
            } else {
              if (_.isEmpty(results)) {
                // no results, assign the original id value to the property
                document[field] = id
              } else {
                document[field] = results[0]
              }
            }

            idx++

            if (fieldNum === fields.length && docIdx === composeCopy.length && idx === originalValue.length) {
              return callback(composeCopy)
            }
          })
        }
      })
    })
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

  _.each(composable, key => {
    var model = this.getModel(key)
    var value = doc[key]

    if (Array.isArray(value)) {
      _.each(value, (val) => {
        if (val && val.constructor === Object) {
          queue.push(this.createOrUpdate(model, key, val, req))
        }
      })
    } else if (value && value.constructor === Object) {
      queue.push(this.createOrUpdate(model, key, value, req))
    }
  })

  Promise.all(queue).then((results) => {
    var allProperties = {}

    _.each(_.compact(results), result => {
      var key = Object.keys(result)[0]

      if (!allProperties[key]) {
        // add the value to the field as a simple string
        allProperties[key] = result[key]
      } else {
        // create an array for this key, another value needs to be added
        if (!Array.isArray(allProperties[key])) {
          allProperties[key] = [allProperties[key]]
        }

        // push the new value
        allProperties[key].push(result[key])
      }
    })

    doc = _.extend(doc, allProperties)

    return callback(null, doc)
  }).catch((err) => {
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
 * Returns an array of Reference field names from the schema for the specified documents
 *
 * @param {Array|Object} obj - an array of JSON documents being processed, or a single document
 * @returns {Array}
 */
Composer.prototype.getComposable = function (obj) {
  if (!Array.isArray(obj)) {
    obj = [obj]
  }

  var composableKeys = []

  _.each(obj, doc => {
    var keys = Object.keys(this.model.schema).filter((key) => {
      return this.model.schema[key].type === 'Reference' && doc[key] && typeof doc[key] !== 'undefined'
    })

    composableKeys = _.union(composableKeys, keys)
  })

  return composableKeys
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

/**
 *
 */
Composer.prototype.getFields = function (field) {
  var fields = {}
  var schemaFields = help.getFromObj(this.model.schema, field + '.settings.fields', [])

  _.each(schemaFields, (field) => {
    fields[field] = 1
  })

  return fields
}

/**
 *
 */
Composer.prototype.getComposeValue = function (field, model) {
  return help.getFromObj(this.model.schema, field + '.settings.compose', false) || model.compose
}

// exports
module.exports = function (model) {
  if (model) return new Composer(model)
}

module.exports.Composer = Composer
