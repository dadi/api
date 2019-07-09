const connection = require(__dirname + '/../../../dadi/lib/model/connection')
const EventEmitter = require('events').EventEmitter

describe('Model connection', function() {
  this.timeout(5000)

  describe('constructor', function() {
    it('should be exposed', function(done) {
      connection.Connection.should.be.Function
      done()
    })

    it('should inherit from EventEmitter', function(done) {
      const conn = new connection.Connection()

      conn.should.be.an.instanceOf(EventEmitter)
      conn.emit.should.be.Function
      done()
    })
  })
})
