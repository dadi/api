var AWS = require('aws-sdk-mock')
var fs = require('fs')
var path = require('path')
var should = require('should')
var sinon = require('sinon')
var stream = require('stream')
var StorageFactory = require(__dirname + '/../../dadi/lib/storage/factory')
var DiskStorage = require(__dirname + '/../../dadi/lib/storage/disk')
var S3Storage = require(__dirname + '/../../dadi/lib/storage/s3')
var cache = require(__dirname + '/../../dadi/lib/cache')

var config = require(__dirname + '/../../config')

describe('Storage', function (done) {
  beforeEach(function (done) {
    done()
  })

  afterEach(function (done) {
    done()
  })

  describe('S3', function (done) {
    it('should use S3 storage handler when set in config', function () {
      config.set('media.enabled', true)
      config.set('media.storage', 's3')
      config.set('media.s3.bucketName', 'testbucket')

      var settings = config.get('media')
      var s3Storage = new S3Storage('test.jpg')

      // create the s3 handler
      var storage = StorageFactory.create('test.jpg')
      return should.exist(storage.s3)
    })

    it('should use bucket name from config', function () {
      config.set('media.enabled', true)
      config.set('media.s3.bucketName', 'testbucket')

      var settings = config.get('media')
      var s3Storage = new S3Storage('test.jpg')

      return s3Storage.getBucket().should.eql(settings.s3.bucketName)
    })

    it('should call S3 API with the correct parameters when uploading media', function (done) {
      config.set('media.enabled', true)
      config.set('media.s3.bucketName', 'testbucket')

      var settings = config.get('media')

      // set expected key value
      var expected = settings.basePath + '/test.jpg'

      // mock the s3 request
      AWS.mock('S3', 'putObject', (data) => {
        AWS.restore()
        // here's the test
        // "data" contains the parameters passed to putObject
        data.Bucket.should.eql(config.get('media.s3.bucketName'))
        data.Key.should.eql(expected)
        done()
      })

      // create the s3 handler
      var storage = StorageFactory.create('test.jpg')

      var readable = new stream.Readable()
      readable.push('xxx')
      readable.push(null)

      storage.put(readable, '').then(() => {
        // nothing
      })
    })

    it('should call S3 API with the correct parameters when deleting media', function (done) {
      config.set('media.enabled', true)
      config.set('media.s3.bucketName', 'testbucket')

      var settings = config.get('media')

      // set expected key value
      var expected = settings.basePath + '/test.jpg'

      var file = {
        fileName: 'test.jpg',
        path: expected
      }

      // mock the s3 request
      AWS.mock('S3', 'deleteObject', (data) => {
        AWS.restore()
        // here's the test
        // "data" contains the parameters passed to deleteObject
        data.Bucket.should.eql(config.get('media.s3.bucketName'))
        data.Key.should.eql(expected)
        done()
      })

      // create the s3 handler
      var storage = StorageFactory.create('test.jpg')

      storage.delete(file).then(() => {
        // nothing
      })
    })

    it('should call S3 API with the correct parameters when requesting media', function (done) {
      config.set('media.enabled', true)
      config.set('media.s3.bucketName', 'testbucket')

      var settings = config.get('media')

      // set expected key value
      var expected = 'test.jpg'

      var file = {
        fileName: 'test.jpg',
        path: expected
      }

      // mock the s3 request
      AWS.mock('S3', 'getObject', (data) => {
        AWS.restore()

        // here's the test
        // "data" contains the parameters passed to getObject
        data.Bucket.should.eql(config.get('media.s3.bucketName'))
        data.Key.should.eql(expected)
        done()
      })

      // create the s3 handler
      var storage = StorageFactory.create('test.jpg')

      storage.get(file.fileName, 'media', {}, {}, function () {}).then(() => {
        // nothing
      })
    })
  })
})
