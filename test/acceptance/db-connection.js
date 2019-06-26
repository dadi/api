const app = require(__dirname + '/../../dadi/lib/')
const config = require(__dirname + '/../../config')
const EventEmitter = require('events').EventEmitter
const fs = require('fs')
const help = require(__dirname + '/help')
const path = require('path')
const request = require('supertest')
const should = require('should')
const testConnector = require(__dirname + '/../test-connector')

const client = request(
  'http://' + config.get('server.host') + ':' + config.get('server.port')
)

const mockDocument = {
  title: 'Foo was arrested at a bar',
  published: {
    date: 123456
  }
}

describe('Database connection', () => {
  let bearerToken

  before(done => {
    app.start(err => {
      help.getBearerToken((err, token) => {
        if (err) return done(err)

        bearerToken = token

        app.stop(done)
      })        
    })
  })

  beforeEach(() => {
    global.___skipTestFromScript = true
  })

  describe('when available at app boot', function () {
    this.timeout(6000)

    let datastore
    let savedDocument

    beforeEach(done => {
      testConnector._mock.setFailedConnection(false)

      app.start(err => {
        if (err) return done(err)

        help.dropDatabase('noauthdb', null, err => {
          if (err) return done(err)

          datastore = app.components['/vtest/noauthdb/articles'].model.connection.datastore

          client
            .post('/vtest/noauthdb/articles')
            .send(mockDocument)
            .set('content-type', 'application/json')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .expect('content-type', 'application/json')
            .end(function (err, res) {
              if (err) return done(err)

              savedDocument = res.body.results[0]

              done()
            })
        })
      })
    })

    afterEach(done => {
      app.stop(done)
    })

    it('should return 200 for GET requests whilst the connection is available', done => {
      client
        .get('/vtest/noauthdb/articles?cache=false')
        .set('content-type', 'application/json')
        .set('Authorization', 'Bearer ' + bearerToken)
        .end((err, res) => {
          if (err) return done(err)

          res.statusCode.should.eql(200)
          res.body.results.length.should.eql(1)
          res.body.results[0].title.should.eql(mockDocument.title)
          datastore._spies.index.calledOnce.should.eql(true)

          datastore._spies.index.callCount.should.be.above(0)

          setTimeout(() => {
            client
              .get('/vtest/noauthdb/articles?cache=false')
              .set('content-type', 'application/json')
              .set('Authorization', 'Bearer ' + bearerToken)
              .end((err, res) => {
                if (err) return done(err)

                res.statusCode.should.eql(200)
                res.body.results.length.should.eql(1)
                res.body.results[0].title.should.eql(mockDocument.title)

                done()
              })
          }, 1000)
        })
    })

    it('should return 503 for GET requests when the database becomes unavailable', done => {
      client
        .get('/vtest/noauthdb/articles?cache=false')
        .set('content-type', 'application/json')
        .set('Authorization', 'Bearer ' + bearerToken)
        .end((err, res) => {
          if (err) return done(err)

          res.statusCode.should.eql(200)
          res.body.results.length.should.eql(1)
          res.body.results[0].title.should.eql(mockDocument.title)
          datastore._spies.index.callCount.should.be.above(0)

          testConnector._mock.disconnect()

          client
            .get('/vtest/noauthdb/articles?cache=false')
            .set('content-type', 'application/json')
            .set('Authorization', 'Bearer ' + bearerToken)
            .end((err, res) => {
              if (err) return done(err)

              res.statusCode.should.eql(503)
              res.body.code.should.eql('API-0004')
              res.body.title.should.eql('Database unavailable')

              done()
            })
        })
    })

    it('should return 200 for PUT requests whilst the connection is available', done => {
      client
        .put('/vtest/noauthdb/articles/' + savedDocument._id + '?cache=false')
        .send({
          title: 'Some other title'
        })
        .set('content-type', 'application/json')
        .set('Authorization', 'Bearer ' + bearerToken)
        .end((err, res) => {
          if (err) return done(err)

          res.statusCode.should.eql(200)
          res.body.results[0].title.should.eql('Some other title')
          datastore._spies.index.calledOnce.should.eql(true)

          setTimeout(() => {
            client
              .put('/vtest/noauthdb/articles/' + savedDocument._id + '?cache=false')
              .send({
                title: 'Yet another title'
              })
              .set('content-type', 'application/json')
              .set('Authorization', 'Bearer ' + bearerToken)
              .end((err, res) => {
                if (err) return done(err)

                res.statusCode.should.eql(200)
                res.body.results[0].title.should.eql('Yet another title')

                done()
              })
          }, 1000)
        })
    })

    it('should return 503 for PUT requests when the database becomes unavailable', done => {
      client
        .put('/vtest/noauthdb/articles/' + savedDocument._id + '?cache=false')
        .send({
          title: 'Some other title'
        })
        .set('content-type', 'application/json')
        .set('Authorization', 'Bearer ' + bearerToken)
        .end((err, res) => {
          if (err) return done(err)

          res.statusCode.should.eql(200)
          res.body.results[0].title.should.eql('Some other title')
          datastore._spies.index.calledOnce.should.eql(true)

          testConnector._mock.disconnect()

          client
            .put('/vtest/noauthdb/articles/59d4b35cb2cf37d706b1d706?cache=false')
            .send({
              title: 'Yet another title'
            })
            .set('content-type', 'application/json')
            .set('Authorization', 'Bearer ' + bearerToken)
            .end((err, res) => {
              if (err) return done(err)

              res.statusCode.should.eql(503)
              res.body.code.should.eql('API-0004')
              res.body.title.should.eql('Database unavailable')

              done()
            })
        })
    })

    it('should return 200 for POST requests whilst the connection is available', done => {
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

          testConnector._mock.disconnect()

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
                res.body.code.should.eql('API-0004')
                res.body.title.should.eql('Database unavailable')

                done()
              })
          }, 1500)
        })
    })

    it('should return 204 for DELETE requests whilst the connection is available', done => {
      client
        .post('/vtest/noauthdb/articles')
        .send(mockDocument)
        .set('content-type', 'application/json')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)

          const savedDocument2 = res.body.results[0]

          client
            .delete('/vtest/noauthdb/articles/' + savedDocument._id + '?cache=false')
            .set('content-type', 'application/json')
            .set('Authorization', 'Bearer ' + bearerToken)
            .end((err, res) => {
              if (err) return done(err)

              res.statusCode.should.eql(204)
              res.body.should.eql('')
              datastore._spies.index.calledOnce.should.eql(true)

              setTimeout(() => {
                client
                  .delete('/vtest/noauthdb/articles/' + savedDocument2._id + '?cache=false')
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
    })

    it('should return 503 for DELETE requests when the database becomes unavailable', done => {
      client
        .delete('/vtest/noauthdb/articles/' + savedDocument._id + '?cache=false')
        .set('content-type', 'application/json')
        .set('Authorization', 'Bearer ' + bearerToken)
        .end((err, res) => {
          if (err) return done(err)

          res.statusCode.should.eql(204)
          res.body.should.eql('')
          datastore._spies.index.callCount.should.be.above(0)

          testConnector._mock.disconnect()

          client
            .delete('/vtest/noauthdb/articles/59d4b35cb2cf37d706b1d706?cache=false')
            .set('content-type', 'application/json')
            .set('Authorization', 'Bearer ' + bearerToken)
            .end((err, res) => {
              if (err) return done(err)

              res.statusCode.should.eql(503)
              res.body.code.should.eql('API-0004')
              res.body.title.should.eql('Database unavailable')

              done()
            })
        })
    })
  })

  describe('when not available at app boot', function () {
    this.timeout(10000)

    let datastore

    beforeEach(done => {
      testConnector._mock.setFailedConnection(true)

      app.start(err => {
        if (err) return done(err)

        datastore = app.components['/vtest/noauthdb/articles'].model.connection.datastore

        done()
      })
    })

    afterEach(done => {
      app.stop(done)
    })

    it('should return 503 for GET requests whilst the connection is unavailable', done => {
      client
        .get('/vtest/noauthdb/articles?cache=false')
        .set('content-type', 'application/json')
        .set('Authorization', 'Bearer ' + bearerToken)
        .end((err, res) => {
          if (err) return done(err)

          datastore._spies.index.called.should.eql(false)

          res.statusCode.should.eql(503)
          res.body.code.should.eql('API-0004')
          res.body.title.should.eql('Database unavailable')

          setTimeout(() => {
            client
              .get('/vtest/noauthdb/articles?cache=false')
              .set('content-type', 'application/json')
              .set('Authorization', 'Bearer ' + bearerToken)
              .end((err, res) => {
                res.statusCode.should.eql(503)
                res.body.code.should.eql('API-0004')
                res.body.title.should.eql('Database unavailable')

                done()
              })
          }, 1000)
        })
    })

    it('should return 200 for GET requests once the database becomes available', done => {
      client
        .get('/vtest/noauthdb/articles?cache=false')
        .set('content-type', 'application/json')
        .set('Authorization', 'Bearer ' + bearerToken)
        .end((err, res) => {
          if (err) return done(err)

          datastore._spies.index.called.should.eql(false)

          res.statusCode.should.eql(503)
          res.body.code.should.eql('API-0004')
          res.body.title.should.eql('Database unavailable')

          testConnector._mock.setFailedConnection(false)

          setTimeout(() => {
            client
              .get('/vtest/noauthdb/articles?cache=false')
              .set('content-type', 'application/json')
              .set('Authorization', 'Bearer ' + bearerToken)
              .end((err, res) => {
                res.statusCode.should.eql(200)
                res.body.results.length.should.eql(0)
                datastore._spies.index.calledOnce.should.eql(true)

                done()
              })
          }, 1000)
        })
    })

    it('should return 503 for PUT requests whilst the connection is unavailable', done => {
      client
        .put('/vtest/noauthdb/articles/5b0d57d04ee2a8387c83439c?cache=false')
        .send({
          title: 'Dadi'
        })
        .set('content-type', 'application/json')
        .set('Authorization', 'Bearer ' + bearerToken)
        .end((err, res) => {
          if (err) return done(err)

          datastore._spies.index.called.should.eql(false)

          res.statusCode.should.eql(503)
          res.body.code.should.eql('API-0004')
          res.body.title.should.eql('Database unavailable')

          setTimeout(() => {
            client
              .put('/vtest/noauthdb/articles/5b0d57d04ee2a8387c83439c?cache=false')
              .send({
                title: 'Dadi'
              })
              .set('content-type', 'application/json')
              .set('Authorization', 'Bearer ' + bearerToken)
              .end((err, res) => {
                res.statusCode.should.eql(503)
                res.body.code.should.eql('API-0004')
                res.body.title.should.eql('Database unavailable')

                done()
              })
          }, 1000)
        })
    })

    it('should return 200 for PUT requests once the database becomes available', done => {
      client
        .put('/vtest/noauthdb/articles/5b0d57d04ee2a8387c83439c?cache=false')
        .send({
          title: 'Dadi'
        })
        .set('content-type', 'application/json')
        .set('Authorization', 'Bearer ' + bearerToken)
        .end((err, res) => {
          if (err) return done(err)

          datastore._spies.index.called.should.eql(false)

          res.statusCode.should.eql(503)
          res.body.code.should.eql('API-0004')
          res.body.title.should.eql('Database unavailable')

          testConnector._mock.setFailedConnection(false)

          setTimeout(() => {
            client
              .post('/vtest/noauthdb/articles?cache=false')
              .send(mockDocument)
              .set('content-type', 'application/json')
              .set('Authorization', 'Bearer ' + bearerToken)
              .end((err, res) => {
                const savedDocument = res.body.results[0]

                client
                  .put('/vtest/noauthdb/articles/' + savedDocument._id + '?cache=false')
                  .send({
                    title: 'A new title'
                  })
                  .set('content-type', 'application/json')
                  .set('Authorization', 'Bearer ' + bearerToken)
                  .end((err, res) => {
                    res.statusCode.should.eql(200)
                    res.body.results[0].title.should.eql('A new title')

                    done()
                  })
              })
          }, 1000)
        })
    })

    it('should return 503 for POST requests whilst the connection is unavailable', done => {
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
                res.body.code.should.eql('API-0004')
                res.body.title.should.eql('Database unavailable')

                done()
              })
          }, 1000)
        })
    })

    it('should return 200 for POST requests once the database becomes available', done => {
      client
        .post('/vtest/noauthdb/articles?cache=false')
        .send({
          published: {
            state: 1
          },
          title: 'A brand new title'
        })
        .set('content-type', 'application/json')
        .set('Authorization', 'Bearer ' + bearerToken)
        .end((err, res) => {
          if (err) return done(err)

          datastore._spies.index.called.should.eql(false)

          res.statusCode.should.eql(503)
          res.body.code.should.eql('API-0004')
          res.body.title.should.eql('Database unavailable')

          testConnector._mock.setFailedConnection(false)

          setTimeout(() => {
            client
              .post('/vtest/noauthdb/articles?cache=false')
              .send({
                published: {
                  state: 1
                },
                title: 'A brand new title'
              })
              .set('content-type', 'application/json')
              .set('Authorization', 'Bearer ' + bearerToken)
              .end((err, res) => {
                res.statusCode.should.eql(200)
                res.body.results[0].title.should.eql('A brand new title')
                res.body.results[0].published.state.should.eql(1)
                datastore._spies.index.callCount.should.be.above(0)

                done()
              })
          }, 1000)
        })
    })

    it('should return 503 for DELETE requests whilst the connection is unavailable', done => {
      client
        .delete('/vtest/noauthdb/articles/5b0d57d04ee2a8387c83439c?cache=false')
        .set('content-type', 'application/json')
        .set('Authorization', 'Bearer ' + bearerToken)
        .end((err, res) => {
          if (err) return done(err)

          datastore._spies.index.called.should.eql(false)

          res.statusCode.should.eql(503)
          res.body.code.should.eql('API-0004')
          res.body.title.should.eql('Database unavailable')

          setTimeout(() => {
            client
              .delete('/vtest/noauthdb/articles/5b0d57d04ee2a8387c83439c?cache=false')
              .set('content-type', 'application/json')
              .set('Authorization', 'Bearer ' + bearerToken)
              .end((err, res) => {
                res.statusCode.should.eql(503)
                res.body.code.should.eql('API-0004')
                res.body.title.should.eql('Database unavailable')

                done()
              })
          }, 1000)
        })
    })

    it('should return 204 for DELETE requests once the database becomes available', done => {
      client
        .delete('/vtest/noauthdb/articles/5b0d57d04ee2a8387c83439c?cache=false')
        .set('content-type', 'application/json')
        .set('Authorization', 'Bearer ' + bearerToken)
        .end((err, res) => {
          if (err) return done(err)

          datastore._spies.index.called.should.eql(false)

          res.statusCode.should.eql(503)
          res.body.code.should.eql('API-0004')
          res.body.title.should.eql('Database unavailable')

          testConnector._mock.setFailedConnection(false)

          setTimeout(() => {
            client
              .post('/vtest/noauthdb/articles?cache=false')
              .send(mockDocument)
              .set('content-type', 'application/json')
              .set('Authorization', 'Bearer ' + bearerToken)
              .end((err, res) => {
                const savedDocument = res.body.results[0]

                client
                  .delete('/vtest/noauthdb/articles/' + savedDocument._id + '?cache=false')
                  .set('content-type', 'application/json')
                  .set('Authorization', 'Bearer ' + bearerToken)
                  .end((err, res) => {
                    res.statusCode.should.eql(204)
                    res.body.should.eql('')
                    datastore._spies.index.calledOnce.should.eql(true)

                    done()
                  })
              })
          }, 1000)
        })
    })
  })
})
