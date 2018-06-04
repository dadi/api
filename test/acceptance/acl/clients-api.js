const app = require('./../../../dadi/lib')
const config = require('./../../../config')
const help = require('./../help')
const request = require('supertest')
const should = require('should')

describe.only('Clients API', () => {
  let configBackup = config.get()
  let client = request(`http://${config.get('server.host')}:${config.get('server.port')}`)

  before(done => {
    app.start(err => {
      if (err) return done(err)

      setTimeout(done, 300)
    })
  })

  beforeEach(done => {
    help.removeACLData(done)
  })

  after(done => {
    help.removeACLData(() => {
      app.stop(done)
    })
  })

  describe('DELETE', () => {
    describe('error states', () => {
      it('should return 401 if the request does not include a valid bearer token', done => {
        client
        .delete('/api/clients/someClient')
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
            .delete('/api/clients/someClient')
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
              delete: false,
              read: true
            }
          }
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
            .delete('/api/clients/someClient')
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

      it('should return 404 if an authorised request tries to delete a client that does not exist', done => {
        let testClient = {
          clientId: 'apiClient',
          secret: 'someSecret',
          resources: {
            clients: {
              delete: true
            }
          }
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
            .delete('/api/clients/someClient')
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              res.statusCode.should.eql(404)

              done()
            })
          })
        })
      })      
    })

    describe('success states (the client has "delete" access to the "clients" resource)', () => {
      it('should delete a client and return 204', done => {
        let testClient1 = {
          clientId: 'apiClient',
          secret: 'someSecret',
          resources: {
            clients: {
              delete: true,
              read: true
            }
          }
        }
        let testClient2 = {
          clientId: 'someClient',
          secret: 'someSecret'
        }

        help.createACLClient(testClient1).then(() => {
          return help.createACLClient(testClient2)
        }).then(() => {
          client
          .post(config.get('auth.tokenUrl'))
          .set('content-type', 'application/json')
          .send({
            clientId: testClient1.clientId,
            secret: testClient1.secret
          })
          .expect(200)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            if (err) return done(err)

            res.body.accessToken.should.be.String

            let bearerToken = res.body.accessToken

            client
            .get(`/api/clients/${testClient2.clientId}`)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              res.statusCode.should.eql(200)

              res.body.results[0].clientId.should.eql(testClient2.clientId)

              client
              .delete(`/api/clients/${testClient2.clientId}`)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(204)

                client
                .get(`/api/clients/${testClient2.clientId}`)
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .expect('content-type', 'application/json')
                .end((err, res) => {
                  res.statusCode.should.eql(404)

                  done()
                })
              })
            })
          })
        })
      })

      it('should not issue tokens to clients that have been deleted', done => {
        let testClient1 = {
          clientId: 'apiClient',
          secret: 'someSecret',
          resources: {
            clients: {
              delete: true,
              read: true
            }
          }
        }
        let testClient2 = {
          clientId: 'someClient',
          secret: 'someSecret'
        }

        help.createACLClient(testClient1).then(() => {
          return help.createACLClient(testClient2)
        }).then(() => {
          client
          .post(config.get('auth.tokenUrl'))
          .set('content-type', 'application/json')
          .send({
            clientId: testClient1.clientId,
            secret: testClient1.secret
          })
          .expect(200)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            if (err) return done(err)

            res.body.accessToken.should.be.String

            let bearerToken = res.body.accessToken

            client
            .post(config.get('auth.tokenUrl'))
            .set('content-type', 'application/json')
            .send({
              clientId: testClient2.clientId,
              secret: testClient2.secret
            })
            .expect(200)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              if (err) return done(err)

              res.statusCode.should.eql(200)
              res.body.accessToken.should.be.String

              client
              .delete(`/api/clients/${testClient2.clientId}`)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(204)

                client
                .post(config.get('auth.tokenUrl'))
                .set('content-type', 'application/json')
                .send({
                  clientId: testClient2.clientId,
                  secret: testClient2.secret
                })
                .expect('content-type', 'application/json')
                .end((err, res) => {
                  if (err) return done(err)

                  res.statusCode.should.eql(401)

                  done()
                })
              })              
            })
          })
        })
      })
    })
  })

  describe('GET', () => {
    describe('error states', () => {
      it('should return 401 if the request does not include a valid bearer token', done => {
        client
        .get('/api/clients')
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
            .get('/api/clients')
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
              create: true,
              read: false
            }
          }
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
            .get('/api/clients')
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

      it('should return 401 for an unauthenticated request trying to access a client that does not exist', done => {
        client
        .get('/api/clients/johndoe')
        .set('content-type', 'application/json')
        .expect('content-type', 'application/json')
        .end((err, res) => {
          res.statusCode.should.eql(401)

          done()
        })
      })

      it('should return 403 for an unauthorised request trying to access a client that does not exist', done => {
        let testClient = {
          clientId: 'apiClient2',
          secret: 'someOtherSecret',
          resources: {
            clients: {
              read: false
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
            .get('/api/clients/johndoe')
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

      it('should return 404 for an authorised request trying to access a client that does not exist', done => {
        let testClient = {
          clientId: 'apiClient2',
          secret: 'someOtherSecret',
          resources: {
            clients: {
              read: true
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
            .get('/api/clients/johndoe')
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              res.statusCode.should.eql(404)

              done()
            })
          })
        })
      })
    })

    describe('success states (the client has "read" access to the "clients" resource)', () => {
      it('should list existing clients', done => {
        let testClient = {
          clientId: 'apiClient',
          secret: 'someSecret',
          resources: {
            clients: {
              read: true
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
            .get('/api/clients')
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              res.statusCode.should.eql(200)

              res.body.results.should.be.Array
              res.body.results.length.should.eql(1)
              res.body.results[0].clientId.should.eql(testClient.clientId)
              res.body.results[0].accessType.should.eql('user')

              should.not.exist(res.body.results[0].secret)

              Object.keys(res.body.results[0].resources).should.eql(['clients'])

              res.body.results[0].resources.clients.create.should.eql(false)
              res.body.results[0].resources.clients.delete.should.eql(false)
              res.body.results[0].resources.clients.deleteOwn.should.eql(false)
              res.body.results[0].resources.clients.read.should.eql(true)
              res.body.results[0].resources.clients.readOwn.should.eql(false)
              res.body.results[0].resources.clients.update.should.eql(false)
              res.body.results[0].resources.clients.updateOwn.should.eql(false)

              done()
            })
          })
        })
      })

      it('should retrieve clients by name, ommitting the `secret` property', done => {
        let testClient1 = {
          clientId: 'apiClient1',
          secret: 'someSecret'
        }

        let testClient2 = {
          clientId: 'apiClient2',
          secret: 'someOtherSecret',
          resources: {
            clients: {
              read: true
            }
          }
        }      

        help.createACLClient(testClient1).then(() => {
          return help.createACLClient(testClient2)
        }).then(() => {
          client
          .post(config.get('auth.tokenUrl'))
          .set('content-type', 'application/json')
          .send({
            clientId: testClient2.clientId,
            secret: testClient2.secret
          })
          .expect(200)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            if (err) return done(err)

            res.body.accessToken.should.be.String

            let bearerToken = res.body.accessToken

            client
            .get(`/api/clients/${testClient1.clientId}`)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              res.statusCode.should.eql(200)

              res.body.results.should.be.Array
              res.body.results.length.should.eql(1)
              res.body.results[0].clientId.should.eql(testClient1.clientId)
              res.body.results[0].accessType.should.eql('user')

              should.not.exist(res.body.results[0].secret)

              Object.keys(res.body.results[0].resources).length.should.eql(0)

              done()
            })
          })
        })
      })      
    })
  })

  describe('POST', () => {
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
                'Invalid input. Expected: {"clientId": String, "secret": String}'
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
                    'Invalid input. Expected: {"clientId": String, "secret": String}'
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
    })
  })

  describe('Resources', () => {
    let targetClient = {
      clientId: 'targetClient',
      secret: 'someSecret'
    }

    beforeEach(() => {
      return help.createACLClient(targetClient)
    })

    describe('error states', () => {
      it('should return 401 if the request does not include a valid bearer token', done => {
        let resource = {
          name: 'collection:library_book',
          access: {
            read: true
          }
        }

        client
        .post(`/api/clients/${targetClient.clientId}/resources`)
        .send(resource)
        .set('content-type', 'application/json')
        .expect('content-type', 'application/json')
        .end((err, res) => {
          res.statusCode.should.eql(401)

          done()
        })
      })

      it('should return 403 if the request includes a valid bearer token without sufficient permissions on the "clients" resource (no "clients" resource)', done => {
        let testClient = {
          clientId: 'apiClient',
          secret: 'someSecret',
          resources: {
            'collection:library_book': {
              create: true,
              delete: true,
              read: true,
              update: true
            }
          }
        }
        let resource = {
          name: 'collection:library_book',
          access: {
            read: true
          }
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
            .post(`/api/clients/${targetClient.clientId}/resources`)
            .send(resource)
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

      it('should return 403 if the request includes a valid bearer token without sufficient permissions (falsy "update" access to "clients" resource)', done => {
        let testClient = {
          clientId: 'apiClient',
          secret: 'someSecret',
          resources: {
            clients: {
              update: false
            },            
            'collection:library_book': {
              create: true,
              delete: true,
              read: true,
              update: true
            }
          }
        }
        let resource = {
          name: 'collection:library_book',
          access: {
            read: true
          }
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
            .post(`/api/clients/${targetClient.clientId}/resources`)
            .send(resource)
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

      it('should return 403 if the request includes a valid bearer token without sufficient permissions (no access to referenced resource)', done => {
        let testClient = {
          clientId: 'apiClient',
          secret: 'someSecret',
          resources: {
            clients: {
              update: true
            },            
            'collection:library_book': {
              create: true,
              read: false
            }
          }
        }
        let resource = {
          name: 'collection:library_book',
          access: {
            read: true
          }
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
            .post(`/api/clients/${targetClient.clientId}/resources`)
            .send(resource)
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

      it('should return 400 if the resource name is missing', done => {
        let testClient = {
          clientId: 'apiClient',
          secret: 'someSecret',
          resources: {
            clients: {
              update: true
            },            
            'collection:library_book': {
              read: true
            }
          }
        }
        let resource = {
          access: {
            read: true
          }
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
            .post(`/api/clients/${targetClient.clientId}/resources`)
            .send(resource)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              res.statusCode.should.eql(400)

              res.body.success.should.eql(false)
              res.body.errors.should.be.Array
              res.body.errors[0].should.eql(
                'Invalid input. Expected: {"name": String, "access": Object}'
              )

              done()
            })
          })
        })
      })

      it('should return 400 if the access matrix is missing', done => {
        let testClient = {
          clientId: 'apiClient',
          secret: 'someSecret',
          resources: {
            clients: {
              update: true
            },            
            'collection:library_book': {
              read: true
            }
          }
        }
        let resource = {
          name: 'collection:library_book'
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
            .post(`/api/clients/${targetClient.clientId}/resources`)
            .send(resource)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              res.statusCode.should.eql(400)

              res.body.success.should.eql(false)
              res.body.errors.should.be.Array
              res.body.errors[0].should.eql(
                'Invalid input. Expected: {"name": String, "access": Object}'
              )

              done()
            })
          })
        })
      })

      it('should return 400 if the access matrix is invalid', done => {
        let testClient = {
          clientId: 'apiClient',
          secret: 'someSecret',
          resources: {
            clients: {
              update: true
            },            
            'collection:library_book': {
              invalidType: true,
              read: true
            }
          }
        }
        let resource = {
          name: 'collection:library_book',
          access: {
            invalidType: true,
            read: {
              invalidField: 35
            }
          }
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
            .post(`/api/clients/${targetClient.clientId}/resources`)
            .send(resource)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              res.statusCode.should.eql(400)

              res.body.success.should.eql(false)
              res.body.errors.should.be.Array
              res.body.errors.includes(
                'Invalid access type: invalidType'
              )
              res.body.errors.includes(
                'Invalid key in access matrix: invalidField'
              )

              done()
            })
          })
        })
      })      

      it('should return 400 if the referenced resource does not exist', done => {
        let testClient = {
          clientId: 'apiClient',
          secret: 'someSecret',
          resources: {
            clients: {
              update: true
            },            
            'collection:library_book': {
              read: true
            }
          }
        }
        let resource = {
          name: 'collection:non_existing',
          access: {
            read: true
          }
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
            .post(`/api/clients/${targetClient.clientId}/resources`)
            .send(resource)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              res.statusCode.should.eql(400)

              res.body.success.should.eql(false)
              res.body.errors.should.be.Array
              res.body.errors[0].should.eql(
                `Invalid resource: ${resource.name}`
              )

              done()
            })
          })
        })
      })
    })

    describe('success states (the client has "update" access to the "clients" resource as well as access to the referenced resource for each of the access types they are attempting to grant)', () => {
      it('should give the client permissions to access a resource (Boolean)', done => {
        let testClient = {
          clientId: 'apiClient',
          secret: 'someSecret',
          resources: {
            clients: {
              update: true
            },            
            'collection:library_book': {
              read: true
            }
          }
        }
        let resource = {
          name: 'collection:library_book',
          access: {
            read: true
          }
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
            .post(`/api/clients/${targetClient.clientId}/resources`)
            .send(resource)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              res.statusCode.should.eql(201)

              res.body.results.should.be.Array
              res.body.results.length.should.eql(1)

              let result = res.body.results[0]

              result.clientId.should.eql(targetClient.clientId)
              result.resources[resource.name].create.should.eql(false)
              result.resources[resource.name].delete.should.eql(false)
              result.resources[resource.name].deleteOwn.should.eql(false)
              result.resources[resource.name].read.should.eql(resource.access.read)
              result.resources[resource.name].readOwn.should.eql(false)
              result.resources[resource.name].update.should.eql(false)
              result.resources[resource.name].updateOwn.should.eql(false)

              done()
            })
          })
        })
      })

      it('should give the client permissions to access a resource (Object with filter)', done => {
        let testClient = {
          clientId: 'apiClient',
          secret: 'someSecret',
          resources: {
            clients: {
              update: true
            },            
            'collection:library_book': {
              read: true
            }
          }
        }
        let resource = {
          name: 'collection:library_book',
          access: {
            read: {
              filter: {
                someField: 'someValue'
              }
            }
          }
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
            .post(`/api/clients/${targetClient.clientId}/resources`)
            .send(resource)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              res.statusCode.should.eql(201)

              res.body.results.should.be.Array
              res.body.results.length.should.eql(1)

              let result = res.body.results[0]

              result.clientId.should.eql(targetClient.clientId)
              result.resources[resource.name].create.should.eql(false)
              result.resources[resource.name].delete.should.eql(false)
              result.resources[resource.name].deleteOwn.should.eql(false)
              result.resources[resource.name].read.should.eql(resource.access.read)
              result.resources[resource.name].readOwn.should.eql(false)
              result.resources[resource.name].update.should.eql(false)
              result.resources[resource.name].updateOwn.should.eql(false)

              done()
            })
          })
        })
      })

      it('should give the client permissions to access a resource (Object with fields)', done => {
        let testClient = {
          clientId: 'apiClient',
          secret: 'someSecret',
          resources: {
            clients: {
              update: true
            },            
            'collection:library_book': {
              read: true
            }
          }
        }
        let resource = {
          name: 'collection:library_book',
          access: {
            read: {
              fields: {
                someField: 1,
                someOtherField: 1
              }
            }
          }
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
            .post(`/api/clients/${targetClient.clientId}/resources`)
            .send(resource)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              res.statusCode.should.eql(201)

              res.body.results.should.be.Array
              res.body.results.length.should.eql(1)

              let result = res.body.results[0]

              result.clientId.should.eql(targetClient.clientId)
              result.resources[resource.name].create.should.eql(false)
              result.resources[resource.name].delete.should.eql(false)
              result.resources[resource.name].deleteOwn.should.eql(false)
              result.resources[resource.name].read.should.eql(resource.access.read)
              result.resources[resource.name].readOwn.should.eql(false)
              result.resources[resource.name].update.should.eql(false)
              result.resources[resource.name].updateOwn.should.eql(false)

              done()
            })
          })
        })
      })
    })
  })
})
