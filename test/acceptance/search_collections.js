var should = require('should')
var fs = require('fs')
var path = require('path')
var request = require('supertest')
var _ = require('underscore')
var config = require(__dirname + '/../../config')
var help = require(__dirname + '/help')
var app = require(__dirname + '/../../dadi/lib/')

// variables scoped for use throughout tests
var bearerToken
var connectionString = 'http://' + config.get('server.host') + ':' + config.get('server.port')

describe.skip('Search', function () {
  this.timeout(5000)

  describe('Collections', function () {
    beforeEach(function (done) {
      help.dropDatabase('testdb', function (err) {
        if (err) return done(err)

        app.start(function () {
          help.getBearerTokenWithAccessType('admin', function (err, token) {
            if (err) return done(err)

            bearerToken = token

              // add a new field to the schema
            var jsSchemaString = fs.readFileSync(__dirname + '/../new-schema.json', {encoding: 'utf8'})
            jsSchemaString = jsSchemaString.replace('newField', 'field1')
            var schema = JSON.parse(jsSchemaString)

            schema.fields.field2 = _.extend({}, schema.fields.newField, {
              type: 'Number',
              required: true,
              message: 'Provide a value here, please!'
            })

            schema.fields.field3 = _.extend({}, schema.fields.newField, {
              type: 'ObjectID',
              required: false
            })

            schema.settings.displayName = 'Test Collection'
            schema.settings.description = 'Test Collection'

            var client = request(connectionString)

            client
              .post('/vtest/testdb/test-schema/config')
              .send(JSON.stringify(schema, null, 2))
              .set('content-type', 'text/plain')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .expect('content-type', 'application/json')
              .end(function (err, res) {
                if (err) return done(err)

                setTimeout(function() {
                  done()
                }, 1000)
              })
          })
        })
      })
    })

    after(function (done) {
        // reset the schema
      var jsSchemaString = fs.readFileSync(__dirname + '/../new-schema.json', {encoding: 'utf8'})
      jsSchemaString = jsSchemaString.replace('newField', 'field1')
      var schema = JSON.parse(jsSchemaString)

      var client = request(connectionString)

      client
        .post('/vtest/testdb/test-schema/config')
        .send(JSON.stringify(schema, null, 2))
        .set('content-type', 'text/plain')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)

          app.stop(done)
        })
    })

    it('should return docs from specified collections', function (done) {
      // sample URL "/:version/search?collections=collection/model&query={"field1":{"$regex":"est"}}"

      var doc = { field1: 'Test', field2: 1234 }

      help.createDocWithSpecificVersion(bearerToken, 'vtest', doc, function (err, doc) {
        if (err) return done(err)

        var client = request(connectionString)

        client
          .get('/vtest/search?collections=testdb/test-schema&query={"field1":{"$regex":"est"}}')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .expect('content-type', 'application/json')
          .end(function (err, res) {
            if (err) return done(err)
            should.exist(res.body['test-schema'].results)
            res.body['test-schema'].results.should.be.Array
            res.body['test-schema'].results.length.should.equal(1)
            res.body['test-schema'].results[0].field1.should.equal('Test')
            done()
          })
      })
    })
  })
})
