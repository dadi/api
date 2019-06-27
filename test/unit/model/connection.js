const should = require('should')
const connection = require(__dirname + '/../../../dadi/lib/model/connection')
const help = require(__dirname + '/../help')
const EventEmitter = require('events').EventEmitter
const url = require('url')
const querystring = require('querystring')

const config = require(__dirname + '/../../../config')

describe('Model connection', function() {
  this.timeout(5000)

  // beforeEach(function (done) {
  //     // connection.resetConnections();
  //   done()
  // })

  // afterEach(function(done) {
  //   done()
  // })

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
