var _ = require('underscore')
var crypto = require('crypto')
var formatError = require('@dadi/format-error')
var fs = require('fs')
var Moment = require('moment')
var path = require('path')
var util = require('util')

var cache = require(path.join(__dirname, '/cache'))
var config = require(path.join(__dirname, '/../../config'))
var log = require('@dadi/logger')

var self = this

// helper that sends json response
module.exports.sendBackJSON = function (successCode, res, next) {
  return function (err, results) {
    if (err) return next(err)

    var resBody = JSON.stringify(results)

    // log response if it's already been sent
    if (res.finished) {
      log.info({res: res}, 'Response already sent. Attempting to send results: ' + resBody)
      return
    }

    if (config.get('cors') === true) {
      res.setHeader('Access-Control-Allow-Origin', '*')
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization')
    }

    res.setHeader('Server', config.get('server.name'))

    res.setHeader('content-type', 'application/json')
    res.setHeader('content-length', Buffer.byteLength(resBody))

    res.statusCode = successCode

    res.end(resBody)
  }
}

module.exports.sendBackJSONP = function (callbackName, res, next) {
  return function (err, results) {
    if (err) console.log(err)

    // callback MUST be made up of letters only
    if (!callbackName.match(/^[a-zA-Z]+$/)) return res.send(400)

    res.statusCode = 200

    var resBody = JSON.stringify(results)
    resBody = callbackName + '(' + resBody + ');'

    res.setHeader('Server', config.get('server.name'))

    res.setHeader('content-type', 'text/javascript')
    res.setHeader('content-length', Buffer.byteLength(resBody))
    res.end(resBody)
  }
}

// helper that sends text response
module.exports.sendBackText = function (successCode, res, next) {
  return function (err, results) {
    if (err) return next(err)

    var resBody = results

    res.setHeader('Server', config.get('server.name'))

    res.setHeader('content-type', 'application/text')
    res.setHeader('content-length', Buffer.byteLength(resBody))

    res.statusCode = successCode

    res.end(resBody)
  }
}

// function to wrap try - catch for JSON.parse to mitigate pref losses
module.exports.parseQuery = function (queryStr) {
  var ret
  try {
    ret = JSON.parse(queryStr)
  } catch (e) {
    ret = {}
  }

  // handle case where queryStr is "null" or some other malicious string
  if (typeof ret !== 'object' || ret === null) ret = {}
  return ret
}

module.exports.keyValidForSchema = function (model, key) {
  if (key !== '_id' && model.schema.hasOwnProperty(key) === false) {
    // check for dot notation so we can determine the datatype of the first part of the key
    if (key.indexOf('.') > 0) {
      var keyParts = key.split('.')
      if (model.schema.hasOwnProperty(keyParts[0])) {
        if (/Mixed|Object|Reference/.test(model.schema[keyParts[0]].type)) {
          return true
        }
      }
    }

    // field/key doesn't exist in the schema
    return false
  }

  // key exists in the schema, or
  return true
}

// Transforms strings from a query object into more appropriate types, based
// on the field type
module.exports.transformQuery = function (obj, type, format) {
  var transformFunction

  switch (type) {
    case 'DateTime':
      transformFunction = function (obj) {
        if (!format) {
          format = 'YYYY-MM-DD'
        }

        var parsedDate = new Moment(obj, format)

        if (!parsedDate.isValid()) return obj

        return parsedDate.toDate()
      }

      break

    case 'String':
      transformFunction = function (obj) {
        var regexParts = obj.match(/\/([^/]*)\/([i]{0,1})$/)

        if (regexParts) {
          try {
            var regex = new RegExp(regexParts[1], regexParts[2])

            return regex
          } catch (e) {
            return obj
          }
        } else {
          return obj
        }
      }

      break

    default:
      return obj
  }

  if (obj) {
    Object.keys(obj).forEach((key) => {
      if ((typeof obj[key] === 'object') && (obj[key] !== null)) {
        this.transformQuery(obj[key], type)
      } else if (typeof obj[key] === 'string') {
        obj[key] = transformFunction(obj[key])
      }
    })
  }
}

module.exports.regExpEscape = function (str) {
  return str.replace(/([.?*+^$[\]\\(){}|-])/g, '\\$1')
}

function getKeys (obj, keyName, result) {
  for (var key in obj) {
    if (obj.hasOwnProperty(key)) {
      if (key === keyName) {
        result.push(obj[key])
      } else if (typeof obj[key] === 'object') {
        getKeys(obj[key], keyName, result)
      }
    }
  }
}

module.exports.getFieldsFromSchema = function (obj) {
  var fields = []
  getKeys(obj, 'fields', fields)
  return JSON.stringify(fields[0])
}

module.exports.isJSON = function (jsonString) {
  if (!jsonString) return false

  try {
    var o = JSON.parse(jsonString)

    // Handle non-exception-throwing cases:
    // Neither JSON.parse(false) or JSON.parse(1234) throw errors, hence the type-checking,
    // but... JSON.parse(null) returns 'null', and typeof null === "object",
    // so we must check for that, too.
    if (o && typeof o === 'object' && o !== null) {
      return o
    }
  } catch (err) {
    log.error(err)
  }

  return false
}

module.exports.validateCollectionSchema = function (obj) {
  // `obj` must be a "hash type object", i.e. { ... }
  if (typeof obj !== 'object' || util.isArray(obj) || obj === null) return false

  var response = {
    success: true,
    errors: []
  }

  var fields = []
  var settings = []

  getKeys(obj, 'fields', fields)
  if (fields.length === 0) {
    response.errors.push({section: 'fields', message: 'must be provided at least once'})
  }

  getKeys(obj, 'settings', settings)
  if (settings.length === 0) {
    response.errors.push({section: 'settings', message: 'must be provided'})
  }

  if (!_.isEmpty(response.errors)) {
    response.success = false
    return response
  }

  // check at least one field has been provided
  if (Object.keys(fields[0]).length === 0) {
    response.success = false
    response.errors.push({section: 'fields', message: 'must include at least one field'})
    return response
  }

  // check that all required settings are present
  var requiredSettings = ['cache', 'authenticate', 'callback', 'defaultFilters', 'fieldLimiters', 'count']

  requiredSettings.forEach(function (key) {
    if (!obj.settings.hasOwnProperty(key)) {
      response.errors.push({setting: key, message: 'must be provided'})
    }
  })

  // check that an index exists for the field
  // specified as the sort field
  if (obj.settings && obj.settings.sort) {
    var indexSpecified = false

    if (!obj.settings.index) {
      indexSpecified = false
    } else {
      if (_.isArray(obj.settings.index)) {
        _.each(obj.settings.index, (index) => {
          if (_.contains(Object.keys(index.keys), obj.settings.sort)) {
            indexSpecified = true
          }
        })
      } else if (_.contains(Object.keys(obj.settings.index.keys), obj.settings.sort)) {
        indexSpecified = true
      }
    }

    if (!indexSpecified) {
      response.errors.push(formatError.createApiError('0001', { 'field': obj.settings.sort }))
    }
  }

  response.success = _.isEmpty(response.errors)

  return response
}

/**
 *
 * Remove each file in the specified cache folder.
 */
module.exports.clearCache = function (pathname, callback) {
  var pattern = ''

  pattern = crypto.createHash('sha1').update(pathname).digest('hex')

  if (config.get('caching.redis.enabled')) {
    pattern = pattern + '*'
  }

  if (pathname === '*' || pathname === '') {
    if (config.get('caching.redis.enabled')) {
      pattern = '*'
    } else {
      pattern = ''
    }
  }

  cache.delete(pattern, function (err) {
    if (err) console.log(err)
    return callback(null)
  })
}

/**
 * Recursively create directories.
 */
module.exports.mkdirParent = function (dirPath, mode, callback) {
  if (fs.existsSync(path.resolve(dirPath))) return

  fs.mkdir(dirPath, mode, function (error) {
    // When it fails because the parent doesn't exist, call it again
    if (error && error.errno === 34) {
      // Create all the parents recursively
      self.mkdirParent(path.dirname(dirPath), mode, callback)
      // And then finally the directory
      self.mkdirParent(dirPath, mode, callback)
    }

    // Manually run the callback
    callback && callback(error)
  })
}

module.exports.getFromObj = function (obj, path, def) {
  var i, len

  for (i = 0, path = path.split('.'), len = path.length; i < len; i++) {
    if (!obj || typeof obj !== 'object') return def
    obj = obj[path[i]]
  }

  if (obj === undefined) return def
  return obj
}
