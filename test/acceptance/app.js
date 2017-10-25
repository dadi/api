var should = require('should')
var sinon = require('sinon')
var fs = require('fs')
var path = require('path')
var request = require('supertest')
var _ = require('underscore')
var EventEmitter = require('events').EventEmitter
var FormData = require('form-data')
var connection = require(__dirname + '/../../dadi/lib/model/connection')
var config = require(__dirname + '/../../config')
var help = require(__dirname + '/help')
var app = require(__dirname + '/../../dadi/lib/')

// variables scoped for use throughout tests
var bearerToken
var connectionString = 'http://' + config.get('server.host') + ':' + config.get('server.port')
var lastModifiedAt = 0

describe('Application', function () {
  this.timeout(10000)

  before(function (done) {
    // read "lastModifiedAt": 1466832329170
    // of workspace/collections/vtest/testdb
    var dirs = config.get('paths')
    var schemaPath = path.resolve(dirs.collections + '/vtest/testdb/collection.test-schema.json')
    var schema = JSON.parse(fs.readFileSync(schemaPath).toString())
    lastModifiedAt = schema.settings.lastModifiedAt
    done()
  })

  after(function (done) {
    // reset "lastModifiedAt": 1466832329170
    // of workspace/collections/vtest/testdb
    var dirs = config.get('paths')
    var schemaPath = path.resolve(dirs.collections + '/vtest/testdb/collection.test-schema.json')
    var schema = JSON.parse(fs.readFileSync(schemaPath).toString())
    schema.settings.lastModifiedAt = lastModifiedAt
    fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2))

    help.removeTestClients(done)
  })

  it('should start from specific directory', function (done) {
    app.start(function (err) {
      if (err) return done(err)

      // give it a moment for http.Server to finish starting
      setTimeout(function () {
        app.stop(done)
      }, 200)
    })
  })

  it('should start a server', function (done) {
    app.start(function (err) {
      if (err) return done(err)

      setTimeout(function () {
        var client = request(connectionString)
        client
          .get('/api/config')

          // just need to test that we get some kind of response
          .expect(401)
          .end(function (err) {
            if (err) done = done.bind(this, err)
            app.stop(done)
          })
      }, 500)
    })
  })

  it('should respond to the /hello endpoint', function (done) {
    app.start(function (err) {
      if (err) return done(err)

      setTimeout(function () {
        var client = request(connectionString)
        client
          .get('/hello')
          .expect(200)
          .end(function (err) {
            if (err) done = done.bind(this, err)
            app.stop(done)
          })
      }, 500)
    })
  })

  describe('collection initialisation', function () {
    var dirs = config.get('paths')
    var newSchemaPath = dirs.collections + '/vtest/testdb/collection.new-test-schema.json'

    before(function (done) {
      // Add a schema file to the collection path
      var newSchema = JSON.parse(JSON.stringify(require(path.resolve(dirs.collections + '/../schemas/collection.new-test-schema.json'))))
      fs.writeFileSync(newSchemaPath, JSON.stringify(newSchema))

      app.start(done)
    })

    after(function (done) {
      if (fs.existsSync(newSchemaPath)) fs.unlinkSync(newSchemaPath)

      app.stop(done)
    })

    describe('on app start', function () {
      before(function (done) {
        help.dropDatabase('testdb', function (err) {
          if (err) return done(err)

          help.getBearerToken(function (err, token) {
            if (err) return done(err)

            bearerToken = token

            done()
          })
        })
      })

      it('should initialise model using collection schema filename as model name', function (done) {
        var loadedModels = _.compact(_.pluck(app.components, 'model'))
        var model = _.where(loadedModels, { name: 'test-schema' })

        model.length.should.equal(1)

        done()
      })

      it('should initialise model using property from schema file as model name', function (done) {
        var loadedModels = _.compact(_.pluck(app.components, 'model'))
        var model = _.where(loadedModels, { name: 'modelNameFromSchema' })

        model.length.should.equal(1)

        done()
      })
    })
  })

  describe('collections api', function () {
    this.timeout(4000)
    before(function (done) {
      app.start(done)
    })

    after(function (done) {
      app.stop(done)
    })

    describe('POST', function () {
      before(function (done) {
        help.dropDatabase('testdb', function (err) {
          if (err) return done(err)

          help.getBearerTokenWithAccessType('admin', function (err, token) {
            if (err) return done(err)

            bearerToken = token

            // add a new field to the schema
            var jsSchemaString = fs.readFileSync(__dirname + '/../new-schema.json', {encoding: 'utf8'})
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

            var client = request(connectionString)

            client
              .post('/vtest/testdb/test-schema/config')
              .send(JSON.stringify(schema, null, 2))
              .set('content-type', 'text/plain')
              .set('Authorization', 'Bearer ' + bearerToken)
              // .expect(200)
              .expect('content-type', 'application/json')
              .end(function (err, res) {
                if (err) return done(err)

                // let's wait a bit
                setTimeout(function () {
                  done()
                }, 500)
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

      it('should create new documents', function (done) {
        var client = request(connectionString)
        client
          .post('/vtest/testdb/test-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({field1: 'foo!'})
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err)

            should.exist(res.body.results)
            res.body.results.should.be.Array
            res.body.results.length.should.equal(1)
            should.exist(res.body.results[0]._id)
            res.body.results[0].field1.should.equal('foo!')
            done()
          })
      })

      it('should create new documents and return its representation containing the internal fields prefixed with the character defined in config', function (done) {
        var originalPrefix = config.get('internalFieldsPrefix')

        config.set('internalFieldsPrefix', '$')

        var client = request(connectionString)
        client
          .post('/vtest/testdb/test-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({field1: 'foo!'})
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err)

            res.body.results.should.be.Array
            res.body.results.length.should.equal(1)
            should.not.exist(res.body.results[0]._id)
            should.exist(res.body.results[0].$id)
            should.exist(res.body.results[0].$createdAt)
            should.exist(res.body.results[0].$createdBy)
            res.body.results[0].field1.should.equal('foo!')

            config.set('internalFieldsPrefix', originalPrefix)

            done()
          })
      })

      it('should create new documents when body is urlencoded', function (done) {
        var body = 'field1=foo!'
        var client = request(connectionString)

        client
          .post('/vtest/testdb/test-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send(body)
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err)

            should.exist(res.body.results)

            res.body.results.should.be.Array
            res.body.results.length.should.equal(1)
            should.exist(res.body.results[0]._id)
            should.exist(res.body.results[0].field1)
            res.body.results[0].field1.should.equal('foo!')
            done()
          })
      })

      it('should create new documents when content-type is text/plain', function (done) {
        var body = JSON.stringify({
          field1: 'foo!'
        })

        var client = request(connectionString)

        client
          .post('/vtest/testdb/test-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .set('content-type', 'text/plain')
          .send(body)
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err)

            should.exist(res.body.results)

            res.body.results.should.be.Array
            res.body.results.length.should.equal(1)
            should.exist(res.body.results[0]._id)
            should.exist(res.body.results[0].field1)
            res.body.results[0].field1.should.equal('foo!')
            done()
          })
      })

      it('should create new documents with ObjectIDs from single value', function (done) {
        var body = { field1: 'foo!', field2: 1278, field3: '55cb1658341a0a804d4dadcc' }
        var client = request(connectionString)
        client
          .post('/vtest/testdb/test-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send(body)
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err)

            should.exist(res.body.results)

            res.body.results.should.be.Array
            res.body.results.length.should.equal(1)
            should.exist(res.body.results[0]._id)
            should.exist(res.body.results[0].field3)
            // (typeof res.body.results[0].field3).should.equal('object')

            done()
          })
      })

      it('should create new documents with ObjectIDs from array', function (done) {
        var body = { field1: 'foo!', field2: 1278, field3: ['55cb1658341a0a804d4dadcc', '55cb1658341a0a804d4dadff'] }
        var client = request(connectionString)
        client
          .post('/vtest/testdb/test-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send(body)
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err)

            should.exist(res.body.results)

            res.body.results.should.be.Array
            res.body.results.length.should.equal(1)
            should.exist(res.body.results[0]._id)
            should.exist(res.body.results[0].field3)
            // (typeof res.body.results[0].field3).should.equal('object')

            done()
          })
      })

      it('should add internal fields to new documents', function (done) {
        var client = request(connectionString)
        client
          .post('/vtest/testdb/test-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({field1: 'foo!'})
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err)

            should.exist(res.body.results)

            res.body.results.should.be.Array
            res.body.results.length.should.equal(1)
            res.body.results[0]._createdBy.should.equal('test123')
            res.body.results[0]._createdAt.should.be.Number
            res.body.results[0]._createdAt.should.not.be.above(Date.now())
            res.body.results[0]._apiVersion.should.equal('vtest')
            done()
          })
      })
    })

    describe('PUT', function () {
      before(function (done) {
        help.dropDatabase('testdb', function (err) {
          if (err) return done(err)

          help.getBearerTokenWithAccessType('admin', function (err, token) {
            if (err) return done(err)

            bearerToken = token

            // add a new field to the schema
            var jsSchemaString = fs.readFileSync(__dirname + '/../new-schema.json', {encoding: 'utf8'})
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

                // add another apiversion with the same collection
                client
                  .post('/vjoin/testdb/test-schema/config')
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
        var jsSchemaString = fs.readFileSync(__dirname + '/../new-schema.json', {encoding: 'utf8'})
        jsSchemaString = jsSchemaString.replace('newField', 'field1')
        var schema = JSON.parse(jsSchemaString)

        var client = request(connectionString)

        help.getBearerTokenWithAccessType('admin', function (err, token) {
          client
          .post('/vtest/testdb/test-schema/config')
          .send(JSON.stringify(schema, null, 4))
          .set('content-type', 'text/plain')
          .set('Authorization', 'Bearer ' + token)
          .expect(200)
          .expect('content-type', 'application/json')
          .end(function (err, res) {
            if (err) return done(err)

            var dirs = config.get('paths')

            try {
              fs.unlinkSync(dirs.collections + '/vjoin/testdb/collection.test-schema.json')
              fs.unlinkSync(dirs.collections + '/vjoin/testdb/collection.test-schema-no-history.json')
              fs.unlinkSync(dirs.collections + '/vtest/testdb/collection.test-schema-no-history.json')

              return done()
            } catch (e) {}

            done()
          })
        })
      })

      it('should update existing documents when passing ID', function (done) {
        var client = request(connectionString)

        client
          .post('/vtest/testdb/test-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({field1: 'doc to update'})
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err)

            var doc = res.body.results[0]
            should.exist(doc)
            doc.field1.should.equal('doc to update')

            var puturl = '/vtest/testdb/test-schema/' + doc._id

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
                  .get('/vtest/testdb/test-schema?filter={"_id": "' + doc._id + '"}')
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

      it('should update existing documents when passing ID, giving back the updated document with internal fields prefixed with the character defined in config', function (done) {
        var client = request(connectionString)
        var originalPrefix = config.get('internalFieldsPrefix')

        config.set('internalFieldsPrefix', '$')

        client
          .post('/vtest/testdb/test-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({field1: 'doc to update'})
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err)

            var doc = res.body.results[0]
            should.exist(doc)
            doc.field1.should.equal('doc to update')

            var puturl = '/vtest/testdb/test-schema/' + doc.$id

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
          .post('/vtest/testdb/test-schema')
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
              .put('/vtest/testdb/test-schema/')
              .set('Authorization', 'Bearer ' + bearerToken)
              .send(body)
              .expect(200)
              .end(function (err, res) {
                if (err) return done(err)

                // console.log(res.body)
                res.body.results[0]._id.should.equal(doc._id)
                res.body.results[0].field1.should.equal('updated doc')

                client
                  .get('/vtest/testdb/test-schema?filter={"_id": "' + doc._id + '"}')
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
          .post('/vtest/testdb/test-schema')
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
              .put('/vtest/testdb/test-schema/')
              .set('Authorization', 'Bearer ' + bearerToken)
              .send(body)
              .expect(200)
              .end(function (err, res) {
                if (err) return done(err)

                res.body.results[0].$id.should.equal(doc.$id)
                res.body.results[0].field1.should.equal('updated doc')

                client
                  .get('/vtest/testdb/test-schema?filter={"$id": "' + doc.$id + '"}')
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
          .post('/vtest/testdb/test-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({field1: 'draft'})
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err)

            client
              .post('/vtest/testdb/test-schema')
              .set('Authorization', 'Bearer ' + bearerToken)
              .send({field1: 'draft'})
              .expect(200)
              .end(function (err, res) {
                if (err) return done(err)

                client
                  .post('/vtest/testdb/test-schema')
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
                      .put('/vtest/testdb/test-schema/')
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

        help.createDoc(bearerToken, function (err, doc) {
          if (err) return done(err)

          var client = request(connectionString)
          var body = {
            query: {
              $id: doc.$id
            },
            update: {
              field1: 'Updated value'
            }
          }

          client
            .put('/vtest/testdb/test-schema')
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
                .get('/vtest/testdb/test-schema/' + doc.$id)
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
          .post('/vtest/testdb/test-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({field1: 'doc to update'})
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err)

            var doc = res.body.results[0]
            should.exist(doc)
            doc.field1.should.equal('doc to update')

            client
              .put('/vtest/testdb/test-schema/' + doc._id)
              .set('Authorization', 'Bearer ' + bearerToken)
              .send({field1: 'updated doc'})
              .expect(200)
              .end(function (err, res) {
                if (err) return done(err)

                res.body.results[0]._id.should.equal(doc._id)
                res.body.results[0].field1.should.equal('updated doc')

                client
                  .get('/vtest/testdb/test-schema?filter={"_id": "' + doc._id + '"}')
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
          .post('/vtest/testdb/test-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({field1: 'doc'})
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err)

            client
              .post('/vjoin/testdb/test-schema')
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
                  .put('/vtest/testdb/test-schema/')
                  .set('Authorization', 'Bearer ' + bearerToken)
                  .send(body)
                  .expect(200)
                  .end(function (err, res) {
                    if (err) return done(err)

                    client
                      .get('/vjoin/testdb/test-schema')
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
          var jsSchemaString = fs.readFileSync(__dirname + '/../new-schema.json', {encoding: 'utf8'})
          jsSchemaString = jsSchemaString.replace('newField', 'field1')
          var schema = JSON.parse(jsSchemaString)
          schema.settings.storeRevisions = false

          config.set('query.useVersionFilter', true)

          var client = request(connectionString)

          client
            .post('/vtest/testdb/test-schema-no-history/config')
            .send(JSON.stringify(schema, null, 4))
            .set('content-type', 'text/plain')
            .set('Authorization', 'Bearer ' + token)
            // .expect(200)
            .expect('content-type', 'application/json')
            .end(function (err, res) {
              if (err) return done(err)

              client
                .post('/vjoin/testdb/test-schema-no-history/config')
                .send(JSON.stringify(schema, null, 4))
                .set('content-type', 'text/plain')
                .set('Authorization', 'Bearer ' + token)
                // .expect(200)
                .expect('content-type', 'application/json')
                .end(function (err, res) {
                  if (err) return done(err)

                  setTimeout(function () {
                    client
                      .post('/vtest/testdb/test-schema-no-history')
                      .set('Authorization', 'Bearer ' + token)
                      .send({field1: 'doc'})
                      // .expect(200)
                      .end(function (err, res) {
                        if (err) return done(err)

                        client
                          .post('/vjoin/testdb/test-schema-no-history')
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
                              .put('/vtest/testdb/test-schema-no-history/')
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
                                  .get('/vjoin/testdb/test-schema-no-history?filter={"field1": { "$ne" : "" } }')
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

    describe('GET', function () {
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
        help.dropDatabase('testdb', function (err) {
          if (err) return done(err)

          help.getBearerTokenWithAccessType('admin', function (err, token) {
            if (err) return done(err)

            bearerToken = token

            // add a new field to the schema
            var jsSchemaString = fs.readFileSync(__dirname + '/../new-schema.json', {encoding: 'utf8'})
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

                done()
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
          .send(JSON.stringify(schema, null, 4))
          .set('content-type', 'text/plain')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .expect('content-type', 'application/json')
          .end(function (err, res) {
            if (err) return done(err)

            cleanup(done)
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

      it.skip('should use apiVersion when getting reference documents if useVersionFilter is set to true', function (done) {
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
            callback: null,
            defaultFilters: null,
            fieldLimiters: null,
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
            callback: null,
            defaultFilters: null,
            fieldLimiters: null,
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

                    var Model = require(__dirname + '/../../dadi/lib/model/index.js')
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
                      config.set('query.useVersionFilter', false)

                      // apiVersion should be in the query passed to find
                      args.forEach((arg) => {
                        should.exist(arg[0]._apiVersion)
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
            callback: null,
            defaultFilters: null,
            fieldLimiters: null,
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
            callback: null,
            defaultFilters: null,
            fieldLimiters: null,
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

                      var Model = require(__dirname + '/../../dadi/lib/model/index.js')
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
                          should.not.exist(arg[0]._apiVersion)
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

        var jsSchemaString = fs.readFileSync(__dirname + '/../new-schema.json', {encoding: 'utf8'})

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
            .expect(200)
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

        var jsSchemaString = fs.readFileSync(__dirname + '/../new-schema.json', {encoding: 'utf8'})

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
            .expect(200)
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
            .get('/vtest/testdb/test-schema?includeHistory=true&filter={"$id": "' + doc.$id + '"}')
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

      it('')
    })

    describe('DELETE', function () {
      beforeEach(function (done) {
        help.dropDatabase('testdb', function (err) {
          if (err) return done(err)

          help.getBearerToken(function (err, token) {
            if (err) return done(err)

            bearerToken = token

            done()
          })
        })
      })

      it('should remove a single document by ID', function (done) {
        var client = request(connectionString)

        client
          .post('/vtest/testdb/test-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({field1: 'doc to remove'})
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err)

            var doc = res.body.results[0]
            should.exist(doc)
            doc.field1.should.equal('doc to remove')

            client
              .delete('/vtest/testdb/test-schema/' + doc._id)
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(204, done)
          })
      })

      it('should remove a specific document', function (done) {
        help.createDoc(bearerToken, function (err, doc1) {
          if (err) return done(err)
          help.createDoc(bearerToken, function (err, doc2) {
            if (err) return done(err)

            var client = request(connectionString)

            client
              .delete('/vtest/testdb/test-schema/' + doc1._id)
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(204)
              .end(function (err) {
                if (err) return done(err)

                var filter = encodeURIComponent(JSON.stringify({
                  _id: doc2._id
                }))

                client
                  .get('/vtest/testdb/test-schema?filter=' + filter)
                  .set('Authorization', 'Bearer ' + bearerToken)
                  .expect(200)
                  .expect('content-type', 'application/json')
                  .end(function (err, res) {
                    if (err) return done(err)

                    res.body['results'].should.exist
                    res.body['results'].should.be.Array
                    res.body['results'].length.should.equal(1)
                    res.body['results'][0]._id.should.equal(doc2._id)

                    done()
                  })
              })
          })
        })
      })

      it('should remove all documents affected by the query property supplied in the request body', function (done) {
        help.createDoc(bearerToken, function (err, doc) {
          if (err) return done(err)

          var client = request(connectionString)

          client
            .delete('/vtest/testdb/test-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({
              query: {
                _id: doc._id
              }
            })
            .expect(204)
            .end(function (err) {
              if (err) return done(err)

              client
                .get('/vtest/testdb/test-schema/' + doc._id)
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .expect('content-type', 'application/json')
                .end(function (err, res) {
                  if (err) return done(err)

                  res.body.results.should.exist
                  res.body.results.should.be.Array
                  res.body.results.length.should.equal(0)

                  done()
                })
            })
        })
      })

      it('should remove all documents affected by the query property supplied in the request body, translating any internal fields to the prefix defined in config', function (done) {
        var originalPrefix = config.get('internalFieldsPrefix')

        config.set('internalFieldsPrefix', '$')

        help.createDoc(bearerToken, function (err, doc) {
          if (err) return done(err)

          var client = request(connectionString)

          client
            .delete('/vtest/testdb/test-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({
              query: {
                $id: doc.$id
              }
            })
            .expect(204)
            .end(function (err) {
              if (err) return done(err)

              client
                .get('/vtest/testdb/test-schema/' + doc.$id)
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .expect('content-type', 'application/json')
                .end(function (err, res) {
                  if (err) return done(err)

                  res.body.results.should.exist
                  res.body.results.should.be.Array
                  res.body.results.length.should.equal(0)

                  config.set('internalFieldsPrefix', originalPrefix)

                  done()
                })
            })
        })
      })

      it('should return deleted count if config.feedback is true', function (done) {
        var originalFeedback = config.get('feedback')
        config.set('feedback', true)

        var client = request(connectionString)

        client
          .post('/vtest/testdb/test-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({field1: 'doc to remove 2'})
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err)

            var doc = res.body.results[0]

            client
            .post('/vtest/testdb/test-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({field1: 'doc to remain'})
            .expect(200)
            .end(function (err, res) {
              if (err) return done(err)

              client
                .delete('/vtest/testdb/test-schema/' + doc._id)
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                // .expect('content-type', 'application/json')
                .end(function (err, res) {
                  config.set('feedback', originalFeedback)
                  if (err) return done(err)

                  res.body.status.should.equal('success')
                  res.body.deleted.should.equal(1)
                  res.body.totalCount.should.equal(1)
                  done()
                })
            })
          })
        })
    })

    describe('Collection count', function () {
      before(function (done) {
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

    describe('Collection stats', function () {
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
        help.dropDatabase('testdb', function (err) {
          if (err) return done(err)

          help.getBearerTokenWithAccessType('admin', function (err, token) {
            if (err) return done(err)

            bearerToken = token

            // add a new field to the schema
            var jsSchemaString = fs.readFileSync(__dirname + '/../new-schema.json', {encoding: 'utf8'})
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

      after(function (done) {
        // reset the schema
        var jsSchemaString = fs.readFileSync(__dirname + '/../new-schema.json', {encoding: 'utf8'})
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
            cleanup(done)
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
  })

  describe('collections config api', function () {
    // mimic a file that could be sent to the server
    var jsSchemaString = fs.readFileSync(__dirname + '/../new-schema.json', {encoding: 'utf8'})

    var cleanup = function (done) {
      // try to cleanup these tests directory tree
      // don't catch errors here, since the paths may not exist

      var dirs = config.get('paths')

      try {
        fs.unlinkSync(dirs.collections + '/vapicreate/testdb/collection.api-create.json')
      } catch (e) {}

      try {
        fs.unlinkSync(dirs.collections + '/vapicreate/testdb/collection.api-create-model-name.json')
      } catch (e) {}

      try {
        fs.unlinkSync(dirs.collections + '/vapicreate/testdb/collection.api-create-last-modified.json')
      } catch (e) {}

      try {
        fs.unlinkSync(dirs.collections + '/vapicreate/testdb/collection.modelNameFromSchema.json')
      } catch (e) {}

      try {
        fs.rmdirSync(dirs.collections + '/vapicreate/testdb')
      } catch (e) {}

      try {
        fs.rmdirSync(dirs.collections + '/vapicreate')
      } catch (e) {}

      done()
    }

    before(function (done) {
      cleanup(function (err) {
        if (err) return done(err)

        app.start(done)
      })
    })

    after(function (done) {
      app.stop(function (err) {
        if (err) return done(err)

        cleanup(done)
      })
    })

    describe('POST', function () {
      before(function (done) {
        help.getBearerTokenWithAccessType('admin', function (err, token) {
          if (err) return done(err)

          bearerToken = token

          done()
        })
      })

      after(function (done) {
        help.removeTestClients(function (err) {
          if (err) return done(err)
          done()
        })
      })

      it('should validate schema', function (done) {
        var client = request(connectionString)
        var schema = JSON.parse(jsSchemaString)
        delete schema.settings
        var newString = JSON.stringify(schema)

        client
          .post('/vapicreate/testdb/api-create/config')
          .send(newString)
          .set('content-type', 'text/plain')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(400)
          .expect('content-type', 'application/json')
          .end(function (err, res) {
            if (err) return done(err)

            res.body.should.be.Object
            res.body.should.not.be.Array
            should.exist(res.body.errors)

            done()
          })
      })

      it('should error when sort field is specified with no indexes specified', function (done) {
        var client = request(connectionString)
        var schema = JSON.parse(jsSchemaString)
        schema.settings.sort = 'newField'
        var newString = JSON.stringify(schema)

        client
          .post('/vapicreate/testdb/api-create/config')
          .send(newString)
          .set('content-type', 'text/plain')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(400)
          .expect('content-type', 'application/json')
          .end(function (err, res) {
            if (err) return done(err)

            res.body.should.be.Object
            res.body.should.not.be.Array
            should.exist(res.body.errors)
            res.body.errors.should.be.Array

            res.body.errors[0].title.should.eql('Missing Index Key')

            done()
          })
      })

      it('should error when sort field is specified but indexes doesn\'t include it (index style 1)', function (done) {
        var client = request(connectionString)
        var schema = JSON.parse(jsSchemaString)
        schema.settings.sort = 'newField'
        schema.settings.index = {
          "keys": {
            "_createdAt" : 1
          }
        }

        var newString = JSON.stringify(schema)

        client
          .post('/vapicreate/testdb/api-create/config')
          .send(newString)
          .set('content-type', 'text/plain')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(400)
          .expect('content-type', 'application/json')
          .end(function (err, res) {
            if (err) return done(err)

            res.body.should.be.Object
            res.body.should.not.be.Array
            should.exist(res.body.errors)
            res.body.errors.should.be.Array

            res.body.errors[0].title.should.eql('Missing Index Key')

            done()
          })
      })

      it('should error when sort field is specified but indexes doesn\'t include it (index style 2)', function (done) {
        var client = request(connectionString)
        var schema = JSON.parse(jsSchemaString)
        schema.settings.sort = 'newField'
        schema.settings.index = [{
          "keys": {
            "_createdAt" : 1
          }
        }]

        var newString = JSON.stringify(schema)

        client
          .post('/vapicreate/testdb/api-create/config')
          .send(newString)
          .set('content-type', 'text/plain')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(400)
          .expect('content-type', 'application/json')
          .end(function (err, res) {
            if (err) return done(err)

            res.body.should.be.Object
            res.body.should.not.be.Array
            should.exist(res.body.errors)
            res.body.errors.should.be.Array

            res.body.errors[0].title.should.eql('Missing Index Key')

            done()
          })
      })

      it('should not error when sort field is specified and indexes includes it (index style 2)', function (done) {
        var client = request(connectionString)
        var schema = JSON.parse(jsSchemaString)
        schema.settings.sort = 'newField'
        schema.settings.index = [{
          'keys': {
            'newField': 1
          }
        }]

        var newString = JSON.stringify(schema)

        client
          .post('/vapicreate/testdb/api-create/config')
          .send(newString)
          .set('content-type', 'text/plain')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .expect('content-type', 'application/json')
          .end(function (err, res) {
            if (err) return done(err)

            should.exist(res.body.result)
            res.body.result.should.eql('success')

            done()
          })
      })

      it('should allow creating a new collection endpoint', function (done) {
        var client = request(connectionString)

        client
          .post('/vapicreate/testdb/api-create/config')
          .send(jsSchemaString)
          .set('content-type', 'text/plain')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .expect('content-type', 'application/json')
          .end(function (err, res) {
            if (err) return done(err)

            // Wait for a few seconds then make request to test that the new endpoint is working
            setTimeout(function () {
              client
                .get('/vapicreate/testdb/api-create')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .expect('content-type', 'application/json')
                .end(done)
            }, 300)
          })
      })

      it('should use collection schema filename as model name', function (done) {
        var client = request(connectionString)

        client
          .post('/vapicreate/testdb/api-create-model-name/config')
          .send(jsSchemaString)
          .set('content-type', 'text/plain')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .expect('content-type', 'application/json')
          .end(function (err, res) {
            if (err) return done(err)

            var body = JSON.stringify(res.body)
            var index = body.indexOf('api-create-model-name collection created')
            index.should.be.above(0)

            done()
          })
      })

      it('should use property from schema file as model name', function (done) {
        var client = request(connectionString)

        var schema = JSON.parse(jsSchemaString)
        schema['model'] = 'modelNameFromSchema'
        jsSchemaString = JSON.stringify(schema)

        client
          .post('/vapicreate/testdb/api-create-model-name/config')
          .send(jsSchemaString)
          .set('content-type', 'text/plain')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .expect('content-type', 'application/json')
          .end(function (err, res) {
            if (err) return done(err)

            var body = JSON.stringify(res.body)

            var index = body.indexOf('modelNameFromSchema collection created')
            index.should.be.above(0)

            done()
          })
      })

      it('should add lastModifiedAt to schema', function (done) {
        var client = request(connectionString)

        var schema = JSON.parse(jsSchemaString)
        delete schema.model
        jsSchemaString = JSON.stringify(schema)

        client
          .post('/vapicreate/testdb/api-create-last-modified/config')
          .send(jsSchemaString)
          .set('content-type', 'text/plain')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err)

            setTimeout(function () {
              client
                .get('/vapicreate/testdb/api-create-last-modified/config')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .end(function (err, res) {
                  if (err) return done(err)

                  res.body.settings.lastModifiedAt.should.exist

                  done()
                })
            }, 1000)
          })
      })

      it('should allow updating a new collection endpoint', function (done) {
        var client = request(connectionString)

        // first make sure the current schema is working
        client
          .post('/vapicreate/testdb/api-create')
          .send({
            updatedField: 'foo'
          })
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(400)
          .end(function (err, res) {
            if (err) return done(err)

            // view the schema
            client
              .get('/vapicreate/testdb/api-create/config')
              .set('Authorization', 'Bearer ' + bearerToken)
              .end(function (err, res) {
                var modifiedDate = res.body.settings.lastModifiedAt

                // add a new field to the schema
                var schema = JSON.parse(jsSchemaString)
                schema.fields.updatedField = _.extend({}, schema.fields.newField, {
                  type: 'Number',
                  required: true
                })

                client
                  .post('/vapicreate/testdb/api-create/config')
                  .send(JSON.stringify(schema))
                  .set('content-type', 'text/plain')
                  .set('Authorization', 'Bearer ' + bearerToken)
                  .expect(200)
                  .expect('content-type', 'application/json')
                  .end(function (err, res) {
                    if (err) return done(err)

                    // Wait, then test that the schema was updated
                    setTimeout(function () {
                      client
                        .post('/vapicreate/testdb/api-create')
                        .send({
                          updatedField: 123
                        })
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .expect(200)
                        .expect('content-type', 'application/json')
                        .end(function (err, res) {
                          res.body.results[0].updatedField.should.eql(123)

                          // view the updated schema
                          client
                            .get('/vapicreate/testdb/api-create/config')
                            .set('Authorization', 'Bearer ' + bearerToken)
                            .end(function (err, res) {
                              (modifiedDate !== res.body.settings.lastModifiedAt).should.eql(true)

                              done()
                            })
                        })
                    }, 300)
                  })
              })
          })
      })
    })

    describe('GET', function () {
      it('should return the schema file', function (done) {
        help.getBearerTokenWithAccessType('admin', function (err, token) {
          request(connectionString)
          .get('/vtest/testdb/test-schema/config')
          .set('Authorization', 'Bearer ' + token)
          .expect(200)
          .expect('content-type', 'application/json')
          .end(function (err, res) {
            if (err) return done(err)

            res.body.should.be.Object
            res.body.should.not.be.Array
            should.exist(res.body.fields)
            should.exist(res.body.settings)

            done()
          })
        })
      })

      it('should only allow authenticated users access', function (done) {
        request(connectionString)
          .get('/vtest/testdb/test-schema/config')
          .set('Authorization', 'Bearer e91e69b4-6563-43bd-a793-cb2af4ba62f4') // invalid token
          .expect(401, done)
      })
    })

    describe('DELETE', function () {
      it('should allow removing endpoints', function (done) {
        help.getBearerTokenWithAccessType('admin', function (err, bearerToken) {
          var client = request(connectionString)

          // make sure the api is working as expected
          client
            .post('/vapicreate/testdb/api-create')
            .send({
              updatedField: 123
            })
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .expect('content-type', 'application/json')
            .end(function (err) {
              if (err) return done(err)

              // send request to remove the endpoint
              client
                .delete('/vapicreate/testdb/api-create/config')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .expect('content-type', 'application/json')
                .end(function (err, res) {
                  if (err) return done(err)

                  setTimeout(function () {
                    client

                      // NOTE: cache invalidation is done via ttl, so this endpoint will be removed after ttl has elapsed
                      .get('/vapicreate/testdb/api-create?cache=false')
                      .set('Authorization', 'Bearer ' + bearerToken)
                      .expect(404)
                      .end(done)
                  }, 300)
                })
            })
        })
      })
    })
  })

  describe('endpoint api', function () {
    before(function (done) {
      app.start(done)
    })

    after(function (done) {
      app.stop(done)
    })

    it('should return hello world', function (done) {
      help.getBearerTokenWithAccessType('admin', function (err, bearerToken) {
        request(connectionString)
        .get('/v1/test-endpoint')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)
          res.body.message.should.equal('Hello World')
          done()
        })
      })
    })

    it('should require authentication by default', function (done) {
      help.getBearerTokenWithAccessType('admin', function (err, bearerToken) {
        request(connectionString)
        .get('/v1/test-endpoint')
        // .set('Authorization', 'Bearer ' + bearerToken)
        .expect(401)
        .end(done)
      })
    })

    it('should allow unauthenticated requests if configured', function (done) {
      var client = request(connectionString)
      client
        .get('/v1/test-endpoint-unauth')
        .expect(200)
        .end(done)
    })

    it('should allow custom routing via config() function', function (done) {
      help.getBearerTokenWithAccessType('admin', function (err, bearerToken) {
        request(connectionString)
        .get('/v1/new-endpoint-routing/55bb8f0a8d76f74b1303a135')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)
          res.body.message.should.equal('Endpoint with custom route provided through config() function...ID passed = 55bb8f0a8d76f74b1303a135')
          done()
        })
      })
    })
  })

  describe('endpoint config api', function () {
    // mimic a file that could be sent to the server
    var jsSchemaString = fs.readFileSync(__dirname + '/../new-endpoint.js', {encoding: 'utf8'})

    var cleanup = function (done) {
      var dirs = config.get('paths')

      // try to cleanup these tests directory tree
      try {
        fs.unlinkSync(dirs.endpoints + '/v1/endpoint.new-endpoint.js')
      } catch (err) {}

      try {
        fs.unlinkSync(dirs.endpoints + '/v1/endpoint.new-endpoint-with-docs.js')
      } catch (err) {}

      try {
        fs.unlinkSync(dirs.endpoints + '/v2/endpoint.new-endpoint.js')
      } catch (err) {}

      try {
        fs.rmdirSync(dirs.endpoints + '/v2')
      } catch (err) {}
      done()
    }

    before(function (done) {
      app.start(function () {
        help.getBearerTokenWithAccessType('admin', function (err, token) {
          if (err) return done(err)

          bearerToken = token
          done()
        })
      })
    })

    after(function (done) {
      app.stop(function (err) {
        if (err) return done(err)

        cleanup(done)
      })
    })

    describe('POST', function () {
      it('should allow creating a new custom endpoint', function (done) {
        help.getBearerTokenWithAccessType('admin', function (err, bearerToken) {
          var client = request(connectionString)
          // make sure the endpoint is not already there
          client
          .get('/v1/new-endpoint?cache=false')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(404)
          .end(function (err) {
            if (err) return done(err)

            // create endpoint
            client
              .post('/v1/new-endpoint/config')
              .send(jsSchemaString)
              .set('content-type', 'text/plain')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .end(function (err, res) {
                if (err) return done(err)

                res.body.message.should.equal('Endpoint "v1:new-endpoint" created')

                // wait, then test that endpoint was created
                setTimeout(function () {
                  client
                    .get('/v1/new-endpoint?cache=false')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    // .expect('content-type', 'application/json')
                    .end(function (err, res) {
                      if (err) return done(err)

                      res.body.message.should.equal('endpoint created through the API')
                      done()
                    })
                }, 1500)
              })
          })
        })
      })

      it('should pass inline documentation to the stack', function (done) {
        this.timeout(2000)
        help.getBearerTokenWithAccessType('admin', function (err, bearerToken) {
          request(connectionString)
          .get('/v1/test-endpoint-with-docs?cache=false')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err)

            var docs = app.docs['/v1/test-endpoint-with-docs']
            docs.should.exist
            docs.should.be.Array

            docs[0].lead.should.eql('Adds two numbers together.')

            done()
          })
        })
      })

      it('should allow updating an endpoint', function (done) {
        this.timeout(8000)
        help.getBearerTokenWithAccessType('admin', function (err, bearerToken) {
          var client = request(connectionString)
          // make sure the endpoint exists from last test
          client
          .get('/v1/new-endpoint?cache=false')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err)

            // get an updated version of the file
            var fileArr = jsSchemaString.split('\n')
            fileArr[0] = "var message = {message: 'endpoint updated through the API'}"
            jsSchemaString = fileArr.join('\n')

            // update endpoint
            client
              .post('/v1/new-endpoint/config')
              .send(jsSchemaString)
              .set('content-type', 'text/plain')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .end(function (err, res) {
                if (err) return done(err)

                // wait, then test that endpoint was created
                setTimeout(function () {
                  client
                    .get('/v1/new-endpoint?cache=false')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .end(function (err, res) {
                      if (err) return done(err)

                      res.statusCode.should.eql(200)
                      res.body.message.should.equal('endpoint updated through the API')
                      done()
                    })
                }, 3000)
              })
          })
        })
      })

      it('should allow creating a new endpoint for a new version number', function (done) {
        help.getBearerTokenWithAccessType('admin', function (err, bearerToken) {
          var client = request(connectionString)
          // make sure the endpoint is not already there
          client
          .get('/v2/new-endpoint?cache=false')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(404)
          .end(function (err) {
            if (err) return done(err)

            // create endpoint
            client
              .post('/v2/new-endpoint/config')
              .send(jsSchemaString)
              .set('content-type', 'text/plain')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .end(function (err, res) {
                if (err) return done(err)

                res.body.message.should.equal('Endpoint "v2:new-endpoint" created')

                // wait, then test that endpoint was created
                setTimeout(function () {
                  client
                    .get('/v2/new-endpoint?cache=false')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .expect('content-type', 'application/json')
                    .end(function (err, res) {
                      if (err) return done(err)

                      res.body.message.should.equal('endpoint updated through the API')
                      done()
                    })
                }, 1500)
              })
          })
        })
      })
    })

    describe('GET', function () {
      it('should NOT return the Javascript file backing the endpoint', function (done) {
        help.getBearerTokenWithAccessType('admin', function (err, bearerToken) {
          request(connectionString)
          .get('/v1/test-endpoint/config?cache=false')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(404)
          .end(done)
        })
      })

      it('should return all loaded endpoints', function (done) {
        help.getBearerTokenWithAccessType('admin', function (err, bearerToken) {
          request(connectionString)
          .get('/api/endpoints')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .expect('content-type', 'application/json')
          .end(function (err, res) {
            if (err) return done(err)

            res.body.should.be.Object
            res.body.endpoints.should.be.Array

            _.each(res.body.endpoints, function (endpoint) {
              should.exist(endpoint.version)
              should.exist(endpoint.name)
              should.exist(endpoint.path)
            })

            var endpointWithDisplayName = _.find(res.body.endpoints, function (endpoint) {
              return endpoint.name === 'Test Endpoint'
            })

            should.exist(endpointWithDisplayName)

            done()
          })
        })
      })
    })

    describe('DELETE', function () {
      it('should NOT remove the custom endpoint', function (done) {
        help.getBearerTokenWithAccessType('admin', function (err, bearerToken) {
          request(connectionString)
          .delete('/v1/test-endpoint/config')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(404)
          .end(done)
        })
      })
    })
  })

  describe('hooks config api', function () {
    before(function (done) {
      app.start(function () {
        help.getBearerTokenWithAccessType('admin', function (err, token) {
          if (err) return done(err)

          bearerToken = token
          done()
        })
      })
    })

    after(function (done) {
      app.stop(function (err) {
        if (err) return done(err)
        done()
      })
    })

    it('should return all loaded hooks', function (done) {
      request(connectionString)
      .get('/api/hooks')
      .set('Authorization', 'Bearer ' + bearerToken)
      .expect(200)
      .expect('content-type', 'application/json')
      .end(function (err, res) {
        if (err) return done(err)

        res.body.should.be.Object
        res.body.hooks.should.be.Array

        _.each(res.body.hooks, function (hook) {
          should.exist(hook.name)
        })
        done()
      })
    })

    it('should return 405 if request method is not supported', function (done) {
      request(connectionString)
      .put('/api/hooks')
      .set('Authorization', 'Bearer ' + bearerToken)
      .expect(405, done)
    })

    it('should return 404 if specified hook is not found', function (done) {
      request(connectionString)
      .get('/api/hooks/xx/config')
      .set('Authorization', 'Bearer ' + bearerToken)
      .expect(404, done)
    })

    it('should return the hook as text if specified hook is found', function (done) {
      request(connectionString)
      .get('/api/hooks/slugify/config')
      .set('Authorization', 'Bearer ' + bearerToken)
      .end(function (err, res) {
        res.statusCode.should.eql(200)
        res.text.should.not.eql('')
        done()
      })
    })

    it('should create a hook with a POST request', function (done) {
      const hookName = 'myHook1'
      const hookContent = `
        module.exports = (obj, type, data) => {
          return obj
        }
      `.trim()

      request(connectionString)
      .post(`/api/hooks/${hookName}/config`)
      .send(hookContent)
      .set('content-type', 'text/plain')
      .set('Authorization', 'Bearer ' + bearerToken)
      .end(function (err, res) {
        res.statusCode.should.eql(200)
        res.text.should.eql('')

        setTimeout(() => {
          request(connectionString)
          .get(`/api/hooks/${hookName}/config`)
          .set('Authorization', 'Bearer ' + bearerToken)
          .end((err, res) => {
            res.statusCode.should.eql(200)
            res.text.should.eql(hookContent)

            const hooksPath = config.get('paths.hooks')

            // Deleting hook file
            fs.unlinkSync(path.join(hooksPath, `${hookName}.js`))

            // Give it some time for the monitor to kick in
            setTimeout(() => {
              done()
            }, 200)
          })
        }, 200)
      })
    })

    it('should return 409 when sending a POST request to a hook that already exists', function (done) {
      const hookName = 'myHook1'
      const hookContent = `
        module.exports = (obj, type, data) => {
          return obj
        }
      `.trim()

      request(connectionString)
      .post(`/api/hooks/${hookName}/config`)
      .send(hookContent)
      .set('content-type', 'text/plain')
      .set('Authorization', 'Bearer ' + bearerToken)
      .end(function (err, res) {
        setTimeout(() => {
          request(connectionString)
          .post(`/api/hooks/${hookName}/config`)
          .send(hookContent)
          .set('content-type', 'text/plain')
          .set('Authorization', 'Bearer ' + bearerToken)
          .end((err, res) => {
            res.statusCode.should.eql(409)

            const hooksPath = config.get('paths.hooks')

            // Deleting hook file
            fs.unlinkSync(path.join(hooksPath, `${hookName}.js`))

            // Give it some time for the monitor to kick in
            setTimeout(() => {
              done()
            }, 200)
          })
        }, 200)
      })
    })

    it('should update a hook with a PUT request', function (done) {
      const hookName = 'myHook1'
      const hookOriginalContent = `
        module.exports = (obj, type, data) => {
          return obj
        }
      `.trim()
      const hookUpdatedContent = `
        module.exports = (obj, type, data) => {
          obj = 'Something else'

          return obj
        }
      `.trim()

      request(connectionString)
      .post(`/api/hooks/${hookName}/config`)
      .send(hookOriginalContent)
      .set('content-type', 'text/plain')
      .set('Authorization', 'Bearer ' + bearerToken)
      .end((err, res) => {
        setTimeout(() => {
          request(connectionString)
          .put(`/api/hooks/${hookName}/config`)
          .set('content-type', 'text/plain')
          .send(hookUpdatedContent)
          .set('Authorization', 'Bearer ' + bearerToken)
          .end((err, res) => {
            res.statusCode.should.eql(200)
            res.text.should.eql('')

            setTimeout(() => {
              request(connectionString)
              .get(`/api/hooks/${hookName}/config`)
              .set('Authorization', 'Bearer ' + bearerToken)
              .end((err, res) => {
                res.statusCode.should.eql(200)
                res.text.should.eql(hookUpdatedContent)

                const hooksPath = config.get('paths.hooks')

                // Deleting hook file
                fs.unlinkSync(path.join(hooksPath, `${hookName}.js`))

                // Give it some time for the monitor to kick in
                setTimeout(() => {
                  done()
                }, 200)
              })
            }, 200)
          })
        }, 200)
      })
    })

    it('should return 404 when sending a PUT request to a hook that does not exist', function (done) {
      const hookName = 'myHook1'
      const hookUpdatedContent = `
        module.exports = (obj, type, data) => {
          return obj
        }
      `.trim()

      request(connectionString)
      .put(`/api/hooks/${hookName}/config`)
      .send(hookUpdatedContent)
      .set('content-type', 'text/plain')
      .set('Authorization', 'Bearer ' + bearerToken)
      .end(function (err, res) {
        res.statusCode.should.eql(404)

        done()
      })
    })

    it('should delete a hook with a DELETE request', function (done) {
      const hookName = 'myHook1'
      const hookContent = `
        module.exports = (obj, type, data) => {
          return obj
        }
      `.trim()

      request(connectionString)
      .post(`/api/hooks/${hookName}/config`)
      .send(hookContent)
      .set('content-type', 'text/plain')
      .set('Authorization', 'Bearer ' + bearerToken)
      .end((err, res) => {
        setTimeout(() => {
          request(connectionString)
          .delete(`/api/hooks/${hookName}/config`)
          .set('Authorization', 'Bearer ' + bearerToken)
          .end((err, res) => {
            res.statusCode.should.eql(200)
            res.text.should.eql('')

            setTimeout(() => {
              request(connectionString)
              .get(`/api/hooks/${hookName}/config`)
              .set('Authorization', 'Bearer ' + bearerToken)
              .end((err, res) => {
                res.statusCode.should.eql(404)

                done()
              })
            }, 200)
          })
        }, 200)
      })
    })

    it('should return 404 when sending a DELETE request to a hook that does not exist', function (done) {
      const hookName = 'myHook1'

      request(connectionString)
      .delete(`/api/hooks/${hookName}/config`)
      .set('Authorization', 'Bearer ' + bearerToken)
      .end(function (err, res) {
        res.statusCode.should.eql(404)

        done()
      })
    })
  })

  describe('config api', function () {
    var config = require(__dirname + '/../../config.js')
    var configPath = path.resolve(config.configPath())
    var originalConfig = fs.readFileSync(configPath).toString()

    beforeEach(function (done) {
      app.start(done)
    })

    afterEach(function (done) {
      // restore the config file to its original state
      fs.writeFileSync(configPath, originalConfig)
      app.stop(done)
    })

    describe('GET', function () {
      it('should return the current config', function (done) {
        help.getBearerTokenWithAccessType('admin', function (err, token) {
          if (err) return done(err)

          bearerToken = token

          request(connectionString)
            .get('/api/config')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .expect('content-type', 'application/json')
            .end(function (err, res) {
              if (err) return done(err)

              res.body.should.be.Object
              should.exist(res.body.datastore)
              should.exist(res.body.logging)
              should.exist(res.body.server)
              should.exist(res.body.auth)
              should.exist(res.body.caching)
              // should.deepEqual(res.body, config)

              done()
            })
        })
      })

      it('should load a domain-specific config', function (done) {
        var testConfigPath = './config/config.test.json'
        var domainConfigPath

        function loadConfig (server) {
          domainConfigPath = './config/' + server.host + ':' + server.port + '.json'

          try {
            var testConfig = JSON.parse(fs.readFileSync(testConfigPath, { encoding: 'utf-8'}))
            testConfig.app.name = 'Domain Loaded Config'
            fs.writeFileSync(domainConfigPath, JSON.stringify(testConfig, null, 2))
          } catch (err) {
            console.log(err)
          }
        }

        loadConfig(config.get('server'))

        help.getBearerTokenWithAccessType('admin', function (err, token) {
          if (err) return done(err)

          bearerToken = token

          delete require.cache[__dirname + '/../../config']

          setTimeout(function () {
            request(connectionString)
              .get('/api/config')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .expect('content-type', 'application/json')
              .end(function (err, res) {
                if (err) return done(err)

                try {
                  fs.unlinkSync(domainConfigPath)
                } catch (err) {
                  console.log(err)
                }

                res.body.should.be.Object
                should.exist(res.body.app)
                res.body.app.name.should.eql('Domain Loaded Config')

                done()
              })
          }, 200)
        })
      })

      it('should only allow authenticated users access', function (done) {
        request(connectionString)
          .get('/api/config')
          .set('Authorization', 'Bearer e91e69b4-6563-43bd-a793-cb2af4ba62f4') // invalid token
          .expect(401)
          .end(function (err, res) {
            if (err) return done(err)
            done()
          })
      })
    })

    describe('POST', function () {
      it('should allow updating the main config file', function (done) {
        var client = request(connectionString)

        client
          .get('/api/config')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .expect('content-type', 'application/json')
          .end(function (err, res) {
            if (err) return done(err)

            should.exist(res.body)
            res.body.auth.tokenTtl = 100

            client
              .post('/api/config')
              .set('Authorization', 'Bearer ' + bearerToken)
              .set('content-type', 'application/json')
              .send(res.body)
              .expect(200)
              .expect('content-type', 'application/json')
              .end(function (err, res) {
                if (err) return done(err)

                res.body.result.should.equal('success')

                // reload the config file and see that it is updated
                delete require.cache[configPath]
                config.loadFile(configPath)

                config.get('auth.tokenTtl').should.equal(100)
                done()
              })
          })
      })
    })
  })
})
