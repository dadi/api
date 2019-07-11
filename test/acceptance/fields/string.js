const app = require('../../../dadi/lib/')
const config = require('../../../config')
const help = require('../help')
const request = require('supertest')

const connectionString =
  'http://' + config.get('server.host') + ':' + config.get('server.port')

let bearerToken

describe('String Field', () => {
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

  describe('query filtering', () => {
    it('should transform string to case-insensitive regex when at root', done => {
      const client = request(connectionString)
      const value = 'Hello world'

      client
        .post('/v1/library/misc')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send({string: value})
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          client
            .get(`/v1/library/misc?filter={"string":"${value.toUpperCase()}"}`)
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end((err, res) => {
              res.body.results.length.should.eql(1)
              res.body.results[0].string.should.eql(value)

              done(err)
            })
        })
    })

    it('should not transform string to case-insensitive regex when nested inside operator', done => {
      const client = request(connectionString)
      const value = 'Hello world'

      client
        .post('/v1/library/misc')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send({string: value})
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          client
            .get(
              `/v1/library/misc?filter={"string":{"$ne":"${value.toUpperCase()}"}}`
            )
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end((err, res) => {
              res.body.results.length.should.eql(1)
              res.body.results[0].string.should.eql(value)

              done()
            })
        })
    })
  })
})
