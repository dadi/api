var path = require('path')
var Model = require(path.join(__dirname, '/../model'))

var schema = {
  'fields': {
    'fileName': {
      'type': 'String',
      'required': true
    },
    'mimetype': {
      'type': 'String',
      'required': true
    },
    'path': {
      'type': 'String',
      'required': true
    },
    'awsUrl': {
      'type': 'String',
      'required': false
    },
    'width': {
      'type': 'Number',
      'required': true
    },
    'height': {
      'type': 'Number',
      'required': true
    },
    'contentLength': {
      'type': 'Number',
      'required': false
    }
  },
  'settings': {
    'cache': true,
    'authenticate': true,
    'count': 40,
    'sort': 'filename',
    'sortOrder': 1,
    'storeRevisions': false
  }
}

var MediaModel = function (collectionName) {
  this.documentModel = Model(collectionName, schema.fields, null, schema.settings, null)
}

MediaModel.prototype.create = function (obj, internals, done, req) {
  return this.documentModel.create(obj, internals, done, req)
}

MediaModel.prototype.get = function (query, options, done, req) {
  return this.documentModel.get(query, options, done, req)
}

MediaModel.prototype.getSchema = function () {
  return schema
}

module.exports = MediaModel
module.exports.Schema = schema
