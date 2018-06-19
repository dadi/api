var should = require('should')
var sinon = require('sinon')
var server = require(__dirname + '/../../dadi/lib')
var fs = require('fs')

describe('Server', function () {
  it('should export an instance', function (done) {
    server.start.should.be.Function
    server.stop.should.be.Function
    server.addComponent.should.be.Function
    server.addCollectionResource.should.be.Function
    done()
  })

  describe('start', function () {
    it('should set readyState', function (done) {
      var fakeFn = function () { return [] }
      var stub = sinon.stub(fs, 'readdirSync').callsFake(fakeFn)

      server.start()

      server.readyState.should.equal(1)
      stub.called.should.be.true
      stub.restore()

      done()
    })
  })

  describe('stop', function () {
    it('should set readyState', function (done) {
      var fakeFn = function (cb) { cb() }
      var stub = sinon.stub(server.server, 'close').callsFake(fakeFn)

      server.stop(function (err) {
        if (err) return done(err)

        server.readyState.should.equal(0)
        stub.called.should.be.true
        stub.restore()

        done()
      })
    })
  })

  describe('addComponent', function () {
    it('should keep reference to component', function (done) {
      var options = {
        name: 'test-component',
        component: function () {},
        route: '/server-acceptance-test-route'
      }
      server.addComponent(options)

      server.components[options.route].should.equal(options.component)
      done()
    })
  })
})
