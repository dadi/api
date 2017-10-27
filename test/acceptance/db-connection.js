const app = require(__dirname + '/../../dadi/lib/')
const config = require(__dirname + '/../../config')
const Connection = require(__dirname + '/../../dadi/lib/model/connection')
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
    { _id: '1', name: 'Father' },
    { _id: '2', name: 'Dad' },
    { _id: '3', name: 'Daddy' }
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
  let currentDatastore = config.get('datastore')

  before(done => {
    const mockConnectorPath = path.resolve(
      __dirname + '/workspace/data-connectors/mock-connector1'
    )

    config.set('datastore', mockConnectorPath)

    done()
  })

  after(done => {
    config.set('datastore', currentDatastore)

    done()
  })

  describe('when available at app boot', () => {
    let bearerToken
    let datastore

    beforeEach(done => {
      mockConnector._mockFailedConnection(false)

      app.start(err => {
        if (err) return done(err)

        setTimeout(() => {
          help.getBearerTokenWithAccessType('admin', (err, token) => {
            if (err) return done(err)

            bearerToken = token

            datastore = app.components['/vtest/testdb/articles/:id([a-fA-F0-9-]*)?'].model.connection.datastore

            done()
          })
        }, 2000)
      })
    })

    afterEach(done => {
      app.stop(() => {
        done()
      })
    })

    it('should return 200 for GET requests whilst the connection is available, and 503 for subsequent requests when the database disconnects', done => {
      datastore._mockSetResponse(mockResults)

      client
        .get('/vtest/testdb/articles?cache=false')
        .set('content-type', 'application/json')
        .set('Authorization', 'Bearer ' + bearerToken)
        .end((err, res) => {
          if (err) return done(err)

          res.statusCode.should.eql(200)
          res.body.should.eql(mockResults)
          datastore._spies.index.calledOnce.should.eql(true)

          datastore._mockDisconnect()

          client
            .get('/vtest/testdb/articles?cache=false')
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

  describe('when not available at app boot', () => {
    let bearerToken
    let datastore

    beforeEach(done => {
      mockConnector._mockFailedConnection(true)

      app.start(err => {
        if (err) return done(err)

        setTimeout(() => {
          help.getBearerTokenWithAccessType('admin', (err, token) => {
            if (err) return done(err)

            bearerToken = token

            datastore = app.components['/vtest/testdb/articles/:id([a-fA-F0-9-]*)?'].model.connection.datastore

            done()
          })
        }, 2000)
      })
    })

    afterEach(done => {
      app.stop(done)
    })

    it('should return 503 for GET requests whilst the connection is unavailable, and 200 for subsequent requests when the database connects', done => {
      datastore._mockSetResponse(mockResults)

      client
        .get('/vtest/testdb/articles?cache=false')
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
              .get('/vtest/testdb/articles?cache=false')
              .set('content-type', 'application/json')
              .set('Authorization', 'Bearer ' + bearerToken)
              .end((err, res) => {
                res.statusCode.should.eql(200)
                res.body.should.eql(mockResults)
                datastore._spies.index.calledOnce.should.eql(true)

                done()
              })
          }, 5000)
        })
    }).timeout(10000)
  })
})
