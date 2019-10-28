const fs = require('fs')
const path = require('path')
const should = require('should')
const sinon = require('sinon')
const stream = require('stream')
const StorageFactory = require(__dirname + '/../../dadi/lib/storage/factory')

const config = require(__dirname + '/../../config')

describe('Storage', function(done) {
  beforeEach(function(done) {
    done()
  })

  afterEach(function(done) {
    done()
  })

  describe('Disk', function(done) {
    it('should use disk storage handler when set in config', function() {
      config.set('media.enabled', true)
      config.set('media.storage', 'disk')

      // create the handler
      const storage = StorageFactory.create('test.jpg')

      return should.not.exist(storage.s3)
    })

    it('should use disk storage handler as default', function() {
      config.set('media.enabled', true)
      config.set('media.storage', 'xxx')

      // create the handler
      const storage = StorageFactory.create('test.jpg')

      return should.not.exist(storage.s3)
    })

    it('should set full path to image directory', function() {
      config.set('media.enabled', true)
      config.set('media.storage', 'disk')
      config.set('media.basePath', '/tmp')

      // create the handler
      const storage = StorageFactory.create('test.jpg')

      storage.setFullPath('1234/5678')

      return storage.path.should.eql('/tmp/1234/5678')
    })

    it('should return full path to image file', function() {
      config.set('media.enabled', true)
      config.set('media.storage', 'disk')
      config.set('media.basePath', '/tmp')

      // create the handler
      const storage = StorageFactory.create('test.jpg')

      storage.setFullPath('1234/5678')

      return storage.getFullUrl().should.eql('/tmp/1234/5678/test.jpg')
    })

    it('should set a new filename if a file exists with the specified name', function(done) {
      config.set('media.enabled', true)
      config.set('media.storage', 'disk')
      config.set('media.basePath', 'test/temp-workspace/media')

      // create the handler
      const storage = StorageFactory.create('test.jpg')

      // mock the call to fs.stat, returning no error so we can
      // test the file renaming sequence
      sinon.stub(fs, 'stat').yields(null, {
        isDirectory(path) {
          return true
        }
      })

      // dummy stream
      const readable = new stream.Readable()

      readable.push('xxx')
      readable.push(null)

      storage.put(readable, '1234/5678').then(data => {
        fs.stat.restore()

        new RegExp('^test-[0-9]*.jpg$')
          .test(path.basename(data.path))
          .should.eql(true)

        // remove the file
        setTimeout(function() {
          fs.unlinkSync(path.join(storage.path, path.basename(data.path)))
          done()
        }, 1000)
      })
    })
  })
})
