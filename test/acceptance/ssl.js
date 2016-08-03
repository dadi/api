var should = require('should')
var request = require('supertest')
var api = require(__dirname + '/../../dadi/lib/api')
var config = require(__dirname + '/../../config')

var clientHost = 'http://' + config.get('server.host') + ':' + config.get('server.port')
var secureClientHost = 'https://' + config.get('server.host') + ':' + config.get('server.port')

var client = request(clientHost)
var secureClient = request(secureClientHost)

var server

var defaultResponse = function defaultResponse(req, res, next) {
  var body = JSON.stringify({ foo: 'bar' })
  res.writeHead(200, {
    'content-length': body.length,
    'content-type': 'application/json'
  })
  res.end('{}')
  server.close()
}

describe('SSL', () => {

  before((done) => {
    // avoid [Error: self signed certificate] code: 'DEPTH_ZERO_SELF_SIGNED_CERT'
    process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
    done()
  })

  beforeEach((done) => {
    // give the server a chance to close & release the port
    setTimeout(done, 500)
  })

  afterEach((done) => {
    config.set('server.protocol', 'http')
    config.set('server.sslPassphrase', '')
    config.set('server.sslPrivateKeyPath', '')
    config.set('server.sslCertificatePath', '')

    done()
  })

  after((done) => {
    done()
  })

  it('should respond to a http request when ssl is disabled', (done) => {
    server = api()
    server.use(defaultResponse)
    server.listen(config.get('server.port'), config.get('server.host'))

    client
      .get('/')
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, res) => {
        if (err) throw err
      })

    done()
  })

  it('should respond to a https request when using unprotected ssl key without a passphrase', (done) => {
    config.set('server.protocol', 'https')
    config.set('server.sslPrivateKeyPath', 'test/ssl/unprotected/key.pem')
    config.set('server.sslCertificatePath', 'test/ssl/unprotected/cert.pem')

    server = api()
    server.use(defaultResponse)
    server.listen(config.get('server.port'), config.get('server.host'))

    secureClient
      .get('/')
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, res) => {
        if (err) throw err
      })

    done()
  })

  it('should respond to a https request when using protected ssl key with a passphrase', (done) => {
    config.set('server.protocol', 'https')
    config.set('server.sslPrivateKeyPath', 'test/ssl/protected/key.pem')
    config.set('server.sslCertificatePath', 'test/ssl/protected/cert.pem')
    config.set('server.sslPassphrase', 'changeme')

    server = api()
    server.use(defaultResponse)
    server.listen(config.get('server.port'), config.get('server.host'))

    secureClient
      .get('/')
      .expect('Content-Type', /json/)
      .expect(200)
      .end((err, res) => {
        if (err) throw err
      })

    done()
  })

  it('should throw a bad password read exception when using protected ssl key with the wrong passphrase', (done) => {
    config.set('server.protocol', 'https')
    config.set('server.sslPrivateKeyPath', 'test/ssl/protected/key.pem')
    config.set('server.sslCertificatePath', 'test/ssl/protected/cert.pem')
    config.set('server.sslPassphrase', 'incorrectamundo')

    try {
      server = api()
      server.use(defaultResponse)
      server.listen(config.get('server.port'), config.get('server.host'))
    } catch (ex) {
      ex.message.should.eql('error:06065064:digital envelope routines:EVP_DecryptFinal_ex:bad decrypt')
    }

    done()
  })

  it('should throw a bad password read exception when using protected ssl key without a passphrase', (done) => {
    config.set('server.protocol', 'https')
    config.set('server.sslPrivateKeyPath', 'test/ssl/protected/key.pem')
    config.set('server.sslCertificatePath', 'test/ssl/protected/cert.pem')

    try {
      server = api()
      server.use(defaultResponse)
      server.listen(config.get('server.port'), config.get('server.host'))
    } catch (ex) {
      ex.message.should.eql('error:0906A068:PEM routines:PEM_do_header:bad password read')
    }

    done()
  })

})
