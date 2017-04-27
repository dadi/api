var fs = require('fs')
var lengthStream = require('length-stream')
var mkdirp = require('mkdirp')
var path = require('path')

var config = require(path.join(__dirname, '/../../../config'))

/**
 *
 */
var DiskStorage = function (fileName) {
  this.basePath = path.resolve(config.get('media.basePath'))
  this.fileName = fileName
}

/**
 *
 * @param {string} folderPath - xxx
 */
DiskStorage.prototype.setFullPath = function (folderPath) {
  this.path = path.join(this.basePath, folderPath)
}

/**
 *
 * @returns {string}
 */
DiskStorage.prototype.getFullUrl = function () {
  return path.join(this.path, this.fileName)
}

/**
 *
 * @returns {string}
 */
DiskStorage.prototype.getStaticAssetUrl = function (folderPath, fileName) {
  return `${config.get('server.protocol')}://${config.get('server.baseUrl')}${folderPath}/${fileName}`
}

/**
 *
 * @param {Stream} stream - xxx
 * @param {string} folderPath - xxx
 */
DiskStorage.prototype.put = function (stream, folderPath) {
  this.setFullPath(folderPath)

  return new Promise((resolve, reject) => {
    mkdirp(this.path, (err, made) => {
      if (err) {
        return reject(err)
      }

      var filePath = this.getFullUrl()

      fs.stat(filePath, (err, stats) => {
        if (err) {
          // file not found on disk, so ok to write it with no filename changes
        } else {
          // file exists, give it a new name
          var pathParts = path.parse(filePath)
          var newFileName = pathParts.name + '-' + Date.now().toString() + pathParts.ext
          filePath = path.join(this.path, newFileName)
        }

        var data = {
          path: this.getStaticAssetUrl(folderPath, newFileName || this.fileName)
        }

        function lengthListener (length) {
          data.contentLength = length
        }

        var writeStream = fs.createWriteStream(filePath)
        stream.pipe(lengthStream(lengthListener)).pipe(writeStream)

        return resolve(data)
      })
    })
  })
}

module.exports = function (fileName) {
  return new DiskStorage(fileName)
}

module.exports.DiskStorage = DiskStorage
