const cache = require('./cache')
const config = require('./../../config')
const crypto = require('crypto')
const ERROR_CODES = require('./../../error-codes')
const etag = require('etag')
const formatError = require('@dadi/format-error')
const log = require('@dadi/logger')
const stackTrace = require('stack-trace')
const zlib = require('zlib')

/**
 * Remove each file in the specified cache folder.
 */
module.exports.clearCache = function(pathname, callback) {
  let pattern = ''

  pattern = crypto
    .createHash('sha1')
    .update(pathname)
    .digest('hex')

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

  cache.delete(pattern, function(err) {
    if (err) console.log(err)

    if (typeof callback === 'function') {
      callback(err)
    }
  })
}

module.exports.isJSON = function(jsonString) {
  if (!jsonString) return false

  try {
    const o = JSON.parse(jsonString)

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

module.exports.sendBackErrorTrace = function(res, next) {
  return err => {
    const body = {
      success: false
    }
    const trace = stackTrace.parse(err)

    if (trace) {
      let stack = 'Error "' + err + '"\n'

      for (let i = 0; i < trace.length; i++) {
        stack += `  at ${trace[i].methodName} (${trace[i].fileName}:${trace[i].lineNumber}:${trace[i].columnNumber})\n`
      }

      body.error = stack

      console.log(stack)
    }

    const resBody = JSON.stringify(body)

    res.setHeader('content-type', 'application/json')
    res.setHeader('content-length', Buffer.byteLength(resBody))

    res.statusCode = 500

    res.end(resBody)
  }
}

module.exports.sendBackErrorWithCode = function(
  errorCode,
  statusCode,
  res,
  next
) {
  if (typeof statusCode !== 'number') {
    next = res
    res = statusCode
    statusCode = 500
  }

  const errorObject = formatError.createError(
    'api',
    errorCode,
    null,
    ERROR_CODES
  )

  return module.exports.sendBackJSON(statusCode, res, next)(null, errorObject)
}

// helper that sends json response
module.exports.sendBackJSON = function(successCode, res, next) {
  return function(err, results, originalRequest) {
    let body = results
    let statusCode = successCode

    if (err) {
      switch (err.message) {
        case 'DB_DISCONNECTED':
          body = formatError.createError('api', '0004', null, ERROR_CODES)
          statusCode = 503

          break

        case 'FORBIDDEN':
          body = formatError.createError('api', '0006', null, ERROR_CODES)
          statusCode = 403

          break

        case 'UNAUTHORISED':
          body = formatError.createError('api', '0005', null, ERROR_CODES)
          statusCode = 401

          break

        default:
          return next(err)
      }
    }

    let resBody = body ? JSON.stringify(body) : null

    if (originalRequest && module.exports.shouldCompress(originalRequest)) {
      res.setHeader('Content-Encoding', 'gzip')

      resBody = new Promise((resolve, reject) => {
        zlib.gzip(resBody, (err, compressedData) => {
          if (err) return reject(err)

          res.setHeader('Content-Length', compressedData.byteLength)
          resolve(compressedData)
        })
      })
    } else {
      res.setHeader('Content-Length', resBody ? Buffer.byteLength(resBody) : 0)
    }

    return Promise.resolve(resBody).then(resBody => {
      res.setHeader('Content-Type', 'application/json')

      if (resBody) {
        const etagResult = etag(resBody)

        res.setHeader('ETag', etagResult)

        if (
          originalRequest &&
          originalRequest.headers['if-none-match'] === etagResult
        ) {
          res.statusCode = 304

          return res.end()
        }
      }

      res.statusCode = statusCode
      res.end(resBody)
    })
  }
}

module.exports.sendBackJSONP = function(callbackName, res, next) {
  return function(err, results) {
    if (err) return next(err)

    // callback MUST be made up of letters only
    if (!callbackName.match(/^[a-zA-Z]+$/)) return res.send(400)

    res.statusCode = 200

    let resBody = JSON.stringify(results)

    resBody = callbackName + '(' + resBody + ');'

    res.setHeader('content-type', 'text/javascript')
    res.setHeader('content-length', Buffer.byteLength(resBody))
    res.end(resBody)
  }
}

// helper that sends text response
module.exports.sendBackText = function(successCode, res, next) {
  return function(err, results) {
    if (err) return next(err)

    const resBody = results

    res.setHeader('content-type', 'application/text')
    res.setHeader('content-length', Buffer.byteLength(resBody))

    res.statusCode = successCode

    res.end(resBody)
  }
}

/**
 * Determines whether the response should be compressed by
 * inspecting the Accept-Encoding header.
 *
 * @param {IncomingMessage} req - the original HTTP request
 * @returns Boolean
 */
module.exports.shouldCompress = function(req) {
  const acceptHeader = req.headers['accept-encoding'] || ''

  return acceptHeader.split(',').includes('gzip')
}

// function to wrap try - catch for JSON.parse to mitigate pref losses
module.exports.parseQuery = function(queryStr) {
  let ret

  try {
    ret = JSON.parse(queryStr)
  } catch (e) {
    ret = {}
  }

  // handle case where queryStr is "null" or some other malicious string
  if (typeof ret !== 'object' || ret === null) ret = {}

  return ret
}
