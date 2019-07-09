const app = require('../../dadi/lib/')
const config = require('../../config')
const fs = require('fs')
const help = require('./help')
const path = require('path')
const request = require('supertest')

const endpointSource = `
module.exports.get = function(req, res, next) {
  res.setHeader('content-type', 'application/json')
  res.statusCode = 200
  res.end(JSON.stringify({message: 'version 1'}))
}`
const endpointPath = path.join(
  __dirname,
  'temp-workspace/endpoints/v1/endpoint.monitor-test-endpoint.js'
)

function resetEndpoint() {
  fs.writeFileSync(endpointPath, endpointSource)
}

let bearerToken

describe('File system watching', function() {
  this.timeout(5000)

  before(function(done) {
    resetEndpoint()

    app.start(function(err) {
      if (err) return done(err)

      setTimeout(function() {
        help.getBearerToken(function(err, token) {
          if (err) return done(err)

          bearerToken = token

          return done()
        })
      }, 1000)
    })
  })

  after(function(done) {
    try {
      fs.unlinkSync(endpointPath)
    } catch (err) {
      // noop
    }

    help.removeTestClients(function() {
      app.stop(done)
    })
  })

  describe('changing files', function() {
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

          const newSource = endpointSource.replace('version 1', 'version 2')

          fs.writeFileSync(endpointPath, newSource)

          setTimeout(function() {
            client
              .get('/v1/monitor-test-endpoint?cache=false')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .expect('content-type', 'application/json')
              .end(function(err, res) {
                if (err) return done(err)

                res.body.message.should.equal('version 2')

                resetEndpoint()
                done()
              })
          }, 2000)
        })
    })
  })

  describe('adding new files', function() {
    const newEndpointPath = path.join(
      __dirname,
      'temp-workspace/endpoints/v1/endpoint.new-test-endpoint.js'
    )

    it('should add to endpoints api when file is added', function(done) {
      const newSource = endpointSource.replace('version 1', 'version 2')

      fs.writeFileSync(newEndpointPath, newSource)

      setTimeout(function() {
        const client = request(
          'http://' +
            config.get('server.host') +
            ':' +
            config.get('server.port')
        )

        client
          .get('/v1/new-test-endpoint?cache=false')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .expect('content-type', 'application/json')
          .end(function(err, res) {
            if (err) return done(err)

            res.body.message.should.equal('version 2')

            fs.unlinkSync(newEndpointPath)
            done()
          })
      }, 900)
    })
  })
})
