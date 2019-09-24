const app = require('./../../../dadi/lib')
const bcrypt = require('bcrypt')
const config = require('./../../../config')
const fs = require('fs-extra')
const help = require('./../help')
const jwt = require('jsonwebtoken')
const path = require('path')
const request = require('supertest')
const sinon = require('sinon')

describe('Token store', () => {
  const configBackup = config.get()
  const client = request(
    `http://${config.get('server.host')}:${config.get('server.port')}`
  )
  const testClient = {
    clientId: 'rootClient',
    email: 'test@edit.com',
    secret: 'superSecret',
    accessType: 'admin'
  }
  const tokenRoute = config.get('auth.tokenUrl')

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
        .expect(401, (err, res) => {
          res.headers['www-authenticate']
            .includes('error="invalid_credentials"')
            .should.eql(true)
          res.headers['www-authenticate']
            .includes('error_description="Invalid credentials supplied"')
            .should.eql(true)

          done(err)
        })
    })

    it('should return 401 with a specific error message in the www-authenticate header if the client must be upgraded due to an outdated hashing algorithm', done => {
      config.set('auth.hashSecrets', true)

      const unhashedClient = {
        clientId: 'anotherTestClient',
        secret: 'iShouldBeHashed',
        accessType: 'admin',
        _hashVersion: null
      }

      help.createClient(unhashedClient, () => {
        client
          .post(tokenRoute)
          .send({
            clientId: unhashedClient.clientId,
            secret: unhashedClient.secret
          })
          .expect('content-type', 'application/json')
          .expect('pragma', 'no-cache')
          .expect('Cache-Control', 'no-store')
          .expect(401, (err, res) => {
            res.headers['www-authenticate']
              .includes('error="client_needs_upgrade"')
              .should.eql(true)
            res.headers['www-authenticate']
              .includes(
                'error_description="The client record on the server must be upgraded"'
              )
              .should.eql(true)

            config.set('auth.hashSecrets', configBackup.auth.hashSecrets)

            done(err)
          })
      })
    })

    it('should return 401 if the client ID, email or secret contain non-string values', done => {
      client
        .post(tokenRoute)
        .send({
          clientId: {
            $ne: null
          },
          email: {
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

    it('should issue a bearer token if the clientId/secret supplied are correct', done => {
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
          res.body.expiresIn.should.eql(config.get('auth.tokenTtl'))

          done()
        })
    })

    it('should issue a bearer token if the email/secret supplied are correct', done => {
      client
        .post(tokenRoute)
        .send({
          email: testClient.email,
          secret: testClient.secret
        })
        .expect('content-type', 'application/json')
        .expect('pragma', 'no-cache')
        .expect('Cache-Control', 'no-store')
        .expect(200, (err, res) => {
          res.body.accessToken.should.be.String
          res.body.tokenType.should.eql('Bearer')
          res.body.expiresIn.should.eql(config.get('auth.tokenTtl'))

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

              const now = Math.floor(Date.now() / 1000)

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
      const nonAdminUser = {
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

                const now = Math.floor(Date.now() / 1000)

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
  })

  describe('Endpoint customisation', () => {
    const newTokenUrl = '/my-custom-endpoint'

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
          res.body.expiresIn.should.eql(config.get('auth.tokenTtl'))

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
    const endpointPath = path.resolve(
      __dirname,
      './../../acceptance/temp-workspace/endpoints/v1/endpoint.intercept-client.js'
    )
    let testClientHash

    before(done => {
      const endpointSource = `
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

      fs.writeFile(endpointPath, endpointSource)
        .then(() => {
          help.createClient(testClient, (err, client) => {
            app.start(err => {
              if (err) return done(err)

              setTimeout(done, 500)
            })
          })
        })
        .catch(done)
    })

    after(done => {
      fs.remove(endpointPath).then(() => {
        help.removeTestClients(() => {
          app.stop(done)
        })
      })
    })

    describe('if `auth.hashSecrets` is set to true', () => {
      it('should compare the secret supplied against the one store using a cryptographic compare function', done => {
        config.set('auth.hashSecrets', true)

        const newClient = {
          clientId: 'testClient1',
          secret: 'superSecret1',
          accessType: 'admin'
        }
        const spy = sinon.spy(bcrypt, 'compare')

        help.createClient(newClient, (err, clientRecord) => {
          client
            .post(tokenRoute)
            .send({
              clientId: newClient.clientId,
              secret: newClient.secret
            })
            .expect('content-type', 'application/json')
            .expect('pragma', 'no-cache')
            .expect('Cache-Control', 'no-store')
            .expect(200, (err, res) => {
              res.body.accessToken.should.be.String

              spy.getCall(0).args[0].should.eql(newClient.secret)
              spy.getCall(0).args[1].should.eql(clientRecord.secret)
              spy.restore()

              client
                .get('/v1/intercept-client')
                .set('Authorization', `Bearer ${res.body.accessToken}`)
                .expect('content-type', 'application/json')
                .expect(200, (err, res) => {
                  res.body.clientId.should.eql(newClient.clientId)
                  res.body.accessType.should.eql(newClient.accessType)

                  config.set('auth.hashSecrets', configBackup.auth.hashSecrets)

                  done()
                })
            })
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
