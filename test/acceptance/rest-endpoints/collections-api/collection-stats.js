const app = require('../../../../dadi/lib/')
const config = require('../../../../config')
const help = require('../../help')
const request = require('supertest')

const connectionString =
  'http://' + config.get('server.host') + ':' + config.get('server.port')
let bearerToken

describe('Collections API – Stats endpoint', function() {
  this.timeout(4000)

  before(done => {
    app.start(() => {
      help.dropDatabase('testdb', function(err) {
        if (err) return done(err)

        help
          .createSchemas([
            {
              name: 'book',
              fields: {
                title: {
                  type: 'String',
                  required: true
                }
              },
              property: 'library',
              settings: {
                cache: false,
                authenticate: true,
                count: 40
              },
              version: '1.0'
            }
          ])
          .then(() => {
            help.getBearerToken(function(err, token) {
              if (err) return done(err)
              bearerToken = token

              const client = request(connectionString)

              client
                .post('/library/book')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({title: 'A book 1'})
                .expect(200)
                .end(function(err, res) {
                  if (err) return done(err)

                  client
                    .post('/library/book')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .send({title: 'A book 2'})
                    .expect(200)
                    .end(function(err, res) {
                      if (err) return done(err)

                      done()
                    })
                })
            })
          })
      })
    })
  })

  after(done => {
    help.dropSchemas().then(() => {
      app.stop(done)
    })
  })

  it('should respond to a stats method', function(done) {
    const client = request(connectionString)

    client
      .get('/library/book/stats')
      .set('Authorization', 'Bearer ' + bearerToken)
      .expect(200)
      .end(function(err, res) {
        if (err) return done(err)
        done()
      })
  })

  it('should return correct count from stats method', function(done) {
    const client = request(connectionString)

    client
      .get('/library/book/stats')
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

  it('should return 404 if not a GET request', function(done) {
    const client = request(connectionString)

    client
      .post('/library/book/stats')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send({})
      .expect(404)
      .end(function(err, res) {
        done(err)
      })
  })
})
