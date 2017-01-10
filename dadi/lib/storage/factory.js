var path = require('path')
var S3Storage = require(path.join(__dirname, '/s3'))
var DiskStorage = require(path.join(__dirname, '/disk'))

var config = require(path.join(__dirname, '/../../../config'))

module.exports = {
  create: function create (fileName) {
    var storageAdapter = config.get('media.storage')

    switch (storageAdapter) {
      case 'disk':
        return new DiskStorage(fileName)
      case 's3':
        return new S3Storage(fileName)
      default:
        return new DiskStorage(fileName)
    }
  }
}
