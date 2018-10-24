'use strict'

const acl = require('./../model/acl')
const Busboy = require('busboy')
const config = require('./../../../config')
const Controller = require('./index')
const help = require('./../help')
const imagesize = require('imagesize')
const jwt = require('jsonwebtoken')
const mediaModel = require('./../model/media')
const mime = require('mime')
const PassThrough = require('stream').PassThrough
const path = require('path')
const sha1 = require('sha1')
const StorageFactory = require('./../storage/factory')
const streamifier = require('streamifier')
const url = require('url')

/**
 * Block with metadata pertaining to an API collection.
 *
 * @typedef {Object} Metadata
 * @property {Number} page - current page
 * @property {Number} offset - offset from start of collection
 * @property {Number} totalCount - total number of documents
 * @property {Number} totalPages - total number of pages
 * @property {Number} nextPage - number of next available page
 * @property {Number} prevPage - number of previous available page
 */

/**
 * @typedef {Object} ResultSet
 * @property {Metadata} metadata - object with collection metadata
 * @property {Array} results - list of documents
 */

const MediaController = function (model, server) {
  this.model = model
  this.server = server
  this.tokenPayloads = {}
}

MediaController.prototype = new Controller()

/**
 * Formats the current date as a YYYY/MM/DD(/HH/MM/SS) string,
 * with the time portion being optional.
 *
 * @param  {Boolean} includeTime Whether to include the time
 * @return {String}
 */
MediaController.prototype._formatDate = function (includeTime) {
  let d = new Date()
  let dateParts = [
    d.getFullYear(),
    ('0' + (d.getMonth() + 1)).slice(-2),
    ('0' + d.getDate()).slice(-2)
  ]

  if (includeTime) {
    dateParts.push(d.getHours())
    dateParts.push(d.getMinutes())
    dateParts.push(d.getSeconds())
  }

  return dateParts.join('/')
}

/**
 * Generates a JSON Web Token representing the specified object
 *
 * @param {Object} obj - a JSON object containing key:value pairs to be encoded into a token
 * @returns {string} JSON Web Token
 */
MediaController.prototype._signToken = function (obj) {
  return jwt.sign(
    obj,
    config.get('media.tokenSecret'),
    {
      expiresIn: obj.expiresIn || config.get('media.tokenExpiresIn')
    }
  )
}

/**
 * Searchs for documents in the datbase and returns a
 * metadata object.
 *
 * @param   {Object}   req
 * @param   {Object}   res
 * @param   {Function} next
 * @returns {Promise<Metadata>}
 */
MediaController.prototype.count = function (req, res, next) {
  let path = url.parse(req.url, true)
  let query = this._prepareQuery(req, this.model)
  let parsedOptions = this._prepareQueryOptions(path.query, this.model.settings)

  if (parsedOptions.errors.length > 0) {
    return help.sendBackJSON(400, res, next)(null, parsedOptions)
  }

  this.model.count({
    client: req.dadiApiClient,
    options: parsedOptions.queryOptions,
    query
  }).then(response => {
    help.sendBackJSON(200, res, next)(null, response)
  }).catch(err => {
    help.sendBackJSON(200, res, next)(err)
  })
}

/**
 * Deletes media files and removes their reference from the database.
 *
 * @param  {Object}   req
 * @param  {Object}   res
 * @param  {Function} next
 * @return {Promise<ResultSet>}
 */
MediaController.prototype.delete = function (req, res, next) {
  let query = req.params.id ? { _id: req.params.id } : req.body.query

  if (!query) return next()

  return acl.access.get(req.dadiApiClient, this.model.aclKey).then(access => {
    if (access.delete !== true) {
      return help.sendBackJSON(null, res, next)(
        acl.createError(req.dadiApiClient)
      )
    }

    return this.model.get({
      query, req
    })
  }).then(results => {
    if (!results.results[0]) {
      return help.sendBackJSON(404, res, next)()
    }

    let file = results.results[0]

    // remove physical file
    let storageHandler = StorageFactory.create(file.fileName)

    return storageHandler.delete(file).then(result => {
      return this.model.delete({
        query,
        req
      })
    }).then(({deletedCount, totalCount}) => {
      if (config.get('feedback')) {
        // Send 200 with JSON payload.
        return help.sendBackJSON(200, res, next)(null, {
          success: true,
          message: 'Document(s) deleted successfully',
          deleted: deletedCount,
          totalCount
        })
      }

      // Send 204 with no content.
      res.statusCode = 204
      res.end()
    })
  }).catch(error => {
    return help.sendBackJSON(200, res, next)(error)
  })
}

/**
 * Finds documents in the database.
 *
 * @param  {Object}   req
 * @param  {Object}   res
 * @param  {Function} next
 * @return {Promise<ResultSet>}
 */
MediaController.prototype.get = function (req, res, next) {
  let path = url.parse(req.url, true)
  let query = this._prepareQuery(req, this.model)
  let parsedOptions = this._prepareQueryOptions(path.query, this.model.settings)

  if (parsedOptions.errors.length > 0) {
    return help.sendBackJSON(400, res, next)(null, parsedOptions)
  }

  return this.model.get({
    client: req.dadiApiClient,
    options: parsedOptions.queryOptions,
    query,
    req
  }).then(response => {
    response.results = response.results.map(document => {
      return mediaModel.formatDocuments(document)
    })

    help.sendBackJSON(200, res, next)(null, response)
  }).catch(err => {
    help.sendBackJSON(500, res, next)(err)
  })
}

/**
 * Serves a media file from its location.
 *
 * @param  {Object}   req
 * @param  {Object}   res
 * @param  {Function} next
 * @return {Promise<Stream>}
 */
MediaController.prototype.getFile = function (req, res, next, route) {
  let storageHandler = StorageFactory.create(req.params.filename)

  return storageHandler.get(req.params.filename, route, req, res, next)
}

/**
 * Generate a folder hierarchy for a file, based on a configuration property
 *
 * @param {string} fileName - the name of the file being uploaded
 */
MediaController.prototype.getPath = function (fileName) {
  let reSplitter

  switch (config.get('media.pathFormat')) {
    case 'sha1/4':
      reSplitter = new RegExp('.{1,4}', 'g')
      return sha1(fileName).match(reSplitter).join('/')
    case 'sha1/5':
      reSplitter = new RegExp('.{1,5}', 'g')
      return sha1(fileName).match(reSplitter).join('/')
    case 'sha1/8':
      reSplitter = new RegExp('.{1,8}', 'g')
      return sha1(fileName).match(reSplitter).join('/')
    case 'date':
      return this._formatDate()
    case 'datetime':
      return this._formatDate(true)
    default:
      return ''
  }
}

/**
 * Processes media uploads and adds their references to the database.
 *
 * @param  {Object}   req
 * @param  {Object}   res
 * @param  {Function} next
 * @return {Promise<ResultSet>}
 */
MediaController.prototype.post = function (req, res, next) {
  let method = req.method.toLowerCase()
  let token = req.params.token
  let aclCheck

  if (!token) {
    let accessRequired = method === 'put'
      ? 'update'
      : 'create'

    aclCheck = acl.access.get(req.dadiApiClient, this.model.aclKey).then(access => {
      if (access[accessRequired] !== true) {
        return Promise.reject(
          acl.createError(req.dadiApiClient)
        )
      }
    })
  }

  let data = []
  let fileName = ''

  return Promise.resolve(aclCheck).then(() => {
    return new Promise((resolve, reject) => {
      let busboy = new Busboy({
        headers: req.headers
      })

      // Listen for event when Busboy finds a file to stream
      busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
        if (method === 'post' && this.tokenPayloads[token]) {
          if (this.tokenPayloads[token].fileName &&
            this.tokenPayloads[token].fileName !== filename) {
            return reject(
              new Error('UNEXPECTED_FILENAME')
            )
          }

          if (this.tokenPayloads[token].mimetype &&
            this.tokenPayloads[token].mimetype !== mimetype) {
            return reject(
              new Error('UNEXPECTED_MIMETYPE')
            )
          }
        }

        delete this.tokenPayloads[token]

        fileName = filename

        file.on('data', chunk => {
          data.push(chunk)
        })
      })

      // Listen for event when Busboy is finished parsing the form
      busboy.on('finish', () => {
        let concatenatedData = Buffer.concat(data)
        let stream = streamifier.createReadStream(concatenatedData)

        let imageSizeStream = new PassThrough()
        let dataStream = new PassThrough()

        // duplicate the stream so we can use it for the imagesize() request and the
        // response. this saves requesting the same data a second time.
        stream.pipe(imageSizeStream)
        stream.pipe(dataStream)

        // get the image size and format
        imagesize(imageSizeStream, (err, imageInfo) => {
          if (err && err !== 'invalid') {
            return reject(err)
          }

          let fields = Object.keys(this.model.schema)
          let obj = {
            fileName: fileName
          }

          if (fields.includes('mimetype')) {
            obj.mimetype = mime.getType(fileName)
          }

          // Is `imageInfo` available?
          if (!err) {
            if (fields.includes('width')) {
              obj.width = imageInfo.width
            }

            if (fields.includes('height')) {
              obj.height = imageInfo.height
            }
          }

          // Write the physical file.
          this.writeFile(
            req,
            fileName,
            mime.getType(fileName),
            dataStream
          ).then(result => {
            if (fields.includes('contentLength')) {
              obj.contentLength = result.contentLength
            }

            obj.path = result.path

            // If the method is POST, we are creating a new document.
            // If not, it's an update.
            if (method === 'post') {
              let internals = {
                _apiVersion: req.url.split('/')[1],
                _createdAt: Date.now(),
                _createdBy: req.dadiApiClient && req.dadiApiClient.clientId
              }

              return this.model.create({
                documents: obj,
                internals,
                req
              })
            }

            if (!req.params.id) {
              return reject(
                new Error('UPDATE_ID_MISSING')
              )
            }

            let internals = {
              _lastModifiedAt: Date.now(),
              _lastModifiedBy: req.dadiApiClient && req.dadiApiClient.clientId
            }

            return this.model.update({
              query: {
                _id: req.params.id
              },
              update: obj,
              internals,
              req
            })
          }).then(response => {
            response.results = response.results.map(document => {
              return mediaModel.formatDocuments(document)
            })

            resolve(response)
          }).catch(err => {
            return help.sendBackJSON(err.statusCode, res, next)(err)
          })
        })
      })

      // Pipe the HTTP Request into Busboy
      req.pipe(busboy)
    })
  }).then(response => {
    help.sendBackJSON(201, res, next)(null, response)
  }).catch(err => {
    switch (err.message) {
      case 'FORBIDDEN':
      case 'UNAUTHORISED':
        return help.sendBackJSON(null, res, next)(err)

      case 'UNEXPECTED_FILENAME':
        return help.sendBackJSON(400, res, next)(null, {
          success: false,
          errors: [
            `Unexpected filename. Expected: ${this.tokenPayloads[token].fileName}`
          ]
        })

      case 'UNEXPECTED_MIMETYPE':
        return help.sendBackJSON(400, res, next)(null, {
          success: false,
          errors: [
            `Unexpected MIME type. Expected: ${this.tokenPayloads[token].mimetype}`
          ]
        })

      case 'UPDATE_ID_MISSING':
        return help.sendBackJSON(405, res, next)({
          success: false,
          errors: [
            'Invalid method. Use POST to upload a new asset or PUT to /{DOCUMENT ID} to update existing'
          ]
        })
    }
  })
}

/**
 * Processes media uploads and adds their references to the database.
 * This is an alias for `MediaController.prototype.post`.
 *
 * @param  {Object}   req
 * @param  {Object}   res
 * @param  {Function} next
 * @return {Promise<ResultSet>}
 */
MediaController.prototype.put = function (req, res, next) {
  return this.post(req, res, next)
}

/**
 * Takes a raw media bucket route (e.g. /media/myBucket) and registers
 * all the associated routes, for signing, uploading and retrieving files.
 *
 * @param  {String}   route
 */
MediaController.prototype.registerRoutes = function (route) {
  this.route = route

  // Generating a signed URL.
  this.server.app.use(`${route}/sign`, (req, res, next) => {
    if (req.method && req.method.toLowerCase() !== 'post') {
      return next()
    }

    return acl.access.get(req.dadiApiClient, this.model.aclKey).then(access => {
      if (access.create !== true) {
        return help.sendBackJSON(null, res, next)(
          acl.createError(req.dadiApiClient)
        )
      }

      let token

      try {
        let payload = Object.assign({}, req.body, {
          _createdBy: req.dadiApiClient.clientId
        })

        token = this._signToken(payload)
      } catch (err) {
        let error = {
          name: 'ValidationError',
          message: err.message,
          statusCode: 400
        }

        return next(error)
      }

      help.sendBackJSON(200, res, next)(null, {
        url: `${route}/upload/${token}`
      })
    })
  })

  // Getting a document count.
  this.server.app.use(`${route}/count`, (req, res, next) => {
    let method = req.method && req.method.toLowerCase()

    if (method !== 'get') {
      return next()
    }

    return this.count(req, res, next)
  })

  // Targets a specific document. Can be used to retrieve (GET), update (PUT)
  // or delete (DELETE).
  this.server.app.use(`${route}/:id(${this.ID_PATTERN})`, (req, res, next) => {
    let method = req.method && req.method.toLowerCase()

    if (req.params.id && method === 'post') {
      return help.sendBackJSON(404, res, next)()
    }

    if (!this[method]) {
      return next()
    }

    return this[method](req, res, next)
  })

  // Creates new document.
  this.server.app.use(`${route}/upload/:token?`, (req, res, next) => {
    let method = req.method && req.method.toLowerCase()

    // If this isn't a new document upload, let the next handler deal with it.
    if (method !== 'post') {
      return next()
    }

    // If there is a signed URL token, we try to decode it and extract the `_createdBy`
    // property. This will be our client ID.
    if (req.params.token) {
      jwt.verify(req.params.token, config.get('media.tokenSecret'), (err, payload) => {
        if (err) {
          if (err.name === 'TokenExpiredError') {
            err.statusCode = 400
          }

          return next(err)
        }

        if (payload._createdBy) {
          req.dadiApiClient = {
            clientId: payload._createdBy
          }
        }

        this.tokenPayloads[req.params.token] = payload

        return this[method](req, res, next)
      })
    } else {
      return this[method](req, res, next)
    }
  })

  // Retrieve media documents.
  this.server.app.use(route, (req, res, next) => {
    if (req.method.toLowerCase() !== 'get') {
      return help.sendBackJSON(405, res, next)()
    }

    return this.get(req, res, next)
  })

  // Serve media files.
  this.server.app.use(`${route}/:filename(.*)`, (req, res, next) => {
    let pathNodes = req.params.filename.split('/')

    if (pathNodes[0] === 'upload' || !pathNodes[pathNodes.length - 1].includes('.')) {
      return next()
    }

    if (req.method.toLowerCase() !== 'get') {
      return help.sendBackJSON(405, res, next)()
    }

    return this
      .getFile(req, res, next, route)
      .catch(err => {
        return help.sendBackJSON(400, res, next)(err)
      })
  })
}

/**
 * Save a file using the configured storage adapter
 *
 * @param {IncomingMessage} req - the HTTP request
 * @param {string} fileName - the name of the file being uploaded
 * @param {string} mimetype - the MIME type of the file being uploaded
 * @param {Object} stream - the stream containing the file being uploaded
 */
MediaController.prototype.writeFile = function (req, fileName, mimetype, stream) {
  return new Promise((resolve, reject) => {
    let folderPath = path.join(this.route, this.getPath(fileName))
    let storageHandler = StorageFactory.create(fileName)

    storageHandler.put(stream, folderPath).then(result => {
      return resolve(result)
    }).catch(err => {
      return reject(err)
    })
  })
}

module.exports = function (model, server) {
  return new MediaController(model, server)
}

module.exports.MediaController = MediaController
