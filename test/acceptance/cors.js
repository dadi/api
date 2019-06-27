const app = require(__dirname + '/../../dadi/lib/')
const config = require(__dirname + '/../../config')
const help = require(__dirname + '/help')
const request = require('supertest')
const should = require('should')

const ORIGINAL_CORS = config.get('cors')

describe('CORS', () => {
  let client

  before(function (done) {
    help.createClient(null, function () {
      app.start(function (err) {
        if (err) return done(err)

        setTimeout(function () {
          done()
        }, 500)
      })
    })
  })

  after(function (done) {
    help.removeTestClients(function () {
      app.stop(done)
    })
  })

  before(() => {
    config.set('cors', true)
  })

  after(() => {
    config.set('cors', ORIGINAL_CORS)
  })

  beforeEach(() => {
    client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))
  })

  it('should respond to OPTIONS requests with a 204', done => {
    client
      .options('/')
      .expect(204)
      .end(done)
  })

  it('should reflect the Origin header back to the client for OPTIONS requests', done => {
    client
      .options('/')
      .set('Origin', 'http://orig.in')
      .expect('Access-Control-Allow-Origin', 'http://orig.in')
      .end(done)
  })

  it('should permit all HTTP methods for OPTIONS requests', done => {
    client
      .options('/')
      .expect('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE')
      .end(done)
  })

  it('should vary on Origin for OPTIONS requests with an Origin', done => {
    client
      .options('/')
      .set('Origin', 'http://orig.in')
      .expect('Vary', 'Origin')
      .end(done)
  })

  it('should permit any requested headers for OPTIONS requests', done => {
    client
      .options('/')
      .set('Access-Control-Request-Headers', 'authorization,content-type')
      .expect('Access-Control-Allow-Headers', 'authorization,content-type')
      .end(done)
  })

  it('should vary on Access-Control-Request-Headers for OPTIONS requests with Access-Control-Request-Headers', done => {
    client
      .options('/')
      .set('Access-Control-Request-Headers', 'authorization,content-type')
      .expect('Vary', 'Access-Control-Request-Headers')
      .end(done)
  })

  it('should reflect the Origin header back to the client for all other requests', done => {
    client
      .get('/')
      .set('Origin', 'http://orig.in')
      .expect('Access-Control-Allow-Origin', 'http://orig.in')
      .end(done)
  })

  it('should not expose the feature support header if disabled in config', done => {
    const featureQueryEnabled = config.get('featureQuery.enabled')

    config.set('featureQuery.enabled', false)

    client
    .get('/hello')
    .set('Access-Control-Request-Headers', 'authorization,content-type')
    .set('X-DADI-Requires', 'aclv1')
    .end((err, res) => {
      should.not.exist(res.headers['access-control-expose-headers'])

      config.set('featureQuery.enabled', featureQueryEnabled)

      done()
    })
  })

  it('should expose the feature support header if enabled in config', done => {
    const featureQueryEnabled = config.get('featureQuery.enabled')

    config.set('featureQuery.enabled', true)

    client
    .get('/hello')
    .set('Access-Control-Request-Headers', 'authorization,content-type')
    .set('X-DADI-Requires', 'aclv1')
    .end((err, res) => {
      res.headers['access-control-expose-headers'].includes('X-DADI-Supports').should.eql(true)

      config.set('featureQuery.enabled', featureQueryEnabled)

      done()
    })
  })
})
