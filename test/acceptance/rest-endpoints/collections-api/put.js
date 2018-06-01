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

describe('Collections API – PUT', function () {
  this.timeout(4000)

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

          var client = request(connectionString)

          client
            .post('/vtest/testdb/put-test-schema/config')
            .send(JSON.stringify(schema, null, 4))
            .set('content-type', 'text/plain')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(201)
            .expect('content-type', 'application/json')
            .end(function (err, res) {
              if (err) return done(err)

              // add another apiversion with the same collection
              client
                .post('/vjoin/testdb/put-test-schema/config')
                .send(JSON.stringify(schema, null, 4))
                .set('content-type', 'text/plain')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(201)
                .expect('content-type', 'application/json')
                .end(function (err, res) {
                  if (err) return done(err)

                  setTimeout(done, 500)
                })
            })
        })
      })
    })
  })

  after(function (done) {
    app.stop(() => {
      var dirs = config.get('paths')

      try {
        fs.unlinkSync(dirs.collections + '/vjoin/testdb/collection.put-test-schema.json')
      } catch (e) {}

      try {
        fs.unlinkSync(dirs.collections + '/vjoin/testdb/collection.put-test-schema-no-history.json')
      } catch (e) {}

      try {
        fs.unlinkSync(dirs.collections + '/vtest/testdb/collection.put-test-schema.json')
      } catch (e) {}

      try {
        fs.unlinkSync(dirs.collections + '/vtest/testdb/collection.put-test-schema-no-history.json')
      } catch (e) {}

      done()
    })
  })

  it('should update existing documents when passing ID', function (done) {
    var client = request(connectionString)

    client
      .post('/vtest/testdb/put-test-schema')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send({field1: 'doc to update'})
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err)

        var doc = res.body.results[0]
        should.exist(doc)
        doc.field1.should.equal('doc to update')

        var puturl = '/vtest/testdb/put-test-schema/' + doc._id

        client
          .put(puturl)
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({field1: 'updated doc'})
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err)
            res.body.results[0]._id.should.equal(doc._id)
            res.body.results[0].field1.should.equal('updated doc')

            client
              .get('/vtest/testdb/put-test-schema?filter={"_id": "' + doc._id + '"}')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .expect('content-type', 'application/json')
              .end(function (err, res) {
                if (err) return done(err)

                res.body['results'].should.exist
                res.body['results'].should.be.Array
                res.body['results'].length.should.equal(1)
                res.body['results'][0].field1.should.equal('updated doc')

                done()
              })
          })
      })
  })

  it('should return 404 when updating a non-existing document by ID (RESTful)', function (done) {
    var client = request(connectionString)

    client
      .put('/vtest/testdb/put-test-schema/59f1b3e038ad765e669ac47f')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send({field1: 'updated doc'})
      .expect(404)
      .end(function (err, res) {
        if (err) return done(err)

        res.body.statusCode.should.eql(404)

        done()
      })
  })

  it('should return 200 when updating a non-existing document by ID, supplying the query in the request body', function (done) {
    var client = request(connectionString)

    client
      .put('/vtest/testdb/put-test-schema')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send({
        query: {
          _id: '59f1b3e038ad765e669ac47f'
        },
        update: {
          field1: 'updated doc'
        }
      })
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err)

        res.body.results.should.eql([])

        done()
      })
  })

  it('should update existing documents when passing ID, giving back the updated document with internal fields prefixed with the character defined in config', function (done) {
    var client = request(connectionString)
    var originalPrefix = config.get('internalFieldsPrefix')

    config.set('internalFieldsPrefix', '$')

    client
      .post('/vtest/testdb/put-test-schema')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send({field1: 'doc to update'})
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err)

        var doc = res.body.results[0]
        should.exist(doc)
        doc.field1.should.equal('doc to update')

        var puturl = '/vtest/testdb/put-test-schema/' + doc.$id

        client
          .put(puturl)
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({field1: 'updated doc'})
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err)

            res.body.results[0].$id.should.equal(doc.$id)

            config.set('internalFieldsPrefix', originalPrefix)

            done()
          })
      })
  })

  it('should update existing document by ID when passing a query', function (done) {
    var client = request(connectionString)

    client
      .post('/vtest/testdb/put-test-schema')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send({field1: 'doc to update'})
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err)

        var doc = res.body.results[0]
        should.exist(doc)
        doc.field1.should.equal('doc to update')

        var body = {
          query: { _id: doc._id },
          update: {field1: 'updated doc'}
        }

        client
          .put('/vtest/testdb/put-test-schema/')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send(body)
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err)

            // console.log(res.body)
            res.body.results[0]._id.should.equal(doc._id)
            res.body.results[0].field1.should.equal('updated doc')

            client
              .get('/vtest/testdb/put-test-schema?filter={"_id": "' + doc._id + '"}')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .expect('content-type', 'application/json')
              .end(function (err, res) {
                if (err) return done(err)

                res.body['results'].should.exist
                res.body['results'].should.be.Array
                res.body['results'].length.should.equal(1)
                res.body['results'][0].field1.should.equal('updated doc')

                done()
              })
          })
      })
  })

  it('should update existing document by ID when passing a query, translating any internal field to the prefix defined in config', function (done) {
    var client = request(connectionString)
    var originalPrefix = config.get('internalFieldsPrefix')

    config.set('internalFieldsPrefix', '$')

    client
      .post('/vtest/testdb/put-test-schema')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send({field1: 'doc to update'})
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err)

        var doc = res.body.results[0]
        should.exist(doc)
        doc.field1.should.equal('doc to update')

        var body = {
          query: { $id: doc.$id },
          update: {field1: 'updated doc'}
        }

        client
          .put('/vtest/testdb/put-test-schema/')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send(body)
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err)

            res.body.results[0].$id.should.equal(doc.$id)
            res.body.results[0].field1.should.equal('updated doc')

            client
              .get('/vtest/testdb/put-test-schema?filter={"$id": "' + doc.$id + '"}')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .expect('content-type', 'application/json')
              .end(function (err, res) {
                if (err) return done(err)

                res.body['results'].should.exist
                res.body['results'].should.be.Array
                res.body['results'].length.should.equal(1)
                res.body['results'][0].field1.should.equal('updated doc')

                config.set('internalFieldsPrefix', originalPrefix)

                done()
              })
          })
      })
  })

  it('should update all existing documents when passing a query with a filter', function (done) {
    var client = request(connectionString)

    // add three docs
    client
      .post('/vtest/testdb/put-test-schema')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send({field1: 'draft'})
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err)

        client
          .post('/vtest/testdb/put-test-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({field1: 'draft'})
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err)

            client
              .post('/vtest/testdb/put-test-schema')
              .set('Authorization', 'Bearer ' + bearerToken)
              .send({field1: 'draft'})
              .expect(200)
              .end(function (err, res) {
                if (err) return done(err)

                // update query
                var body = {
                  query: { field1: 'draft' },
                  update: {field1: 'published'}
                }

                client
                  .put('/vtest/testdb/put-test-schema/')
                  .set('Authorization', 'Bearer ' + bearerToken)
                  .send(body)
                  .expect(200)
                  .end(function (err, res) {
                    if (err) return done(err)

                    res.body['results'].should.exist
                    res.body['results'].should.be.Array
                    res.body['results'].length.should.equal(3)
                    res.body['results'][0].field1.should.equal('published')
                    res.body['results'][1].field1.should.equal('published')
                    res.body['results'][2].field1.should.equal('published')

                    done()
                  })
              })
          })
      })
  })

  it('should update documents when passing a query with a filter, translating any internal field to the prefix defined in config', function (done) {
    var client = request(connectionString)
    var originalPrefix = config.get('internalFieldsPrefix')

    config.set('internalFieldsPrefix', '$')

    client
      .post('/vtest/testdb/put-test-schema')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send({field1: 'some value'})
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err)

        var doc = res.body.results[0]
        var body = {
          query: {
            $id: doc.$id
          },
          update: {
            field1: 'Updated value'
          }
        }

        client
          .put('/vtest/testdb/put-test-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send(body)
          .expect(200)
          .expect('content-type', 'application/json')
          .end(function (err, res) {
            if (err) return done(err)

            res.body.results.should.be.Array
            res.body.results[0].$id.should.eql(doc.$id)
            res.body.results[0].field1.should.eql(body.update.field1)

            client
              .get('/vtest/testdb/put-test-schema/' + doc.$id)
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .expect('content-type', 'application/json')
              .end(function (err, res) {
                if (err) return done(err)

                res.body.results.should.be.Array
                res.body.results[0].$id.should.eql(doc.$id)
                res.body.results[0].field1.should.eql(body.update.field1)

                config.set('internalFieldsPrefix', originalPrefix)

                done()
              })
          })
      })
  })

  it('should add internal fields to updated documents', function (done) {
    var client = request(connectionString)

    client
      .post('/vtest/testdb/put-test-schema')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send({field1: 'doc to update'})
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err)

        var doc = res.body.results[0]
        should.exist(doc)
        doc.field1.should.equal('doc to update')

        client
          .put('/vtest/testdb/put-test-schema/' + doc._id)
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({field1: 'updated doc'})
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err)

            res.body.results[0]._id.should.equal(doc._id)
            res.body.results[0].field1.should.equal('updated doc')

            client
              .get('/vtest/testdb/put-test-schema?filter={"_id": "' + doc._id + '"}')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .expect('content-type', 'application/json')
              .end(function (err, res) {
                if (err) return done(err)

                res.body['results'].should.exist
                res.body['results'].should.be.Array
                res.body['results'].length.should.equal(1)
                res.body['results'][0]._lastModifiedBy.should.equal('test123')
                res.body['results'][0]._lastModifiedAt.should.be.Number
                res.body['results'][0]._lastModifiedAt.should.not.be.above(Date.now())
                res.body['results'][0]._apiVersion.should.equal('vtest')

                done()
              })
          })
      })
  })

  it('should use apiVersion to filter when selecting update documents if configured', function (done) {
    this.timeout(6000)
    var client = request(connectionString)

    config.set('query.useVersionFilter', true)

    client
      .post('/vtest/testdb/put-test-schema')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send({field1: 'doc'})
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err)

        client
          .post('/vjoin/testdb/put-test-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({field1: 'doc'})
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err)

            var doc = res.body.results[0]
            should.exist(doc)

            doc.field1.should.equal('doc')

            var body = {
              query: { field1: 'doc' },
              update: {field1: 'updated doc'}
            }

            client
              .put('/vtest/testdb/put-test-schema/')
              .set('Authorization', 'Bearer ' + bearerToken)
              .send(body)
              .expect(200)
              .end(function (err, res) {
                if (err) return done(err)

                client
                  .get('/vjoin/testdb/put-test-schema')
                  .set('Authorization', 'Bearer ' + bearerToken)
                  .expect(200)
                  .expect('content-type', 'application/json')
                  .end(function (err, res) {
                    if (err) return done(err)

                    res.body['results'].should.exist
                    res.body['results'].should.be.Array
                    res.body['results'].length.should.equal(1)
                    res.body['results'][0].field1.should.equal('doc') // not "updated doc"
                    res.body['results'][0]._apiVersion.should.equal('vjoin')

                    config.set('query.useVersionFilter', false)

                    done()
                  })
              })
          })
      })
  })

  it('should update correct documents and return when history is off', function (done) {
    help.getBearerTokenWithAccessType('admin', function (err, token) {
      if (err) return done(err)

      // modify schema settings
      var jsSchemaString = fs.readFileSync(__dirname + '/../../../new-schema.json', {encoding: 'utf8'})
      jsSchemaString = jsSchemaString.replace('newField', 'field1')
      var schema = JSON.parse(jsSchemaString)
      schema.settings.storeRevisions = false

      config.set('query.useVersionFilter', true)

      var client = request(connectionString)

      client
        .post('/vtest/testdb/put-test-schema-no-history/config')
        .send(JSON.stringify(schema, null, 4))
        .set('content-type', 'text/plain')
        .set('Authorization', 'Bearer ' + token)
        // .expect(200)
        .expect('content-type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)

          client
            .post('/vjoin/testdb/put-test-schema-no-history/config')
            .send(JSON.stringify(schema, null, 4))
            .set('content-type', 'text/plain')
            .set('Authorization', 'Bearer ' + token)
            // .expect(200)
            .expect('content-type', 'application/json')
            .end(function (err, res) {
              if (err) return done(err)

              setTimeout(function () {
                client
                  .post('/vtest/testdb/put-test-schema-no-history')
                  .set('Authorization', 'Bearer ' + token)
                  .send({field1: 'doc'})
                  // .expect(200)
                  .end(function (err, res) {
                    if (err) return done(err)

                    client
                      .post('/vjoin/testdb/put-test-schema-no-history')
                      .set('Authorization', 'Bearer ' + token)
                      .send({field1: 'doc'})
                      // .expect(200)
                      .end(function (err, res) {
                        if (err) return done(err)

                        var doc = res.body.results[0]
                        should.exist(doc)
                        doc.field1.should.equal('doc')

                        var body = {
                          query: { field1: 'doc' },
                          update: {field1: 'updated doc'}
                        }

                        client
                          .put('/vtest/testdb/put-test-schema-no-history/')
                          .set('Authorization', 'Bearer ' + token)
                          .send(body)
                          .expect(200)
                          .end(function (err, res) {
                            if (err) return done(err)

                            res.body['results'].should.exist
                            res.body['results'].should.be.Array
                            res.body['results'].length.should.equal(1)
                            res.body['results'][0].field1.should.equal('updated doc') // not "updated doc"
                            res.body['results'][0]._apiVersion.should.equal('vtest')

                            client
                              .get('/vjoin/testdb/put-test-schema-no-history?filter={"field1": { "$ne" : "" } }')
                              .set('Authorization', 'Bearer ' + token)
                              .expect(200)
                              .expect('content-type', 'application/json')
                              .end(function (err, res) {
                                if (err) return done(err)

                                res.body['results'].should.exist
                                res.body['results'].should.be.Array
                                res.body['results'].length.should.equal(1)
                                res.body['results'][0].field1.should.equal('doc') // not "updated doc"
                                res.body['results'][0]._apiVersion.should.equal('vjoin')

                                config.set('query.useVersionFilter', false)

                                done()
                              })
                          })
                      })
                  })
              }, 1000)
            })
        })
    })
  })
})
