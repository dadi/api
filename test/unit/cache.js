const api = require('../../dadi/lib/api')
const fs = require('fs')
const path = require('path')
const proxyquire = require('proxyquire')
const Server = require('../../dadi/lib')
const sinon = require('sinon')

let config
let cache
let testConfigString

describe('Cache', function(done) {
  beforeEach(function(done) {
    delete require.cache[path.join(__dirname, '/../../dadi/lib/cache')]
    cache = require(path.join(__dirname, '/../../dadi/lib/cache'))

    delete require.cache[path.join(__dirname, '/../../config')]
    config = require(path.join(__dirname, '/../../config'))

    testConfigString = fs.readFileSync(config.configPath())

    done()
  })

  afterEach(function(done) {
    fs.writeFileSync(config.configPath(), testConfigString)
    done()
  })

  it('should export middleware', function(done) {
    cache.should.be.Function
    cache.length.should.equal(1)

    done()
  })

  describe('Config', function(done) {
    it('should return default config settings for directory', function(done) {
      const newTestConfig = JSON.parse(testConfigString)

      delete newTestConfig.caching
      fs.writeFileSync(
        config.configPath(),
        JSON.stringify(newTestConfig, null, 2)
      )

      delete require.cache[path.join(__dirname, '/../../config')]
      config = require(path.join(__dirname, '/../../config'))

      config.loadFile(config.configPath())

      config.get('caching.directory.path').should.eql('./cache/api')
      config.get('caching.directory.extension').should.eql('json')

      done()
    })
  })

  it('should take a server instance as an argument', function(done) {
    const server = sinon.mock(Server)

    server.object.app = api()

    const method = sinon.spy(server.object.app, 'use')

    cache(server.object).init()

    method.called.should.eql(true)

    server.object.app.use.restore()
    done()
  })

  it("should cache if the app's directory config settings allow", function(done) {
    const server = sinon.mock(Server)

    server.object.app = api()

    const newTestConfig = JSON.parse(testConfigString)

    newTestConfig.caching.directory.enabled = true
    newTestConfig.caching.redis.enabled = false
    fs.writeFileSync(
      config.configPath(),
      JSON.stringify(newTestConfig, null, 2)
    )

    config.loadFile(config.configPath())

    cache = proxyquire('../../dadi/lib/cache', {config})

    cache(server.object).enabled.should.eql(true)

    done()
  })

  it("should not cache if the app's config settings don't allow", function(done) {
    const server = sinon.mock(Server)

    server.object.app = api()

    const newTestConfig = JSON.parse(testConfigString)

    newTestConfig.caching.directory.enabled = false
    newTestConfig.caching.redis.enabled = false
    fs.writeFileSync(
      config.configPath(),
      JSON.stringify(newTestConfig, null, 2)
    )

    config.loadFile(config.configPath())

    cache = proxyquire('../../dadi/lib/cache', {config})

    cache(server.object).enabled.should.eql(false)

    done()
  })

  it("should cache if the app's redis config settings allow", function(done) {
    const server = sinon.mock(Server)

    server.object.app = api()

    const newTestConfig = JSON.parse(testConfigString)

    newTestConfig.caching.directory.enabled = false
    newTestConfig.caching.redis.enabled = true
    fs.writeFileSync(
      config.configPath(),
      JSON.stringify(newTestConfig, null, 2)
    )

    config.loadFile(config.configPath())

    cache = proxyquire('../../dadi/lib/cache', {config})

    cache(server.object).enabled.should.eql(true)

    done()
  })

  describe('cachingEnabled', function(done) {
    it("should not cache if the url key can't be found in the loaded keys", function(done) {
      const server = sinon.mock(Server)

      server.object.app = api()

      const req = {
        url: '/library/authors'
      }

      cache(server.object)
        .cachingEnabled(req)
        .should.eql(false)

      done()
    })

    it('should cache if the url key can be found in the loaded keys and it allows caching', function(done) {
      const server = sinon.mock(Server)

      server.object.app = api()

      const req = {
        collectionModel: {
          isCacheable: () => true,
          name: 'books'
        },
        url: '/library/books'
      }

      cache.reset()
      cache(server.object)
        .cachingEnabled(req)
        .should.eql(true)

      done()
    })

    it('should not cache if the url key can be found in the loaded keys but it is not cacheable', function(done) {
      const server = sinon.mock(Server)

      server.object.app = api()

      const req = {
        collectionModel: {
          isCacheable: () => false,
          name: 'books'
        },
        url: '/library/books'
      }

      cache(server.object)
        .cachingEnabled(req)
        .should.eql(false)

      done()
    })

    it('should cache if the url key can be found in the loaded keys and ?cache=true exists in the query', function(done) {
      const server = sinon.mock(Server)

      server.object.app = api()

      const req = {
        collectionModel: {
          isCacheable: () => true,
          name: 'books'
        },
        url: '/library/books?cache=true'
      }

      cache(server.object)
        .cachingEnabled(req)
        .should.eql(true)

      done()
    })
  })
})
