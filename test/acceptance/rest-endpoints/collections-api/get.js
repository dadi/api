const should = require('should')
const sinon = require('sinon')
const fs = require('fs')
const path = require('path')
const request = require('supertest')
const _ = require('underscore')
const EventEmitter = require('events').EventEmitter
const config = require(__dirname + '/../../../../config')
const help = require(__dirname + '/../../help')
const app = require(__dirname + '/../../../../dadi/lib/')

// variables scoped for use throughout tests
const connectionString = 'http://' + config.get('server.host') + ':' + config.get('server.port')
let bearerToken
let lastModifiedAt = 0

describe('Collections API – GET', function () {
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

    setTimeout(done, 300)
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

          schema.fields.field2 = _.extend({}, schema.fields.newField, {
            type: 'Number',
            required: false
          })

          schema.fields.field3 = _.extend({}, schema.fields.newField, {
            type: 'ObjectID',
            required: false
          })

          // testing here
          schema.fields._fieldWithUnderscore = _.extend({}, schema.fields.newField, {
            type: 'Object',
            required: false
          })

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

            // Waiting for the new schema to be written to disk.
            setTimeout(done, 1000)
          })
        })
      })
    })
  })

  beforeEach(done => {
    cleanup(done)
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

  it('should get documents', function (done) {
    help.createDoc(bearerToken, function (err, doc) {
      if (err) return done(err)

      var client = request(connectionString)

      client
        .get('/vtest/testdb/test-schema?cache=false')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)

          res.body['results'].should.exist
          res.body['results'].should.be.Array
          res.body['results'].length.should.be.above(0)
          done()
        })
    })
  })

  it('should get documents with the internal fields prefixed with the character defined in config', function (done) {
    var originalPrefix = config.get('internalFieldsPrefix')

    help.createDoc(bearerToken, function (err, doc) {
      if (err) return done(err)

      config.set('internalFieldsPrefix', '$')

      var client = request(connectionString)

      client
        .get('/vtest/testdb/test-schema/' + doc._id)
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)

          res.body.results[0].$id.should.exist
          should.not.exist(res.body.results[0]._id)
          res.body.results[0].$id.should.eql(doc._id)

          config.set('internalFieldsPrefix', originalPrefix)

          done()
        })
    })
  })

  it('should use apiVersion when getting reference documents if useVersionFilter is set to true', function (done) {
    config.set('query.useVersionFilter', true)

    var bookSchema = {
      fields: {
        'title': { 'type': 'String', 'required': true },
        'author': { 'type': 'Reference',
          'settings': { 'collection': 'person', 'fields': ['name', 'spouse'] }
        },
        'booksInSeries': {
          'type': 'Reference',
          'settings': { 'collection': 'book', 'multiple': true }
        }
      },
      settings: {
        cache: false,
        authenticate: true,
        count: 40
      }
    }

    var personSchema = {
      fields: {
        'name': { 'type': 'String', 'required': true },
        'occupation': { 'type': 'String', 'required': false },
        'nationality': { 'type': 'String', 'required': false },
        'education': { 'type': 'String', 'required': false },
        'spouse': { 'type': 'Reference' }
      },
      settings: {
        cache: false,
        authenticate: true,
        count: 40
      }
    }

    // create new API endpoint
    var client = request(connectionString)

    client
    .post('/1.0/library/book/config')
    .send(JSON.stringify(bookSchema))
    .set('content-type', 'text/plain')
    .set('Authorization', 'Bearer ' + bearerToken)
    .expect(200)
    .expect('content-type', 'application/json')
    .end((err, res) => {
      if (err) return done(err)

      client
      .post('/1.0/library/person/config')
      .send(JSON.stringify(personSchema))
      .set('content-type', 'text/plain')
      .set('Authorization', 'Bearer ' + bearerToken)
      .expect(200)
      .expect('content-type', 'application/json')
      .end((err, res) => {
        if (err) return done(err)

        // create some docs
        client
        .post('/1.0/library/person')
        .send({name: 'Neil Murray'})
        .set('content-type', 'application/json')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .end((err, res) => {
          var id = res.body.results[0]._id

          client
          .post('/1.0/library/person')
          .send({name: 'J K Rowling', spouse: id})
          .set('content-type', 'application/json')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end((err, res) => {
            id = res.body.results[0]._id

            client
            .post('/1.0/library/book')
            .send({title: 'Harry Potter 1', author: id})
            .set('content-type', 'application/json')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end((err, res) => {
              var bookid = res.body.results[0]._id
              var books = []
              books.push(bookid)

              client
              .post('/1.0/library/book')
              .send({title: 'Harry Potter 2', author: id, booksInSeries: books})
              .set('content-type', 'application/json')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .end((err, res) => {
                // find a book

                var Model = require(__dirname + '/../../../../dadi/lib/model/index.js')
                var spy = sinon.spy(Model.Model.prototype, 'find')

                client
                .get('/1.0/library/book?filter={ "title": "Harry Potter 2" }')
                .send({title: 'Harry Potter 2', author: id, booksInSeries: books})
                .set('content-type', 'application/json')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .end((err, res) => {
                  var args = spy.args
                  spy.restore()
                  config.set('query.useVersionFilter', false)

                  // apiVersion should be in the query passed to find
                  args.forEach((arg) => {
                    should.exist(arg[0].query._apiVersion)
                  })

                  var results = res.body.results
                  results.should.be.Array
                  results.length.should.eql(1)

                  done()
                })
              })
            })
          })
        })
      })
    })
  })

  it('should not use apiVersion when getting reference documents if useVersionFilter is set to false', function (done) {
    config.set('query.useVersionFilter', false)

    var bookSchema = {
      fields: {
        'title': { 'type': 'String', 'required': true },
        'author': { 'type': 'Reference',
          'settings': { 'collection': 'person', 'fields': ['name', 'spouse'] }
        },
        'booksInSeries': {
          'type': 'Reference',
          'settings': { 'collection': 'book', 'multiple': true }
        }
      },
      settings: {
        cache: false,
        authenticate: true,
        count: 40
      }
    }

    var personSchema = {
      fields: {
        'name': { 'type': 'String', 'required': true },
        'occupation': { 'type': 'String', 'required': false },
        'nationality': { 'type': 'String', 'required': false },
        'education': { 'type': 'String', 'required': false },
        'spouse': { 'type': 'Reference' }
      },
      settings: {
        cache: false,
        authenticate: true,
        count: 40
      }
    }

    // create new API endpoint
    var client = request(connectionString)

    client
    .post('/1.0/library/book/config')
    .send(JSON.stringify(bookSchema))
    .set('content-type', 'text/plain')
    .set('Authorization', 'Bearer ' + bearerToken)
    .expect(200)
    .expect('content-type', 'application/json')
    .end((err, res) => {
      if (err) return done(err)

      client
      .post('/1.0/library/person/config')
      .send(JSON.stringify(personSchema))
      .set('content-type', 'text/plain')
      .set('Authorization', 'Bearer ' + bearerToken)
      .expect(200)
      .expect('content-type', 'application/json')
      .end((err, res) => {
        if (err) return done(err)

        setTimeout(function () {
          // create some docs
          client
          .post('/1.0/library/person')
          .send({name: 'Neil Murray'})
          .set('content-type', 'application/json')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end((err, res) => {
            var id = res.body.results[0]._id

            client
            .post('/1.0/library/person')
            .send({name: 'J K Rowling', spouse: id})
            .set('content-type', 'application/json')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end((err, res) => {
              id = res.body.results[0]._id

              client
              .post('/1.0/library/book')
              .send({title: 'Harry Potter 1', author: id})
              .set('content-type', 'application/json')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .end((err, res) => {
                var bookid = res.body.results[0]._id
                var books = []
                books.push(bookid)

                client
                .post('/1.0/library/book')
                .send({title: 'Harry Potter 2', author: id, booksInSeries: books})
                .set('content-type', 'application/json')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .end((err, res) => {
                  // find a book

                  var Model = require(__dirname + '/../../../../dadi/lib/model/index.js')
                  var spy = sinon.spy(Model.Model.prototype, 'find')

                  client
                  .get('/1.0/library/book?filter={ "title": "Harry Potter 2" }&compose=true')
                  .send({title: 'Harry Potter 2', author: id, booksInSeries: books})
                  .set('content-type', 'application/json')
                  .set('Authorization', 'Bearer ' + bearerToken)
                  .expect(200)
                  .end((err, res) => {
                    var args = spy.args
                    spy.restore()

                    config.set('query.useVersionFilter', true)

                    // apiVersion should be in the query passed to find
                    args.forEach((arg) => {
                      should.not.exist(arg[0].query._apiVersion)
                    })

                    var results = res.body.results
                    results.should.be.Array
                    results.length.should.be.above(0)

                    done()
                  })
                })
              })
            })
          })
        }, 1000)
      })
    })
  })

  it('should ignore apiVersion when getting documents if useVersionFilter is not set', function (done) {
    config.set('query.useVersionFilter', false)

    var jsSchemaString = fs.readFileSync(__dirname + '/../../../new-schema.json', {encoding: 'utf8'})

    help.createDoc(bearerToken, function (err, doc) {
      if (err) return done(err)

      doc._apiVersion.should.equal('vtest')

      // create new API endpoint
      var client = request(connectionString)

      client
        .post('/v1/testdb/test-schema/config')
        .send(jsSchemaString)
        .set('content-type', 'text/plain')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(201)
        .expect('content-type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)

          // Wait for a few seconds then make request to test that the new endpoint is working
          setTimeout(function () {
            var testdoc = { newField: 'test string' }
            help.createDocWithSpecificVersion(bearerToken, 'v1', testdoc, function (err, doc) {
              if (err) return done(err)

              setTimeout(function () {
                client
                  .get('/v1/testdb/test-schema')
                  .set('Authorization', 'Bearer ' + bearerToken)
                  .expect(200)
                  .expect('content-type', 'application/json')
                  .end(function (err, res) {
                    if (err) return done(err)

                    res.body['results'].should.exist
                    res.body['results'].should.be.Array
                    res.body['results'][0]._apiVersion.should.equal('vtest')
                    done()
                  })
              }, 300)
            })
          }, 300)
        })
    })
  })

  it('should get documents from correct API version when useVersionFilter is set', function (done) {
    config.set('query.useVersionFilter', true)

    var jsSchemaString = fs.readFileSync(__dirname + '/../../../new-schema.json', {encoding: 'utf8'})

    help.createDoc(bearerToken, function (err, doc) {
      if (err) return done(err)

      doc._apiVersion.should.equal('vtest')

      // create new API endpoint
      var client = request(connectionString)

      client
        .post('/v1/testdb/test-schema/config')
        .send(jsSchemaString)
        .set('content-type', 'text/plain')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(201)
        .expect('content-type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)

          // Wait for a few seconds then make request to test that the new endpoint is working
          setTimeout(function () {
            var testdoc = { newField: 'doc with v1' }
            help.createDocWithSpecificVersion(bearerToken, 'v1', testdoc, function (err, doc) {
              if (err) return done(err)

              setTimeout(function () {
                client
                  .get('/v1/testdb/test-schema?filter={"newField":"doc with v1"}')
                  .set('Authorization', 'Bearer ' + bearerToken)
                  .expect(200)
                  .expect('content-type', 'application/json')
                  .end(function (err, res) {
                    if (err) return done(err)

                    config.set('query.useVersionFilter', false)

                    res.body['results'].should.exist
                    res.body['results'].should.be.Array
                    res.body['results'][0]._apiVersion.should.equal('v1')
                    done()
                  })
              }, 300)
            })
          }, 300)
        })
    })
  })

  it('should allow case insensitive query', function (done) {
    var doc = { field1: 'Test', field2: null }

    help.createDocWithParams(bearerToken, doc, function (err) {
      if (err) return done(err)

      var client = request(connectionString)
      var query = {
        field1: 'test'
      }

      query = encodeURIComponent(JSON.stringify(query))

      client
        .get('/vtest/testdb/test-schema?cache=false&filter=' + query)
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)

          res.body['results'].should.exist
          res.body['results'].should.be.Array
          res.body['results'].length.should.equal(1)
          res.body['results'][0].field1.should.equal('Test')
          done()
        })
    })
  })

  it('should allow case insensitive regex query', function (done) {
    var doc = { field1: 'Test', field2: null }

    help.createDocWithParams(bearerToken, doc, function (err) {
      if (err) return done(err)

      var client = request(connectionString)
      var query = {
        field1: { '$regex': 'tes' }
      }

      query = encodeURIComponent(JSON.stringify(query))

      client
        .get('/vtest/testdb/test-schema?cache=false&filter=' + query)
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)

          var found = false

          res.body['results'].should.exist
          res.body['results'].should.be.Array

          _.each(res.body['results'], function (value, key) {
            if (value.field1 === 'Test') found = true
          })

          found.should.be.true

          done()
        })
    })
  })

  it('should allow null values in query when converting to case insensitive', function (done) {
    var doc = { field1: 'Test', field2: null }

    help.createDocWithParams(bearerToken, doc, function (err) {
      if (err) return done(err)

      var client = request(connectionString)
      var query = {
        field2: null
      }

      query = encodeURIComponent(JSON.stringify(query))

      client
        .get('/vtest/testdb/test-schema?cache=false&filter=' + query)
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)

          var found = false

          res.body['results'].should.exist
          res.body['results'].should.be.Array

          _.each(res.body['results'], function (value, key) {
            if (value.field1 === 'Test') found = true
          })

          found.should.be.true

          done()
        })
    })
  })

  it('should not display fields with null values', function (done) {
    var doc = { field1: null }

    help.createDocWithParams(bearerToken, doc, function (err, doc) {
      if (err) return done(err)

      var client = request(connectionString)

      client
        .get('/vtest/testdb/test-schema/' + doc._id)
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)

          var found = false

          res.body.results.should.exist
          res.body.results.should.be.Array
          res.body.results[0].should.exist
          res.body.results[0]._id.should.exist
          should.not.exist(res.body.results[0].field1)

          done()
        })
    })
  })

  it('should return specified fields only when supplying `fields` param', function (done) {
    var doc = { field1: 'Test', field2: null }

    help.createDocWithParams(bearerToken, doc, function (err) {
      if (err) return done(err)

      var client = request(connectionString)

      var fields = {
        'field1': 1
      }

      query = encodeURIComponent(JSON.stringify(fields))
      client
        .get('/vtest/testdb/test-schema?cache=false&fields=' + query)
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)

          res.body['results'].should.exist
          res.body['results'].should.be.Array

          var obj = _.sample(_.compact(_.filter(res.body['results'], function (x) { return x.hasOwnProperty('field1') })))

          delete obj._id

          Object.keys(obj).length.should.equal(1)
          Object.keys(obj)[0].should.equal('field1')

          done()
        })
    })
  })

  it('should allow specifying fields with underscores  (issue #140)', function (done) {
    var doc = { field1: 'Test', field2: null, _fieldWithUnderscore: { first: 'Ernest', last: 'Hemingway' } }

    help.createDocWithParams(bearerToken, doc, function (err) {
      if (err) return done(err)

      var client = request(connectionString)

      var fields = {
        '_fieldWithUnderscore': 1
      }

      query = encodeURIComponent(JSON.stringify(fields))
      client
        .get('/vtest/testdb/test-schema?cache=false&fields=' + query)
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)

          res.body['results'].should.exist
          res.body['results'].should.be.Array

          var obj = _.sample(_.compact(_.map(res.body['results'], function (x) { if (x.hasOwnProperty('_fieldWithUnderscore')) return x })))
          should.exist(obj['_fieldWithUnderscore'])

          done()
        })
    })
  })

  it('should find specific document using filter param', function (done) {
    help.createDoc(bearerToken, function (err, doc1) {
      if (err) return done(err)
      help.createDoc(bearerToken, function (err, doc2) {
        if (err) return done(err)

        var client = request(connectionString)
        var docId = doc2._id
        var query = {
          _id: doc2._id
        }

        query = encodeURIComponent(JSON.stringify(query))
        client
          .get('/vtest/testdb/test-schema?filter=' + query)
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .expect('content-type', 'application/json')
          .end(function (err, res) {
            if (err) return done(err)

            res.body['results'].should.exist
            res.body['results'].should.be.Array
            res.body['results'].length.should.equal(1)
            res.body['results'][0]._id.should.equal(docId)
            done()
          })
      })
    })
  })

  it('should apply configured prefix to any internal fields present in the filter param', function (done) {
    var originalPrefix = config.get('internalFieldsPrefix')

    help.createDoc(bearerToken, function (err, doc) {
      if (err) return done(err)

      config.set('internalFieldsPrefix', '$')

      var client = request(connectionString)
      var query = {
        $id: doc._id
      }

      query = encodeURIComponent(JSON.stringify(query))

      client
        .get('/vtest/testdb/test-schema?filter=' + query)
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)

          res.body.results.should.exist
          res.body.results.should.be.Array
          res.body.results.length.should.equal(1)
          res.body.results[0].$id.should.eql(doc._id)
          should.not.exist(res.body.results[0]._id)

          config.set('internalFieldsPrefix', originalPrefix)

          done()
        })
    })
  })

  it('should find specific document using request param', function (done) {
    help.createDoc(bearerToken, function (err, doc1) {
      if (err) return done(err)
      help.createDoc(bearerToken, function (err, doc2) {
        if (err) return done(err)

        var client = request(connectionString)
        var docId = doc2._id

        client
          .get('/vtest/testdb/test-schema/' + doc2._id)
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .expect('content-type', 'application/json')
          .end(function (err, res) {
            if (err) return done(err)

            res.body['results'].should.exist
            res.body['results'].should.be.Array
            res.body['results'].length.should.equal(1)
            res.body['results'][0]._id.should.equal(docId)
            done()
          })
      })
    })
  })

  it('should find documents when using request param and filter', function (done) {
    help.createDoc(bearerToken, function (err, doc1) {
      if (err) return done(err)
      help.createDoc(bearerToken, function (err, doc2) {
        if (err) return done(err)

        setTimeout(function () {
          var client = request(connectionString)
          var docId = doc2._id
          var query = {
            field1: { '$gt': '0' }
          }

          query = encodeURIComponent(JSON.stringify(query))

          client
            .get('/vtest/testdb/test-schema/' + doc2._id + '?cache=false&filter=' + query)
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .expect('content-type', 'application/json')
            .end(function (err, res) {
              if (err) return done(err)

              res.body['results'].should.exist
              res.body['results'].should.be.Array
              res.body['results'].length.should.equal(1)
              res.body['results'][0]._id.should.equal(docId)
              done()
            })
        })
      }, 1000)
    })
  })

  it('should find specific documents using a standard query', function (done) {
    help.createDoc(bearerToken, function (err, doc1) {
      if (err) return done(err)
      help.createDoc(bearerToken, function (err, doc2) {
        if (err) return done(err)

        var client = request(connectionString)
        var docId = doc2._id
        var query = {
          _id: doc2._id
        }

        query = encodeURIComponent(JSON.stringify(query))
        client
          .get('/vtest/testdb/test-schema?filter=' + query)
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .expect('content-type', 'application/json')
          .end(function (err, res) {
            if (err) return done(err)

            res.body['results'].should.exist
            res.body['results'].should.be.Array
            res.body['results'].length.should.equal(1)
            res.body['results'][0]._id.should.equal(docId)
            done()
          })
      })
    })
  })

  it('should find all documents using a standard query', function (done) {
    help.createDoc(bearerToken, function (err, doc1) {
      if (err) return done(err)
      help.createDoc(bearerToken, function (err, doc2) {
        if (err) return done(err)

        var client = request(connectionString)
        var docId = doc2._id
        var query = {

        }

        query = encodeURIComponent(JSON.stringify(query))
        client
          .get('/vtest/testdb/test-schema?filter=' + query)
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .expect('content-type', 'application/json')
          .end(function (err, res) {
            if (err) return done(err)

            res.body['results'].should.exist
            res.body['results'].should.be.Array
            res.body['results'].length.should.be.above(1)
            done()
          })
      })
    })
  })

  it('should find one document using a standard query with count=1', function (done) {
    help.createDoc(bearerToken, function (err, doc1) {
      if (err) return done(err)
      help.createDoc(bearerToken, function (err, doc2) {
        if (err) return done(err)

        var client = request(connectionString)
        var docId = doc2._id

        client
          .get('/vtest/testdb/test-schema?count=1&cache=false')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .expect('content-type', 'application/json')
          .end(function (err, res) {
            if (err) return done(err)

            res.body['results'].should.exist
            res.body['results'].should.be.Array
            res.body['results'].length.should.equal(1)
            done()
          })
      })
    })
  })

  it('should add history to results when querystring param includeHistory=true', function (done) {
    var client = request(connectionString)

    client
    .post('/vtest/testdb/test-schema')
    .set('Authorization', 'Bearer ' + bearerToken)
    .send({field1: 'original field content'})
    .expect(200)
    .end(function (err, res) {
      if (err) return done(err)

      var doc = res.body.results[0]
      var body = {
        query: { _id: doc._id },
        update: {field1: 'updated'}
      }

      client
      .put('/vtest/testdb/test-schema/')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(body)
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err)

        res.body.results[0]._id.should.equal(doc._id)
        res.body.results[0].field1.should.equal('updated')

        client
        .get('/vtest/testdb/test-schema?includeHistory=true&filter={"_id": "' + doc._id + '"}')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)

          res.body['results'].should.exist
          res.body['results'].should.be.Array
          res.body['results'][0]._history.should.exist
          res.body['results'][0]._history[0].field1.should.eql('original field content')
          done()
        })
      })
    })
  })

  it('should add history to results when querystring param includeHistory=true, translating internal fields to the prefix defined in config', function (done) {
    var originalPrefix = config.get('internalFieldsPrefix')
    var client = request(connectionString)

    config.set('internalFieldsPrefix', '$')

    client
    .post('/vtest/testdb/test-schema')
    .set('Authorization', 'Bearer ' + bearerToken)
    .send({field1: 'original field content'})
    .expect(200)
    .end(function (err, res) {
      if (err) return done(err)

      var doc = res.body.results[0]

      var body = {
        query: { $id: doc.$id },
        update: {field1: 'updated'}
      }

      client
      .put('/vtest/testdb/test-schema/')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(body)
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err)

        res.body.results[0].$id.should.equal(doc.$id)
        res.body.results[0].field1.should.equal('updated')

        client
        .get('/vtest/testdb/test-schema/' +  doc.$id + '?includeHistory=true')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)

          res.body.results.should.exist
          res.body.results.should.be.Array
          res.body.results[0].$history.should.exist
          res.body.results[0].$history[0].$id.should.exist
          res.body.results[0].$history[0].field1.should.eql('original field content')

          config.set('internalFieldsPrefix', originalPrefix)

          done()
        })
      })
    })
  })

  it('should use specified historyFilters when querystring param includeHistory=true', function (done) {
    var client = request(connectionString)

    client
    .post('/vtest/testdb/test-schema')
    .set('Authorization', 'Bearer ' + bearerToken)
    .send({field1: 'ABCDEF', field2: 2001 })
    .expect(200)
    .end(function (err, res) {
      if (err) return done(err)
      var doc = res.body.results[0]

      var body = {
        query: { _id: doc._id },
        update: {field1: 'GHIJKL'}
      }

      client
      .put('/vtest/testdb/test-schema/')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(body)
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err)

        res.body.results[0]._id.should.equal(doc._id)
        res.body.results[0].field1.should.equal('GHIJKL')

        client
        .get('/vtest/testdb/test-schema?filter={"_id": "' + doc._id + '"}&includeHistory=true&historyFilters={"field2":2001}')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)

          res.body['results'].should.exist
          res.body['results'].should.be.Array
          res.body['results'][0].field1.should.exist
          res.body['results'][0].field1.should.eql('GHIJKL')
          res.body['results'][0].field2.should.exist
          res.body['results'][0]._history.should.exist
          res.body['results'][0]._history[0].field1.should.eql('ABCDEF')
          done()
        })
      })
    })
  })

  it('should return single document when querystring param count=1', function (done) {
    // create a bunch of docs
    var ac = new EventEmitter()
    var count = 0

    for (var i = 0; i < 10; ++i) {
      var doc = {field1: ((Math.random() * 10) | 0).toString(), field2: (Math.random() * 10) | 0}
      help.createDocWithParams(bearerToken, doc, function (err) {
        if (err) return ac.emit('error', err)
        count += 1
        if (count > 9) ac.emit('ready')
      })
    }

    ac.on('ready', function () {
      // documents are loaded and test can start
      var client = request(connectionString)

      var query = {}
      query = encodeURIComponent(JSON.stringify(query))

      client
        .get('/vtest/testdb/test-schema?count=1')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)

          res.body['results'].should.exist
          res.body['results'].should.be.Array
          res.body['results'].length.should.equal(1)
          done()
        })
    })
  })

  describe('query string params', function () {
    before(function (done) {
      // create a bunch of docs
      var asyncControl = new EventEmitter()
      var count = 0

      for (var i = 0; i < 45; ++i) {
        help.createDoc(bearerToken, function (err) {
          if (err) return asyncControl.emit('error', err)
          count += 1

          if (count >= 45) asyncControl.emit('ready')
        })
      }

      asyncControl.on('ready', function () {
        // documents are loaded and tests can start
        done()
      })

      asyncControl.on('error', function (err) { throw err })
    })

    it('should paginate results', function (done) {
      var client = request(connectionString)
      var docCount = 20

      client
        .get('/vtest/testdb/test-schema?page=1&count=' + docCount)
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)

          res.body['results'].should.exist
          res.body['results'].should.be.Array
          res.body['results'].length.should.equal(docCount)

          done()
        })
    })

    it('should return pagination metadata', function (done) {
      var client = request(connectionString)
      var docCount = 20

      client
        .get('/vtest/testdb/test-schema?page=1&count=' + docCount)
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)

          res.body['metadata'].should.exist
          res.body['metadata'].page.should.equal(1)
          res.body['metadata'].limit.should.equal(docCount)
          res.body['metadata'].totalPages.should.be.above(1) // Math.ceil(# documents/20 per page)
          res.body['metadata'].nextPage.should.equal(2)

          done()
        })
    })

    it('should return correct pagination nextPage value', function (done) {
      var client = request(connectionString)
      var docCount = 20

      client
        .get('/vtest/testdb/test-schema?page=2&count=' + docCount)
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)

          res.body['metadata'].should.exist
          res.body['metadata'].page.should.equal(2)
          res.body['metadata'].nextPage.should.equal(3)
          res.body['metadata'].prevPage.should.equal(1)

          done()
        })
    })

    it('should use schema defaults if not provided', function (done) {
      var client = request(connectionString)

      client
        .get('/vtest/testdb/test-schema?cache=false') // make sure not hitting cache
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)

          res.body['results'].should.exist
          res.body['results'].should.be.Array
          res.body['results'].length.should.equal(40)
          done()
        })
    })

    it('should show later pages', function (done) {
      var client = request(connectionString)

      client
        .get('/vtest/testdb/test-schema?count=20&page=1')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)

          res.body['results'].should.exist
          res.body['results'].should.be.Array
          res.body['results'].length.should.equal(20)

          var eleventhDoc = res.body['results'][10]

          client
            .get('/vtest/testdb/test-schema?count=10&page=2')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .expect('content-type', 'application/json')
            .end(function (err, res) {
              if (err) return done(err)

              res.body['results'].should.exist
              res.body['results'].should.be.Array
              res.body['results'].length.should.equal(10)

              // make sure second page starts in correct position
              res.body['results'][0]._id.should.equal(eleventhDoc._id)

              done()
            })
        })
    })

    it('should allow sorting results', function (done) {
      var client = request(connectionString)

      client
        .get('/vtest/testdb/test-schema?sort=field1')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)

          res.body['results'].should.exist
          res.body['results'].should.be.Array
          res.body['results'].length.should.equal(40)

          var max = ''
          res.body['results'].forEach(function (doc) {
            if (doc.field1) {
              doc.field1.should.not.be.below(max)
              max = doc.field1
            }
          })

          done()
        })
    })

    it('should allow specifying descending sort order', function (done) {
      var client = request(connectionString)

      client
        .get('/vtest/testdb/test-schema?sort=field1&sortOrder=desc')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)

          res.body['results'].should.exist
          res.body['results'].should.be.Array
          res.body['results'].length.should.equal(40)

          var last = ''
          res.body['results'].forEach(function (doc) {
            if (last) doc.field1.should.not.be.above(last)
            last = doc.field1
          })

          done()
        })
    })

    it('should allow specifying ascending sort order', function (done) {
      var client = request(connectionString)

      client
        .get('/vtest/testdb/test-schema?sort=field1&sortOrder=asc')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)

          res.body['results'].should.exist
          res.body['results'].should.be.Array
          res.body['results'].length.should.equal(40)

          var last = ''
          res.body['results'].forEach(function (doc) {
            if (last) doc.field1.should.not.be.below(last)
            last = doc.field1
          })

          done()
        })
    })

    it('should return 400 if invalid skip option is provided', function (done) {
      var client = request(connectionString)

      client
        .get('/vtest/testdb/test-schema?skip=-1')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(400)
        .expect('content-type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)

          res.body['errors'].should.exist
          res.body['errors'][0].title.should.eql('Invalid Skip Parameter Provided')

          done()
        })
    })

    it('should return 400 if skip option is alphabetical', function (done) {
      var client = request(connectionString)

      client
        .get('/vtest/testdb/test-schema?skip=a')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(400)
        .expect('content-type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)

          res.body['errors'].should.exist
          res.body['errors'][0].title.should.eql('Invalid Skip Parameter Provided')

          done()
        })
    })

    it('should return 400 if invalid page option is provided', function (done) {
      var client = request(connectionString)

      client
        .get('/vtest/testdb/test-schema?page=-1')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(400)
        .expect('content-type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)

          res.body['errors'].should.exist
          res.body['errors'][0].title.should.eql('Invalid Page Parameter Provided')

          done()
        })
    })

    it('should return multiple errors if invalid page and skip options are provided', function (done) {
      var client = request(connectionString)

      client
        .get('/vtest/testdb/test-schema?page=-1&skip=-8')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(400)
        .expect('content-type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)

          res.body['errors'].should.exist
          res.body['errors'].length.should.eql(2)

          done()
        })
    })

    it('should return javascript if `callback` is provided', function (done) {
      var client = request(connectionString)
      var callbackName = 'testCallback'

      client
        .get('/vtest/testdb/test-schema?callback=' + callbackName)
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'text/javascript')
        .end(function (err, res) {
          if (err) return done(err)

          res.text.slice(0, callbackName.length).should.equal(callbackName)
          res.text.slice(-2).should.equal(');')
          done()
        })
    })
  })
})
