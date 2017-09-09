var _ = require('underscore')
var should = require('should')
var connection = require(__dirname + '/../../../dadi/lib/model/connection')
var help = require(__dirname + '/../help')
var EventEmitter = require('events').EventEmitter
var url = require('url')
var querystring = require('querystring')

var config = require(__dirname + '/../../../config')

describe('Model connection', function () {
  this.timeout(5000)

  // beforeEach(function (done) {
  //     // connection.resetConnections();
  //   done()
  // })

  // afterEach(function(done) {
  //   done()
  // })

  describe('constructor', function () {
    it('should be exposed', function (done) {
      connection.Connection.should.be.Function
      done()
    })

    it('should inherit from EventEmitter', function (done) {
      var conn = new connection.Connection()
      conn.should.be.an.instanceOf(EventEmitter)
      conn.emit.should.be.Function
      done()
    })
  })
})
