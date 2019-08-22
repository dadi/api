const app = require('./../../../../dadi/lib')
const client = require('./../../../../dadi/lib/model/acl/client')
const bcrypt = require('bcrypt')
const config = require('./../../../../config')
const help = require('./../../help')
const request = require('supertest')
const should = require('should')
const sinon = require('sinon')

module.exports = () => {
  const configBackup = config.get()
  const client = request(
    `http://${config.get('server.host')}:${config.get('server.port')}`
  )

  describe('error states', () => {
    it('should return 401 if the request does not include a valid bearer token', done => {
      const newClient = {
        clientId: 'apiClient',
        secret: 'someSecret'
      }

      client
        .post('/api/clients')
        .send(newClient)
        .set('content-type', 'application/json')
        .expect('content-type', 'application/json')
        .end((err, res) => {
          res.statusCode.should.eql(401)

          done()
        })
    })

    it('should return 403 if the request includes a valid bearer token without sufficient permissions on the "clients" resource (no resource)', done => {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret'
      }
      const newClient = {
        clientId: 'newClient',
        secret: 'aNewSecret'
      }

      help.createACLClient(testClient).then(() => {
        client
          .post(config.get('auth.tokenUrl'))
          .set('content-type', 'application/json')
          .send(testClient)
          .expect(200)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            if (err) return done(err)

            res.body.accessToken.should.be.String

            const bearerToken = res.body.accessToken

            client
              .post('/api/clients')
              .send(newClient)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(403)

                done()
              })
          })
      })
    })

    it('should return 403 if the request includes a valid bearer token without sufficient permissions on the "clients" resource (falsy access type)', done => {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          clients: {
            create: false,
            read: true
          }
        }
      }
      const newClient = {
        clientId: 'newClient',
        secret: 'aNewSecret'
      }

      help.createACLClient(testClient).then(() => {
        client
          .post(config.get('auth.tokenUrl'))
          .set('content-type', 'application/json')
          .send(testClient)
          .expect(200)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            if (err) return done(err)

            res.body.accessToken.should.be.String

            const bearerToken = res.body.accessToken

            client
              .post('/api/clients')
              .send(newClient)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(403)

                done()
              })
          })
      })
    })

    it('should return 400 if the request does not include a client ID and a secret', done => {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          clients: {
            create: true
          }
        }
      }

      help.createACLClient(testClient).then(() => {
        client
          .post(config.get('auth.tokenUrl'))
          .set('content-type', 'application/json')
          .send({
            clientId: testClient.clientId,
            secret: testClient.secret
          })
          .expect(200)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            if (err) return done(err)

            res.body.accessToken.should.be.String

            const bearerToken = res.body.accessToken

            client
              .post('/api/clients')
              .send({
                clientId: 'aNewClient'
              })
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(400)
                res.body.success.should.eql(false)
                res.body.errors.should.be.Array
                res.body.errors[0].code.should.eql('ERROR_REQUIRED')
                res.body.errors[0].field.should.eql('secret')
                res.body.errors[0].message.should.be.String

                client
                  .post(config.get('auth.tokenUrl'))
                  .set('content-type', 'application/json')
                  .send({
                    clientId: testClient.clientId,
                    secret: testClient.secret
                  })
                  .expect(200)
                  .expect('content-type', 'application/json')
                  .end((err, res) => {
                    if (err) return done(err)

                    res.body.accessToken.should.be.String

                    const bearerToken = res.body.accessToken

                    client
                      .post('/api/clients')
                      .send({
                        secret: 'aNewSecret'
                      })
                      .set('content-type', 'application/json')
                      .set('Authorization', `Bearer ${bearerToken}`)
                      .expect('content-type', 'application/json')
                      .end((err, res) => {
                        res.statusCode.should.eql(400)
                        res.body.errors[0].code.should.eql('ERROR_REQUIRED')
                        res.body.errors[0].field.should.eql('clientId')
                        res.body.errors[0].message.should.be.String

                        done()
                      })
                  })
              })
          })
      })
    })

    it('should return 403 if the request body includes an `accessType` of `admin`', done => {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          clients: {
            create: true
          }
        }
      }
      const newClient = {
        clientId: 'newClient',
        secret: 'aNewSecret',
        accessType: 'admin'
      }

      help.createACLClient(testClient).then(() => {
        client
          .post(config.get('auth.tokenUrl'))
          .set('content-type', 'application/json')
          .send({
            clientId: testClient.clientId,
            secret: testClient.secret
          })
          .expect(200)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            if (err) return done(err)

            res.body.accessToken.should.be.String

            const bearerToken = res.body.accessToken

            client
              .post('/api/clients')
              .send(newClient)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(403)
                res.body.code.should.eql('API-0006')

                done(err)
              })
          })
      })
    })

    it('should return 400 if the request body includes a `roles` property with a role that does not exist', done => {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          clients: {
            create: true
          }
        }
      }
      const newClient = {
        clientId: 'newClient',
        secret: 'aNewSecret',
        roles: ['i-do-not-exist', 'me-neither']
      }

      help.createACLClient(testClient).then(() => {
        client
          .post(config.get('auth.tokenUrl'))
          .set('content-type', 'application/json')
          .send({
            clientId: testClient.clientId,
            secret: testClient.secret
          })
          .expect(200)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            if (err) return done(err)

            res.body.accessToken.should.be.String

            const bearerToken = res.body.accessToken

            client
              .post('/api/clients')
              .send(newClient)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(400)

                res.body.success.should.eql(false)
                res.body.errors.should.be.Array
                res.body.errors[0].code.should.eql('ERROR_INVALID_ROLE')
                res.body.errors[0].field.should.eql(newClient.roles[0])
                res.body.errors[0].message.should.be.String
                res.body.errors[1].code.should.eql('ERROR_INVALID_ROLE')
                res.body.errors[1].field.should.eql(newClient.roles[1])
                res.body.errors[1].message.should.be.String

                done()
              })
          })
      })
    })

    it('should return 400 if the request body includes an invalid `resources` property', done => {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        accessType: 'admin'
      }
      const newClient = {
        clientId: 'newClient',
        secret: 'aNewSecret',
        resources: {
          'i-do-not-exist': {
            create: true
          }
        }
      }

      help.createACLClient(testClient).then(() => {
        client
          .post(config.get('auth.tokenUrl'))
          .set('content-type', 'application/json')
          .send({
            clientId: testClient.clientId,
            secret: testClient.secret
          })
          .expect(200)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            if (err) return done(err)

            res.body.accessToken.should.be.String

            const bearerToken = res.body.accessToken

            client
              .post('/api/clients')
              .send(newClient)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(400)

                res.body.success.should.eql(false)
                res.body.errors.should.be.Array
                res.body.errors[0].code.should.eql('ERROR_INVALID_RESOURCE')
                res.body.errors[0].field.should.eql('resources.i-do-not-exist')
                res.body.errors[0].message.should.be.String

                done()
              })
          })
      })
    })

    it('should return 400 if the request body includes an unknown property', done => {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          clients: {
            create: true
          }
        }
      }
      const newClient = {
        clientId: 'newClient',
        secret: 'aNewSecret',
        something: 12345
      }

      help.createACLClient(testClient).then(() => {
        client
          .post(config.get('auth.tokenUrl'))
          .set('content-type', 'application/json')
          .send({
            clientId: testClient.clientId,
            secret: testClient.secret
          })
          .expect(200)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            if (err) return done(err)

            res.body.accessToken.should.be.String

            const bearerToken = res.body.accessToken

            client
              .post('/api/clients')
              .send(newClient)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(400)

                res.body.success.should.eql(false)
                res.body.errors.should.be.Array
                res.body.errors[0].code.should.eql('ERROR_NOT_IN_SCHEMA')
                res.body.errors[0].field.should.eql('something')
                res.body.errors[0].message.should.be.String

                done()
              })
          })
      })
    })

    it('should return 400 if a non-admin client tries to create a client containing a protected data property', done => {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          clients: {
            create: true
          }
        }
      }
      const newClient = {
        clientId: 'newClient',
        secret: 'aNewSecret',
        data: {
          _id: 123456
        }
      }

      help.createACLClient(testClient).then(() => {
        client
          .post(config.get('auth.tokenUrl'))
          .set('content-type', 'application/json')
          .send({
            clientId: testClient.clientId,
            secret: testClient.secret
          })
          .expect(200)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            if (err) return done(err)

            res.body.accessToken.should.be.String

            const bearerToken = res.body.accessToken

            client
              .post('/api/clients')
              .send(newClient)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(400)

                res.body.success.should.eql(false)
                res.body.errors[0].code.should.eql('ERROR_PROTECTED_DATA_FIELD')
                res.body.errors[0].field.should.eql('data._id')
                res.body.errors[0].message.should.be.String

                done()
              })
          })
      })
    })

    it('should return 409 if a client with the given ID already exists', done => {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          clients: {
            create: true
          }
        }
      }

      help.createACLClient(testClient).then(() => {
        client
          .post(config.get('auth.tokenUrl'))
          .set('content-type', 'application/json')
          .send({
            clientId: testClient.clientId,
            secret: testClient.secret
          })
          .expect(200)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            if (err) return done(err)

            res.body.accessToken.should.be.String

            const bearerToken = res.body.accessToken

            client
              .post('/api/clients')
              .send({
                clientId: testClient.clientId,
                secret: 'someOtherSecret'
              })
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(409)
                res.body.success.should.eql(false)
                res.body.errors.should.be.Array
                res.body.errors[0].code.should.eql('ERROR_CLIENT_EXISTS')
                res.body.errors[0].field.should.eql('clientId')
                res.body.errors[0].message.should.be.String

                done()
              })
          })
      })
    })
  })

  describe('success states (the client has "create" access to the "clients" resource)', () => {
    describe('if `auth.hashSecrets` is set to true', () => {
      it('should hash client secrets and salt them using the number of rounds specified in the `auth.saltRounds` config property', done => {
        config.set('auth.hashSecrets', true)
        config.set('auth.saltRounds', 5)

        const spy = sinon.spy(bcrypt, 'hash')
        const testClient = {
          clientId: 'apiClient',
          secret: 'someSecret',
          resources: {
            clients: {
              create: true
            }
          }
        }
        const newClient1 = {
          clientId: 'newClient1',
          secret: 'aNewSecret1'
        }
        const newClient2 = {
          clientId: 'newClient2',
          secret: 'aNewSecret2'
        }

        help.createACLClient(testClient).then(() => {
          client
            .post(config.get('auth.tokenUrl'))
            .set('content-type', 'application/json')
            .send({
              clientId: testClient.clientId,
              secret: testClient.secret
            })
            .expect(200)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              if (err) return done(err)

              const {accessToken} = res.body

              client
                .post('/api/clients')
                .send(newClient1)
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${accessToken}`)
                .expect('content-type', 'application/json')
                .end((err, res) => {
                  res.statusCode.should.eql(201)

                  spy.getCall(0).args[0].should.eql('aNewSecret1')
                  spy.getCall(0).args[1].should.eql(5)

                  config.set('auth.saltRounds', 8)

                  client
                    .post('/api/clients')
                    .send(newClient2)
                    .set('content-type', 'application/json')
                    .set('Authorization', `Bearer ${accessToken}`)
                    .expect('content-type', 'application/json')
                    .end((err, res) => {
                      res.statusCode.should.eql(201)

                      config.set(
                        'auth.hashSecrets',
                        configBackup.auth.hashSecrets
                      )
                      config.set(
                        'auth.saltRounds',
                        configBackup.auth.saltRounds
                      )

                      spy.getCall(1).args[0].should.eql('aNewSecret2')
                      spy.getCall(1).args[1].should.eql(8)

                      spy.restore()

                      done(err)
                    })
                })
            })
        })
      })
    })

    it('should create a client and return a 201', done => {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          clients: {
            create: true
          }
        }
      }
      const newClient = {
        clientId: 'newClient',
        secret: 'aNewSecret'
      }

      help.createACLClient(testClient).then(() => {
        client
          .post(config.get('auth.tokenUrl'))
          .set('content-type', 'application/json')
          .send({
            clientId: testClient.clientId,
            secret: testClient.secret
          })
          .expect(200)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            if (err) return done(err)

            res.body.accessToken.should.be.String

            const bearerToken = res.body.accessToken

            client
              .post('/api/clients')
              .send(newClient)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(201)

                res.body.results.should.be.Array
                res.body.results.length.should.eql(1)
                res.body.results[0].clientId.should.eql(newClient.clientId)
                res.body.results[0].accessType.should.eql('user')
                res.body.results[0].resources.should.eql({})
                res.body.results[0].roles.should.eql([])
                should.not.exist(res.body.results[0].secret)

                done()
              })
          })
      })
    })

    it('should create a client with a data object', done => {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          clients: {
            create: true,
            read: true
          }
        }
      }
      const newClient = {
        clientId: 'newClient',
        secret: 'aNewSecret',
        data: {
          firstName: 'Eduardo'
        }
      }

      help.createACLClient(testClient).then(() => {
        client
          .post(config.get('auth.tokenUrl'))
          .set('content-type', 'application/json')
          .send({
            clientId: testClient.clientId,
            secret: testClient.secret
          })
          .expect(200)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            if (err) return done(err)

            res.body.accessToken.should.be.String

            const bearerToken = res.body.accessToken

            client
              .post('/api/clients')
              .send(newClient)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(201)

                res.body.results.should.be.Array
                res.body.results.length.should.eql(1)
                res.body.results[0].clientId.should.eql(newClient.clientId)
                res.body.results[0].accessType.should.eql('user')
                res.body.results[0].resources.should.eql({})
                res.body.results[0].roles.should.eql([])
                res.body.results[0].data.should.eql(newClient.data)
                should.not.exist(res.body.results[0].secret)

                client
                  .get(`/api/clients/${newClient.clientId}`)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .expect('content-type', 'application/json')
                  .end((err, res) => {
                    res.statusCode.should.eql(200)

                    res.body.results.should.be.Array
                    res.body.results.length.should.eql(1)
                    res.body.results[0].clientId.should.eql(newClient.clientId)
                    res.body.results[0].accessType.should.eql('user')
                    res.body.results[0].resources.should.eql({})
                    res.body.results[0].roles.should.eql([])
                    res.body.results[0].data.should.eql(newClient.data)
                    should.not.exist(res.body.results[0].secret)

                    done()
                  })
              })
          })
      })
    })

    it('should create a client with a data object containing protected properties if the requesting client is an admin', done => {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        accessType: 'admin'
      }
      const newClient = {
        clientId: 'newClient',
        secret: 'aNewSecret',
        data: {
          _id: 12345
        }
      }

      help.createACLClient(testClient).then(() => {
        client
          .post(config.get('auth.tokenUrl'))
          .set('content-type', 'application/json')
          .send({
            clientId: testClient.clientId,
            secret: testClient.secret
          })
          .expect(200)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            if (err) return done(err)

            res.body.accessToken.should.be.String

            const bearerToken = res.body.accessToken

            client
              .post('/api/clients')
              .send(newClient)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(201)

                res.body.results.should.be.Array
                res.body.results.length.should.eql(1)
                res.body.results[0].clientId.should.eql(newClient.clientId)
                res.body.results[0].accessType.should.eql('user')
                res.body.results[0].resources.should.eql({})
                res.body.results[0].roles.should.eql([])
                res.body.results[0].data.should.eql(newClient.data)
                should.not.exist(res.body.results[0].secret)

                client
                  .get(`/api/clients/${newClient.clientId}`)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .expect('content-type', 'application/json')
                  .end((err, res) => {
                    res.statusCode.should.eql(200)

                    res.body.results.should.be.Array
                    res.body.results.length.should.eql(1)
                    res.body.results[0].clientId.should.eql(newClient.clientId)
                    res.body.results[0].accessType.should.eql('user')
                    res.body.results[0].resources.should.eql({})
                    res.body.results[0].roles.should.eql([])
                    res.body.results[0].data.should.eql(newClient.data)
                    should.not.exist(res.body.results[0].secret)

                    done()
                  })
              })
          })
      })
    })
  })
}
