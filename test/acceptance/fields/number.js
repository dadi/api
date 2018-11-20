const should = require('should')
const sinon = require('sinon')
const request = require('supertest')
const config = require(__dirname + '/../../../config')
const help = require(__dirname + '/../help')
const app = require(__dirname + '/../../../dadi/lib/')
const Model = require('./../../../dadi/lib/model')

let bearerToken
let configBackup = config.get()
let connectionString = 'http://' + config.get('server.host') + ':' + config.get('server.port')

describe('Number Field', () => {
  beforeEach(done => {
    config.set('paths.collections', 'test/acceptance/temp-workspace/collections')

    help.dropDatabase('library', 'misc', _err => {
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
    it('should treat a supplied number as a number', done => {
      let client = request(connectionString)
      let value = 5000

      client
      .post('/v1/library/misc')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send({number: value})
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        let model = Model('misc')
        let spy = sinon.spy(model.connection.db, 'find')

        let query = JSON.stringify({
          'number': {
            '$gt': value
          }
        })

        client
        .get(`/v1/library/misc?filter=${query}`)
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .end((err, res) => {        
          let query = spy.getCall(0).args[0].query.number
          query[Object.keys(query)[0]].should.eql(5000)

          spy.restore()

          done()
        })
      })
    })
  })
})
