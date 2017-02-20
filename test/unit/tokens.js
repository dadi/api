var should = require('should')
var sinon = require('sinon')
var request = require('supertest')
var uuid = require('uuid')
var config = require(__dirname + '/../../config')
var Connection = require(__dirname + '/../../dadi/lib/model/connection')
var tokens = require(__dirname + '/../../dadi/lib/auth/tokens')
var tokenStore = require(__dirname + '/../../dadi/lib/auth/tokenStore')
var acceptanceTestHelper = require(__dirname + '/../acceptance/help')

var clientCollectionName = config.get('auth.clientCollection')

describe('Tokens', function () {
  before(function (done) {
    var dbOptions = { auth: true, database: config.get('auth.database'), collection: clientCollectionName }
    var conn = Connection(dbOptions, config.get('auth.datastore'))

    setTimeout(function () {
      if (conn.datastore.dropDatabase) {
        conn.datastore.dropDatabase().then(() => {
          done()
        }).catch((err) => {
          console.log(err)
          done(err)
        })
      } else {
        done()
      }
    }, 500)
  })

  after(function (done) {
    // acceptanceTestHelper.removeTestClients(done);
    done()
  })

  it('should export generate function', function (done) {
    tokens.generate.should.be.Function
    done()
  })

  it('should export validate function', function (done) {
    tokens.validate.should.be.Function
    done()
  })

  it('should export a tokenStore', function (done) {
    tokens.store.should.be.instanceOf(tokenStore.Store)
    done()
  })

  describe('generate', function () {
    before(function (done) {
      var dbOptions = { auth: true, database: config.get('auth.database'), collection: clientCollectionName }
      var conn = Connection(dbOptions, config.get('auth.datastore'))

      setTimeout(function () {
        conn.datastore.insert({
          clientId: 'test123',
          secret: 'superSecret'
        }, clientCollectionName).then(() => {
          done()}
        )
      }, 500)
    })

    it('should check the generated token doesn\'t already exist before returning token', function (done) {
        // set new tokens
      tokens.store.set('test123', {id: 'test123'}, function (err) {
        if (err) return done(err)
      })

      tokens.store.set('731a3bac-7872-481c-9069-fa223b318f6d', {id: 'test123'}, function (err) {
        if (err) return done(err)
      })

      var uuidStub = sinon.stub(uuid, 'v4')
      uuidStub.onCall(0).returns('test123') // make v4 return an existing token
      uuidStub.onCall(1).returns('731a3bac-7872-481c-9069-fa223b318f6d') // make v4 return a diff token
      uuidStub.returns('731a3bac-7872-481c-9069-fa223b318f6e') // make v4 return a diff token

      var req = { body: { clientId: 'test123', secret: 'superSecret' } }

      var res = {
        setHeader: function () {},
        end: function (data) {
          data = JSON.parse(data)

          should.exist(data.accessToken)
          uuid.v4.restore()
          uuidStub.callCount.should.eql(3)
          done()
        }
      }

      tokens.generate(req, res)
    })
  })

  describe('validate', function () {
    before(function (done) {
      var dbOptions = { auth: true, database: config.get('auth.database'), collection: clientCollectionName }
      var conn = Connection(dbOptions, config.get('auth.datastore'))

      setTimeout(function () {
        conn.datastore.insert({
          clientId: 'test123',
          secret: 'superSecret'
        }, clientCollectionName).then(() => {
          done()}
        )
      }, 500)
    })

    it('should return object for valid token', function (done) {
      var req = {
        body: {
          clientId: 'test123',
          secret: 'superSecret'
        }
      }

      var res = {
        setHeader: function () {},
        end: function (data) {
          data = JSON.parse(data)

          should.exist(data.accessToken)
          data.tokenType.should.equal('Bearer')
          done()
        }
      }

      tokens.generate(req, res)
    })
  })
})
