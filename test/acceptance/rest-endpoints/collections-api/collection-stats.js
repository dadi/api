const should = require('should')
const sinon = require('sinon')
const fs = require('fs')
const path = require('path')
const request = require('supertest')
const _ = require('underscore')
const config = require(__dirname + '/../../../../config')
const help = require(__dirname + '/../../help')
const app = require(__dirname + '/../../../../dadi/lib/')

// variables scoped for use throughout tests
const connectionString = 'http://' + config.get('server.host') + ':' + config.get('server.port')
let bearerToken
let lastModifiedAt = 0

describe('Collections API – Stats endpoint', function () {
  this.timeout(4000)

  var cleanup = function (done) {
    // try to cleanup these tests directory tree
    // don't catch errors here, since the paths may not exist

    var dirs = config.get('paths')

    try {
      fs.unlinkSync(dirs.collections + '/v1/testdb/collection.test-schema.json')
    } catch (e) {}

    try {
      fs.rmdirSync(dirs.collections + '/v1/testdb')
    } catch (e) {}

    done()
  }

  before(function (done) {
    app.start(() => {
      help.dropDatabase('testdb', function (err) {
        if (err) return done(err)

        help.getBearerTokenWithAccessType('admin', function (err, token) {
          if (err) return done(err)

          bearerToken = token

          // add a new field to the schema
          var jsSchemaString = fs.readFileSync(__dirname + '/../../../new-schema.json', {encoding: 'utf8'})
          jsSchemaString = jsSchemaString.replace('newField', 'field1')
          var schema = JSON.parse(jsSchemaString)

          schema.fields.field2 = _.extend({}, schema.fields.newField, { type: 'Number', required: false })

          var client = request(connectionString)

          client
            .post('/vtest/testdb/test-schema/config')
            .send(JSON.stringify(schema, null, 4))
            .set('content-type', 'text/plain')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .expect('content-type', 'application/json')
            .end(function (err, res) {
              if (err) return done(err)
              done()
            })
        })
      })
    })
  })

  after(function (done) {
    // reset the schema
    var jsSchemaString = fs.readFileSync(__dirname + '/../../../new-schema.json', {encoding: 'utf8'})
    jsSchemaString = jsSchemaString.replace('newField', 'field1')
    var schema = JSON.parse(jsSchemaString)

    var client = request(connectionString)

    client
      .post('/vtest/testdb/test-schema/config')
      .send(JSON.stringify(schema, null, 4))
      .set('content-type', 'text/plain')
      .set('Authorization', 'Bearer ' + bearerToken)
      .expect(200)
      .expect('content-type', 'application/json')
      .end(function (err, res) {
        if (err) return done(err)

        app.stop(() => {
          cleanup(done)
        })
      })
  })

  it('should respond to a stats method', function (done) {
    help.createDoc(bearerToken, function (err, doc) {
      if (err) return done(err)

      var client = request(connectionString)

      client
        .get('/vtest/testdb/test-schema/stats')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        // .expect('content-type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)
          done()
        })
    })
  })

  it('should return correct count from stats method', function (done) {
    help.createDoc(bearerToken, function (err, doc) {
      if (err) return done(err)

      var client = request(connectionString)

      client
        .get('/vtest/testdb/test-schema/stats')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)

          res.body.should.exist
          res.body.count.should.exist

          done()
        })
    })
  })

  it('should return 404 if not a GET request', function (done) {
    help.createDoc(bearerToken, function (err, doc) {
      if (err) return done(err)

      var client = request(connectionString)

      client
        .post('/vtest/testdb/test-schema/stats')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send({})
        .expect(404)
        .end(function (err, res) {
          if (err) return done(err)

          done()
        })
    })
  })
})
