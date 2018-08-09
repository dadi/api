const app = require('./../../../dadi/lib')
const config = require('./../../../config')
const fs = require('fs-extra')
const help = require('./../help')
const jwt = require('jsonwebtoken')
const path = require('path')
const request = require('supertest')
const should = require('should')

describe('Token store', () => {
  let configBackup = config.get()
  let client = request(`http://${config.get('server.host')}:${config.get('server.port')}`)
  let testClient = {
    clientId: 'rootClient',
    secret: 'superSecret',
    accessType: 'admin'
  }
  let tokenRoute = config.get('auth.tokenUrl')

  describe('Bearer token issuing', () => {
    before(done => {
      app.start(err => {
        if (err) return done(err)

        setTimeout(done, 500)
      })
    })

    beforeEach(done => {
      help.createClient(testClient, done)
    })

    after(done => {
      app.stop(done)
    })

    afterEach(done => {
      help.removeTestClients(done)
    })

    it('should return 401 if the client ID or secret are incorrect', done => {
      client
        .post(tokenRoute)
        .send({
          clientId: 'wrongId',
          secret: 'wrongSecret'
        })
        .expect('content-type', 'application/json')
        .expect('pragma', 'no-cache')
        .expect('Cache-Control', 'no-store')
        .expect(401, done)
    })

    it('should return 401 if the client ID or secret contain non-string values', done => {
      client
        .post(tokenRoute)
        .send({
          clientId: {
            $ne: null
          },
          secret: {
            $ne: null
          }
        })
        .expect('content-type', 'application/json')
        .expect('pragma', 'no-cache')
        .expect('Cache-Control', 'no-store')
        .expect(401, done)
    })

    it('should return 401 if the client ID and/or secret are missing', done => {
      client
        .post(tokenRoute)
        .send({
          clientId: testClient.clientId
        })
        .expect('content-type', 'application/json')
        .expect('pragma', 'no-cache')
        .expect('Cache-Control', 'no-store')
        .expect(401, (err, res) => {
          if (err) return done(err)

          client
            .post(tokenRoute)
            .send({
              secret: testClient.secret
            })
            .expect('content-type', 'application/json')
            .expect('pragma', 'no-cache')
            .expect('Cache-Control', 'no-store')
            .expect(401, (err, res) => {
              if (err) return done(err)

              client
                .post(tokenRoute)
                .send({})
                .expect('content-type', 'application/json')
                .expect('pragma', 'no-cache')
                .expect('Cache-Control', 'no-store')
                .expect(401, done)                
            })            
        })
    })

    it('should issue a bearer token if the credentials are correct', done => {
      client
        .post(tokenRoute)
        .send({
          clientId: testClient.clientId,
          secret: testClient.secret
        })
        .expect('content-type', 'application/json')
        .expect('pragma', 'no-cache')
        .expect('Cache-Control', 'no-store')
        .expect(200, (err, res) => {
          res.body.accessToken.should.be.String
          res.body.tokenType.should.eql('Bearer')
          res.body.expiresIn.should.eql(
            config.get('auth.tokenTtl')
          )

          done()
        })
    })

    it('should encode the client ID and the access type in the JWT', done => {
      client
        .post(tokenRoute)
        .send({
          clientId: testClient.clientId,
          secret: testClient.secret
        })
        .expect('content-type', 'application/json')
        .expect('pragma', 'no-cache')
        .expect('Cache-Control', 'no-store')
        .expect(200, (err, res) => {
          jwt.verify(
            res.body.accessToken,
            config.get('auth.tokenKey'),
            (err, decoded) => {
              if (err) {
                return done(err)
              }

              let now = Math.floor(Date.now() / 1000)

              decoded.clientId.should.eql(testClient.clientId)
              decoded.accessType.should.eql(testClient.accessType)
              decoded.iat.should.eql(now)
              decoded.exp.should.eql(now + config.get('auth.tokenTtl'))

              done()
            }
          )
        })
    })

    it('should encode the access type as "user" in the JWT if the client record does not have one set', done => {
      let nonAdminUser = {
        clientId: 'soldier',
        secret: 'nobody'
      }

      help.createClient(nonAdminUser, () => {
        client
          .post(tokenRoute)
          .send({
            clientId: nonAdminUser.clientId,
            secret: nonAdminUser.secret
          })
          .expect('content-type', 'application/json')
          .expect('pragma', 'no-cache')
          .expect('Cache-Control', 'no-store')
          .expect(200, (err, res) => {
            jwt.verify(
              res.body.accessToken,
              config.get('auth.tokenKey'),
              (err, decoded) => {
                if (err) {
                  return done(err)
                }

                let now = Math.floor(Date.now() / 1000)

                decoded.clientId.should.eql(nonAdminUser.clientId)
                decoded.accessType.should.eql('user')
                decoded.iat.should.eql(now)
                decoded.exp.should.eql(now + config.get('auth.tokenTtl'))

                done()
              }
            )
          })
      })
    })

    it('should return a data object in the response if one is set for the client, but not encode it in the JWT', done => {
      let nonAdminUser = {
        clientId: 'soldier',
        secret: 'nobody',
        data: {
          first_name: 'John',
          last_name: 'Doe'
        }
      }

      help.createClient(nonAdminUser, () => {
        client
          .post(tokenRoute)
          .send({
            clientId: nonAdminUser.clientId,
            secret: nonAdminUser.secret
          })
          .expect('content-type', 'application/json')
          .expect('pragma', 'no-cache')
          .expect('Cache-Control', 'no-store')
          .expect(200, (err, res) => {
            res.body.data.should.eql(nonAdminUser.data)

            jwt.verify(
              res.body.accessToken,
              config.get('auth.tokenKey'),
              (err, decoded) => {
                if (err) {
                  return done(err)
                }

                let now = Math.floor(Date.now() / 1000)

                decoded.clientId.should.eql(nonAdminUser.clientId)
                decoded.accessType.should.eql('user')
                decoded.iat.should.eql(now)
                decoded.exp.should.eql(now + config.get('auth.tokenTtl'))

                should.not.exist(decoded.data)

                done()
              }
            )
          })
      })
    })
  })

  describe('Endpoint customisation', () => {
    let newTokenUrl = '/my-custom-endpoint'

    before(done => {
      config.set('auth.tokenUrl', newTokenUrl)

      help.createClient(testClient, () => {
        app.start(err => {
          if (err) return done(err)

          setTimeout(done, 500)
        })
      })
    })

    after(done => {
      config.set('auth.tokenUrl', configBackup.auth.tokenUrl)

      help.removeTestClients(() => {
        app.stop(done)
      })
    })

    it('should respond to requests on the endpoint configured in `auth.tokenTtl`', done => {
      client
        .post(newTokenUrl)
        .send({
          clientId: testClient.clientId,
          secret: testClient.secret
        })
        .expect('content-type', 'application/json')
        .expect('pragma', 'no-cache')
        .expect('Cache-Control', 'no-store')
        .expect(200, (err, res) => {
          res.body.accessToken.should.be.String
          res.body.tokenType.should.eql('Bearer')
          res.body.expiresIn.should.eql(
            config.get('auth.tokenTtl')
          )

          done()
        })
    })

    it('should leave vacant the `/token` endpoint if `auth.tokenUrl` is set to something else', done => {
      client
        .post('/token')
        .send({
          clientId: testClient.clientId,
          secret: testClient.secret
        })
        .expect(404, done)
    })
  })

  describe('Validating requests', () => {
    let endpointPath = path.resolve(
      __dirname,
      './../../acceptance/temp-workspace/endpoints/v1/endpoint.intercept-client.js'
    )

    before(done => {
      let endpointSource = `
        module.exports.get = function (req, res, next) {
          res.setHeader('content-type', 'application/json')
          res.statusCode = 200
          res.end(JSON.stringify(req.dadiApiClient))        
        }

        module.exports.model = {
          settings: {
            authenticate: false
          }
        }
      `

      fs.writeFile(endpointPath, endpointSource).then(() => {
        help.createClient(testClient, () => {
          app.start(err => {
            if (err) return done(err)

            setTimeout(done, 500)
          })
        })
      }).catch(console.log)
    })

    after(done => {
      fs.remove(endpointPath).then(() => {
        help.removeTestClients(() => {
          app.stop(done)
        })
      })
    })

    it('should attach client data to the request object if the bearer token supplied is valid', done => {
      client
        .post(tokenRoute)
        .send({
          clientId: testClient.clientId,
          secret: testClient.secret
        })
        .expect('content-type', 'application/json')
        .expect('pragma', 'no-cache')
        .expect('Cache-Control', 'no-store')
        .expect(200, (err, res) => {
          res.body.accessToken.should.be.String

          client
            .get('/v1/intercept-client')
            .set('Authorization', `Bearer ${res.body.accessToken}`)
            .expect('content-type', 'application/json')
            .expect(200, (err, res) => {
              res.body.clientId.should.eql(testClient.clientId)
              res.body.accessType.should.eql(testClient.accessType)

              done()
            })
        })
    })

    it('should attach an error to the request object if the bearer token supplied is invalid', done => {
      client
        .get('/v1/intercept-client')
        .set('Authorization', `Bearer not-a-valid-token`)
        .expect('content-type', 'application/json')
        .expect(200, (err, res) => {
          res.body.error.name.should.eql('JsonWebTokenError')
          res.body.error.message.should.eql('jwt malformed')

          done()
        })
    })
  })
})
