'use strict'

const acl = require('./../model/acl')
const Busboy = require('busboy')
const config = require('./../../../config')
const Controller = require('./index')
const help = require('./../help')
const imagesize = require('imagesize')
const jwt = require('jsonwebtoken')
const log = require('@dadi/logger')
const mediaModel = require('./../model/media')
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

const MediaController = function(model, server) {
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
MediaController.prototype._formatDate = function(includeTime) {
  const d = new Date()
  const dateParts = [
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
MediaController.prototype._signToken = function(obj) {
  return jwt.sign(obj, config.get('media.tokenSecret'), {
    expiresIn: obj.expiresIn || config.get('media.tokenExpiresIn')
  })
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
MediaController.prototype.count = function(req, res, next) {
  const path = url.parse(req.url, true)
  const query = this._prepareQuery(req, this.model)
  const parsedOptions = this._prepareQueryOptions(path.query, this.model)

  if (parsedOptions.errors.length > 0) {
    return help.sendBackJSON(400, res, next)(null, parsedOptions)
  }

  this.model
    .count({
      client: req.dadiApiClient,
      options: parsedOptions.queryOptions,
      query
    })
    .then(response => {
      help.sendBackJSON(200, res, next)(null, response)
    })
    .catch(err => {
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
MediaController.prototype.delete = function(req, res, next) {
  const query = req.params.id ? {_id: req.params.id} : req.body.query

  if (!query) return next()

  return acl.access
    .get(req.dadiApiClient, this.model.aclKey)
    .then(access => {
      if (access.delete !== true) {
        return help.sendBackJSON(null, res, next)(
          acl.createError(req.dadiApiClient)
        )
      }

      return this.model.get({
        query,
        req
      })
    })
    .then(({results}) => {
      if (results.length === 0) {
        return help.sendBackJSON(404, res, next)()
      }

      const deleteQueue = results.map(file => {
        // Remove physical file.
        const storageHandler = StorageFactory.create(file.fileName)

        return storageHandler.delete(file)
      })

      return Promise.all(deleteQueue)
        .then(result => {
          return this.model.delete({
            query,
            req
          })
        })
        .then(({deletedCount, totalCount}) => {
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
    })
    .catch(error => {
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
MediaController.prototype.get = function(req, res, next) {
  const path = url.parse(req.url, true)
  const query = this._prepareQuery(req, this.model)
  const parsedOptions = this._prepareQueryOptions(path.query, this.model)

  if (parsedOptions.errors.length > 0) {
    return help.sendBackJSON(400, res, next)(null, parsedOptions)
  }

  return this.model
    .get({
      client: req.dadiApiClient,
      options: parsedOptions.queryOptions,
      query,
      req
    })
    .then(response => {
      response.results = response.results.map(document => {
        return mediaModel.formatDocuments(document)
      })

      help.sendBackJSON(200, res, next)(null, response)
    })
    .catch(err => {
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
MediaController.prototype.getFile = function(req, res, next, route) {
  const storageHandler = StorageFactory.create(req.params.filename)

  return storageHandler.get(req.params.filename, route, req, res, next)
}

/**
 * Generate a folder hierarchy for a file, based on a configuration property
 *
 * @param {string} fileName - the name of the file being uploaded
 */
MediaController.prototype.getPath = function(fileName) {
  let reSplitter

  switch (config.get('media.pathFormat')) {
    case 'sha1/4':
      reSplitter = new RegExp('.{1,4}', 'g')

      return sha1(fileName)
        .match(reSplitter)
        .join('/')
    case 'sha1/5':
      reSplitter = new RegExp('.{1,5}', 'g')

      return sha1(fileName)
        .match(reSplitter)
        .join('/')
    case 'sha1/8':
      reSplitter = new RegExp('.{1,8}', 'g')

      return sha1(fileName)
        .match(reSplitter)
        .join('/')
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
MediaController.prototype.post = function(req, res, next) {
  const method = req.method.toLowerCase()
  const token = req.params.token
  let aclCheck

  if (!token) {
    const accessRequired = method === 'put' ? 'update' : 'create'

    aclCheck = acl.access
      .get(req.dadiApiClient, this.model.aclKey)
      .then(access => {
        if (access[accessRequired] !== true) {
          return Promise.reject(acl.createError(req.dadiApiClient))
        }
      })
  }

  const files = []

  return Promise.resolve(aclCheck)
    .then(() => {
      return new Promise((resolve, reject) => {
        // This variable will be used to track whether something has thrown
        // an error that should stop the request in its tracks. Calling the
        // `rejectAndAbort` function will take care of rejecting the Promise
        // and setting `hasErrors` accordingly.
        let hasErrors = false
        const rejectAndAbort = error => {
          hasErrors = true

          reject(error)
        }

        if (method === 'put') {
          if (!req.params.id) {
            return rejectAndAbort(new Error('UPDATE_ID_MISSING'))
          }

          // If we're updating a document, we can accept an application/json
          // request. We treat it as an update to the metadata properties only.
          if (req.headers['content-type'] === 'application/json') {
            const update = req.body

            if (!mediaModel.isValidUpdate(update)) {
              return rejectAndAbort(new Error('UPDATE_INVALID_FIELDS'))
            }

            return resolve(
              this.model.update({
                query: {
                  _id: req.params.id
                },
                internals: {
                  _lastModifiedAt: Date.now(),
                  _lastModifiedBy:
                    req.dadiApiClient && req.dadiApiClient.clientId
                },
                req,
                update,
                validate: false
              })
            )
          }
        }

        const busboy = new Busboy({
          headers: req.headers
        })
        const userData = {}

        busboy.on('field', (fieldName, value) => {
          try {
            const parsedUpdate = JSON.parse(value)

            if (!mediaModel.isValidUpdate(parsedUpdate)) {
              return rejectAndAbort(new Error('UPDATE_INVALID_FIELDS'))
            }

            Object.assign(userData, parsedUpdate)
          } catch (error) {
            log.error({module: 'media controller'}, error)
          }
        })

        // Listen for event when Busboy finds a file to stream
        busboy.on(
          'file',
          (fieldName, file, inputFileName, encoding, inputMimeType) => {
            if (method === 'post' && this.tokenPayloads[token]) {
              const tokenFileName = this.tokenPayloads[token].fileName
              const tokenMimeType =
                this.tokenPayloads[token].mimeType ||
                this.tokenPayloads[token].mimetype

              if (tokenFileName && tokenFileName !== inputFileName) {
                return rejectAndAbort(new Error('UNEXPECTED_FILENAME'))
              }

              if (tokenMimeType && tokenMimeType !== inputMimeType) {
                return rejectAndAbort(new Error('UNEXPECTED_MIMETYPE'))
              }

              if (files.length > 0) {
                return rejectAndAbort(new Error('UNEXPECTED_NUMBER_OF_FILES'))
              }
            }

            // This array will be used to store the data chunks for this particular
            // file. We'll keep a reference to it so that we can write to it on the
            // "data" event, but we'll also add it to the files array so that we can
            // reference it later.
            const data = []

            files.push({
              data,
              fileName: inputFileName.replace(/ /g, '_'),
              mimeType: inputMimeType
            })

            file.on('data', chunk => {
              data.push(chunk)
            })
          }
        )

        busboy.on('finish', () => {
          delete this.tokenPayloads[token]

          // If there's something upstream that has thrown an error, there's
          // nothing left to do here.
          if (hasErrors) return

          // If the method is PUT, we are updating a media document. As such,
          // we don't support the upload of multiple files and consider the
          // first one only.
          if (method === 'put') {
            const {data, fileName, mimeType} = files[0]

            return resolve(
              this.processFile({
                data: Buffer.concat(data),
                fileName,
                mimeType,
                req
              }).then(response => {
                return this.model.update({
                  query: {
                    _id: req.params.id
                  },
                  internals: {
                    _lastModifiedAt: Date.now(),
                    _lastModifiedBy:
                      req.dadiApiClient && req.dadiApiClient.clientId
                  },
                  req,
                  update: Object.assign({}, userData, response),
                  validate: false
                })
              })
            )
          }

          // If we're here, it means we're dealing with the creation of new media
          // documents, in which case we can accept the upload of multiple files.
          // We'll process them one by one and then craft the response at the end.
          const processedFiles = files.map(file => {
            const {data, fileName, mimeType} = file

            return this.processFile({
              data: Buffer.concat(data),
              fileName,
              mimeType,
              req
            })
          })

          return Promise.all(processedFiles).then(documents => {
            const documentsWithUserData = documents.map(document => {
              return Object.assign({}, userData, document)
            })

            resolve(
              this.model.create({
                documents: documentsWithUserData,
                internals: {
                  _createdAt: Date.now(),
                  _createdBy: req.dadiApiClient && req.dadiApiClient.clientId
                },
                req,
                validate: false
              })
            )
          })
        })

        req.pipe(busboy)
      })
    })
    .then(response => {
      const statusCode = method === 'post' ? 201 : 200

      if (response.results) {
        response.results = response.results.map(document => {
          return mediaModel.formatDocuments(document)
        })
      }

      help.sendBackJSON(statusCode, res, next)(null, response)
    })
    .catch(err => {
      log.error({module: 'media controller'}, err)

      switch (err.message) {
        case 'FORBIDDEN':
        case 'UNAUTHORISED':
          return help.sendBackJSON(null, res, next)(err)

        case 'UNEXPECTED_FILENAME':
          return help.sendBackJSON(400, res, next)(null, {
            statusCode: 400,
            success: false,
            errors: [
              `Unexpected filename. Expected: ${this.tokenPayloads[token].fileName}`
            ]
          })

        case 'UNEXPECTED_NUMBER_OF_FILES':
          return help.sendBackJSON(400, res, next)(null, {
            statusCode: 400,
            success: false,
            errors: ['Multiple file upload with signed URLs not supported']
          })

        case 'UNEXPECTED_MIMETYPE':
          return help.sendBackJSON(400, res, next)(null, {
            statusCode: 400,
            success: false,
            errors: [
              `Unexpected MIME type. Expected: ${this.tokenPayloads[token].mimeType}`
            ]
          })

        case 'UPDATE_ID_MISSING':
          return help.sendBackJSON(405, res, next)({
            statusCode: 405,
            success: false,
            errors: [
              'Invalid method. Use POST to upload a new asset or PUT to /{DOCUMENT ID} to update existing'
            ]
          })

        case 'UPDATE_INVALID_FIELDS':
          return help.sendBackJSON(400, res, next)({
            statusCode: 400,
            success: false,
            errors: [
              'Invalid update object. One or more fields are reserved and cannot be updated'
            ]
          })

        default:
          if (err.message.includes('Unsupported content type')) {
            const expectedContentTypes =
              method === 'put'
                ? ['application/json', 'multipart/form-data']
                : ['multipart/form-data']

            return help.sendBackJSON(400, res, next)({
              statusCode: 400,
              success: false,
              errors: [
                `Unexpected content type: ${
                  req.headers['content-type']
                }. Expected: ${expectedContentTypes.join(', ')}`
              ]
            })
          }

          help.sendBackJSON(err.statusCode || 400, res, next)(err)
      }
    })
}

/**
 * Processes the uploaded file and returns a response object containing any
 * metadata properties that are global to all file types as well as any
 * additional properties specific to the MIME type in question.
 *
 * @param  {Stream} options.data     Uploaded file
 * @param  {String} options.fileName File name
 * @param  {String} options.mimeType MIME type
 * @param  {Object} options.req      Request
 * @return {Promise<Object>}
 */
MediaController.prototype.processFile = function({
  data,
  fileName,
  mimeType,
  req
}) {
  const stream = streamifier.createReadStream(data)
  let queue = Promise.resolve({
    _storageType: config.get('media.storage'),
    contentLength: data.length,
    fileName,
    mimeType,

    // (!) For backward compatibility. To be removed in
    // version 5.0.0. ¯\_(ツ)_/¯
    mimetype: mimeType
  })
  const outputStream = new PassThrough()

  stream.pipe(outputStream)

  // Setting up any additional streams based on MIME type.
  switch (mimeType) {
    case 'image/jpeg':
    case 'image/png': {
      const imageSizeStream = new PassThrough()

      stream.pipe(imageSizeStream)

      queue = queue.then(
        response =>
          new Promise((resolve, reject) => {
            imagesize(imageSizeStream, (error, imageInfo) => {
              if (error) {
                return resolve(response)
              }

              resolve(
                Object.assign(response, {
                  width: imageInfo.width,
                  height: imageInfo.height
                })
              )
            })
          })
      )
    }
  }

  return queue.then(response => {
    // Write the physical file.
    return this.writeFile(req, fileName, mimeType, outputStream).then(
      result => {
        return Object.assign(response, {
          path: result.path
        })
      }
    )
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
MediaController.prototype.put = function(req, res, next) {
  return this.post(req, res, next)
}

/**
 * Takes a raw media bucket route (e.g. /media/myBucket) and registers
 * all the associated routes, for signing, uploading and retrieving files.
 *
 * @param  {String}   route
 */
MediaController.prototype.registerRoutes = function(route) {
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
        const payload = Object.assign({}, req.body, {
          _createdBy: req.dadiApiClient.clientId
        })

        token = this._signToken(payload)
      } catch (err) {
        const error = {
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
    const method = req.method && req.method.toLowerCase()

    if (method !== 'get') {
      return next()
    }

    return this.count(req, res, next)
  })

  // Targets a specific document. Can be used to retrieve (GET), update (PUT)
  // or delete (DELETE).
  this.server.app.use(`${route}/:id(${this.ID_PATTERN})`, (req, res, next) => {
    const method = req.method && req.method.toLowerCase()

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
    const method = req.method && req.method.toLowerCase()

    // If this isn't a new document upload, let the next handler deal with it.
    if (method !== 'post') {
      return next()
    }

    // If there is a signed URL token, we try to decode it and extract the `_createdBy`
    // property. This will be our client ID.
    if (req.params.token) {
      jwt.verify(
        req.params.token,
        config.get('media.tokenSecret'),
        (err, payload) => {
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
        }
      )
    } else {
      return this[method](req, res, next)
    }
  })

  // Retrieve or delete media documents.
  this.server.app.use(route, (req, res, next) => {
    const method = req.method && req.method.toLowerCase()

    if (method !== 'get' && method !== 'delete') {
      return help.sendBackJSON(405, res, next)()
    }

    return this[method](req, res, next)
  })

  // Serve media files.
  this.server.app.use(`${route}/:filename(.*)`, (req, res, next) => {
    const pathNodes = req.params.filename.split('/')

    if (
      pathNodes[0] === 'upload' ||
      !pathNodes[pathNodes.length - 1].includes('.')
    ) {
      return next()
    }

    if (req.method.toLowerCase() !== 'get') {
      return help.sendBackJSON(405, res, next)()
    }

    return this.getFile(req, res, next, route).catch(err => {
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
MediaController.prototype.writeFile = function(
  req,
  fileName,
  mimetype,
  stream
) {
  return new Promise((resolve, reject) => {
    const folderPath = path.join(this.route, this.getPath(fileName))
    const storageHandler = StorageFactory.create(fileName)

    storageHandler
      .put(stream, folderPath)
      .then(result => {
        return resolve(result)
      })
      .catch(err => {
        return reject(err)
      })
  })
}

module.exports = function(model, server) {
  return new MediaController(model, server)
}

module.exports.MediaController = MediaController
