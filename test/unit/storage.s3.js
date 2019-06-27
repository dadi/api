const AWS = require('aws-sdk-mock')
const fs = require('fs')
const should = require('should')
const stream = require('stream')
const StorageFactory = require(__dirname + '/../../dadi/lib/storage/factory')
const S3Storage = require(__dirname + '/../../dadi/lib/storage/s3')

const config = require(__dirname + '/../../config')

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

      // create the s3 handler
      const storage = StorageFactory.create('test.jpg')

      return should.exist(storage.s3)
    })

    it('should use bucket name from config', function () {
      config.set('media.enabled', true)
      config.set('media.storage', 's3')
      config.set('media.s3.bucketName', 'testbucket')

      const settings = config.get('media')
      const s3Storage = new S3Storage('test.jpg')

      return s3Storage.getBucket().should.eql(settings.s3.bucketName)
    })

    it('should determine provider type by inclusion of endpoint', function () {
      config.set('media.enabled', true)
      config.set('media.storage', 's3')
      config.set('media.s3.bucketName', 'testbucket')
      config.set('media.s3.endpoint', 'nyc1')

      const settings = config.get('media')
      const s3Storage = new S3Storage('test.jpg')

      return s3Storage.providerType.should.eql('DigitalOcean')
    })

    it.skip('should call S3 API with the correct parameters when uploading media', function (done) {
      config.set('media.enabled', true)
      config.set('media.storage', 's3')
      config.set('media.s3.bucketName', 'testbucket')

      const settings = config.get('media')

      // set expected key value
      const expected = settings.basePath + '/test.jpg'

      // mock the s3 request
      AWS.mock('S3', 'putObject', (data) => {
        console.log(data)
        AWS.restore()
        // here's the test
        // "data" contains the parameters passed to putObject
        data.Bucket.should.eql(config.get('media.s3.bucketName'))
        data.Key.should.eql(expected)
        done()
      })

      // create the s3 handler
      const storage = StorageFactory.create('test.jpg')

      const readable = new stream.Readable()

      readable.push('xxx')
      readable.push(null)

      storage.put(readable, '').then(() => {
        // nothing
      }).catch(err => {
        console.log(err)
      })
    })

    it('should call S3 API with the correct parameters when deleting media', function (done) {
      config.set('media.enabled', true)
      config.set('media.storage', 's3')
      config.set('media.s3.bucketName', 'testbucket')

      const settings = config.get('media')

      // set expected key value
      const expected = settings.basePath + '/test.jpg'

      const file = {
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
      const storage = StorageFactory.create('test.jpg')

      storage.delete(file).then(() => {
        // nothing
      })
    })

    it('should call S3 API with the correct parameters when requesting media', function (done) {
      config.set('media.enabled', true)
      config.set('media.storage', 's3')
      config.set('media.s3.bucketName', 'testbucket')

      const settings = config.get('media')

      // set expected key value
      const expected = 'test.jpg'

      const file = {
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
      const storage = StorageFactory.create('test.jpg')

      storage.get(file.fileName, 'media', {}, {}, function () {}).then(() => {
        // nothing
      })
    })

    it('should set the provierType to "DigitalOcean" when an endpoint is specified', function (done) {
      config.set('media.enabled', true)
      config.set('media.storage', 's3')
      config.set('media.s3.bucketName', 'testbucket')
      config.set('media.s3.endpoint', 'nyc3.digitalocean.com')

      // set expected key value
      const expected = 'test.jpg'

      const file = {
        fileName: 'test.jpg',
        path: expected
      }

      // create the s3 handler
      const storage = StorageFactory.create('test.jpg')

      config.set('media.s3.endpoint', '')

      storage.providerType.should.eql('DigitalOcean')

      done()
    })
  })
})
