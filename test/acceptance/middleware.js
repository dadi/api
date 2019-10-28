const should = require('should')
const request = require('supertest')
const config = require(__dirname + '/../../config')
const help = require(__dirname + '/help')
const appHelp = require(__dirname + '/../../dadi/lib/help')
const app = require(__dirname + '/../../dadi/lib/')

// variables scoped for use throughout tests
let bearerToken
const connectionString =
  'http://' + config.get('server.host') + ':' + config.get('server.port')

describe('middleware extension', function(done) {
  before(function(done) {
    app.start(function(err) {
      if (err) return done(err)
      help.dropDatabase('testdb', function(err) {
        if (err) return done(err)

        help.getBearerToken(function(err, token) {
          if (err) return done(err)

          bearerToken = token

          done()
        })
      })
    })
  })

  after(function(done) {
    help.removeTestClients(function() {
      app.stop(done)
    })
  })

  it('should expose a .get method', function(done) {
    const client = request(connectionString)

    app.get(
      '/test-route',
      function(req, res, next) {
        // make sure we can pass multiple middlewares
        next()
      },
      function(req, res, next) {
        appHelp.sendBackJSON(200, res, next)(null, {
          result: 'test passed'
        })
      }
    )

    client
      .get('/test-route')
      .set('Authorization', 'Bearer ' + bearerToken)
      .expect(200)
      .expect('content-type', 'application/json')
      .end(function(err, res) {
        if (err) return done(err)

        res.body.result.should.equal('test passed')
        done()
      })
  })

  it('should expose a .post method', function(done) {
    const client = request(connectionString)

    app.post(
      '/test-route',
      function(req, res, next) {
        // make sure we can pass multiple middlewares
        next()
      },
      function(req, res, next) {
        // we are using the body parser internally
        req.body.name.should.equal('POST test request')
        appHelp.sendBackJSON(200, res, next)(null, {
          result: 'test passed'
        })
      }
    )

    client
      .post('/test-route')
      .send({name: 'POST test request'})
      .set('Authorization', 'Bearer ' + bearerToken)
      .expect(200)
      .expect('content-type', 'application/json')
      .end(function(err, res) {
        if (err) return done(err)

        res.body.result.should.equal('test passed')
        done()
      })
  })

  it('should expose a .put method', function(done) {
    const client = request(connectionString)

    app.put(
      '/test-route',
      function(req, res, next) {
        // make sure we can pass multiple middlewares
        next()
      },
      function(req, res, next) {
        // we are using the body parser internally
        req.body.name.should.equal('PUT test request')
        appHelp.sendBackJSON(200, res, next)(null, {
          result: 'test passed'
        })
      }
    )

    client
      .put('/test-route')
      .send({name: 'PUT test request'})
      .set('Authorization', 'Bearer ' + bearerToken)
      .expect(200)
      .expect('content-type', 'application/json')
      .end(function(err, res) {
        if (err) return done(err)

        res.body.result.should.equal('test passed')
        done()
      })
  })

  it('should expose a .delete method', function(done) {
    const client = request(connectionString)

    app.delete(
      '/test-route',
      function(req, res, next) {
        // make sure we can pass multiple middlewares
        next()
      },
      function(req, res, next) {
        // we are using the body parser internally
        req.body.name.should.equal('DELETE test request')
        appHelp.sendBackJSON(200, res, next)(null, {
          result: 'test passed'
        })
      }
    )

    client
      .delete('/test-route')
      .send({name: 'DELETE test request'})
      .set('Authorization', 'Bearer ' + bearerToken)
      .expect(200)
      .expect('content-type', 'application/json')
      .end(function(err, res) {
        if (err) return done(err)

        res.body.result.should.equal('test passed')
        done()
      })
  })

  it('should expose a .head method', function(done) {
    const client = request(connectionString)

    app.head(
      '/test-route',
      function(req, res, next) {
        // make sure we can pass multiple middlewares
        next()
      },
      function(req, res, next) {
        res.statusCode = 204
        res.end()
      }
    )

    client
      .head('/test-route')
      .set('Authorization', 'Bearer ' + bearerToken)
      .expect(204)
      .end(done)
  })

  it('should expose a .options method', function(done) {
    const client = request(connectionString)

    app.options(
      '/test-route',
      function(req, res, next) {
        // make sure we can pass multiple middlewares
        next()
      },
      function(req, res, next) {
        // we are using the body parser internally
        req.body.name.should.equal('OPTIONS test request')
        appHelp.sendBackJSON(200, res, next)(null, {
          result: 'test passed'
        })
      }
    )

    client
      .options('/test-route')
      .send({name: 'OPTIONS test request'})
      .set('Authorization', 'Bearer ' + bearerToken)
      .expect(200)
      .expect('content-type', 'application/json')
      .end(function(err, res) {
        if (err) return done(err)

        res.body.result.should.equal('test passed')
        done()
      })
  })

  it('should expose a .trace method', function(done) {
    const client = request(connectionString)

    app.trace(
      '/test-route',
      function(req, res, next) {
        // make sure we can pass multiple middlewares
        next()
      },
      function(req, res, next) {
        // we are using the body parser internally
        req.body.name.should.equal('TRACE test request')

        // reflect the request as recieved
        appHelp.sendBackJSON(200, res, next)(null, req.body)
      }
    )

    client
      .trace('/test-route')
      .send({name: 'TRACE test request'})
      .set('Authorization', 'Bearer ' + bearerToken)
      .expect(200)
      .expect('content-type', 'application/json')
      .end(function(err, res) {
        if (err) return done(err)

        res.body.name.should.equal('TRACE test request')
        done()
      })
  })
})
