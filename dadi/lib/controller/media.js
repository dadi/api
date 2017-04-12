var _ = require('underscore')
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

var MediaModel = require(path.join(__dirname, '/../model/media'))
var prepareQueryOptions = require(path.join(__dirname, './index')).prepareQueryOptions
var StorageFactory = require(path.join(__dirname, '/../storage/factory'))

var collectionName = config.get('media.collection')

var MediaController = function (tokenPayload) {
  this.model = new MediaModel(collectionName)
  this.tokenPayload = tokenPayload
}

MediaController.prototype.get = function (req, res, next) {
  var path = url.parse(req.url, true)
  var parsedOptions = prepareQueryOptions(path.query, this.model.getSchema().settings)

  if (parsedOptions.errors.length > 0) {
    return help.sendBackJSON(400, res, next)(null, parsedOptions)
  }

  this.model.get({}, parsedOptions.queryOptions, help.sendBackJSON(200, res, next), req)
}

MediaController.prototype.getFile = function (req, res, next) {
  // `serveStatic` will look at the entire URL to find the file it needs to
  // serve, but we're not serving files from the root. To get around this, we
  // pass it a modified version of the URL, where the root URL becomes just the
  // filename parameter.
  const modifiedReq = Object.assign({}, req, {url: req.params.filename})

  return serveStatic(config.get('media.basePath'))(modifiedReq, res, next)
}

MediaController.prototype.post = function (req, res, next) {
  var busboy = new Busboy({ headers: req.headers })
  this.data = []
  this.fileName = ''

  // Listen for event when Busboy finds a file to stream
  busboy.on('file', (fieldname, file, filename, encoding, mimetype) => {
    if (this.tokenPayload) {
      if (this.tokenPayload.fileName !== filename) {
        return next({
          statusCode: 400,
          name: 'Unexpected filename',
          message: 'Expected a file named "' + this.tokenPayload.fileName + '"'
        })
      }

      if (this.tokenPayload.mimetype !== mimetype) {
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
      // console.log('Finished with ' + fieldname)
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

      var obj = {
        fileName: this.fileName,
        mimetype: this.mimetype,
        width: imageInfo.width,
        height: imageInfo.height
      }

      var internals = {
        createdAt: Date.now(),
        createdBy: req.client && req.client.clientId
      }

      return writeFile(req, this.fileName, this.mimetype, dataStream).then((result) => {
        obj = _.extend(obj, result)

        this.model.create(obj, internals, help.sendBackJSON(201, res, next), req)
      })
    })
  })

  // Pipe the HTTP Request into Busboy
  req.pipe(busboy)
}

module.exports = function (tokenPayload) {
  return new MediaController(tokenPayload)
}

module.exports.MediaController = MediaController

function writeFile (req, fileName, mimetype, stream) {
  return new Promise((resolve, reject) => {
    var folderPath = getPath(fileName)
    var storageHandler = StorageFactory.create(fileName)

    storageHandler.put(stream, folderPath).then((result) => {
      return resolve(result)
    }).catch((err) => {
      return reject(err)
    })
  })
}

function getPath (fileName) {
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
