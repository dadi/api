const app = require(__dirname + '/../../dadi/lib/')
const config = require(__dirname + '/../../config')
const DataStore = require(__dirname + '/../../dadi/lib/datastore')
const mockRequire = require('mock-require')
const path = require('path')
const proxyquire = require('proxyquire')
const should = require('should')
const sinon = require('sinon')

describe('DataStore', function () {
  let datastoreBackup = config.get('datastore')

  afterEach(() => {
    config.set('datastore', datastoreBackup)
  })

  it('should throw an error when specifying an unknown connector', done => {
    should.throws(() => DataStore('xxx'))

    done()
  })

  it('should call the constructor function of the data connector', done => {
    let namespace = {
      MockConnector: function () {}
    }

    namespace.MockConnector.prototype.connect = () => Promise.resolve()

    let spy = sinon.spy(namespace, 'MockConnector')

    mockRequire('@dadi/api-fakestore', namespace.MockConnector)

    config.set('datastore', '@dadi/api-fakestore')

    app.start(err => {
      if (err) return done(err)

      spy.called.should.eql(true)

      setTimeout(() => {
        app.stop(done)
      }, 250)
    })
  })

  it('should call the handshake function of the data connector', done => {
    let MockConnector = function () {}

    MockConnector.prototype.connect = () => Promise.resolve()
    MockConnector.prototype.handshake = sinon.stub().returns({
      version: '1.0.0'
    })

    mockRequire('@dadi/api-fakestore', MockConnector)

    config.set('datastore', '@dadi/api-fakestore')

    app.start(err => {
      if (err) return done(err)

      MockConnector.prototype.handshake.called.should.eql(true)

      setTimeout(() => {
        app.stop(done)
      }, 250)
    })
  })

  it('should not throw an error if the data connector does not implement a handshake function and there is no minimum version required set for it', done => {
    let MockConnector = function () {}

    MockConnector.prototype.connect = () => Promise.resolve()

    mockRequire('@dadi/api-fakestore', MockConnector)

    DataStore.setPackageData({
      dataConnectorDependencies: {
        '@dadi/api-someotherstore': '1.1.0'
      }
    })

    config.set('datastore', '@dadi/api-fakestore')

    app.start(err => {
      if (err) return done(err)

      setTimeout(() => {
        app.stop(done)
      }, 250)
    })
  })

  it('should throw an error if the data connector does not implement a handshake function and there is a minimum version required set for it', done => {
    let MockConnector = function () {}

    MockConnector.prototype.connect = () => Promise.resolve()

    mockRequire('@dadi/api-fakestore', MockConnector)

    DataStore.setPackageData({
      dataConnectorDependencies: {
        '@dadi/api-fakestore': '1.1.0'
      }
    })

    config.set('datastore', '@dadi/api-fakestore')

    try {
      app.start()
    } catch (err) {
      err.should.be.Error
      err.message.should.eql(
        `The minimum supported version of '@dadi/api-fakestore' is '1.1.0'. Please update your dependency.`
      )

      setTimeout(() => {
        app.stop(err => {
          ;(err.message.indexOf('not running') > 0).should.eql(true)

          done()
        })
      }, 250)
    }
  })

  describe('data connector version check', () => {
    it('should not throw an error if the version of the data connector is the same as the one required by API', done => {
      let MockConnector = function () {}

      MockConnector.prototype.connect = () => Promise.resolve()
      MockConnector.prototype.handshake = () => ({
        version: '1.1.0'
      })

      mockRequire('@dadi/api-fakestore', MockConnector)

      DataStore.setPackageData({
        dataConnectorDependencies: {
          '@dadi/api-fakestore': '1.1.0'
        }
      })

      config.set('datastore', '@dadi/api-fakestore')

      app.start(err => {
        if (err) return done(err)

        setTimeout(() => {
          app.stop(done)
        }, 250)
      })
    })

    it('should not throw an error if the version of the data connector is greater than the one required by API', done => {
      let MockConnector = function () {}

      MockConnector.prototype.connect = () => Promise.resolve()
      MockConnector.prototype.handshake = () => ({
        version: '2.5.0'
      })

      mockRequire('@dadi/api-fakestore', MockConnector)

      DataStore.setPackageData({
        dataConnectorDependencies: {
          '@dadi/api-fakestore': '1.1.0'
        }
      })

      config.set('datastore', '@dadi/api-fakestore')

      app.start(err => {
        if (err) return done(err)

        setTimeout(() => {
          app.stop(done)
        }, 250)
      })
    })

    it('should throw an error if the version of the data connector is lower than the one required by API', done => {
      let MockConnector = function () {}

      MockConnector.prototype.connect = () => Promise.resolve()
      MockConnector.prototype.handshake = sinon.stub().returns({
        version: '1.0.0'
      })

      mockRequire('@dadi/api-fakestore', MockConnector)

      DataStore.setPackageData({
        dataConnectorDependencies: {
          '@dadi/api-fakestore': '1.1.0'
        }
      })

      config.set('datastore', '@dadi/api-fakestore')

      try {
        app.start()
      } catch (err) {
        err.should.be.Error
        err.message.should.eql(
          `The minimum supported version of '@dadi/api-fakestore' is '1.1.0'. Please update your dependency.`
        )

        setTimeout(() => {
          app.stop(err => {
            ;(err.message.indexOf('not running') > 0).should.eql(true)

            done()
          })
        }, 250)
      }
    })
  })

  describe('API version check', () => {
    it('should not throw an error if the version of API is the same as the one required by the data connector', done => {
      let MockConnector = function () {}

      MockConnector.prototype.connect = () => Promise.resolve()
      MockConnector.prototype.handshake = () => ({
        minimumApiVersion: '3.2.0',
        version: '1.1.0'
      })

      mockRequire('@dadi/api-fakestore', MockConnector)

      DataStore.setPackageData({
        dataConnectorDependencies: {},
        version: '3.2.0'
      })

      config.set('datastore', '@dadi/api-fakestore')

      app.start(err => {
        if (err) return done(err)

        setTimeout(() => {
          app.stop(done)
        }, 250)
      })
    })

    it('should not throw an error if the version of API is greater than the one required by the data connector', done => {
      let MockConnector = function () {}

      MockConnector.prototype.connect = () => Promise.resolve()
      MockConnector.prototype.handshake = () => ({
        minimumApiVersion: '3.0.0',
        version: '2.5.0'
      })

      mockRequire('@dadi/api-fakestore', MockConnector)

      DataStore.setPackageData({
        dataConnectorDependencies: {},
        version: '3.2.0'
      })

      config.set('datastore', '@dadi/api-fakestore')

      app.start(err => {
        if (err) return done(err)

        setTimeout(() => {
          app.stop(done)
        }, 250)
      })
    })

    it('should throw an error if the version of API is lower than the one required by the data connector', done => {
      let MockConnector = function () {}

      MockConnector.prototype.connect = () => Promise.resolve()
      MockConnector.prototype.handshake = sinon.stub().returns({
        minimumApiVersion: '3.1.0',
        version: '1.0.0'
      })

      mockRequire('@dadi/api-fakestore', MockConnector)

      DataStore.setPackageData({
        dataConnectorDependencies: {},
        version: '3.0.0'
      })

      config.set('datastore', '@dadi/api-fakestore')

      try {
        app.start()
      } catch (err) {
        err.should.be.Error
        err.message.should.eql(
          `The version of '@dadi/api-fakestore' being used (1.0.0) requires version 3.1.0 (or greater) of DADI API. Please update your app or install an older version of the data connector, if available.`
        )

        setTimeout(() => {
          app.stop(err => {
            ;(err.message.indexOf('not running') > 0).should.eql(true)

            done()
          })
        }, 250)
      }
    })
  })
})
