const app = require(__dirname + '/../../dadi/lib/')
const config = require(__dirname + '/../../config')
const fs = require('fs')
const help = require(__dirname + '/help')
const model = require(__dirname + '/../../dadi/lib/model/')
const should = require('should')
const sinon = require('sinon')
const path = require('path')
const request = require('supertest')

// variables scoped for use throughout tests
let bearerToken
let connectionString = 'http://' + config.get('server.host') + ':' + config.get('server.port')
let lastModifiedAt = 0

describe('Search', function () {
  this.timeout(4000)

  let cleanupFn

  before(function (done) {
    help.dropDatabase('testdb', function (err) {
      if (err) return done(err)

      config.set('search', {
        'enabled': true,
        'minQueryLength': 3,
        'wordCollection': 'words',
        'datastore': './../../../test/test-connector',
        'database': 'testdb'
      })

      app.start(function () {
        help.getBearerTokenWithAccessType('admin', function (err, token) {
          if (err) return done(err)

          bearerToken = token

          let schema = {
            'fields': {
              'field1': {
                'type': 'String',
                'required': false
              },
              'title': {
                'type': 'String',
                'required': false,
                'search': {
                  'weight': 2
                }
              },
              'field2': {
                'type': 'Number',
                'required': false
              },
              'field3': {
                'type': 'ObjectID',
                'required': false
              },
              '_fieldWithUnderscore': {
                'type': 'Object',
                'required': false
              }
            },
            'settings': {
              'count': 40
            }
          }

          help.writeTempFile(
            'temp-workspace/collections/vtest/testdb/collection.test-schema.json',
            schema,
            callback1 => {
              help.writeTempFile(
                'temp-workspace/collections/v1/testdb/collection.test-schema.json',
                schema,
                callback2 => {
                  cleanupFn = () => {
                    callback1()
                    callback2()
                  }

                  done()
                }
              )
            }
          )
        })
      })
    })
  })

  after(function (done) {
    config.set('search', {
      'enabled': false
    })

    app.stop(() => {
      cleanupFn()
      done()
    })
  })

  describe('Disabled', function () {
    it('should return 501 when calling a /search endpoint', function (done) {
      config.set('search.enabled', false)

      var client = request(connectionString)
      client
      .get('/vtest/testdb/test-schema/search')
      .set('Authorization', 'Bearer ' + bearerToken)
      .expect(501)
      .end((err, res) => {
        config.set('search.enabled', true)
        done()
      })
    })
  })

  describe('Enabled', function () {
    it('should return 400 when calling a /search endpoint with no query', function (done) {
      let searchModel = model('test-schema')
      searchModel.searchHandler.init()

      var client = request(connectionString)
      client
      .get('/vtest/testdb/test-schema/search')
      .set('Authorization', 'Bearer ' + bearerToken)
      .expect(400)
      .end(done)
    })

    it('should return 400 when calling a /search endpoint with a short query', function (done) {
      let searchModel = model('test-schema')
      searchModel.searchHandler.init()

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
      let searchModel = model('test-schema')
      searchModel.searchHandler.init()

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
      let searchModel = model('test-schema')
      searchModel.searchHandler.init()

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

    it('should return metadata containing the search term', function (done) {
      let searchModel = model('test-schema')
      searchModel.searchHandler.init()

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
          should.exist(res.body.metadata)
          should.exist(res.body.metadata.search)
          res.body.metadata.search.should.eql('quick brown')

          done()
        })
      })
    })
  })
})
