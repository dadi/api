const app = require(__dirname + '/../../dadi/lib/')
const config = require(__dirname + '/../../config')
const help = require(__dirname + '/help')
const request = require('supertest')

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

  it('responds to OPTIONS requests with a 204', done => {
    client
      .options('/')
      .expect(204)
      .end(done)
  })

  it('reflects the Origin header back to the client for OPTIONS requests', done => {
    client
      .options('/')
      .set('Origin', 'http://orig.in')
      .expect('Access-Control-Allow-Origin', 'http://orig.in')
      .end(done)
  })

  it('pemits all HTTP methods for OPTIONS requests', done => {
    client
      .options('/')
      .expect('Access-Control-Allow-Methods', 'GET,HEAD,PUT,PATCH,POST,DELETE')
      .end(done)
  })

  it('varies on Origin for OPTIONS requests with an Origin', done => {
    client
      .options('/')
      .set('Origin', 'http://orig.in')
      .expect('Vary', 'Origin')
      .end(done)
  })

  it('permits any requested headers for OPTIONS requests', done => {
    client
      .options('/')
      .set('Access-Control-Request-Headers', 'authorization,content-type')
      .expect('Access-Control-Allow-Headers', 'authorization,content-type')
      .end(done)
  })

  it('varies on Access-Control-Request-Headers for OPTIONS requests with Access-Control-Request-Headers', done => {
    client
      .options('/')
      .set('Access-Control-Request-Headers', 'authorization,content-type')
      .expect('Vary', 'Access-Control-Request-Headers')
      .end(done)
  })

  it('reflects the Origin header back to the client for all other requests', done => {
    client
      .get('/')
      .set('Origin', 'http://orig.in')
      .expect('Access-Control-Allow-Origin', 'http://orig.in')
      .end(done)
  })
})

