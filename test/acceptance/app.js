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
        fs.unlinkSync(dirs.collections + '/vapicreate/testdb/collection.api-create-no-settings.json')
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

    beforeEach(function (done) {
      cleanup(function (err) {
        if (err) return done(err)

        app.start(done)
      })
    })

    afterEach(function (done) {
      app.stop(function (err) {
        if (err) return done(err)

        cleanup(done)
      })
    })

    describe('POST', function () {
      beforeEach(function (done) {
        help.getBearerToken(function (err, token) {
          if (err) return done(err)

          bearerToken = token

          done()
        })
      })

      afterEach(function (done) {
        help.removeTestClients(function (err) {
          if (err) return done(err)
          done()
        })
      })

      it('should validate schema', function (done) {
        var client = request(connectionString)
        var schema = JSON.parse(jsSchemaString)
        delete schema.fields
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
          'keys': {
            '_createdAt': 1
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
          'keys': {
            '_createdAt': 1
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
          .expect(201)
          .expect('content-type', 'application/json')
          .end(function (err, res) {
            if (err) return done(err)

            res.body.success.should.eql(true)

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
          .expect(201)
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
                .end((err, res) => {
                  done()
                })
            }, 300)
          })
      })

      it('should allow creating a new collection without a settings block', function (done) {
        let client = request(connectionString)
        let schemaWithoutSettings = JSON.parse(jsSchemaString)

        delete schemaWithoutSettings.settings

        schemaWithoutSettings = JSON.stringify(schemaWithoutSettings)

        client
          .post('/vapicreate/testdb/api-create-no-settings/config')
          .send(schemaWithoutSettings)
          .set('content-type', 'text/plain')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(201)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            if (err) return done(err)

            // Wait for a few seconds then make request to test that the new endpoint is working
            setTimeout(function () {
              client
              .post('/vapicreate/testdb/api-create-no-settings')
              .send({newField: 'hello'})
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                client
                .get('/vapicreate/testdb/api-create-no-settings')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .expect('content-type', 'application/json')
                .end((err, res) => {
                  res.body.results.length.should.eql(1)
                  res.body.results[0].newField.should.eql('hello')

                  done()
                })
              })
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
          .expect(201)
          .expect('content-type', 'application/json')
          .end(function (err, res) {
            if (err) return done(err)

            res.body.success.should.eql(true)
            res.body.message.includes('api-create-model-name').should.eql(true)

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
          .expect(201)
          .expect('content-type', 'application/json')
          .end(function (err, res) {
            if (err) return done(err)

            res.body.success.should.eql(true)
            res.body.message.includes('modelNameFromSchema').should.eql(true)

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
          .expect(201)
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

        client
          .post('/vapicreate/testdb/api-create/config')
          .send(jsSchemaString)
          .set('content-type', 'text/plain')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(201)
          .expect('content-type', 'application/json')
          .end(function (err, res) {
            if (err) return done(err)

            setTimeout(() => {
              // First make sure the current schema is working. At this
              // point, `updatedField` doesn't exist in the schema.
              client
                .post('/vapicreate/testdb/api-create')
                .send({
                  updatedField: 123
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
            }, 500)
          })
      })
    })

    describe('GET', function () {
      it('should return the schema file', function (done) {
        help.getBearerToken(function (err, token) {
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
        var client = request(connectionString)

        client
          .post('/vapicreate/testdb/api-create/config')
          .send(jsSchemaString)
          .set('content-type', 'text/plain')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(201)
          .expect('content-type', 'application/json')
          .end(function (err, res) {
            if (err) return done(err)

            setTimeout(() => {
              client
                .post('/vapicreate/testdb/api-create')
                .send({
                  updatedField: 123
                })
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .expect('content-type', 'application/json')
                .end(function (err, res) {
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
            }, 500)
          })
      })
    })
  })

  describe('endpoint api', function () {
    before(function (done) {
      app.start(() => setTimeout(done, 500))
    })

    after(function (done) {
      app.stop(done)
    })

    it('should return hello world', function (done) {
      help.getBearerToken(function (err, bearerToken) {
        request(connectionString)
        .get('/v1/test-endpoint')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err)
          res.headers['content-type'].should.eql('application/json')
          res.body.message.should.equal('Hello World')
          done()
        })
      })
    })

    it('should require authentication by default', function (done) {
      help.getBearerToken(function (err, bearerToken) {
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
      help.getBearerToken(function (err, bearerToken) {
        request(connectionString)
        .get('/v1/new-endpoint-routing/55bb8f0a8d76f74b1303a135')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        //.expect('content-type', 'application/json')
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
        help.getBearerToken(function (err, token) {
          if (err) return done(err)

          bearerToken = token

          setTimeout(done, 500)
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
        help.getBearerToken(function (err, bearerToken) {
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
        help.getBearerToken(function (err, bearerToken) {
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
        help.getBearerToken(function (err, bearerToken) {
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
        help.getBearerToken(function (err, bearerToken) {
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
        help.getBearerToken(function (err, bearerToken) {
          request(connectionString)
          .get('/v1/test-endpoint/config?cache=false')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(404)
          .end(done)
        })
      })

      it('should return all loaded endpoints', function (done) {
        help.getBearerToken(function (err, bearerToken) {
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
        help.getBearerToken(function (err, bearerToken) {
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
        help.getBearerToken(function (err, token) {
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
        help.getBearerToken(function (err, token) {
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

        help.getBearerToken(function (err, token) {
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

                res.body.success.should.eql(true)

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
