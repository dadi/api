const app = require('./../../../../dadi/lib')
const config = require('./../../../../config')
const help = require('./../../help')
const request = require('supertest')
const should = require('should')

let configBackup = config.get()
let client = request(`http://${config.get('server.host')}:${config.get('server.port')}`)

module.exports = () => {
  beforeEach(() => {
    return help.createACLRole({
      name: 'parent'
    }).then(() => {
      return help.createACLRole({
        name: 'child',
        extends: 'parent'
      })
    }).then(() => {
      return help.createACLRole({
        name: 'cousin'
      })
    })
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
      .post('/api/roles/child/resources')
      .send(resource)
      .set('content-type', 'application/json')
      .expect('content-type', 'application/json')
      .end((err, res) => {
        res.statusCode.should.eql(401)

        done()
      })
    })

    it('should return 403 if the request includes a valid bearer token without sufficient permissions on the "roles" resource (no resource)', done => {
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
        },
        roles: ['child']
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
          .post('/api/roles/child/resources')
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

    it('should return 403 if the request includes a valid bearer token without sufficient permissions (falsy "update" access to "roles" resource)', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          roles: {
            update: false
          },            
          'collection:library_book': {
            create: true,
            delete: true,
            read: true,
            update: true
          }
        },
        roles: ['child']
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
          .post('/api/roles/child/resources')
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

    it('should return 403 if the request includes a valid bearer token without sufficient permissions (no access to role)', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          roles: {
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
          .post('/api/roles/child/resources')
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
          roles: {
            update: true
          },            
          'collection:library_book': {
            create: true,
            read: false
          }
        },
        roles: ['child']
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
          .post('/api/roles/child/resources')
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
          roles: {
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
          .post('/api/roles/child/resources')
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
          roles: {
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
          .post('/api/roles/child/resources')
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
        accessType: 'admin'
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
          .post('/api/roles/child/resources')
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
        accessType: 'admin'
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
          .post('/api/roles/child/resources')
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

  describe('success states (the client has "update" access to the "roles" resource, has access to the role being edited as well as access to the referenced resource for each of the access types they are attempting to grant)', () => {
    it('should give the role permissions to access a resource', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          roles: {
            read: true,
            update: true
          },            
          'collection:library_book': {
            read: true
          }
        },
        roles: ['child']
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
          .get('/api/roles/child')
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            res.statusCode.should.eql(200)

            res.body.results.should.be.Array
            res.body.results.length.should.eql(1)

            let result = res.body.results[0]

            result.resources.should.eql({})

            client
            .post('/api/roles/child/resources')
            .send(resource)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              res.statusCode.should.eql(201)

              res.body.results.should.be.Array
              res.body.results.length.should.eql(1)

              let result = res.body.results[0]

              result.name.should.eql('child')
              result.resources[resource.name].create.should.eql(false)
              result.resources[resource.name].delete.should.eql(false)
              result.resources[resource.name].deleteOwn.should.eql(false)
              result.resources[resource.name].read.should.eql(resource.access.read)
              result.resources[resource.name].readOwn.should.eql(false)
              result.resources[resource.name].update.should.eql(false)
              result.resources[resource.name].updateOwn.should.eql(false)

              client
              .get('/api/roles/child')
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(200)

                res.body.results.should.be.Array
                res.body.results.length.should.eql(1)

                let result = res.body.results[0]

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

    it('should give the role permissions to access a resource without deleting existing permissions for other roles', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          roles: {
            read: true,
            update: true
          },            
          'collection:library_book': {
            read: true,
            updateOwn: true
          },
          'collection:library_person': {
            read: true,
            create: true
          }          
        },
        roles: ['child']
      }
      let resource1 = {
        name: 'collection:library_book',
        access: {
          read: true,
          updateOwn: true
        }
      }
      let resource2 = {
        name: 'collection:library_person',
        access: {
          read: true,
          create: true
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
          .get('/api/roles/child')
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            res.statusCode.should.eql(200)

            res.body.results.should.be.Array
            res.body.results.length.should.eql(1)

            let result = res.body.results[0]

            result.resources.should.eql({})

            client
            .post('/api/roles/child/resources')
            .send(resource1)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              res.statusCode.should.eql(201)

              res.body.results.should.be.Array
              res.body.results.length.should.eql(1)

              let result = res.body.results[0]

              result.name.should.eql('child')
              result.resources[resource1.name].create.should.eql(resource1.access.create || false)
              result.resources[resource1.name].delete.should.eql(resource1.access.delete || false)
              result.resources[resource1.name].deleteOwn.should.eql(resource1.access.deleteOwn || false)
              result.resources[resource1.name].read.should.eql(resource1.access.read || false)
              result.resources[resource1.name].readOwn.should.eql(resource1.access.readOwn || false)
              result.resources[resource1.name].update.should.eql(resource1.access.update || false)
              result.resources[resource1.name].updateOwn.should.eql(resource1.access.updateOwn || false)

              client
              .post('/api/roles/child/resources')
              .send(resource2)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(201)

                res.body.results.should.be.Array
                res.body.results.length.should.eql(1)

                let result = res.body.results[0]

                Object.keys(result.resources).length.should.eql(2)

                result.name.should.eql('child')
                result.resources[resource2.name].create.should.eql(resource2.access.create || false)
                result.resources[resource2.name].delete.should.eql(resource2.access.delete || false)
                result.resources[resource2.name].deleteOwn.should.eql(resource2.access.deleteOwn || false)
                result.resources[resource2.name].read.should.eql(resource2.access.read || false)
                result.resources[resource2.name].readOwn.should.eql(resource2.access.readOwn || false)
                result.resources[resource2.name].update.should.eql(resource2.access.update || false)
                result.resources[resource2.name].updateOwn.should.eql(resource2.access.updateOwn || false)              

                client
                .get('/api/roles/child')
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .expect('content-type', 'application/json')
                .end((err, res) => {
                  res.statusCode.should.eql(200)

                  res.body.results.should.be.Array
                  res.body.results.length.should.eql(1)

                  let result = res.body.results[0]

                  Object.keys(result.resources).length.should.eql(2)

                  result.resources[resource1.name].create.should.eql(resource1.access.create || false)
                  result.resources[resource1.name].delete.should.eql(resource1.access.delete || false)
                  result.resources[resource1.name].deleteOwn.should.eql(resource1.access.deleteOwn || false)
                  result.resources[resource1.name].read.should.eql(resource1.access.read || false)
                  result.resources[resource1.name].readOwn.should.eql(resource1.access.readOwn || false)
                  result.resources[resource1.name].update.should.eql(resource1.access.update || false)
                  result.resources[resource1.name].updateOwn.should.eql(resource1.access.updateOwn || false)

                  result.resources[resource2.name].create.should.eql(resource2.access.create || false)
                  result.resources[resource2.name].delete.should.eql(resource2.access.delete || false)
                  result.resources[resource2.name].deleteOwn.should.eql(resource2.access.deleteOwn || false)
                  result.resources[resource2.name].read.should.eql(resource2.access.read || false)
                  result.resources[resource2.name].readOwn.should.eql(resource2.access.readOwn || false)
                  result.resources[resource2.name].update.should.eql(resource2.access.update || false)
                  result.resources[resource2.name].updateOwn.should.eql(resource2.access.updateOwn || false)                  

                  done()
                })
              })
            })
          })
        })
      })
    })    
  })
}