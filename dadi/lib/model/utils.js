var _ = require('underscore')
var ObjectID = require('mongodb').ObjectID
var path = require('path')

var help = require(path.join(__dirname, '/../help'))

/**
 * Returns the type of field, allowing for dot notation in queries.
 * If dot notation is used, the first part of the key is used to
 * determine the field type from the schema
 */
function getSchemaOrParent (key, schema) {
  // use the key as specified or the first part after splitting on '.'
  var keyOrParent = (key.split('.').length > 1) ? key.split('.')[0] : key

  if (schema[keyOrParent]) {
    return schema[keyOrParent]
  }
}

function isReference (key, schema) {
  return key.split('.').length > 1 && getSchemaOrParent(key, schema).type === 'Reference'
}

function containsNestedReferenceFields (query, schema) {
  var result = false

  _.each(Object.keys(query), function (key) {
    if (isReference(key, schema)) {
      result = true
    }
  })

  return result
}

function processReferenceFieldQuery (query, schema) {
  var queryWith = {}
  var queryWithout = {}
  _.each(Object.keys(query), function (key) {
    if (isReference(key, schema)) {
      queryWith[key] = query[key]
    } else {
      queryWithout[key] = query[key]
    }
  })

  // sort the reference queries by deepest nesting first
  queryWith = sortQueriesByNestedLevel(queryWith)

  return [queryWithout, queryWith]
}

function sortQueriesByNestedLevel (queries) {
  var keys = Object.keys(queries).sort((a, b) => {
    var aLen = a.split('.').length
    var bLen = b.split('.').length
    if (aLen === bLen) return 0
    return aLen < bLen ? 1 : -1
  })

  return keys.reduce((r, k) => (r[k] = queries[k], r), {}) // eslint-disable-line
}

function convertApparentObjectIds (query, schema) {
  _.each(Object.keys(query), function (key) {
    if (/apiVersion/.test(key)) {
      return
    }

    var fieldSettings = getSchemaOrParent(key, schema)
    var type = fieldSettings ? fieldSettings.type : undefined

    if (key === '$in') {
      if (typeof query[key] === 'object' && _.isArray(query[key])) {
        var arr = query[key]
        _.each(arr, function (value, key) {
          if (typeof value === 'string' && ObjectID.isValid(value) && value.match(/^[a-fA-F0-9]{24}$/)) {
            arr[key] = ObjectID.createFromHexString(value)
          }
        })
        query[key] = arr
      }
    } else if (typeof query[key] === 'object' && query[key] !== null) {
      if (typeof type !== 'undefined' && /^Mixed|Object$/.test(type)) {
        // ignore
      } else if (typeof type === 'undefined' || type !== 'Reference') { // Don't convert query id when it's a Reference field
        query[key] = convertApparentObjectIds(query[key], schema)
      }
    } else if (typeof query[key] === 'string' && !/^Mixed|Object$/.test(type) && ObjectID.isValid(query[key]) && query[key].match(/^[a-fA-F0-9]{24}$/)) {
      query[key] = ObjectID.createFromHexString(query[key])
    }
  })

  return query
}

function makeCaseInsensitive (obj, schema) {
  var newObj = _.clone(obj)

  _.each(Object.keys(obj), function (key) {
    if (key === 'apiVersion') {
      return
    }

    var fieldSettings
    if (key[0] !== '$') {
      fieldSettings = getSchemaOrParent(key, schema)
    }

    if (typeof obj[key] === 'string') {
      if (ObjectID.isValid(obj[key]) && obj[key].match(/^[a-fA-F0-9]{24}$/)) {
        newObj[key] = obj[key]
      } else if (key[0] === '$' && key === '$regex') {
        newObj[key] = new RegExp(obj[key], 'i')
      } else if (key[0] === '$' && key !== '$regex') {
        newObj[key] = obj[key]
      } else {
        if (fieldSettings && fieldSettings.matchType) {
          switch (fieldSettings.matchType) {
            case 'exact':
              newObj[key] = obj[key]
              break
            case 'ignoreCase':
              newObj[key] = new RegExp(['^', help.regExpEscape(obj[key]), '$'].join(''), 'i')
              break
            default:
              newObj[key] = new RegExp(['^', help.regExpEscape(obj[key]), '$'].join(''))
          }
        } else {
          newObj[key] = new RegExp(['^', help.regExpEscape(obj[key]), '$'].join(''), 'i')
        }
      }
    } else if (typeof obj[key] === 'object' && obj[key] !== null) {
      if (key[0] === '$' && key !== '$regex') {
        newObj[key] = obj[key]
      } else {
        newObj[key] = makeCaseInsensitive(obj[key], schema)
      }
    } else {
      return obj
    }
  })

  return newObj
}

function processFilter (query, schema) {
  var newQuery = _.clone(query)

  Object.keys(query).forEach((key) => {
    if (typeof query[key] === 'string') {
      switch (query[key]) {
        case '$now':
          newQuery[key] = Math.round(new Date().getTime() / 1000.0)
          break
        default:
          newQuery[key] = query[key]
      }
    } else if (typeof query[key] === 'object' && query[key] !== null) {
      newQuery[key] = processFilter(query[key], schema)
    } else {
      newQuery[key] = query[key]
    }
  })

  return newQuery
}

function removeInternalFields (obj) {
  delete obj._id
  delete obj.createdAt
  delete obj.createdBy
  delete obj.lastModifiedAt
  delete obj.lastModifiedBy
  delete obj.v
  delete obj.apiVersion

  if (obj.composed) {
    _.each(Object.keys(obj.composed), (key) => {
      obj[key] = obj.composed[key]
    })

    delete obj.composed
  }

  return obj
}

module.exports = {
  containsNestedReferenceFields: containsNestedReferenceFields,
  convertApparentObjectIds: convertApparentObjectIds,
  getSchemaOrParent: getSchemaOrParent,
  makeCaseInsensitive: makeCaseInsensitive,
  processReferenceFieldQuery: processReferenceFieldQuery,
  processFilter: processFilter,
  removeInternalFields: removeInternalFields
}
