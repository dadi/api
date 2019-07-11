const app = require('../../dadi/lib/')
const config = require('../../config')
const help = require('./help')
const fs = require('fs')
const request = require('supertest')

let bearerToken
const connectionString =
  'http://' + config.get('server.host') + ':' + config.get('server.port')
const logpath =
  config.get('logging').path +
  '/' +
  config.get('logging').filename +
  '.access.' +
  config.get('logging').extension

const resetLog = function(done) {
  // empty the log for each test
  fs.writeFileSync(logpath, Buffer.from(''))
  done()
}

describe('Logger', function() {
  describe('request', function() {
    beforeEach(resetLog)

    before(function(done) {
      help.dropDatabase('testdb', function(err) {
        if (err) return done(err)

        app.start(() => {
          help
            .createSchemas([
              {
                fields: {
                  field1: {
                    type: 'String',
                    label: 'Title',
                    comments: 'The title of the entry',
                    validation: {},
                    required: false
                  },
                  title: {
                    type: 'String',
                    label: 'Title',
                    comments: 'The title of the entry',
                    validation: {},
                    required: false,
                    search: {
                      weight: 2
                    }
                  },
                  leadImage: {
                    type: 'Media'
                  },
                  leadImageJPEG: {
                    type: 'Media',
                    validation: {
                      mimeTypes: ['image/jpeg']
                    }
                  },
                  legacyImage: {
                    type: 'Reference',
                    settings: {
                      collection: 'mediaStore'
                    }
                  },
                  fieldReference: {
                    type: 'Reference',
                    settings: {
                      collection: 'test-reference-schema'
                    }
                  }
                },
                name: 'test-schema',
                property: 'testdb',
                settings: {
                  cache: true,
                  cacheTTL: 300,
                  authenticate: true,
                  count: 40,
                  sortOrder: 1,
                  storeRevisions: true,
                  revisionCollection: 'testSchemaHistory'
                },
                version: 'vtest'
              }
            ])
            .then(() => {
              help.getBearerTokenWithAccessType('admin', function(err, token) {
                bearerToken = token

                done(err)
              })
            })
        })
      })
    })

    after(done => {
      help.dropSchemas().then(() => {
        app.stop(() => {
          done()
        })
      })
    })

    it('should log to the access log when collection endpoint is requested', function(done) {
      help.createDoc(bearerToken, function(err, doc) {
        if (err) return done(err)

        const client = request(connectionString)

        client
          .get('/vtest/testdb/test-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .expect('content-type', 'application/json')
          .end(function(err, res) {
            if (err) return done(err)

            res.body['results'].should.exist
            res.body['results'].should.be.Array
            res.body['results'].length.should.be.above(0)

            const logEntry = fs.readFileSync(logpath, {encoding: 'utf8'})

            logEntry.indexOf('/vtest/testdb/test-schema').should.be.above(0)

            done()
          })
      })
    })

    it('should determine the client IP address correctly', function(done) {
      help.createDoc(bearerToken, function(err, doc) {
        if (err) return done(err)

        const client = request(connectionString)

        client
          .get('/vtest/testdb/test-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .set('x-forwarded-for', '52.101.34.175')
          .expect(200)
          .expect('content-type', 'application/json')
          .end(function(err, res) {
            if (err) return done(err)

            setTimeout(() => {
              const logEntry = fs.readFileSync(logpath, {encoding: 'utf8'})

              logEntry.indexOf('52.101.34.175').should.be.above(0)

              done()
            }, 300)
          })
      })
    })
  })
})
