const app = require('./../../../../dadi/lib')
const config = require('./../../../../config')
const help = require('./../../help')
const request = require('supertest')
const should = require('should')

module.exports = () => {
  let configBackup = config.get()
  let client = request(`http://${config.get('server.host')}:${config.get('server.port')}`)

  describe('error states', () => {
    it('should return 401 if the request does not include a valid bearer token', done => {
      let newClient = {
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
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret'
      }
      let newClient = {
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

          let bearerToken = res.body.accessToken

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
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          clients: {
            create: false,
            read: true
          }
        }
      }
      let newClient = {
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

          let bearerToken = res.body.accessToken

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
      let testClient = {
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

          let bearerToken = res.body.accessToken

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
            res.body.errors[0].should.eql(
              'Invalid input. Expected: {"clientId": String, "secret": String, "data": Object (optional)}'
            )

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

              let bearerToken = res.body.accessToken

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
                res.body.success.should.eql(false)
                res.body.errors.should.be.Array
                res.body.errors[0].should.eql(
                  'Invalid input. Expected: {"clientId": String, "secret": String, "data": Object (optional)}'
                )

                done()
              })
            })
          })
        })
      })
    })

    it('should return 400 if the request body includes an `accessType` property', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          clients: {
            create: true
          }
        }
      }
      let newClient = {
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

          let bearerToken = res.body.accessToken

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
            res.body.errors[0].should.eql(
              'Invalid field: accessType'
            )

            done()
          })
        })
      })
    })

    it('should return 400 if the request body includes a `roles` property', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          clients: {
            create: true
          }
        }
      }
      let newClient = {
        clientId: 'newClient',
        secret: 'aNewSecret',
        roles: ['admin']
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

          let bearerToken = res.body.accessToken

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
            res.body.errors[0].should.eql(
              'Invalid field: roles'
            )

            done()
          })
        })
      })
    })

    it('should return 400 if the request body includes a `resources` property', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          clients: {
            create: true
          }
        }
      }
      let newClient = {
        clientId: 'newClient',
        secret: 'aNewSecret',
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

          let bearerToken = res.body.accessToken

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
            res.body.errors[0].should.eql(
              'Invalid field: resources'
            )

            done()
          })
        })
      })
    })

    it('should return 400 if the request body includes an unknown property', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          clients: {
            create: true
          }
        }
      }
      let newClient = {
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

          let bearerToken = res.body.accessToken

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
            res.body.errors[0].should.eql(
              'Invalid field: something'
            )

            done()
          })
        })
      })
    })

    it('should return 400 if a non-admin client tries to create a client containing a protected data property', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          clients: {
            create: true
          }
        }
      }
      let newClient = {
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

          let bearerToken = res.body.accessToken

          client
          .post('/api/clients')
          .send(newClient)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            res.statusCode.should.eql(400)

            res.body.success.should.eql(false)
            res.body.errors[0].should.eql('Cannot set internal data property: data._id')

            done()
          })
        })
      })
    })    

    it('should return 409 if a client with the given ID already exists', done => {
      let testClient = {
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

          let bearerToken = res.body.accessToken

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
            res.body.errors[0].should.eql(
              'The client already exists'
            )

            done()
          })
        })
      })
    })
  })

  describe('success states (the client has "create" access to the "clients" resource)', () => {
    it('should create a client and return a 201', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          clients: {
            create: true
          }
        }
      }
      let newClient = {
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

          let bearerToken = res.body.accessToken

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
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          clients: {
            create: true,
            read: true
          }
        }
      }
      let newClient = {
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

          let bearerToken = res.body.accessToken

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
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        accessType: 'admin'
      }
      let newClient = {
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

          let bearerToken = res.body.accessToken

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