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

    store.set('test123', {id: '123'}, function (err) {
      if (err) return done(err)

      store.get('test123', function (err, val) {
        if (err) return done(err)

        val.value.id.should.equal('123')
        val.token.should.equal('test123')
        done()
      })
    })
  })

  it("should return empty object when token isn't found", function (done) {
    var store = tokenStore()

    store.get('XXX', function (err, val) {
      if (err) return done(err);(val === null).should.eql(true)
      done()
    })
  })

  it.skip('should use specified database when creating a connection', function (done) {
    var dbConfig = {
      'hosts': [
        {
          'host': '127.0.0.1',
          'port': 27017
        }
      ],
      'username': '',
      'password': '',
      'database': 'test',
      'ssl': false,
      'replicaSet': '',
      'enableCollectionDatabases': false,
      'secondary': {
        'hosts': [
          {
            'host': '127.0.0.1',
            'port': 27017
          }
        ],
        'username': '',
        'password': '',
        'replicaSet': '',
        'ssl': false
      }
    }

    var auth = {
      'tokenUrl': '/token',
      'tokenTtl': 1800,
      'database': {
        'hosts': [
          {
            'host': '127.0.0.1',
            'port': 27017
          }
        ],
        'username': '',
        'password': '',
        'database': 'separate_auth_db'
      },
      'clientCollection': 'clientStore',
      'tokenCollection': 'tokenStore'
    }

    var oldConfig = config.get('auth')
    config.set('auth', auth)

    var store = tokenStore()

    should.exist(store.connection)
    store.connection.connectionOptions.database.should.equal('separate_auth_db')

    config.set('auth', oldConfig)
    done()
  })

  describe('get method', function () {
    it('should be a function', function (done) {
      var store = tokenStore()

      store.get.should.be.Function
      done()
    })

    it('should take token as first arg and callback as second', function (done) {
      var store = tokenStore()
      store.get('1234567890abcdefghi', function (err, val) {
        done(err)
      })
    })
  })

  describe('set method', function () {
    it('should be a function', function (done) {
      var store = tokenStore()

      store.set.should.be.Function
      done()
    })

    it('should take token as first arg, value as second, and callback as third', function (done) {
      var store = tokenStore()
      store.set('1234567890abcdefghi', {id: '123', secret: 'asdfghjkl'}, function (err) {
        done(err)
      })
    })
  })
})
