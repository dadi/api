const request = require('supertest')
const config = require(__dirname + '/../../../config')
const help = require(__dirname + '/../help')
const app = require(__dirname + '/../../../dadi/lib/')

const connectionString =
  'http://' + config.get('server.host') + ':' + config.get('server.port')

let bearerToken

describe('Boolean Field', () => {
  beforeEach(done => {
    help.dropDatabase('library', 'misc', err => {
      app.start(() => {
        help
          .createSchemas([
            {
              version: 'v1',
              property: 'library',
              name: 'misc',
              fields: {
                boolean: {
                  type: 'Boolean'
                },
                string: {
                  type: 'String'
                },
                mixed: {
                  type: 'Mixed'
                },
                object: {
                  type: 'Object'
                },
                multiReference: {
                  type: 'Reference'
                }
              },
              settings: {
                cache: false,
                authenticate: false,
                count: 40,
                sort: 'string',
                sortOrder: 1,
                storeRevisions: false
              }
            }
          ])
          .then(() => {
            help.getBearerToken(function(err, token) {
              bearerToken = token

              done(err)
            })
          })
      })
    })
  })

  afterEach(done => {
    help.dropSchemas().then(() => {
      app.stop(done)
    })
  })

  it('should create and retrieve', done => {
    const client = request(connectionString)

    client
      .post('/v1/library/misc')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send({boolean: true})
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        res.body.results[0].boolean.should.eql(true)

        client
          .get(`/v1/library/misc/${res.body.results[0]._id}`)
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end((err, res) => {
            res.body.results[0].boolean.should.eql(true)

            done()
          })
      })
  })

  it('should retrieve all documents where the field is truthy', done => {
    const client = request(connectionString)
    const docs = [
      {
        boolean: true
      },
      {
        boolean: false
      },
      {
        boolean: true
      },
      {
        string: 'hello'
      }
    ]

    client
      .post('/v1/library/misc')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(docs)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        client
          .get(`/v1/library/misc?filter={"boolean":true}`)
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end((err, res) => {
            res.body.results.length.should.eql(2)

            done()
          })
      })
  })

  it('should retrieve all documents where the field is falsy', done => {
    const client = request(connectionString)
    const docs = [
      {
        boolean: true
      },
      {
        boolean: false
      },
      {
        boolean: true
      },
      {
        string: 'hello'
      }
    ]

    client
      .post('/v1/library/misc')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(docs)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        client
          .get(`/v1/library/misc?filter={"boolean":false}`)
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end((err, res) => {
            res.body.results.length.should.eql(2)

            done()
          })
      })
  })
})
