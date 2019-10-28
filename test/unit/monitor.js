const should = require('should')
const monitor = require(__dirname + '/../../dadi/lib/monitor')
const help = require(__dirname + '/help')
const config = require(__dirname + '/../../config')
const EventEmitter = require('events').EventEmitter
const fs = require('fs')

describe('Monitor', function() {
  it('should export constructor', function(done) {
    monitor.Monitor.should.be.Function
    done()
  })

  it('should export a function that returns an instance', function(done) {
    const watch = monitor(__dirname)

    watch.should.be.an.instanceOf(monitor.Monitor)
    watch.close()
    done()
  })

  it('should inherit from Event Emitter', function(done) {
    const watch = monitor(__dirname)

    watch.should.be.an.instanceOf(EventEmitter)
    watch.close()
    done()
  })

  it('should accept a path as first argument', function(done) {
    const watch = monitor(__dirname)

    watch.path.should.equal(__dirname)
    watch.close()
    done()
  })

  it('should require a path as first argument', function(done) {
    monitor.should.throw()
    done()
  })

  it('should have `close` method', function(done) {
    const watch = monitor(__dirname)

    watch.close.should.be.Function
    watch.close()
    done()
  })

  describe('file system watching', function() {
    const testfile = 'testfile.txt'
    const testfilePath = __dirname + '/' + testfile

    afterEach(function(done) {
      fs.unlink(testfilePath, done)
    })

    it('should be able to watch for new files in a directory', function(done) {
      const watch = monitor(__dirname)

      watch.once('change', function(filename) {
        filename.should.equal(testfile)
        watch.close()
        done()
      })
      fs.writeFileSync(testfilePath, 'Foo Bar Baz Qux')
    })

    it('should be able to watch for changes to existing files', function(done) {
      fs.writeFileSync(testfilePath, 'Foo Bar Baz')

      const watch = monitor(__dirname)

      watch.on('change', function(filename) {
        filename.should.equal(testfile)
        watch.close()
        done()
      })

      fs.appendFileSync(testfilePath, ' Qux')
    })
  })
})
