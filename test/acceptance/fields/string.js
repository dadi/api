const should = require('should')
const sinon = require('sinon')
const fs = require('fs')
const path = require('path')
const request = require('supertest')
const config = require(__dirname + '/../../../config')
const help = require(__dirname + '/../help')
const app = require(__dirname + '/../../../dadi/lib/')
const Model = require('./../../../dadi/lib/model')

let bearerToken
const configBackup = config.get()
const connectionString =
  'http://' + config.get('server.host') + ':' + config.get('server.port')

describe('String Field', () => {
  beforeEach(done => {
    config.set(
      'paths.collections',
      'test/acceptance/temp-workspace/collections'
    )

    help.dropDatabase('library', 'misc', err => {
      app.start(() => {
        help.getBearerToken(function(err, token) {
          if (err) return done(err)
          bearerToken = token
          done()
        })
      })
    })
  })

  afterEach(done => {
    config.set('paths.collections', configBackup.paths.collections)
    app.stop(done)
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
