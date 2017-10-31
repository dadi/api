var _ = require('underscore')
var should = require('should')
var sinon = require('sinon')
var fs = require('fs')
var path = require('path')
var request = require('supertest')
var EventEmitter = require('events').EventEmitter
var connection = require(__dirname + '/../../dadi/lib/model/connection')
var config = require(__dirname + '/../../config')
var help = require(__dirname + '/help')
var app = require(__dirname + '/../../dadi/lib/')

// variables scoped for use throughout tests
var bearerToken
var connectionString = 'http://' + config.get('server.host') + ':' + config.get('server.port')
var lastModifiedAt = 0

describe('Search', function () {
  this.timeout(4000)

  before(function (done) {
    app.start(() => {
      help.dropDatabase('testdb', function (err) {
        if (err) return done(err)

        help.getBearerTokenWithAccessType('admin', function (err, token) {
          if (err) return done(err)

          bearerToken = token

          // add a searchable field to the schema
          var jsSchemaString = fs.readFileSync(__dirname + '/../new-schema.json', {encoding: 'utf8'})
          jsSchemaString = jsSchemaString.replace('newField', 'field1')
          var schema = JSON.parse(jsSchemaString)

          schema.fields.title = _.extend({}, schema.fields.newField, {
            type: 'String',
            required: false,
            search: {
              weight: 2
            }
          })

          var client = request(connectionString)

          client
            .post('/vtest/testdb/test-schema/config')
            .send(JSON.stringify(schema, null, 2))
            .set('content-type', 'text/plain')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              if (err) return done(err)

              // let's wait a bit
              setTimeout(function () {
                done()
              }, 500)
            })
        })
      })
    })
  })

  after(function (done) {
    config.set('search', {
      "enabled": false
    })

    var cleanup = function (done) {
      // try {
      //   fs.unlinkSync(config.get('paths').collections + '/vtest/testdb/collection.test-schema.json')
      // } catch (e) {}

      done()
    }

    help.removeTestClients(() => {
      app.stop(() => {
        setTimeout(() => {
          cleanup(done)
        }, 500)
      })
    })
  })

  describe('Disabled', function () {
    it('should return 501 when calling a /search endpoint', function (done) {
      config.set('search', {
        "enabled": false,
        "minQueryLength": 3,
        "datastore": "@dadi/api-mongodb",
        "database": "search"
      })

      var client = request(connectionString)
      client
      .get('/vtest/testdb/test-schema/search')
      .set('Authorization', 'Bearer ' + bearerToken)
      .expect(501)
      .end(done)
    })
  })

  describe('Enabled', function () {
    it('should return 400 when calling a /search endpoint with no query', function (done) {
      config.set('search', {
        "enabled": true,
        "minQueryLength": 3,
        "datastore": "@dadi/api-mongodb",
        "database": "search"
      })

      var client = request(connectionString)
      client
      .get('/vtest/testdb/test-schema/search')
      .set('Authorization', 'Bearer ' + bearerToken)
      .expect(400)
      .end(done)
    })

    it('should return 400 when calling a /search endpoint with a short query', function (done) {
      config.set('search', {
        "enabled": true,
        "minQueryLength": 3,
        "datastore": "@dadi/api-mongodb",
        "database": "search"
      })

      var client = request(connectionString)
      client
      .get('/vtest/testdb/test-schema/search?q=xx')
      .set('Authorization', 'Bearer ' + bearerToken)
      .expect(400)
      .end((err, res) => {
        if (err) return done(err)
        done()
      })
    })

    it('should return empty results when no documents match a query', function (done) {
      var client = request(connectionString)
      client
      .get('/vtest/testdb/test-schema/search?q=xxx')
      .set('Authorization', 'Bearer ' + bearerToken)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)
        should.exist(res.body.results)
        res.body.results.should.be.Array
        res.body.results.length.should.eql(0)
        done()
      })
    })

    it('should return results when documents match a query', function (done) {
      var client = request(connectionString)

      var doc = {
        field1: 'The quick brown fox jumps',
        title: 'The quick brown fox jumps over the lazy dog'
      }

      client
      .post('/vtest/testdb/test-schema')
      .set('Authorization', 'Bearer ' + bearerToken)
      .set('content-type', 'application/json')
      .send(doc)
      .expect(200)
      .end((err, res) => {

        client
        .get('/vtest/testdb/test-schema/search?q=quick%20brown')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          should.exist(res.body.results)
          res.body.results.should.be.Array
          res.body.results.length.should.eql(1)
          done()
        })
      })
    })
  })
})
