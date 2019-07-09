const app = require('./../../../../dadi/lib')
const config = require('./../../../../config')
const help = require('./../../help')
const request = require('supertest')
const should = require('should')

const configBackup = config.get()
const client = request(
  `http://${config.get('server.host')}:${config.get('server.port')}`
)

module.exports = () => {
  const targetClient = {
    clientId: 'targetClient',
    secret: 'someSecret'
  }

  beforeEach(() => {
    return help.createACLClient(targetClient)
  })

  describe('error states', () => {
    it('should return 401 if the request does not include a valid bearer token', done => {
      const resource = {
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
      const testClient = {
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
      const resource = {
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

            const bearerToken = res.body.accessToken

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
      const testClient = {
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
      const resource = {
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

            const bearerToken = res.body.accessToken

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
      const testClient = {
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
      const resource = {
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

            const bearerToken = res.body.accessToken

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
      const testClient = {
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
      const resource = {
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

            const bearerToken = res.body.accessToken

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
      const testClient = {
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
      const resource = {
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

            const bearerToken = res.body.accessToken

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
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        accessType: 'admin'
      }
      const resource = {
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

            const bearerToken = res.body.accessToken

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
                res.body.errors.includes('Invalid access type: invalidType')
                res.body.errors.includes(
                  'Invalid key in access matrix: invalidField'
                )

                done()
              })
          })
      })
    })

    it('should return 400 if the referenced resource does not exist', done => {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          clients: {
            update: true
          },
          'collection:non_existing': {
            read: true
          }
        }
      }
      const resource = {
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

            const bearerToken = res.body.accessToken

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
      const testClient = {
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
      const resource = {
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

            const bearerToken = res.body.accessToken

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

                const result = res.body.results[0]

                result.clientId.should.eql(targetClient.clientId)
                result.resources[resource.name].create.should.eql(false)
                result.resources[resource.name].delete.should.eql(false)
                result.resources[resource.name].deleteOwn.should.eql(false)
                result.resources[resource.name].read.should.eql(
                  resource.access.read
                )
                result.resources[resource.name].readOwn.should.eql(false)
                result.resources[resource.name].update.should.eql(false)
                result.resources[resource.name].updateOwn.should.eql(false)

                done()
              })
          })
      })
    })

    it('should give the client permissions to access a resource (Object with filter)', done => {
      const testClient = {
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
      const resource = {
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

            const bearerToken = res.body.accessToken

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

                const result = res.body.results[0]

                result.clientId.should.eql(targetClient.clientId)
                result.resources[resource.name].create.should.eql(false)
                result.resources[resource.name].delete.should.eql(false)
                result.resources[resource.name].deleteOwn.should.eql(false)
                result.resources[resource.name].read.should.eql(
                  resource.access.read
                )
                result.resources[resource.name].readOwn.should.eql(false)
                result.resources[resource.name].update.should.eql(false)
                result.resources[resource.name].updateOwn.should.eql(false)

                done()
              })
          })
      })
    })

    it('should give the client permissions to access a resource (Object with fields)', done => {
      const testClient = {
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
      const resource = {
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

            const bearerToken = res.body.accessToken

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

                const result = res.body.results[0]

                result.clientId.should.eql(targetClient.clientId)
                result.resources[resource.name].create.should.eql(false)
                result.resources[resource.name].delete.should.eql(false)
                result.resources[resource.name].deleteOwn.should.eql(false)
                result.resources[resource.name].read.should.eql(
                  resource.access.read
                )
                result.resources[resource.name].readOwn.should.eql(false)
                result.resources[resource.name].update.should.eql(false)
                result.resources[resource.name].updateOwn.should.eql(false)

                done()
              })
          })
      })
    })
  })
}
