const api = require('../../dadi/lib/api')
const config = require('../../config')
const request = require('supertest')

describe('Server', function() {
  it('should respond to request', function(done) {
    const app = api()

    app.use(function(req, res, next) {
      const body = JSON.stringify({foo: 'bar'})

      res.writeHead(200, {
        'content-length': body.length,
        'content-type': 'application/json'
      })
      res.end(body)
    })

    const server = app.listen(
      config.get('server.port'),
      config.get('server.host')
    )

    request(server)
      .get('/')
      .expect('Content-Type', /json/)
      .expect(200, done)
  })

  describe('middleware', function() {
    it('should allow multiple', function(done) {
      const app = api()
      const body = JSON.stringify({foo: 'bar'})

      app.use(function(req, res, next) {
        res.writeHead(200, {
          'content-length': body.length,
          'content-type': 'application/json'
        })
        res.write(body)
        next()
      })

      app.use(function(req, res, next) {
        res.end()
      })

      const server = app.listen(
        config.get('server.port'),
        config.get('server.host')
      )

      request(server)
        .get('/')
        .expect('Content-Type', /json/)
        .expect(200, done)
    })

    it('should be able to pass error to next', function(done) {
      const app = api()
      const body = JSON.stringify({foo: 'bar'})

      app.use(function(req, res, next) {
        next(new Error('error handle test'))
      })

      const server = app.listen(
        config.get('server.port'),
        config.get('server.host')
      )

      request(server)
        .get('/')
        .expect(500, done)
    })
  })

  describe('routes', function() {
    it('should respond to requests', function(done) {
      const app = api()
      const body = JSON.stringify({foo: 'bar'})

      app.use(function(req, res, next) {
        res.setHeader('x-is-test', 'true')
        next()
      })

      app.use('/', function(req, res, next) {
        res.writeHead(200, {
          'content-type': 'application/json',
          'content-length': body.length
        })
        res.end(body)
      })

      const server = app.listen(
        config.get('server.port'),
        config.get('server.host')
      )

      request(server)
        .get('/')
        .expect('Content-Type', /json/)
        .expect('x-is-test', 'true')
        .expect(200, function(err, res) {
          if (err) return done(err)

          res.body.foo.should.equal('bar')
          done()
        })
    })

    it('should send 404', function(done) {
      const app = api()

      app.use(function(req, res, next) {
        res.setHeader('x-is-test', 'true')
        next()
      })

      app.use('/', function(req, res, next) {
        res.writeHead(204)
        res.end()
      })

      const server = app.listen(
        config.get('server.port'),
        config.get('server.host')
      )

      request(server)
        .get('/doesnotexist')
        .expect('x-is-test', 'true')
        .expect(404, done)
    })

    it('should send 500', function(done) {
      const app = api()

      app.use(function(req, res, next) {
        res.setHeader('x-is-test', 'true')
        next()
      })

      app.use('/', function(req, res, next) {
        next(new Error('500 test'))
      })

      const server = app.listen(
        config.get('server.port'),
        config.get('server.host')
      )

      request(server)
        .get('/')
        .expect('x-is-test', 'true')
        .expect(500, done)
    })

    it('should parse `req.params` from path', function(done) {
      const app = api()
      const id = 'test123'

      app.use('/model/:id', function(req, res, next) {
        req.params.id.should.equal(id)
        res.statusCode = 200
        res.end()
      })

      const server = app.listen(
        config.get('server.port'),
        config.get('server.host')
      )

      request(server)
        .get('/model/' + id)
        .expect(200, done)
    })
  })
})
