var _ = require('underscore-contrib')
var moment = require('moment')
var path = require('path')
var validator = require('validator')

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

// function convertApparentObjectIds (query, schema) {
//   // TODO: move this to mongo store
//   console.log('>>>>> convertApparentObjectIds')
//
//   // _.each(Object.keys(query), function (key) {
//   //   if (/apiVersion/.test(key)) {
//   //     return
//   //   }
//   //
//   //   var fieldSettings = getSchemaOrParent(key, schema)
//   //   var type = fieldSettings ? fieldSettings.type : undefined
//   //
//   //   if (key === '$in') {
//   //     if (typeof query[key] === 'object' && _.isArray(query[key])) {
//   //       var arr = query[key]
//   //
//   //       _.each(arr, (value, key) => {
//   //         if (typeof value === 'string' && ObjectID.isValid(value) && value.match(/^[a-fA-F0-9]{24}$/)) {
//   //           arr[key] = ObjectID.createFromHexString(value)
//   //         }
//   //       })
//   //       query[key] = arr
//   //     }
//   //   } else if (typeof query[key] === 'object' && query[key] !== null) {
//   //     if (typeof type !== 'undefined' && /^Mixed|Object$/.test(type)) {
//   //       // ignore
//   //     } else if (typeof type === 'undefined' || type !== 'Reference') { // Don't convert query id when it's a Reference field
//   //       query[key] = convertApparentObjectIds(query[key], schema)
//   //     }
//   //   } else if (typeof query[key] === 'string' && !/^Mixed|Object$/.test(type) && ObjectID.isValid(query[key]) && query[key].match(/^[a-fA-F0-9]{24}$/)) {
//   //     query[key] = ObjectID.createFromHexString(query[key])
//   //   }
//   // })
//
//   return query
// }

function makeCaseInsensitive (obj, schema) {
  var newObj = _.clone(obj)

  _.each(Object.keys(obj), function (key) {
    if (key === '_apiVersion' || key === '_id') {
      return
    }

    var fieldSettings = {}

    if (key[0] !== '$') {
      fieldSettings = getSchemaOrParent(key, schema)
    }

    if (typeof obj[key] === 'string') {
      if (validator.isMongoId(obj[key]) || validator.isUUID(obj[key])) { // && obj[key].match(/^[a-fA-F0-9]{24}$/)) {
        newObj[key] = obj[key]
      } else if (key[0] === '$' && key === '$regex') {
        newObj[key] = new RegExp(obj[key], 'i')
      } else if (key[0] === '$' && key !== '$regex') {
        newObj[key] = obj[key]
      } else {
        if (fieldSettings.matchType) {
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
      } else if (Object.prototype.toString.call(obj[key]) === '[object RegExp]') {
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

function convertDateTimeForSave (schema, obj) {
  Object.keys(schema).filter(function (key) {
    return schema[key].type === 'DateTime' && obj[key] !== null && !_.isUndefined(obj[key])
  }).forEach(key => {
    console.log(key, schema[key], obj[key])
    switch (schema[key].format) {
      case 'unix':
        obj[key] = moment(obj[key]).valueOf()
        break
      case 'iso':
        obj[key] = new Date(moment(obj[key]).toISOString())
        break
      default:
        if (schema[key].format) {
          obj[key] = moment(obj[key], schema[key].format || ['MM-DD-YYYY', 'YYYY-MM-DD', 'DD MMMM YYYY', 'DD/MM/YYYY']).format()
        } else {
          obj[key] = new Date(moment(obj[key])).toISOString()
        }
    }
  })

  return obj
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
  delete obj._createdAt
  delete obj._createdBy
  delete obj._lastModifiedAt
  delete obj._lastModifiedBy
  delete obj._version
  delete obj._apiVersion

  if (obj._composed) {
    _.each(Object.keys(obj._composed), (key) => {
      obj[key] = obj._composed[key]
    })

    delete obj._composed
  }

  return obj
}

function stringifyProperties (obj) {
  _.each(Object.keys(obj), (key) => {
    try {
      if (typeof obj[key] === 'string' && validator.isMongoId(obj[key].toString())) {
        obj[key] = obj[key].toString()
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        var value = obj[key].toString()

        // console.log('stringifyProperties', value, typeof value, obj[key], typeof obj[key])

        if (Array.isArray(obj[key])) {
          // if (obj[key].length === 0) {
          //   delete obj[key]
          // } else {
          _.each(obj[key], (v, k) => {
            if (v.toString().match(/^[a-fA-F0-9]{24}$/) && validator.isMongoId(v.toString())) {
              obj[key][k] = v.toString()
            } else {
              obj[key][k] = stringifyProperties(obj[key][k])
            }
          })
          // }
        } else if (value.match(/^[a-fA-F0-9]{24}$/) && validator.isMongoId(value)) {
          obj[key] = obj[key].toString()
        }
        // else if (_.isEmpty(obj[key])) {
        //   delete obj[key]
        // }
      }
    } catch (err) {
      console.log('stringifyProperties error', err)
    }
  })

  return obj
}

function snapshot (obj) {
  if (Array.isArray(obj)) {
    obj.forEach(document => {
      document = stringifyProperties(document)
    })
  } else {
    obj = stringifyProperties(obj)
  }

  return _.snapshot(obj)
}

module.exports = {
  containsNestedReferenceFields: containsNestedReferenceFields,
  getSchemaOrParent: getSchemaOrParent,
  makeCaseInsensitive: makeCaseInsensitive,
  convertDateTimeForSave: convertDateTimeForSave,
  processReferenceFieldQuery: processReferenceFieldQuery,
  processFilter: processFilter,
  removeInternalFields: removeInternalFields,
  snapshot: snapshot
}
