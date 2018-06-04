const cache = require('./cache')
const config = require('./../../config')
const crypto = require('crypto')
const formatError = require('@dadi/format-error')
const log = require('@dadi/logger')
const stackTrace = require('stack-trace')

module.exports.sendBackErrorTrace = function (res, next) {
  return err => {
    let body = {
      success: false
    }
    let trace = stackTrace.parse(err)

    if (trace) {
      let stack = 'Error "' + err + '"\n'

      for (var i = 0; i < trace.length; i++) {
        stack += `  at ${trace[i].methodName} (${trace[i].fileName}:${trace[i].lineNumber}:${trace[i].columnNumber})\n`
      }

      body.error = stack

      console.log(stack)
    }

    let resBody = JSON.stringify(body)

    res.setHeader('content-type', 'application/json')
    res.setHeader('content-length', Buffer.byteLength(resBody))

    res.statusCode = 500

    res.end(resBody)
  }
}

// helper that sends json response
module.exports.sendBackJSON = function (successCode, res, next) {
  return function (err, results) {
    let body = results
    let statusCode = successCode

    if (err) {
      switch (err.message) {
        case 'BAD_REQUEST':
          body = {
            success: false,
            errors: err.errors,
            statusCode: 400
          }
          statusCode = body.statusCode

          break

        case 'DB_DISCONNECTED':
          body = Object.assign(formatError.createApiError('0004'), {
            statusCode: 503
          })
          statusCode = body.statusCode

          break

        case 'FORBIDDEN':
          body = Object.assign(formatError.createApiError('0006'), {
            statusCode: 403
          })
          statusCode = 403

          break

        case 'UNAUTHORISED':
          body = Object.assign(formatError.createApiError('0005'), {
            statusCode: 401
          })
          statusCode = 401

          break

        default:
          return next(err)
      }
    }

    let resBody = body ? JSON.stringify(body) : null

    // log response if it's already been sent
    if (res.finished) {
      log.info({res: res}, 'Response already sent. Attempting to send results: ' + resBody)
      return
    }

    res.setHeader('content-type', 'application/json')
    res.setHeader('content-length', resBody ? Buffer.byteLength(resBody) : 0)

    res.statusCode = statusCode

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
  if (typeof obj !== 'object' || Array.isArray(obj) || obj === null) return false

  let response = {
    success: true,
    errors: []
  }
  let fields = []

  getKeys(obj, 'fields', fields)
  if (fields.length === 0) {
    response.errors.push({section: 'fields', message: 'must be provided at least once'})
  }

  if (response.errors.length > 0) {
    response.success = false
    return response
  }

  // check at least one field has been provided
  if (Object.keys(fields[0]).length === 0) {
    response.success = false
    response.errors.push({section: 'fields', message: 'must include at least one field'})
    return response
  }

  // check that an index exists for the field
  // specified as the sort field
  if (obj.settings && obj.settings.sort) {
    let indexSpecified = false

    if (!obj.settings.index) {
      indexSpecified = false
    } else {
      if (Array.isArray(obj.settings.index)) {
        obj.settings.index.forEach(index => {
          if (Object.keys(index.keys).includes(obj.settings.sort)) {
            indexSpecified = true
          }
        })
      } else if (Object.keys(obj.settings.index.keys).includes(obj.settings.sort)) {
        indexSpecified = true
      }
    }

    if (!indexSpecified) {
      response.errors.push(formatError.createApiError('0001', { 'field': obj.settings.sort }))
    }
  }

  response.success = response.errors.length === 0

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
