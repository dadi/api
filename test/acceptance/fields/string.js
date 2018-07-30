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
let configBackup = config.get()
let connectionString = 'http://' + config.get('server.host') + ':' + config.get('server.port')

describe('String Field', () => {
  beforeEach(done => {
    config.set('paths.collections', 'test/acceptance/temp-workspace/collections')

    help.dropDatabase('library', 'misc', err => {
      app.start(() => {
        help.getBearerToken(function (err, token) {
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
    it('should transform string to regex when at root', done => {
      let client = request(connectionString)
      let value = 'Hello world'

      client
      .post('/v1/library/misc')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send({string: value})
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        let model = Model('misc')
        let spy = sinon.spy(model.connection.db, 'find')

        client
        .get(`/v1/library/misc?filter={"string":"${value}"}`)
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .end((err, res) => {
          spy.getCall(0).args[0].query.string.should.eql({
            $regex: [`^${value}$`, 'i']
          })

          spy.restore()

          done()
        })
      })
    })

    it('should not transform string to regex when nested inside operator', done => {
      let client = request(connectionString)
      let value = 'Hello world'

      client
      .post('/v1/library/misc')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send({string: value})
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        let model = Model('misc')
        let spy = sinon.spy(model.connection.db, 'find')

        client
        .get(`/v1/library/misc?filter={"string":{"$ne":"${value}"}}`)
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .end((err, res) => {
          spy.getCall(0).args[0].query.string.should.eql({
            $ne: value
          })

          spy.restore()

          done()
        })
      })
    })
  })
})
