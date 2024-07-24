const api = require('../../dadi/lib/api')
const config = require('../../config')
const request = require('supertest')

const clientHost =
  'http://' + config.get('server.host') + ':' + config.get('server.port')
const secureClientHost =
  'https://' + config.get('server.host') + ':' + config.get('server.port')

const client = request(clientHost)
const secureClient = request(secureClientHost)

let server

const defaultResponse = function defaultResponse(req, res, next) {
  const body = JSON.stringify({foo: 'bar'})

  res.writeHead(200, {
    'content-length': body.length,
    'content-type': 'application/json'
  })
  res.end(body)
  next()
}

describe('SSL', function() {
  this.timeout(5 * 60 * 1000)

  before(done => {
    // avoid [Error: self signed certificate] code: 'DEPTH_ZERO_SELF_SIGNED_CERT'
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    done()
  })

  beforeEach(done => {
    // give the server a chance to close & release the port
    setTimeout(done, 500)
  })

  afterEach(done => {
    config.set('server.protocol', 'http')
    config.set('server.redirectPort', '')
    config.set('server.sslPassphrase', '')
    config.set('server.sslPrivateKeyPath', '')
    config.set('server.sslCertificatePath', '')

    server.close(err => {
      if (err) {
        console.log(err) // error if server not running
      }

      done()
    })
  })

  after(done => {
    done()
  })

  it('should respond to a http request when ssl is disabled', done => {
    server = api()
    server.use(defaultResponse)
    server.listen()

    client
      .get('/')
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, res) => {
        if (err) done(err)
        done()
      })
  })

  it('should redirect http request to https when redirectPort is set', done => {
    config.set('server.protocol', 'https')
    config.set('server.redirectPort', '9999')
    config.set('server.sslPrivateKeyPath', 'test/ssl/unprotected/key.pem')
    config.set('server.sslCertificatePath', 'test/ssl/unprotected/cert.pem')

    server = api()
    server.use(defaultResponse)
    server.listen()

    const httpClient = request('http://' + config.get('server.host') + ':9999')

    httpClient
      .get('/')
      .expect(301)
      .end((err, res) => {
        if (err) return done(err)
        done()
      })
  })

  it('should respond to a https request when using unprotected ssl key without a passphrase', done => {
    config.set('server.protocol', 'https')
    config.set('server.sslPrivateKeyPath', 'test/ssl/unprotected/key.pem')
    config.set('server.sslCertificatePath', 'test/ssl/unprotected/cert.pem')

    server = api()
    server.use(defaultResponse)
    server.listen()

    secureClient
      .get('/')
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, res) => {
        if (err) done(err)
        done()
      })
  })

  it('should respond to a https request when using protected ssl key with a passphrase', done => {
    config.set('server.protocol', 'https')
    config.set('server.sslPrivateKeyPath', 'test/ssl/protected/key.pem')
    config.set('server.sslCertificatePath', 'test/ssl/protected/cert.pem')
    config.set('server.sslPassphrase', 'changeme')

    server = api()
    server.use(defaultResponse)
    server.listen()

    secureClient
      .get('/')
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, res) => {
        if (err) done(err)
        done()
      })
  })

  it('should throw a bad password read exception when using protected ssl key with the wrong passphrase', done => {
    config.set('server.protocol', 'https')
    config.set('server.sslPrivateKeyPath', 'test/ssl/protected/key.pem')
    config.set('server.sslCertificatePath', 'test/ssl/protected/cert.pem')
    config.set('server.sslPassphrase', 'incorrectamundo')

    try {
      server = api()
      server.use(defaultResponse)
      server.listen()
    } catch (ex) {
      ex.message.should.startWith('error starting https server')
    }

    done()
  })

  it('should throw a bad password read exception when using protected ssl key without a passphrase', done => {
    config.set('server.protocol', 'https')
    config.set('server.sslPrivateKeyPath', 'test/ssl/protected/key.pem')
    config.set('server.sslCertificatePath', 'test/ssl/protected/cert.pem')

    try {
      server = api()
      server.use(defaultResponse)
      server.listen()
    } catch (ex) {
      ex.message.should.startWith('error starting https server')
    }

    done()
  })
})
