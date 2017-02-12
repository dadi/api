var _ = require('underscore')
var path = require('path')
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
  var schema = this.model.schema

  var composable = Object.keys(schema).filter((key) => {
    return schema[key].type === 'Reference' && doc[key] && doc[key] !== 'undefined'
  })

  if (_.isEmpty(composable)) return callback(doc)

  var keyIdx = 0

  _.each(composable, (key) => {
    var Model = require(path.join(__dirname, '/../model/index.js'))
    var mod

    var query = {}
    var returnArray = false
    var value = doc[key]

    if (value.constructor.name === 'Array') {
      query = { '_id': { '$in': _.map(value, function (val) { return val + '' }) } }
      returnArray = true
    } else {
      query = { '_id': value + '' }
    }

    // add the apiVersion param
    _.extend(query, { apiVersion: this.apiVersion })

    // are specific fields required?
    var fields = {}
    var schemaFields = help.getFromObj(schema, key + '.settings.fields', [])

    _.each(schemaFields, function (field) {
      fields[field] = 1
    })

    // load correct model
    var collection = help.getFromObj(schema, key + '.settings', null)

    if (collection && collection.collection && collection.collection !== this.model.name) {
      mod = Model(collection.collection)
    } else {
      mod = Model(this.model.name)
    }

    if (!mod) {
      callback(null)
    } else {
      // does the collection allow us to compose references beyond the first one
      // (i.e. the one that got us here) ?
      var compose = help.getFromObj(schema, key + '.settings.compose', false) || mod.compose

      mod.find(query, { 'compose': compose, 'fields': fields }, (err, result) => {
        if (err) console.log(err)

        if (result) {
          if (result.results.length === 1 && returnArray === false) {
            doc[key] = result.results[0]
          } else {
            doc[key] = result.results
          }
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

        keyIdx++

        if (keyIdx === composable.length) {
          callback(doc)
        }
      })
    }
  })
}

// exports
module.exports = function (model) {
  if (model) return new Composer(model)
}

module.exports.Composer = Composer
