const fs = require('fs')
const lengthStream = require('length-stream')
const mkdirp = require('mkdirp')
const path = require('path')
const serveStatic = require('serve-static')

const config = require(path.join(__dirname, '/../../../config'))

/**
 * Creates a new DiskStorage instance
 * @constructor
 * @classdesc
 */
const DiskStorage = function (fileName) {
  this.basePath = path.resolve(config.get('media.basePath'))
  this.fileName = fileName
}

/**
 * Set the path for uploading a file
 */
DiskStorage.prototype.setFullPath = function (folderPath) {
  this.path = path.join(this.basePath, folderPath)
}

/**
 * Get the full URL for the file, including path and filename
 */
DiskStorage.prototype.getFullUrl = function () {
  return path.join(this.path, this.fileName)
}

DiskStorage.prototype.get = function (filePath, route, req, res, next) {
  // `serveStatic` will look at the entire URL to find the file it needs to
  // serve, but we're not serving files from the root. To get around this, we
  // pass it a modified version of the URL, where the root URL becomes just the
  // filename parameter.
  const modifiedReq = Object.assign({}, req, {
    url: `${route}/${req.params.filename}`
  })

  return new Promise((resolve, reject) => {
    try {
      serveStatic(config.get('media.basePath'))(modifiedReq, res, next)
      resolve()
    } catch (err) {
      return reject(err)
    }
  })
}

/**
 * Upload a file to the filesystem
 *
 * @param {Stream} stream - the stream containing the uploaded file
 * @param {string} folderPath - the directory structure in which to store the file
 */
DiskStorage.prototype.put = function (stream, folderPath) {
  this.setFullPath(folderPath)

  return new Promise((resolve, reject) => {
    mkdirp(this.path, (err, made) => {
      if (err) {
        return reject(err)
      }

      let filePath = this.getFullUrl()
      let newFileName

      fs.stat(filePath, (err, stats) => {
        if (err) {
          // file not found on disk, so ok to write it with no filename changes
        } else {
          // file exists, give it a new name
          const pathParts = path.parse(filePath)

          newFileName = pathParts.name + '-' + Date.now().toString() + pathParts.ext
          filePath = path.join(this.path, newFileName)
        }

        const data = {
          path: `${folderPath}/${newFileName || this.fileName}`
        }

        function lengthListener (length) {
          data.contentLength = length
        }

        const writeStream = fs.createWriteStream(filePath)

        stream.pipe(lengthStream(lengthListener)).pipe(writeStream)

        return resolve(data)
      })
    })
  })
}

/**
 * Delete a file from the filesystem
 *
 * @param {Object} file - the media file's database record
 */
DiskStorage.prototype.delete = function (fileDocument) {
  return new Promise((resolve, reject) => {
    const filePath = path.join(this.basePath, fileDocument.path)

    fs.unlink(filePath, err => {
      if (err) {
        return reject(err)
      }

      return resolve()
    })
  })
}

module.exports = function (fileName) {
  return new DiskStorage(fileName)
}

module.exports.DiskStorage = DiskStorage
