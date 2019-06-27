const should = require('should')
const sinon = require('sinon')
const fs = require('fs')
const path = require('path')
const request = require('supertest')
const config = require(__dirname + '/../../config')
const help = require(__dirname + '/help')
const app = require(__dirname + '/../../dadi/lib/')

// variables scoped for use throughout tests
let bearerToken
const connectionString =
  'http://' + config.get('server.host') + ':' + config.get('server.port')
let lastModifiedAt = 0

describe('Application', function() {
  this.timeout(10000)

  before(function(done) {
    // read "lastModifiedAt": 1466832329170
    // of workspace/collections/vtest/testdb
    const dirs = config.get('paths')
    const schemaPath = path.resolve(
      dirs.collections + '/vtest/testdb/collection.test-schema.json'
    )
    const schema = JSON.parse(fs.readFileSync(schemaPath).toString())

    lastModifiedAt = schema.settings.lastModifiedAt
    done()
  })

  after(function(done) {
    // reset "lastModifiedAt": 1466832329170
    // of workspace/collections/vtest/testdb
    const dirs = config.get('paths')
    const schemaPath = path.resolve(
      dirs.collections + '/vtest/testdb/collection.test-schema.json'
    )
    const schema = JSON.parse(fs.readFileSync(schemaPath).toString())

    schema.settings.lastModifiedAt = lastModifiedAt
    fs.writeFileSync(schemaPath, JSON.stringify(schema, null, 2))

    help.removeTestClients(done)
  })

  it('should start from specific directory', function(done) {
    app.start(function(err) {
      if (err) return done(err)

      // give it a moment for http.Server to finish starting
      setTimeout(function() {
        app.stop(done)
      }, 200)
    })
  })

  it('should start a server', function(done) {
    app.start(function(err) {
      if (err) return done(err)

      setTimeout(function() {
        const client = request(connectionString)

        client
          .get('/api/config')

          // just need to test that we get some kind of response
          .expect(401)
          .end(function(err) {
            if (err) done = done.bind(this, err)
            app.stop(done)
          })
      }, 500)
    })
  })

  it('should respond to the /hello endpoint', function(done) {
    app.start(function(err) {
      if (err) return done(err)

      setTimeout(function() {
        const client = request(connectionString)

        client
          .get('/hello')
          .expect(200)
          .end(function(err) {
            if (err) done = done.bind(this, err)
            app.stop(done)
          })
      }, 500)
    })
  })

  describe('collection initialisation', function() {
    const dirs = config.get('paths')
    const newSchemaPath =
      dirs.collections + '/vtest/testdb/collection.new-test-schema.json'

    before(function(done) {
      // Add a schema file to the collection path
      const newSchema = JSON.parse(
        JSON.stringify(
          require(path.resolve(
            dirs.collections + '/../schemas/collection.new-test-schema.json'
          ))
        )
      )

      fs.writeFileSync(newSchemaPath, JSON.stringify(newSchema))

      app.start(done)
    })

    after(function(done) {
      if (fs.existsSync(newSchemaPath)) fs.unlinkSync(newSchemaPath)

      app.stop(done)
    })

    describe('on app start', function() {
      before(function(done) {
        help.dropDatabase('testdb', function(err) {
          if (err) return done(err)

          help.getBearerToken(function(err, token) {
            if (err) return done(err)

            bearerToken = token

            done()
          })
        })
      })

      it('should initialise model using collection schema filename as model name', function(done) {
        const loadedModels = Object.keys(app.components)
          .map(key => {
            if (app.components[key].model) {
              return app.components[key]
            }

            return undefined
          })
          .filter(Boolean)

        const component = loadedModels.find(c => c.model.name === 'test-schema')

        component.model.name.should.equal('test-schema')

        done()
      })

      it('should initialise model using property from schema file as model name', function(done) {
        const loadedModels = Object.keys(app.components)
          .map(key => {
            if (app.components[key].model) {
              return app.components[key]
            }

            return undefined
          })
          .filter(Boolean)

        const component = loadedModels.find(
          c => c.model.name === 'modelNameFromSchema'
        )

        component.model.name.should.equal('modelNameFromSchema')

        done()
      })
    })
  })

  describe('collections config api', function() {
    // mimic a file that could be sent to the server
    const jsSchemaString = fs.readFileSync(__dirname + '/../new-schema.json', {
      encoding: 'utf8'
    })

    const cleanup = function(done) {
      // try to cleanup these tests directory tree
      // don't catch errors here, since the paths may not exist

      const dirs = config.get('paths')

      try {
        fs.unlinkSync(
          dirs.collections + '/vapicreate/testdb/collection.api-create.json'
        )
      } catch (_) {
        // noop
      }

      try {
        fs.unlinkSync(
          dirs.collections +
            '/vapicreate/testdb/collection.api-create-no-settings.json'
        )
      } catch (_) {
        // noop
      }

      try {
        fs.unlinkSync(
          dirs.collections +
            '/vapicreate/testdb/collection.api-create-model-name.json'
        )
      } catch (_) {
        // noop
      }

      try {
        fs.unlinkSync(
          dirs.collections +
            '/vapicreate/testdb/collection.api-create-last-modified.json'
        )
      } catch (_) {
        // noop
      }

      try {
        fs.unlinkSync(
          dirs.collections +
            '/vapicreate/testdb/collection.modelNameFromSchema.json'
        )
      } catch (_) {
        // noop
      }

      try {
        fs.rmdirSync(dirs.collections + '/vapicreate/testdb')
      } catch (_) {
        // noop
      }

      try {
        fs.rmdirSync(dirs.collections + '/vapicreate')
      } catch (_) {
        // noop
      }

      done()
    }

    beforeEach(function(done) {
      cleanup(function(err) {
        if (err) return done(err)

        app.start(done)
      })
    })

    afterEach(function(done) {
      app.stop(function(err) {
        if (err) return done(err)

        cleanup(done)
      })
    })

    describe('POST', function() {
      it('should not accept the creation of a new collection', function(done) {
        const client = request(connectionString)
        const schema = JSON.parse(jsSchemaString)

        delete schema.fields
        const newString = JSON.stringify(schema)

        client
          .post('/vapicreate/testdb/api-create/config')
          .send(newString)
          .set('content-type', 'text/plain')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(404, done)
      })
    })

    describe('GET', function() {
      it('should return the schema file', function(done) {
        help.getBearerToken(function(err, token) {
          request(connectionString)
            .get('/vtest/testdb/test-schema/config')
            .set('Authorization', 'Bearer ' + token)
            .expect(200)
            .expect('content-type', 'application/json')
            .end(function(err, res) {
              if (err) return done(err)

              res.body.should.be.Object
              res.body.should.not.be.Array
              should.exist(res.body.fields)
              should.exist(res.body.settings)

              done()
            })
        })
      })

      it('should only allow authenticated users access', function(done) {
        request(connectionString)
          .get('/vtest/testdb/test-schema/config')
          .set('Authorization', 'Bearer e91e69b4-6563-43bd-a793-cb2af4ba62f4') // invalid token
          .expect(401, done)
      })
    })

    describe('DELETE', function() {
      it('should not allow removing endpoints', function(done) {
        const client = request(connectionString)

        client
          .delete('/vapicreate/testdb/api-create/config')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(404, done)
      })
    })
  })

  describe('endpoint api', function() {
    before(function(done) {
      app.start(() => setTimeout(done, 500))
    })

    after(function(done) {
      app.stop(done)
    })

    it('should return hello world', function(done) {
      help.getBearerToken(function(err, bearerToken) {
        request(connectionString)
          .get('/v1/test-endpoint')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end(function(err, res) {
            if (err) return done(err)
            res.headers['content-type'].should.eql('application/json')
            res.body.message.should.equal('Hello World')
            done()
          })
      })
    })

    it('should require authentication by default', function(done) {
      help.getBearerToken(function(err, bearerToken) {
        request(connectionString)
          .get('/v1/test-endpoint')
          // .set('Authorization', 'Bearer ' + bearerToken)
          .expect(401)
          .end(done)
      })
    })

    it('should allow unauthenticated requests if configured', function(done) {
      const client = request(connectionString)

      client
        .get('/v1/test-endpoint-unauth')
        .expect(200)
        .end(done)
    })

    it('should allow custom routing via config() function', function(done) {
      help.getBearerToken(function(err, bearerToken) {
        request(connectionString)
          .get('/v1/new-endpoint-routing/55bb8f0a8d76f74b1303a135')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          // .expect('content-type', 'application/json')
          .end(function(err, res) {
            if (err) return done(err)
            res.body.message.should.equal(
              'Endpoint with custom route provided through config() function...ID passed = 55bb8f0a8d76f74b1303a135'
            )
            done()
          })
      })
    })
  })

  describe('endpoint config api', function() {
    // mimic a file that could be sent to the server
    let jsSchemaString = fs.readFileSync(__dirname + '/../new-endpoint.js', {
      encoding: 'utf8'
    })

    const cleanup = function(done) {
      const dirs = config.get('paths')

      // try to cleanup these tests directory tree
      try {
        fs.unlinkSync(dirs.endpoints + '/v1/endpoint.new-endpoint.js')
      } catch (err) {
        // noop
      }

      try {
        fs.unlinkSync(dirs.endpoints + '/v1/endpoint.new-endpoint-with-docs.js')
      } catch (err) {
        // noop
      }

      try {
        fs.unlinkSync(dirs.endpoints + '/v2/endpoint.new-endpoint.js')
      } catch (err) {
        // noop
      }

      try {
        fs.rmdirSync(dirs.endpoints + '/v2')
      } catch (err) {
        // noop
      }

      done()
    }

    before(function(done) {
      app.start(function() {
        help.getBearerToken(function(err, token) {
          if (err) return done(err)

          bearerToken = token

          setTimeout(done, 500)
        })
      })
    })

    after(function(done) {
      app.stop(function(err) {
        if (err) return done(err)

        cleanup(done)
      })
    })

    describe('POST', function() {
      it('should not allow creating a new custom endpoint', function(done) {
        help.getBearerToken(function(err, bearerToken) {
          const client = request(connectionString)

          // make sure the endpoint is not already there
          client
            .get('/v1/new-endpoint?cache=false')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(404)
            .end(function(err) {
              if (err) return done(err)

              // create endpoint
              client
                .post('/v1/new-endpoint/config')
                .send(jsSchemaString)
                .set('content-type', 'text/plain')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(404, done)
            })
        })
      })

      it('should pass inline documentation to the stack', function(done) {
        this.timeout(2000)
        help.getBearerToken(function(err, bearerToken) {
          request(connectionString)
            .get('/v1/test-endpoint-with-docs?cache=false')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end(function(err, res) {
              if (err) return done(err)

              const docs = app.docs['/v1/test-endpoint-with-docs']

              docs.should.exist
              docs.should.be.Array

              docs[0].description.should.eql('Adds two numbers together.')

              done()
            })
        })
      })

      it('should not allow updating an endpoint', function(done) {
        this.timeout(8000)
        help.getBearerToken(function(err, bearerToken) {
          const client = request(connectionString)

          client
            .get('/v1/test-endpoint?cache=false')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end(function(err, res) {
              if (err) return done(err)

              // get an updated version of the file
              const fileArr = jsSchemaString.split('\n')

              fileArr[0] =
                "var message = {message: 'endpoint updated through the API'}"
              jsSchemaString = fileArr.join('\n')

              // update endpoint
              client
                .post('/v1/test-endpoint/config')
                .send(jsSchemaString)
                .set('content-type', 'text/plain')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(404, done)
            })
        })
      })
    })

    describe('GET', function() {
      it('should NOT return the Javascript file backing the endpoint', done => {
        help.getBearerToken((err, bearerToken) => {
          request(connectionString)
            .get('/v1/test-endpoint/config?cache=false')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(404)
            .end(done)
        })
      })

      it('should return 401 when trying to access the list of endpoints without a valid bearer token', done => {
        request(connectionString)
          .get('/api/endpoints')
          .expect('content-type', 'application/json')
          .end((err, res) => {
            if (err) return done(err)

            res.statusCode.should.eql(401)

            done()
          })
      })

      it('should return all loaded endpoints if the requesting client has admin access', done => {
        help.getBearerToken((err, bearerToken) => {
          request(connectionString)
            .get('/api/endpoints')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              if (err) return done(err)

              res.body.should.be.Object
              res.body.endpoints.should.be.Array

              res.body.endpoints.forEach(endpoint => {
                should.exist(endpoint.version)
                should.exist(endpoint.name)
                should.exist(endpoint.path)
              })

              const endpointWithDisplayName = res.body.endpoints.find(
                endpoint => {
                  return endpoint.name === 'Test Endpoint'
                }
              )

              should.exist(endpointWithDisplayName)

              done()
            })
        })
      })

      it('should return the endpoints which the requesting client has `read` access to', done => {
        help
          .getBearerTokenWithPermissions({
            resources: {
              'endpoint:v1_test-endpoint': {
                read: true
              },
              'endpoint:v1_test-endpoint-with-docs': {
                create: true
              }
            }
          })
          .then(bearerToken => {
            request(connectionString)
              .get('/api/endpoints')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                if (err) return done(err)

                res.body.should.be.Object
                res.body.endpoints.should.be.Array
                res.body.endpoints.length.should.eql(1)

                res.body.endpoints[0].name.should.eql('test-endpoint')
                res.body.endpoints[0].path.should.eql('/v1/test-endpoint')

                done()
              })
          })
      })
    })

    describe('DELETE', function() {
      it('should NOT remove the custom endpoint', function(done) {
        help.getBearerToken(function(err, bearerToken) {
          request(connectionString)
            .delete('/v1/test-endpoint/config')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(404)
            .end(done)
        })
      })
    })
  })

  describe('config api', function() {
    const config = require(__dirname + '/../../config.js')
    const configPath = path.resolve(config.configPath())
    const originalConfig = fs.readFileSync(configPath).toString()

    beforeEach(function(done) {
      app.start(done)
    })

    afterEach(function(done) {
      // restore the config file to its original state
      fs.writeFileSync(configPath, originalConfig)
      app.stop(done)
    })

    describe('GET', function() {
      it('should return the current config', function(done) {
        help.getBearerToken(function(err, token) {
          if (err) return done(err)

          bearerToken = token

          request(connectionString)
            .get('/api/config')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .expect('content-type', 'application/json')
            .end(function(err, res) {
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

      it('should load a domain-specific config', function(done) {
        const testConfigPath = './config/config.test.json'
        let domainConfigPath

        function loadConfig(server) {
          domainConfigPath =
            './config/' + server.host + ':' + server.port + '.json'

          try {
            const testConfig = JSON.parse(
              fs.readFileSync(testConfigPath, {encoding: 'utf-8'})
            )

            testConfig.app.name = 'Domain Loaded Config'
            fs.writeFileSync(
              domainConfigPath,
              JSON.stringify(testConfig, null, 2)
            )
          } catch (err) {
            console.log(err)
          }
        }

        loadConfig(config.get('server'))

        help.getBearerToken(function(err, token) {
          if (err) return done(err)

          bearerToken = token

          delete require.cache[__dirname + '/../../config']

          setTimeout(function() {
            request(connectionString)
              .get('/api/config')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .expect('content-type', 'application/json')
              .end(function(err, res) {
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

      it('should only allow authenticated users access', function(done) {
        request(connectionString)
          .get('/api/config')
          .set('Authorization', 'Bearer e91e69b4-6563-43bd-a793-cb2af4ba62f4') // invalid token
          .expect(401)
          .end(function(err, res) {
            if (err) return done(err)
            done()
          })
      })
    })

    describe('POST', function() {
      it('should not allow updating the main config file', function(done) {
        const client = request(connectionString)
        const currentTtl = config.get('auth.tokenTtl')

        client
          .get('/api/config')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .expect('content-type', 'application/json')
          .end(function(err, res) {
            if (err) return done(err)

            should.exist(res.body)
            res.body.auth.tokenTtl = 100

            client
              .post('/api/config')
              .set('Authorization', 'Bearer ' + bearerToken)
              .set('content-type', 'application/json')
              .send(res.body)
              .expect(404)
              .end(function(err, res) {
                if (err) return done(err)

                delete require.cache[configPath]
                config.loadFile(configPath)

                config.get('auth.tokenTtl').should.equal(currentTtl)
                done()
              })
          })
      })
    })
  })
})
