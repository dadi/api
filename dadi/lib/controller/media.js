'use strict'

var Busboy = require('busboy')
var imagesize = require('imagesize')
var PassThrough = require('stream').PassThrough
var path = require('path')
var serveStatic = require('serve-static')
var sha1 = require('sha1')
var url = require('url')

var config = require(path.join(__dirname, '/../../../config'))
var help = require(path.join(__dirname, '/../help'))
var streamifier = require('streamifier')

var mediaModel = require(path.join(__dirname, '/../model/media'))
var prepareQuery = require(path.join(__dirname, './index')).prepareQuery
var prepareQueryOptions = require(path.join(__dirname, './index')).prepareQueryOptions
var StorageFactory = require(path.join(__dirname, '/../storage/factory'))

var MediaController = function (model) {
  this.model = model
}

/**
 *
 */
MediaController.prototype.get = function (req, res, next) {
  var path = url.parse(req.url, true)
  var query = prepareQuery(req, this.model)
  var parsedOptions = prepareQueryOptions(path.query, this.model.settings)

  if (parsedOptions.errors.length > 0) {
    return help.sendBackJSON(400, res, next)(null, parsedOptions)
  }

  const callback = (err, response) => {
    response.results = response.results.map(document => {
      return mediaModel.formatDocuments(document)
    })

    help.sendBackJSON(200, res, next)(err, response)
  }

  this.model.get(query, parsedOptions.queryOptions, callback, req)
}

/**
 *
 */
MediaController.prototype.count = function (req, res, next) {
  var path = url.parse(req.url, true)
  var query = prepareQuery(req, this.model)
  var parsedOptions = prepareQueryOptions(path.query, this.model.settings)

  if (parsedOptions.errors.length > 0) {
    return help.sendBackJSON(400, res, next)(null, parsedOptions)
  }

  this.model.count(query, parsedOptions.queryOptions, help.sendBackJSON(200, res, next), req)
}

/**
 * Serve a media file from it's location on disk.
 */
MediaController.prototype.getFile = function (req, res, next, route) {
  // `serveStatic` will look at the entire URL to find the file it needs to
  // serve, but we're not serving files from the root. To get around this, we
  // pass it a modified version of the URL, where the root URL becomes just the
  // filename parameter.
  const modifiedReq = Object.assign({}, req, {
    url: `${route}/${req.params.filename}`
  })

  return serveStatic(config.get('media.basePath'))(modifiedReq, res, next)
}

/**
 * Generate a folder hierarchy for a file, based on a configuration property
 *
 * @param {string} fileName - the name of the file being uploaded
 */
MediaController.prototype.getPath = function (fileName) {
  var reSplitter

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
      return formatDate()
    case 'datetime':
      return formatDate(true)
    default:
      return ''
  }
}

MediaController.prototype.put = function (req, res, next) {
  return this.post(req, res, next)
}

MediaController.prototype.post = function (req, res, next) {
  if (req.method.toLowerCase() === 'post') {
    var busboy = new Busboy({ headers: req.headers })
    this.data = []
    this.fileName = ''

    // Listen for event when Busboy finds a file to stream
    busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
      if (this.tokenPayload) {
        if (this.tokenPayload.fileName && this.tokenPayload.fileName !== filename) {
          return next({
            statusCode: 400,
            name: 'Unexpected filename',
            message: 'Expected a file named "' + this.tokenPayload.fileName + '"'
          })
        }

        if (this.tokenPayload.mimetype && this.tokenPayload.mimetype !== mimetype) {
          return next({
            statusCode: 400,
            name: 'Unexpected mimetype',
            message: 'Expected a mimetype of "' + this.tokenPayload.mimetype + '"'
          })
        }
      }

      this.fileName = filename
      this.mimetype = mimetype

      file.on('data', (chunk) => {
        this.data.push(chunk)
      })

      file.on('end', () => {
        // console.log('Finished with ' + filename)
      })
    })

    // Listen for event when Busboy finds a non-file field
    busboy.on('field', (fieldname, val) => {
      // Do something with non-file field.
    })

    // Listen for event when Busboy is finished parsing the form
    busboy.on('finish', () => {
      var data = Buffer.concat(this.data)
      var stream = streamifier.createReadStream(data)

      var imageSizeStream = new PassThrough()
      var dataStream = new PassThrough()

      // duplicate the stream so we can use it for the imagesize() request and the
      // response. this saves requesting the same data a second time.
      stream.pipe(imageSizeStream)
      stream.pipe(dataStream)

      // get the image size and format
      imagesize(imageSizeStream, (err, imageInfo) => {
        if (err && err !== 'invalid') {
          console.log(err)
        }

        var fields = Object.keys(this.model.schema)

        var obj = {
          fileName: this.fileName
        }

        if (fields.includes('mimetype')) {
          obj.mimetype = this.mimetype
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

        var internals = {
          _apiVersion: req.url.split('/')[1],
          _createdAt: Date.now(),
          _createdBy: req.client && req.client.clientId
        }

        const callback = (err, response) => {
          response.results = response.results.map(document => {
            return mediaModel.formatDocuments(document)
          })

          help.sendBackJSON(201, res, next)(err, response)
        }

        return this.writeFile(req, this.fileName, this.mimetype, dataStream).then(result => {
          if (fields.includes('contentLength')) {
            obj.contentLength = result.contentLength
          }

          obj.path = result.path

          this.model.create(obj, internals, callback, req)
        })
      })
    })

    // Pipe the HTTP Request into Busboy
    req.pipe(busboy)
  } else {
    // if id is present in the url, then this is an update
    if (req.params.id || req.body.update) {
      var internals = {
        _lastModifiedAt: Date.now(),
        _lastModifiedBy: req.client && req.client.clientId
      }

      var query = {}
      var update = {}

      if (req.params.id) {
        query._id = req.params.id
        update = req.body
      } else {
        query = req.body.query
        update = req.body.update
      }

      this.model.update(query, update, internals, help.sendBackJSON(200, res, next), req)
    }
  }
}

/**
 *
 */
MediaController.prototype.setPayload = function (payload) {
  this.tokenPayload = payload
}

/**
 * Sets the route that this controller instance is resonsible for handling
 *
 * @param {string} route - a route in the format /apiVersion/database/collection. For example /1.0/library/images
 */
MediaController.prototype.setRoute = function (route) {
  this.route = route
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
    var folderPath = path.join(this.route, this.getPath(fileName))
    var storageHandler = StorageFactory.create(fileName)

    storageHandler.put(stream, folderPath).then((result) => {
      return resolve(result)
    }).catch((err) => {
      return reject(err)
    })
  })
}

function formatDate (includeTime) {
  var d = new Date()
  var dateParts = [
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

module.exports = function (model) {
  return new MediaController(model)
}

module.exports.MediaController = MediaController
