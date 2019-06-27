const should = require('should')
const sinon = require('sinon')
const server = require(__dirname + '/../../dadi/lib')
const fs = require('fs')

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
      const fakeFn = function () { return [] }

      const stub = sinon.stub(fs, 'readdirSync').callsFake(fakeFn)

      server.start()

      server.readyState.should.equal(1)
      stub.called.should.be.true
      stub.restore()

      done()
    })
  })

  describe('stop', function () {
    it('should set readyState', function (done) {
      const fakeFn = function (cb) { cb() }

      const stub = sinon.stub(server.server, 'close').callsFake(fakeFn)

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
      const options = {
        name: 'test-component',
        component () {},
        route: '/server-acceptance-test-route'
      }

      server.addComponent(options)

      server.components[options.route].should.equal(options.component)
      done()
    })
  })
})
