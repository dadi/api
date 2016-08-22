var help = require(__dirname + '/../help')
var ObjectID = require('mongodb').ObjectID
var _ = require('underscore')

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

function isReference(key, schema) {
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

function sortQueriesByNestedLevel(queries) {
  var keys = Object.keys(queries).sort((a, b) => {
    var aLen = a.split('.').length
    var bLen = b.split('.').length
    if (aLen === bLen) return 0
    return aLen < bLen ? 1 : -1
  })

  return keys.reduce((r, k) => (r[k] = queries[k], r), {})
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
            arr[key] = new ObjectID.createFromHexString(value)
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
      query[key] = new ObjectID.createFromHexString(query[key])
    }
  })

  return query
}

function makeCaseInsensitive (obj) {
  var newObj = _.clone(obj)

  _.each(Object.keys(obj), function (key) {
    if (key === 'apiVersion') {
      return
    }

    if (typeof obj[key] === 'string') {
      if (ObjectID.isValid(obj[key]) && obj[key].match(/^[a-fA-F0-9]{24}$/)) {
        newObj[key] = obj[key]
      }
      else if (key[0] === '$' && key === '$regex') {
        newObj[key] = new RegExp(obj[key], 'i')
      }
      else if (key[0] === '$' && key !== '$regex') {
        newObj[key] = obj[key]
      } else {
        newObj[key] = new RegExp(['^', help.regExpEscape(obj[key]), '$'].join(''), 'i')
      }
    }
    else if (typeof obj[key] === 'object' && obj[key] !== null) {
      if (key[0] === '$' && key !== '$regex') {
        newObj[key] = obj[key]
      } else {
        newObj[key] = makeCaseInsensitive(obj[key])
      }
    } else {
      return obj
    }
  })

  return newObj
}

module.exports = {
  containsNestedReferenceFields: containsNestedReferenceFields,
  convertApparentObjectIds: convertApparentObjectIds,
  getSchemaOrParent: getSchemaOrParent,
  makeCaseInsensitive: makeCaseInsensitive,
  processReferenceFieldQuery: processReferenceFieldQuery
}

_.mixin({
  // Get/set the value of a nested property
  deep: function (obj, key, value) {
    var keys = key.replace(/\[(["']?)([^\1]+?)\1?\]/g, '.$2').replace(/^\./, '').split('.'),
      root,
      i = 0,
      n = keys.length

    // Set deep value
    if (arguments.length > 2) {
      root = obj
      n--

      while (i < n) {
        key = keys[i++]
        obj = obj[key] = _.isObject(obj[key]) ? obj[key] : {}
      }

      obj[keys[i]] = value

      value = root

    // Get deep value
    } else {
      while ((obj = obj[keys[i++]]) != null && i < n) {}
      value = i < n ? void 0 : obj
    }

    return value
  }
})

// Usage:
//
// var obj = {
//   a: {
//     b: {
//       c: {
//         d: ['e', 'f', 'g']
//       }
//     }
//   }
// }
//
// Get deep value
// _.deep(obj, 'a.b.c.d[2]'); // 'g'
//
// Set deep value
// _.deep(obj, 'a.b.c.d[2]', 'george')
//
// _.deep(obj, 'a.b.c.d[2]'); // 'george'

_.mixin({
  pluckDeep: function (obj, key) {
    return _.map(obj, function (value) { return _.deep(value, key); })
  }
})

// Usage:
//
// var arr = [{
//   deeply: {
//     nested: 'foo'
//   }
// }, {
//   deeply: {
//     nested: 'bar'
//   }
// }];
//
// _.pluckDeep(arr, 'deeply.nested') // ['foo', 'bar']
