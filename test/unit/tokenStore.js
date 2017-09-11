var sinon = require('sinon')
var should = require('should')
var request = require('supertest')
var config = require(__dirname + '/../../config')
var Connection = require(__dirname + '/../../dadi/lib/model/connection')
var tokens = require(__dirname + '/../../dadi/lib/auth/tokens')
var tokenStore = require(__dirname + '/../../dadi/lib/auth/tokenStore')
var clientCollectionName = config.get('auth.clientCollection')

describe('Token Store', function () {
  before(function (done) {
    var dbOptions = { auth: true, database: config.get('auth.database'), collection: clientCollectionName }
    var conn = Connection(dbOptions, null, config.get('auth.datastore'))

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

  it('should export function that returns an instance', function (done) {
    var store = tokenStore()
    store.should.be.an.instanceOf(tokenStore.TokenStore)
    done()
  })

  it('should export a constructor', function (done) {
    tokenStore.TokenStore.should.be.Function
    done()
  })

  it('should be able to get and set values and tokens', function (done) {
    var store = tokenStore()

    store.set('test123', {id: '123'}).then(doc => {
      doc.value.id.should.equal('123')
      doc.token.should.equal('test123')

      done()
    }).catch(err => done(err))
  })

  it("should return empty object when token isn't found", function (done) {
    var store = tokenStore()

    store.get('XXX').then(doc => {
      (doc === null).should.eql(true)

      done()
    }).catch(err => done(err))
  })

  it('should use specified database when creating a connection', function (done) {
    this.timeout(30000)

    var auth = {
      database: 'separate_auth_db',
      clientCollection: 'clientStore',
      tokenCollection: 'tokenStore',
      datastore: '@dadi/api-mongodb'
    }
    var TokenStore = tokenStore.TokenStore

    sinon.stub(config, 'get')
      .withArgs('auth.database').returns(auth.database)
      .withArgs('auth.datastore').returns(auth.datastore)
      .withArgs('auth.clientCollection').returns(auth.clientCollection)
      .withArgs('auth.tokenCollection').returns(auth.tokenCollection)

    var connectCopy = Connection.Connection.prototype.connect

    Connection.Connection.prototype.connect = function (details) {
      Connection.Connection.prototype.connect = connectCopy
      config.get.restore()

      details.database.should.eql(auth.database)
      details.collection.should.eql(auth.tokenCollection)

      done()
    }

    var store = new TokenStore()
    
    store.connect()
  })

  describe('get method', function () {
    it('should be a function', function (done) {
      var store = tokenStore()

      store.get.should.be.Function
      done()
    })

    it('should take token as arg and return Promise', function (done) {
      var store = tokenStore()
      store.get('1234567890abcdefghi').then(doc => {
        done()
      }).catch(err => done(err))
    })
  })

  describe('set method', function () {
    it('should be a function', function (done) {
      var store = tokenStore()

      store.set.should.be.Function
      done()
    })

    it('should take token as first arg and value as second, returning a Promise', function (done) {
      var store = tokenStore()
      store.set('1234567890abcdefghi', {id: '123', secret: 'asdfghjkl'}).then(doc => {
        done()
      }).catch(err => done(err))
    })
  })
})
