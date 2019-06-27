const connection = require(__dirname + '/../../dadi/lib/model/connection')
const should = require('should')
const request = require('supertest')
const config = require(__dirname + '/../../config')
const fs = require('fs')
const app = require(__dirname + '/../../dadi/lib/')
const help = require(__dirname + '/help')

const originalSchemaPath =
  __dirname +
  '/temp-workspace/monitor-collection/collection.monitor-test-schema.json'
const testSchemaPath =
  __dirname +
  '/temp-workspace/collections/vtest/testdb/collection.monitor-test-schema.json'

const originalEndpointPath =
  __dirname +
  '/temp-workspace/monitor-collection/endpoint.monitor-test-endpoint.js'
const testEndpointPath =
  __dirname + '/temp-workspace/endpoints/v1/endpoint.monitor-test-endpoint.js'

let bearerToken // used through out tests

describe('File system watching', function() {
  this.timeout(5000)

  before(function(done) {
    // start the app
    app.start(function(err) {
      if (err) return done(err)

      setTimeout(function() {
        help.dropDatabase('testdb', function(err) {
          if (err) return done(err)

          help.getBearerToken(function(err, token) {
            if (err) return done(err)

            bearerToken = token

            // help.clearCache()
            return done()
          })
        })
      }, 1000)
    })
  })

  after(function(done) {
    try {
      fs.unlinkSync(testSchemaPath)
      fs.unlinkSync(testEndpointPath)
    } catch (err) {
      // noop
    }

    help.removeTestClients(function() {
      app.stop(done)
    })
  })

  beforeEach(function(done) {
    const testSchema = fs.readFileSync(originalSchemaPath)
    const testEndpoint = fs.readFileSync(originalEndpointPath)

    fs.writeFileSync(testSchemaPath, testSchema)
    fs.writeFileSync(testEndpointPath, testEndpoint)

    setTimeout(function() {
      done()
    }, 500)
  })

  describe('changing files', function() {
    it('should update collections component when file changes', function(done) {
      this.timeout(4000)
      const client = request(
        'http://' + config.get('server.host') + ':' + config.get('server.port')
      )

      client
        .post('/vtest/testdb/monitor-test-schema')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send({field1: 'string value'})
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function(err, res) {
          if (err) return done(err)

          // Change the schema file's content
          const schemaPath =
            __dirname +
            '/temp-workspace/collections/vtest/testdb/collection.monitor-test-schema.json'
          // clone so that `require.cache` is unaffected
          const schema = JSON.parse(JSON.stringify(require(schemaPath)))

          schema.fields.field1.type = 'Number'
          fs.writeFileSync(schemaPath, JSON.stringify(schema))

          setTimeout(function() {
            client
              .post('/vtest/testdb/monitor-test-schema')
              .set('Authorization', 'Bearer ' + bearerToken)
              .send({field1: 31337})
              .expect(200)
              .expect('content-type', 'application/json')
              .end(function(err, res) {
                if (err) return done(err)

                done()
              })
          }, 100)
        })
    })

    it('should update endpoint component when file changes', function(done) {
      this.timeout(5000)
      const client = request(
        'http://' + config.get('server.host') + ':' + config.get('server.port')
      )

      client
        .get('/v1/monitor-test-endpoint?cache=false')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err)

          res.body.message.should.equal('version 1')

          // Change the endpoint file's content
          const endpoint = fs.readFileSync(testEndpointPath).toString()

          const lines = endpoint.split('\n')

          lines[0] = "var message = 'version 2';"
          fs.writeFileSync(testEndpointPath, lines.join('\n'))

          setTimeout(function() {
            // console.log(app.components['/v1/monitor-test-endpoint'])
            client
              .get('/v1/monitor-test-endpoint?cache=false')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .expect('content-type', 'application/json')
              .end(function(err, res) {
                if (err) return done(err)

                res.body.message.should.equal('version 2')
                done()
              })
          }, 2000)
        })
    })
  })

  describe('adding new files', function() {
    const newSchemaPath =
      __dirname +
      '/temp-workspace/collections/vtest2/testdb/collection.new-test-schema.json'
    const newEndpointPath =
      __dirname + '/temp-workspace/endpoints/v1/endpoint.new-test-endpoint.js'

    before(function(done) {
      // tests are going to try to create these directories and they shouldn't exist before hand
      if (
        fs.existsSync(__dirname + '/temp-workspace/collections/vtest2/testdb')
      ) {
        fs.rmdirSync(__dirname + '/temp-workspace/collections/vtest2/testdb')
      }

      if (fs.existsSync(__dirname + '/temp-workspace/collections/vtest2')) {
        fs.rmdirSync(__dirname + '/temp-workspace/collections/vtest2')
      }

      done()
    })

    after(function(done) {
      fs.unlinkSync(newSchemaPath)
      fs.unlinkSync(newEndpointPath)
      fs.rmdirSync(__dirname + '/temp-workspace/collections/vtest2/testdb')
      fs.rmdirSync(__dirname + '/temp-workspace/collections/vtest2')
      done()
    })

    it('should add to collections api when file is added', function(done) {
      // make a copy of the test schema in a new collections dir
      const testSchema = fs.readFileSync(originalSchemaPath)

      fs.mkdirSync(__dirname + '/temp-workspace/collections/vtest2')
      fs.mkdirSync(__dirname + '/temp-workspace/collections/vtest2/testdb')
      fs.writeFileSync(newSchemaPath, testSchema)

      // allow time for app to respond
      setTimeout(function() {
        const client = request(
          'http://' +
            config.get('server.host') +
            ':' +
            config.get('server.port')
        )

        client
          .get('/vtest2/testdb/new-test-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .expect('content-type', 'application/json')
          .end(done)
      }, 300)
    })

    it('should add to endpoints api when file is added', function(done) {
      // Change the endpoint file's content
      const endpoint = fs.readFileSync(testEndpointPath).toString()

      const lines = endpoint.split('\n')

      lines[0] = "var message = 'version 2';"
      fs.writeFileSync(newEndpointPath, lines.join('\n'))

      setTimeout(function() {
        const client = request(
          'http://' +
            config.get('server.host') +
            ':' +
            config.get('server.port')
        )

        client
          .get('/v1/new-test-endpoint')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .expect('content-type', 'application/json')
          .end(function(err, res) {
            if (err) return done(err)

            res.body.message.should.equal('version 2')
            done()
          })
      }, 300)
    })
  })

  describe('removing existing files', function() {
    it('should remove endpoint from api when file is removed', function(done) {
      fs.unlinkSync(testEndpointPath)

      const client = request(
        'http://' + config.get('server.host') + ':' + config.get('server.port')
      )

      setTimeout(function() {
        client
          .get('/v1/monitor-test-endpoint?cache=false')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(404)
          .end(done)
      }, 500)
    })

    it('should remove collection from api when file is removed', function(done) {
      fs.unlinkSync(testSchemaPath)

      const client = request(
        'http://' + config.get('server.host') + ':' + config.get('server.port')
      )

      setTimeout(function() {
        client
          .get('/vtest/testdb/monitor-test-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(404)
          .end(done)
      }, 500)
    })
  })
})
