const should = require('should')
const request = require('supertest')
const config = require(__dirname + '/../../../../config')
const help = require(__dirname + '/../../help')
const app = require(__dirname + '/../../../../dadi/lib/')

// variables scoped for use throughout tests
const connectionString =
  'http://' + config.get('server.host') + ':' + config.get('server.port')
let bearerToken
const lastModifiedAt = 0

describe('Collections API – Stats endpoint', function() {
  this.timeout(4000)

  before(function(done) {
    app.start(function() {
      help.getBearerTokenWithAccessType('admin', function(err, token) {
        if (err) return done(err)

        bearerToken = token

        done()
      })
    })
  })

  after(function(done) {
    app.stop(done)
  })

  it('should respond to a stats method', function(done) {
    help.createDoc(bearerToken, function(err, doc) {
      if (err) return done(err)

      const client = request(connectionString)

      client
        .get('/vtest/testdb/test-schema/stats')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        // .expect('content-type', 'application/json')
        .end(function(err, res) {
          if (err) return done(err)
          done()
        })
    })
  })

  it('should return correct count from stats method', function(done) {
    help.createDoc(bearerToken, function(err, doc) {
      if (err) return done(err)

      const client = request(connectionString)

      client
        .get('/vtest/testdb/test-schema/stats')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function(err, res) {
          if (err) return done(err)

          res.body.should.exist
          res.body.count.should.exist

          done()
        })
    })
  })

  it('should return 404 if not a GET request', function(done) {
    help.createDoc(bearerToken, function(err, doc) {
      if (err) return done(err)

      const client = request(connectionString)

      client
        .post('/vtest/testdb/test-schema/stats')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send({})
        .expect(404)
        .end(function(err, res) {
          if (err) return done(err)

          done()
        })
    })
  })
})
