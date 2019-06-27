const path = require('path')
const S3Storage = require(path.join(__dirname, '/s3'))
const DiskStorage = require(path.join(__dirname, '/disk'))

const config = require(path.join(__dirname, '/../../../config'))

module.exports = {
  create: function create(fileName) {
    const storageAdapter = config.get('media.storage')

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
