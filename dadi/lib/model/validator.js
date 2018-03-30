'use strict'

// Validation should:
//   ensure that no queries use `$` operators at top level
//   ensure that all objects are JSON
//   ensure that field validation passes for inserts and updates

var _ = require('underscore')
var path = require('path')
var datastore = require(path.join(__dirname, '../datastore'))()
var validator = require('validator')
var ignoredKeys = _.union(
  [
    '_id',
    '_apiVersion',
    '_version',
    '_history',
    '_createdAt',
    '_createdBy',
    '_lastModifiedAt',
    '_lastModifiedBy'
  ],
  datastore.settings.internalProperties || []
)

var Validator = function (model) {
  this.model = model
}

Validator.prototype.query = function (query) {
  var response = { success: true, errors: [] }

  if (!Array.isArray(query) && !_.isObject(query)) {
    response.success = false
    response.errors.push({
      message: 'Query must be either a JSON array or a JSON object.'
    })

    return response
  }

  Object.keys(query).every(key => {
    if (key === '$where') {
      response.success = false
      response.errors.push({
        message: 'Bad query'
      })
    }
  })

  return response
}

Validator.prototype.schema = function (obj, update) {
  update = update || false

  // `obj` must be a "hash type object", i.e. { ... }
  if (typeof obj !== 'object' || Array.isArray(obj) || obj === null) return false

  var response = {
    success: true,
    errors: []
  }

  var schema = this.model.schema

  // check for default fields, assign them if the obj didn't
  // provide a value (unless we're updating a document)
  if (!update) {
    Object.keys(schema)
      .filter(function (key) { return schema[key].default || (schema[key].default === false) })
      .forEach(function (key) {
        if (!obj.hasOwnProperty(key)) {
          obj[key] = schema[key].default
        }
      })
  }

  // check that all required fields are present
  Object.keys(schema)
    .filter(function (key) { return schema[key].required })
    .forEach(function (key) {
      // if it's an insert and a required field isn't found, error
      if (!obj.hasOwnProperty(key) && !update) {
        response.success = false
        response.errors.push({field: key, message: 'must be specified'})
      } else if (obj.hasOwnProperty(key) && (typeof obj[key] === 'undefined' || obj[key] === '')) {
        // if it's a required field and is blank or null, error
        response.success = false
        response.errors.push({ field: key, message: 'can\'t be blank' })
      }
    })

  // check all `obj` fields
  this._parseDocument(obj, schema, response)
  return response
}

Validator.prototype._parseDocument = function (obj, schema, response) {
  var keys = _.difference(Object.keys(obj), ignoredKeys)
  var err = false

  keys.forEach(key => {
    if (!schema[key]) {
      response.success = false
      response.errors.push({
        collection: this.model.name,
        field: key,
        message: "doesn't exist in the collection schema",
        data: obj
      })
    } else {
      // handle objects first
      if (typeof obj[key] === 'object') {
        if (schema[key] && (schema[key].type === 'Mixed' || schema[key].type === 'Object')) {
          // do nothing
        } else if (schema[key] && schema[key].type === 'Reference') {
          // bah!
        } else if (obj[key] !== null && !Array.isArray(obj[key])) {
          this._parseDocument(obj[key], schema, response)
        } else if (obj[key] !== null && schema[key] && schema[key].type === 'ObjectID' && Array.isArray(obj[key])) {
          err = this._validate(obj[key], schema[key], key)

          if (err) {
            response.success = false
            response.errors.push({field: key, message: err})
          }
        } else if (Array.isArray(obj[key]) && schema[key] && (schema[key].type === 'String')) {
          // We allow type `String` to actually be an array of Strings. When this
          // happens, we run the validation against the combination of all strings
          // glued together.

          err = this._validate(obj[key].join(''), schema[key], key)

          if (err) {
            response.success = false
            response.errors.push({field: key, message: err})
          }
        }
      } else {
        err = this._validate(obj[key], schema[key], key)

        if (err) {
          response.success = false
          response.errors.push({field: key, message: err})
        }
      }
    }
  })
}

Validator.prototype._validate = function (field, schema, key) {
  if (schema.validation) {
    var validationObj = schema.validation

    if (validationObj.regex && validationObj.regex.pattern) {
      var pattern = validationObj.regex.pattern

      if (Object.prototype.toString.call(pattern) === '[object RegExp]') {
        pattern = pattern.source
      }

      var flags = typeof validationObj.regex.flags === 'string' ? validationObj.regex.flags : ''
      var re = new RegExp(pattern, flags)

      if (re.exec(field) === null) {
        return schema.message || 'should match the pattern ' + pattern
      }
    }

    if (validationObj.minLength && field.toString().length < Number(validationObj.minLength)) return schema.message || 'is too short'
    if (validationObj.maxLength && field.toString().length > Number(validationObj.maxLength)) return schema.message || 'is too long'
  }

  var primitives = ['String', 'Number', 'Boolean', 'Array', 'Date', 'DateTime']

  var message
  var newSchema

  // check length
  if (schema.limit) {
    newSchema = {}
    newSchema[key] = _.clone(schema)
    newSchema[key].validation = { maxLength: schema.limit }
    delete newSchema[key].limit
    message = 'The use of the `limit` property in field declarations is deprecated and was removed in v1.8.0\n\nPlease use the following instead:\n\n'
    message += JSON.stringify(newSchema, null, 2)
    throw new Error(message)
  }

  // check validation regex
  if (schema.validationRule) {
    newSchema = {}
    newSchema[key] = _.clone(schema)
    newSchema[key].validation = { regex: { pattern: schema.validationRule } }
    delete newSchema[key].validationRule
    message = 'The use of the `validationRule` property in field declarations is deprecated and was removed in v1.8.0\n\nPlease use the following instead:\n\n'
    message += JSON.stringify(newSchema, null, 2)
    throw new Error(message)
  }

  if (schema.type === 'ObjectID') {
    if (typeof field === 'object' && _.isArray(field)) {
      for (var i = field.length - 1; i >= 0; i--) {
        var val = field[i]
        if (typeof val !== 'string' || !validator.isMongoId(val)) {
          return val + ' is not a valid ObjectID'
        }
      }
    } else if (typeof field === 'string') {
      if (!validator.isMongoId(field)) return 'is not a valid ObjectID'
    } else {
      return 'is wrong type'
    }
  }

  // if (schema.type === 'DateTime') {
  //   if (new Date(field).toString() === 'Invalid Date') {
  //     return 'is not a valid DateTime'
  //   }
  // }

  // allow Mixed/ObjectID/Reference/DateTime fields through,
  // but check all other types
  if (['Mixed', 'ObjectID', 'Reference', 'DateTime'].includes(schema.type) === false) {
    // check constructor of field against primitive types and check the type of field == the specified type
    // using constructor.name as array === object in typeof comparisons
    try {
      if (~primitives.indexOf(field.constructor.name) && schema.type !== field.constructor.name) return schema.message || 'is wrong type'
    } catch (e) {
      return schema.message || 'is wrong type'
    }
  }
}

module.exports = Validator
