var app = require('./../../dadi/lib/')
var config = require('./../../config')
var fs = require('fs')
var help = require('./help')
var request = require('supertest')
var should = require('should')

// variables scoped for use throughout tests
var bearerToken
var connectionString = 'http://' + config.get('server.host') + ':' + config.get('server.port')

let cleanupFn

describe('Search', function () {
  this.timeout(5000)

  describe('Collections', function () {
    before(function (done) {
      help.dropDatabase('testdb', function (err) {
        if (err) return done(err)

        let schema = {
          "fields": {
            "field1": {
              "type": "String",
              "required": false
            },
            "field2": {
              "type": "Number",
              "required": false
            },
            "field3": {
              "type": "ObjectID",
              "required": false
            }
          },
          "settings": {
            "count": 40,
            "displayName": "Test Collection",
            "description": "Test Collection"
          }
        }

        help.writeTempFile(
          'temp-workspace/collections/vtest/testdb/collection.test-schema.json',
          schema,
          callback => {
            cleanupFn = callback

            app.start(function () {
              help.getBearerTokenWithAccessType('admin', function (err, token) {
                if (err) return done(err)

                bearerToken = token

                done()
              })
            })            
          }
        )          
      })
    })

    after(function (done) {
      app.stop(() => {
        cleanupFn()
        done()
      })
    })

    it('should return docs from specified collections', function (done) {
      // sample URL "/:version/search?collections=collection/model&query={"field1":{"$regex":"est"}}"

      var doc = { field1: 'Test', field2: 1234 }

      help.createDocWithSpecificVersion(bearerToken, 'vtest', doc, function (err, doc) {
        if (err) return done(err)

        var client = request(connectionString)

        client
          .get('/vtest/search?collections=testdb/test-schema,testdb/articles&query={"field1":{"$regex":"est"}}')
          .set('Authorization', 'Bearer ' + bearerToken)
          // .expect(200)
          .expect('content-type', 'application/json')
          .end(function (err, res) {
            if (err) {
              console.log(err)
              return done(err)
            }
            should.exist(res.body['test-schema'].results)
            res.body['test-schema'].results.should.be.Array
            res.body['test-schema'].results.length.should.equal(1)
            res.body['test-schema'].results[0].field1.should.equal('Test')
            done()
          })
      })
    })

    it('should return 404 if method used is not GET', function (done) {
      var doc = { field1: 'Test', field2: 1234 }

      help.createDocWithSpecificVersion(bearerToken, 'vtest', doc, function (err, doc) {
        if (err) return done(err)

        var client = request(connectionString)

        client
          .put('/vtest/search')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(404)
          .end(done)
      })
    })

    it('should return 400 if no collections or query specified', function (done) {
      var doc = { field1: 'Test', field2: 1234 }

      help.createDocWithSpecificVersion(bearerToken, 'vtest', doc, function (err, doc) {
        if (err) return done(err)

        var client = request(connectionString)

        client
          .get('/vtest/search')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(400)
          .expect('content-type', 'application/json')
          .end(done)
      })
    })

    it('should return 400 if no collections specified', function (done) {
      var doc = { field1: 'Test', field2: 1234 }

      help.createDocWithSpecificVersion(bearerToken, 'vtest', doc, function (err, doc) {
        if (err) return done(err)

        var client = request(connectionString)

        client
          .get('/vtest/search?query={"field1":{"$regex":"est"}}')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(400)
          .expect('content-type', 'application/json')
          .end(done)
      })
    })
  })
})
