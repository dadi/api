const app = require('./../../../../dadi/lib')
const config = require('./../../../../config')
const help = require('./../../help')
const request = require('supertest')
const should = require('should')

const configBackup = config.get()
const client = request(`http://${config.get('server.host')}:${config.get('server.port')}`)

module.exports = () => {
  const initialResource = {
    name: 'collection:library_book',
    access: {
      create: true,
      delete: true
    }
  }

  beforeEach(() => {
    return help.createACLRole({
      name: 'child',
      resources: {
        [initialResource.name]: initialResource.access
      }
    })
  })

  describe('error states', () => {
    it('should return 401 if the request does not include a valid bearer token', done => {
      client
      .delete(`/api/roles/child/resources/${initialResource.name}`)
      .set('content-type', 'application/json')
      .expect('content-type', 'application/json')
      .end((err, res) => {
        res.statusCode.should.eql(401)

        done()
      })
    })

    it('should return 403 if the request includes a valid bearer token without sufficient permissions on the "roles" resource (no "roles" resource)', done => {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret'
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
          .delete(`/api/roles/child/resources/${initialResource.name}`)
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
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          clients: {
            update: false
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
          .delete(`/api/roles/child/resources/${initialResource.name}`)
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

    it('should return 404 if the role does not have permissions for the resource', done => {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
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
          .delete(`/api/roles/child/resources/other:resource`)
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

  describe('success states (the client has "update" access to the "clients" resource, has the role being updated as well as access to the referenced resource for all the access types)', () => {
    it('should remove the client\'s permissions to access a resource', done => {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          roles: {
            create: true,
            delete: true,
            read: true,
            update: true
          },            
          [initialResource.name]: {
            create: true,
            delete: true,
            read: true,
            update: true
          }
        },
        roles: ['child']
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
          .get(`/api/roles/child`)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            res.body.results.should.be.Array
            res.body.results.length.should.eql(1)

            const result = res.body.results[0]

            should.exist(result.resources[initialResource.name])

            client
            .delete(`/api/roles/child/resources/${initialResource.name}`)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              res.statusCode.should.eql(204)

              client
              .get(`/api/roles/child`)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.body.results.should.be.Array
                res.body.results.length.should.eql(1)

                const result = res.body.results[0]

                should.not.exist(result.resources[initialResource.name])

                done()
              })
            })
          })
        })
      })
    })

    it('should remove the client\'s permissions to access a resource without affecting permissions for other resources', done => {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          roles: {
            create: true,
            delete: true,
            read: true,
            update: true
          },            
          [initialResource.name]: {
            create: true,
            delete: true,
            read: true,
            update: true
          },
          'collection:library_person': {
            create: true,
            delete: true,
            read: true,
            update: true            
          }
        },
        roles: ['child']
      }
      const newResource = {
        name: 'collection:library_person',
        access: {
          create: true,
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

          const bearerToken = res.body.accessToken

          client
          .post(`/api/roles/child/resources`)
          .send(newResource)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect('content-type', 'application/json')
          .end((err, res) => {          
            res.statusCode.should.eql(201)

            client
            .get(`/api/roles/child`)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              res.body.results.should.be.Array
              res.body.results.length.should.eql(1)

              const result = res.body.results[0]

              result.resources[initialResource.name].create.should.eql(initialResource.access.create || false)
              result.resources[initialResource.name].delete.should.eql(initialResource.access.delete || false)
              result.resources[initialResource.name].deleteOwn.should.eql(initialResource.access.deleteOwn || false)
              result.resources[initialResource.name].read.should.eql(initialResource.access.read || false)
              result.resources[initialResource.name].readOwn.should.eql(initialResource.access.readOwn || false)
              result.resources[initialResource.name].update.should.eql(initialResource.access.update || false)
              result.resources[initialResource.name].updateOwn.should.eql(initialResource.access.updateOwn || false)

              result.resources[newResource.name].create.should.eql(newResource.access.create || false)
              result.resources[newResource.name].delete.should.eql(newResource.access.delete || false)
              result.resources[newResource.name].deleteOwn.should.eql(newResource.access.deleteOwn || false)
              result.resources[newResource.name].read.should.eql(newResource.access.read || false)
              result.resources[newResource.name].readOwn.should.eql(newResource.access.readOwn || false)
              result.resources[newResource.name].update.should.eql(newResource.access.update || false)
              result.resources[newResource.name].updateOwn.should.eql(newResource.access.updateOwn || false)

              client
              .delete(`/api/roles/child/resources/${initialResource.name}`)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(204)

                client
                .get(`/api/roles/child`)
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .expect('content-type', 'application/json')
                .end((err, res) => {
                  res.body.results.should.be.Array
                  res.body.results.length.should.eql(1)

                  const result = res.body.results[0]

                  should.not.exist(result.resources[initialResource.name])

                  result.resources[newResource.name].create.should.eql(newResource.access.create || false)
                  result.resources[newResource.name].delete.should.eql(newResource.access.delete || false)
                  result.resources[newResource.name].deleteOwn.should.eql(newResource.access.deleteOwn || false)
                  result.resources[newResource.name].read.should.eql(newResource.access.read || false)
                  result.resources[newResource.name].readOwn.should.eql(newResource.access.readOwn || false)
                  result.resources[newResource.name].update.should.eql(newResource.access.update || false)
                  result.resources[newResource.name].updateOwn.should.eql(newResource.access.updateOwn || false)

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