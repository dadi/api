const app = require('../../../../dadi/lib/')
const config = require('../../../../config')
const help = require('../../help')
const request = require('supertest')

const connectionString =
  'http://' + config.get('server.host') + ':' + config.get('server.port')
let bearerToken

describe('Collections API – Count endpoint', function() {
  this.timeout(6000)

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

  it('should return metadata about the collection', function(done) {
    const client = request(connectionString)

    client
      .get('/library/book/count')
      .set('Authorization', 'Bearer ' + bearerToken)
      .end(function(err, res) {
        const response = res.body

        response.metadata.should.exist
        response.metadata.totalCount.should.eql(2)

        done(err)
      })
  })

  it('should return metadata about the collection when using a filter', function(done) {
    const client = request(connectionString)

    client
      .get('/library/book/count?filter={"title":"A book 1"}')
      .set('Authorization', 'Bearer ' + bearerToken)
      .end(function(err, res) {
        const response = res.body

        response.metadata.should.exist
        response.metadata.totalCount.should.eql(1)

        done(err)
      })
  })
})
