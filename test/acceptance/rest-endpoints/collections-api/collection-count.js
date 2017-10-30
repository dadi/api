const should = require('should')
const sinon = require('sinon')
const fs = require('fs')
const path = require('path')
const request = require('supertest')
const config = require(__dirname + '/../../../../config')
const help = require(__dirname + '/../../help')
const app = require(__dirname + '/../../../../dadi/lib/')

// variables scoped for use throughout tests
const connectionString = 'http://' + config.get('server.host') + ':' + config.get('server.port')
let bearerToken
let lastModifiedAt = 0

describe('Collections API – Count endpoint', function () {
  this.timeout(4000)

  before(done => {
    app.start(() => {
      help.dropDatabase('testdb', function (err) {
        if (err) return done(err)

        help.getBearerToken(function (err, token) {
          if (err) return done(err)
          bearerToken = token

          var client = request(connectionString)
          client
          .post('/vtest/testdb/test-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({field1: 'doc1'})
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err)

            client
            .post('/vtest/testdb/test-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({field1: 'doc2'})
            .expect(200)
            .end(function (err, res) {
              if (err) return done(err)

              done()
            })
          })
        })
      })
    })
  })

  after(done => {
    app.stop(done)
  })

  it('should return metadata about the collection', function (done) {
    var client = request(connectionString)
    client
    .get('/vtest/testdb/test-schema/count')
    .set('Authorization', 'Bearer ' + bearerToken)
    .end(function (err, res) {
      if (err) return done(err)
      var response = res.body
      response.metadata.should.exist
      response.metadata.totalCount.should.eql(2)
      done()
    })
  })

  it('should return metadata about the collection when using a filter', function (done) {
    var client = request(connectionString)
    client
    .get('/vtest/testdb/test-schema/count?filter={"field1":"doc2"}')
    .set('Authorization', 'Bearer ' + bearerToken)
    .end(function (err, res) {
      if (err) return done(err)
      var response = res.body
      response.metadata.should.exist
      response.metadata.totalCount.should.eql(1)
      done()
    })
  })
})