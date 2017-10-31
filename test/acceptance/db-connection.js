const app = require(__dirname + '/../../dadi/lib/')
const config = require(__dirname + '/../../config')
const EventEmitter = require('events').EventEmitter
const fs = require('fs')
const help = require(__dirname + '/help')
const mockConnector = require(__dirname + '/workspace/data-connectors/mock-connector1')
const path = require('path')
const request = require('supertest')
const should = require('should')

const client = request(
  'http://' + config.get('server.host') + ':' + config.get('server.port')
)
const mockResults = {
  results: [
    { _id: '59d4b35cb2cf37d706b1d706', title: 'Father' },
    { _id: '59d4b35cb2cf37d706b1d707', title: 'Dad' },
    { _id: '59d4b35cb2cf37d706b1d708', title: 'Daddy' }
  ],
  metadata: {
    limit: 20,
    page: 1,
    fields: {},
    offset: 0,
    totalCount: 0,
    totalPages: 0
  }
}

describe('Database connection', () => {
  let backupDatastore = config.get('datastore')

  before(done => {
    const mockConnectorPath = path.resolve(
      __dirname + '/workspace/data-connectors/mock-connector1'
    )

    config.set('datastore', mockConnectorPath)

    done()
  })

  after(done => {
    config.set('datastore', backupDatastore)

    done()
  })

  describe('when available at app boot', function () {
    this.timeout(6000)

    let bearerToken
    let datastore

    beforeEach(done => {
      mockConnector._mockFailedConnection(false)

      app.start(err => {
        if (err) return done(err)

        help.getBearerTokenWithAccessType('admin', (err, token) => {
          if (err) return done(err)

          bearerToken = token

          datastore = app.components['/vtest/noauthdb/articles/:id([a-fA-F0-9-]*)?'].model.connection.datastore

          done()
        })
      })
    })

    afterEach(done => {
      app.stop(() => {
        done()
      })
    })

    it('should return 200 for GET requests whilst the connection is available', done => {
      mockConnector._mockSetResponse(mockResults)

      client
        .get('/vtest/noauthdb/articles?cache=false')
        .set('content-type', 'application/json')
        .set('Authorization', 'Bearer ' + bearerToken)
        .end((err, res) => {
          if (err) return done(err)

          res.statusCode.should.eql(200)
          res.body.should.eql(mockResults)

          datastore._spies.index.callCount.should.be.above(0)

          setTimeout(() => {
            client
              .get('/vtest/noauthdb/articles?cache=false')
              .set('content-type', 'application/json')
              .set('Authorization', 'Bearer ' + bearerToken)
              .end((err, res) => {
                if (err) return done(err)

                res.statusCode.should.eql(200)
                res.body.should.eql(mockResults)

                done()
              })
            }, 1000)
        })
    })

    it('should return 503 for GET requests when the database becomes unavailable', done => {
      mockConnector._mockSetResponse(mockResults)

      client
        .get('/vtest/noauthdb/articles?cache=false')
        .set('content-type', 'application/json')
        .set('Authorization', 'Bearer ' + bearerToken)
        .end((err, res) => {
          if (err) return done(err)

          res.statusCode.should.eql(200)
          res.body.should.eql(mockResults)
          datastore._spies.index.callCount.should.be.above(0)

          datastore._mockDisconnect()
          client
            .get('/vtest/noauthdb/articles?cache=false')
            .set('content-type', 'application/json')
            .set('Authorization', 'Bearer ' + bearerToken)
            .end((err, res) => {
              if (err) return done(err)

              res.statusCode.should.eql(503)
              res.body.statusCode.should.eql(503)
              res.body.code.should.eql('API-0004')
              res.body.title.should.eql('Database unavailable')

              done()
            })
        })
    })

    it('should return 200 for PUT requests whilst the connection is available', done => {
      mockConnector._mockSetResponse(mockResults)

      client
        .put('/vtest/noauthdb/articles/59d4b35cb2cf37d706b1d706?cache=false')
        .send({
          title: 'Dadi'
        })
        .set('content-type', 'application/json')
        .set('Authorization', 'Bearer ' + bearerToken)
        .end((err, res) => {
          if (err) return done(err)

          res.statusCode.should.eql(200)
          res.body.should.eql(mockResults)
          datastore._spies.index.callCount.should.be.above(0)

          setTimeout(() => {
            client
              .put('/vtest/noauthdb/articles/59d4b35cb2cf37d706b1d706?cache=false')
              .send({
                title: 'Dadi'
              })
              .set('content-type', 'application/json')
              .set('Authorization', 'Bearer ' + bearerToken)
              .end((err, res) => {
                if (err) return done(err)

                res.statusCode.should.eql(200)
                res.body.should.eql(mockResults)

                done()
              })
            }, 1000)
        })
    })

    it('should return 503 for PUT requests when the database becomes unavailable', done => {
      mockConnector._mockSetResponse(mockResults)

      client
        .put('/vtest/noauthdb/articles/59d4b35cb2cf37d706b1d706?cache=false')
        .send({
          title: 'Dadi'
        })
        .set('content-type', 'application/json')
        .set('Authorization', 'Bearer ' + bearerToken)
        .end((err, res) => {
          if (err) return done(err)

          res.statusCode.should.eql(200)
          res.body.should.eql(mockResults)
          datastore._spies.index.callCount.should.be.above(0)

          datastore._mockDisconnect()

          client
            .put('/vtest/noauthdb/articles/59d4b35cb2cf37d706b1d706?cache=false')
            .send({
              title: 'Dadi'
            })
            .set('content-type', 'application/json')
            .set('Authorization', 'Bearer ' + bearerToken)
            .end((err, res) => {
              if (err) return done(err)

              res.statusCode.should.eql(503)
              res.body.statusCode.should.eql(503)
              res.body.code.should.eql('API-0004')
              res.body.title.should.eql('Database unavailable')

              done()
            })
        })
    })

    it('should return 200 for POST requests whilst the connection is available', done => {
      mockConnector._mockSetResponse(mockResults)

      client
        .post('/vtest/noauthdb/articles?cache=false')
        .send({
          published: {
            state: 1
          },
          title: 'Dadi'
        })
        .set('content-type', 'application/json')
        .set('Authorization', 'Bearer ' + bearerToken)
        .end((err, res) => {
          if (err) return done(err)

          res.statusCode.should.eql(200)
          res.body.results[0].title.should.eql('Dadi')
          res.body.results[0].published.state.should.eql(1)
          datastore._spies.index.callCount.should.be.above(0)

          setTimeout(() => {
            client
              .post('/vtest/noauthdb/articles?cache=false')
              .send({
                published: {
                  state: 1
                },
                title: 'Dadi'
              })
              .set('content-type', 'application/json')
              .set('Authorization', 'Bearer ' + bearerToken)
              .end((err, res) => {
                if (err) return done(err)

                res.statusCode.should.eql(200)
                res.body.results[0].title.should.eql('Dadi')
                res.body.results[0].published.state.should.eql(1)

                done()
              })
            }, 1000)
        })
    })

    it('should return 503 for POST requests when the database becomes unavailable', done => {
      mockConnector._mockSetResponse(mockResults)

      client
        .post('/vtest/noauthdb/articles?cache=false')
        .send({
          published: {
            state: 1
          },
          title: 'Dadi'
        })
        .set('content-type', 'application/json')
        .set('Authorization', 'Bearer ' + bearerToken)
        .end((err, res) => {
          if (err) return done(err)

          res.statusCode.should.eql(200)
          res.body.results[0].title.should.eql('Dadi')
          res.body.results[0].published.state.should.eql(1)
          datastore._spies.index.callCount.should.be.above(0)

          datastore._mockDisconnect()

          setTimeout(() => {
            client
              .post('/vtest/noauthdb/articles?cache=false')
              .send({
                published: {
                  state: 1
                },
                title: 'Dadi'
              })
              .set('content-type', 'application/json')
              .set('Authorization', 'Bearer ' + bearerToken)
              .end((err, res) => {
                if (err) return done(err)

                res.statusCode.should.eql(503)
                res.body.statusCode.should.eql(503)
                res.body.code.should.eql('API-0004')
                res.body.title.should.eql('Database unavailable')

                done()
              })
          }, 1500)
        })
    })

    it('should return 204 for DELETE requests whilst the connection is available', done => {
      mockConnector._mockSetResponse(mockResults)

      client
        .delete('/vtest/noauthdb/articles/59d4b35cb2cf37d706b1d706?cache=false')
        .set('content-type', 'application/json')
        .set('Authorization', 'Bearer ' + bearerToken)
        .end((err, res) => {
          if (err) return done(err)

          res.statusCode.should.eql(204)
          res.body.should.eql('')
          datastore._spies.index.callCount.should.be.above(0)

          setTimeout(() => {
            client
              .delete('/vtest/noauthdb/articles/59d4b35cb2cf37d706b1d707?cache=false')
              .set('content-type', 'application/json')
              .set('Authorization', 'Bearer ' + bearerToken)
              .end((err, res) => {
                if (err) return done(err)

                res.statusCode.should.eql(204)
                res.body.should.eql('')

                done()
              })
            }, 1000)
        })
    })

    it('should return 503 for DELETE requests when the database becomes unavailable', done => {
      mockConnector._mockSetResponse(mockResults)

      client
        .delete('/vtest/noauthdb/articles/59d4b35cb2cf37d706b1d706?cache=false')
        .set('content-type', 'application/json')
        .set('Authorization', 'Bearer ' + bearerToken)
        .end((err, res) => {
          if (err) return done(err)

          res.statusCode.should.eql(204)
          res.body.should.eql('')
          datastore._spies.index.callCount.should.be.above(0)

          datastore._mockDisconnect()

          client
            .delete('/vtest/noauthdb/articles/59d4b35cb2cf37d706b1d706?cache=false')
            .set('content-type', 'application/json')
            .set('Authorization', 'Bearer ' + bearerToken)
            .end((err, res) => {
              if (err) return done(err)

              res.statusCode.should.eql(503)
              res.body.statusCode.should.eql(503)
              res.body.code.should.eql('API-0004')
              res.body.title.should.eql('Database unavailable')

              done()
            })
        })
    })
  })

  describe('when not available at app boot', function () {
    this.timeout(10000)

    let bearerToken
    let datastore

    beforeEach(done => {
      mockConnector._mockFailedConnection(true)

      app.start(err => {
        if (err) return done(err)

        datastore = app.components['/vtest/noauthdb/articles/:id([a-fA-F0-9-]*)?'].model.connection.datastore

        done()
      })
    })

    afterEach(done => {
      app.stop(done)
    })

    it('should return 503 for GET requests whilst the connection is unavailable', done => {
      mockConnector._mockSetResponse(mockResults)

      client
        .get('/vtest/noauthdb/articles?cache=false')
        .set('content-type', 'application/json')
        .set('Authorization', 'Bearer ' + bearerToken)
        .end((err, res) => {
          if (err) return done(err)

          datastore._spies.index.called.should.eql(false)

          res.statusCode.should.eql(503)
          res.body.statusCode.should.eql(503)
          res.body.code.should.eql('API-0004')
          res.body.title.should.eql('Database unavailable')

          setTimeout(() => {
            client
              .get('/vtest/noauthdb/articles?cache=false')
              .set('content-type', 'application/json')
              .set('Authorization', 'Bearer ' + bearerToken)
              .end((err, res) => {
                res.statusCode.should.eql(503)
                res.body.statusCode.should.eql(503)
                res.body.code.should.eql('API-0004')
                res.body.title.should.eql('Database unavailable')

                done()
              })
          }, 2000)
        })
    })

    it('should return 200 for GET requests once the database becomes available', done => {
      mockConnector._mockSetResponse(mockResults)

      client
        .get('/vtest/noauthdb/articles?cache=false')
        .set('content-type', 'application/json')
        .set('Authorization', 'Bearer ' + bearerToken)
        .end((err, res) => {
          if (err) return done(err)

          datastore._spies.index.called.should.eql(false)

          res.statusCode.should.eql(503)
          res.body.statusCode.should.eql(503)
          res.body.code.should.eql('API-0004')
          res.body.title.should.eql('Database unavailable')

          mockConnector._mockFailedConnection(false)

          setTimeout(() => {
            client
              .get('/vtest/noauthdb/articles?cache=false')
              .set('content-type', 'application/json')
              .set('Authorization', 'Bearer ' + bearerToken)
              .end((err, res) => {
                res.statusCode.should.eql(200)
                res.body.should.eql(mockResults)
                datastore._spies.index.callCount.should.be.above(0)

                done()
              })
          }, 5000)
        })
    })

    it('should return 503 for PUT requests whilst the connection is unavailable', done => {
      mockConnector._mockSetResponse(mockResults)

      client
        .put('/vtest/noauthdb/articles/59d4b35cb2cf37d706b1d706?cache=false')
        .send({
          title: 'Dadi'
        })
        .set('content-type', 'application/json')
        .set('Authorization', 'Bearer ' + bearerToken)
        .end((err, res) => {
          if (err) return done(err)

          datastore._spies.index.called.should.eql(false)

          res.statusCode.should.eql(503)
          res.body.statusCode.should.eql(503)
          res.body.code.should.eql('API-0004')
          res.body.title.should.eql('Database unavailable')

          setTimeout(() => {
            client
              .put('/vtest/noauthdb/articles/59d4b35cb2cf37d706b1d706?cache=false')
              .send({
                title: 'Dadi'
              })
              .set('content-type', 'application/json')
              .set('Authorization', 'Bearer ' + bearerToken)
              .end((err, res) => {
                res.statusCode.should.eql(503)
                res.body.statusCode.should.eql(503)
                res.body.code.should.eql('API-0004')
                res.body.title.should.eql('Database unavailable')

                done()
              })
          }, 2000)
        })
    })

    it('should return 200 for PUT requests once the database becomes available', done => {
      mockConnector._mockSetResponse(mockResults)

      client
        .put('/vtest/noauthdb/articles/59d4b35cb2cf37d706b1d706?cache=false')
        .send({
          title: 'Dadi'
        })
        .set('content-type', 'application/json')
        .set('Authorization', 'Bearer ' + bearerToken)
        .end((err, res) => {
          if (err) return done(err)

          datastore._spies.index.called.should.eql(false)

          res.statusCode.should.eql(503)
          res.body.statusCode.should.eql(503)
          res.body.code.should.eql('API-0004')
          res.body.title.should.eql('Database unavailable')

          mockConnector._mockFailedConnection(false)

          setTimeout(() => {
            client
              .put('/vtest/noauthdb/articles/59d4b35cb2cf37d706b1d706?cache=false')
              .send({
                title: 'Dadi'
              })
              .set('content-type', 'application/json')
              .set('Authorization', 'Bearer ' + bearerToken)
              .end((err, res) => {
                res.statusCode.should.eql(200)
                res.body.should.eql(mockResults)
                datastore._spies.index.callCount.should.be.above(0)

                done()
              })
          }, 5000)
        })
    })

    it('should return 503 for POST requests whilst the connection is unavailable', done => {
      mockConnector._mockSetResponse(mockResults)

      client
        .post('/vtest/noauthdb/articles?cache=false')
        .send({
          published: {
            state: 1
          },
          title: 'Dadi'
        })
        .set('content-type', 'application/json')
        .set('Authorization', 'Bearer ' + bearerToken)
        .end((err, res) => {
          if (err) return done(err)

          datastore._spies.index.called.should.eql(false)

          res.statusCode.should.eql(503)
          res.body.statusCode.should.eql(503)
          res.body.code.should.eql('API-0004')
          res.body.title.should.eql('Database unavailable')

          setTimeout(() => {
            client
              .post('/vtest/noauthdb/articles?cache=false')
              .send({
                published: {
                  state: 1
                },
                title: 'Dadi'
              })
              .set('content-type', 'application/json')
              .set('Authorization', 'Bearer ' + bearerToken)
              .end((err, res) => {
                res.statusCode.should.eql(503)
                res.body.statusCode.should.eql(503)
                res.body.code.should.eql('API-0004')
                res.body.title.should.eql('Database unavailable')

                done()
              })
          }, 2000)
        })
    })

    it('should return 200 for POST requests once the database becomes available', done => {
      mockConnector._mockSetResponse(mockResults)

      client
        .post('/vtest/noauthdb/articles?cache=false')
        .send({
          published: {
            state: 1
          },
          title: 'Dadi'
        })
        .set('content-type', 'application/json')
        .set('Authorization', 'Bearer ' + bearerToken)
        .end((err, res) => {
          if (err) return done(err)

          datastore._spies.index.called.should.eql(false)

          res.statusCode.should.eql(503)
          res.body.statusCode.should.eql(503)
          res.body.code.should.eql('API-0004')
          res.body.title.should.eql('Database unavailable')

          mockConnector._mockFailedConnection(false)

          setTimeout(() => {
            client
              .post('/vtest/noauthdb/articles?cache=false')
              .send({
                published: {
                  state: 1
                },
                title: 'Dadi'
              })
              .set('content-type', 'application/json')
              .set('Authorization', 'Bearer ' + bearerToken)
              .end((err, res) => {
                res.statusCode.should.eql(200)
                res.body.results[0].title.should.eql('Dadi')
                res.body.results[0].published.state.should.eql(1)
                datastore._spies.index.callCount.should.be.above(0)

                done()
              })
          }, 5000)
        })
    })

    it('should return 503 for DELETE requests whilst the connection is unavailable', done => {
      mockConnector._mockSetResponse(mockResults)

      client
        .delete('/vtest/noauthdb/articles/59d4b35cb2cf37d706b1d706?cache=false')
        .set('content-type', 'application/json')
        .set('Authorization', 'Bearer ' + bearerToken)
        .end((err, res) => {
          if (err) return done(err)

          datastore._spies.index.called.should.eql(false)

          res.statusCode.should.eql(503)
          res.body.statusCode.should.eql(503)
          res.body.code.should.eql('API-0004')
          res.body.title.should.eql('Database unavailable')

          setTimeout(() => {
            client
              .delete('/vtest/noauthdb/articles/59d4b35cb2cf37d706b1d706?cache=false')
              .set('content-type', 'application/json')
              .set('Authorization', 'Bearer ' + bearerToken)
              .end((err, res) => {
                res.statusCode.should.eql(503)
                res.body.statusCode.should.eql(503)
                res.body.code.should.eql('API-0004')
                res.body.title.should.eql('Database unavailable')

                done()
              })
          }, 2000)
        })
    })

    it('should return 204 for DELETE requests once the database becomes available', done => {
      mockConnector._mockSetResponse(mockResults)

      client
        .delete('/vtest/noauthdb/articles/59d4b35cb2cf37d706b1d706?cache=false')
        .set('content-type', 'application/json')
        .set('Authorization', 'Bearer ' + bearerToken)
        .end((err, res) => {
          if (err) return done(err)

          datastore._spies.index.called.should.eql(false)

          res.statusCode.should.eql(503)
          res.body.statusCode.should.eql(503)
          res.body.code.should.eql('API-0004')
          res.body.title.should.eql('Database unavailable')

          mockConnector._mockFailedConnection(false)

          setTimeout(() => {
            client
              .delete('/vtest/noauthdb/articles/59d4b35cb2cf37d706b1d706?cache=false')
              .set('content-type', 'application/json')
              .set('Authorization', 'Bearer ' + bearerToken)
              .end((err, res) => {
                res.statusCode.should.eql(204)
                res.body.should.eql('')
                datastore._spies.index.callCount.should.be.above(0)

                done()
              })
          }, 5000)
        })
    })
  })
})
