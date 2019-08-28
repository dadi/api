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
      const newAccess = {
        delete: false,
        update: true
      }

      client
        .put('/api/roles/child/resources/collection:library_book')
        .send(newAccess)
        .set('content-type', 'application/json')
        .expect('content-type', 'application/json')
        .end((err, res) => {
          res.statusCode.should.eql(401)

          done()
        })
    })

    it('should return 403 if the request includes a valid bearer token without sufficient permissions on the "roles" resource (no resource)', done => {
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
        },
        roles: ['child']
      }
      const newAccess = {
        delete: false,
        update: true
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
              .put('/api/roles/child/resources/collection:library_book')
              .send(newAccess)
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
      const newAccess = {
        delete: false,
        update: true
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
              .put('/api/roles/child/resources/collection:library_book')
              .send(newAccess)
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
      const testClient = {
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
      const newAccess = {
        delete: false,
        update: true
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
              .put('/api/roles/child/resources/collection:library_book')
              .send(newAccess)
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
      const newAccess = {
        delete: false,
        update: true
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
              .put('/api/roles/child/resources/collection:library_book')
              .send(newAccess)
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

    it('should return 400 if the access matrix is invalid', done => {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        accessType: 'admin'
      }
      const newAccess = {
        invalidType: true,
        read: {
          invalidField: 35
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
              .put('/api/roles/child/resources/collection:library_book')
              .send(newAccess)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(400)

                res.body.success.should.eql(false)
                res.body.errors.should.be.Array
                res.body.errors[0].code.should.eql('ERROR_INVALID_ACCESS_TYPE')
                res.body.errors[0].field.should.eql('invalidType')
                res.body.errors[0].message.should.be.String
                res.body.errors[1].code.should.eql('ERROR_INVALID_ACCESS_VALUE')
                res.body.errors[1].field.should.eql('read.invalidField')
                res.body.errors[1].message.should.be.String

                done()
              })
          })
      })
    })

    it('should return 404 if the role does not have the referenced resource', done => {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        accessType: 'admin'
      }
      const newAccess = {
        read: true
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
              .put('/api/roles/child/resources/collection:non_existing')
              .send(newAccess)
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

  describe('success states (the client has "update" access to the "roles" resource, has access to the role being edited as well as access to the referenced resource for each of the access types they are attempting to update)', () => {
    it("should update the role's permissions to access a resource", done => {
      const testClient = {
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
      const newAccess = {
        read: true
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
              .get('/api/roles/child')
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(200)

                res.body.results.should.be.Array
                res.body.results.length.should.eql(1)

                const result = res.body.results[0]

                result.resources[initialResource.name].create.should.eql(true)
                result.resources[initialResource.name].delete.should.eql(true)
                result.resources[initialResource.name].deleteOwn.should.eql(
                  false
                )
                result.resources[initialResource.name].read.should.eql(false)
                result.resources[initialResource.name].readOwn.should.eql(false)
                result.resources[initialResource.name].update.should.eql(false)
                result.resources[initialResource.name].updateOwn.should.eql(
                  false
                )

                client
                  .put('/api/roles/child/resources/collection:library_book')
                  .send(newAccess)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .expect('content-type', 'application/json')
                  .end((err, res) => {
                    res.statusCode.should.eql(200)

                    res.body.results.should.be.Array
                    res.body.results.length.should.eql(1)

                    const result = res.body.results[0]

                    result.name.should.eql('child')
                    result.resources[initialResource.name].create.should.eql(
                      true
                    )
                    result.resources[initialResource.name].delete.should.eql(
                      true
                    )
                    result.resources[initialResource.name].deleteOwn.should.eql(
                      false
                    )
                    result.resources[initialResource.name].read.should.eql(true)
                    result.resources[initialResource.name].readOwn.should.eql(
                      false
                    )
                    result.resources[initialResource.name].update.should.eql(
                      false
                    )
                    result.resources[initialResource.name].updateOwn.should.eql(
                      false
                    )

                    client
                      .get('/api/roles/child')
                      .set('content-type', 'application/json')
                      .set('Authorization', `Bearer ${bearerToken}`)
                      .expect('content-type', 'application/json')
                      .end((err, res) => {
                        res.statusCode.should.eql(200)

                        res.body.results.should.be.Array
                        res.body.results.length.should.eql(1)

                        const result = res.body.results[0]

                        result.name.should.eql('child')
                        result.resources[
                          initialResource.name
                        ].create.should.eql(true)
                        result.resources[
                          initialResource.name
                        ].delete.should.eql(true)
                        result.resources[
                          initialResource.name
                        ].deleteOwn.should.eql(false)
                        result.resources[initialResource.name].read.should.eql(
                          true
                        )
                        result.resources[
                          initialResource.name
                        ].readOwn.should.eql(false)
                        result.resources[
                          initialResource.name
                        ].update.should.eql(false)
                        result.resources[
                          initialResource.name
                        ].updateOwn.should.eql(false)

                        done()
                      })
                  })
              })
          })
      })
    })

    it("should update the role's permissions to access a resource without affecting existing permissions for other roles", done => {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          roles: {
            read: true,
            update: true
          },
          'collection:library_book': {
            create: true,
            delete: true,
            read: true,
            update: true
          },
          'collection:library_person': {
            read: true,
            create: true
          }
        },
        roles: ['child']
      }
      const newResource = {
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

            const bearerToken = res.body.accessToken

            client
              .post('/api/roles/child/resources')
              .send(newResource)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(201)

                res.body.results.should.be.Array
                res.body.results.length.should.eql(1)

                const result = res.body.results[0]

                result.name.should.eql('child')
                result.resources[newResource.name].create.should.eql(
                  newResource.access.create || false
                )
                result.resources[newResource.name].delete.should.eql(
                  newResource.access.delete || false
                )
                result.resources[newResource.name].deleteOwn.should.eql(
                  newResource.access.deleteOwn || false
                )
                result.resources[newResource.name].read.should.eql(
                  newResource.access.read || false
                )
                result.resources[newResource.name].readOwn.should.eql(
                  newResource.access.readOwn || false
                )
                result.resources[newResource.name].update.should.eql(
                  newResource.access.update || false
                )
                result.resources[newResource.name].updateOwn.should.eql(
                  newResource.access.updateOwn || false
                )

                client
                  .put(`/api/roles/child/resources/${initialResource.name}`)
                  .send({
                    create: true,
                    delete: true,
                    read: true,
                    update: true
                  })
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .expect('content-type', 'application/json')
                  .end((err, res) => {
                    res.statusCode.should.eql(200)

                    res.body.results.should.be.Array
                    res.body.results.length.should.eql(1)

                    const result = res.body.results[0]

                    Object.keys(result.resources).length.should.eql(2)

                    result.name.should.eql('child')
                    result.resources[initialResource.name].create.should.eql(
                      true
                    )
                    result.resources[initialResource.name].delete.should.eql(
                      true
                    )
                    result.resources[initialResource.name].deleteOwn.should.eql(
                      false
                    )
                    result.resources[initialResource.name].read.should.eql(true)
                    result.resources[initialResource.name].readOwn.should.eql(
                      false
                    )
                    result.resources[initialResource.name].update.should.eql(
                      true
                    )
                    result.resources[initialResource.name].updateOwn.should.eql(
                      false
                    )

                    client
                      .get('/api/roles/child')
                      .set('content-type', 'application/json')
                      .set('Authorization', `Bearer ${bearerToken}`)
                      .expect('content-type', 'application/json')
                      .end((err, res) => {
                        res.statusCode.should.eql(200)

                        res.body.results.should.be.Array
                        res.body.results.length.should.eql(1)

                        const result = res.body.results[0]

                        Object.keys(result.resources).length.should.eql(2)

                        result.resources[newResource.name].create.should.eql(
                          newResource.access.create || false
                        )
                        result.resources[newResource.name].delete.should.eql(
                          newResource.access.delete || false
                        )
                        result.resources[newResource.name].deleteOwn.should.eql(
                          newResource.access.deleteOwn || false
                        )
                        result.resources[newResource.name].read.should.eql(
                          newResource.access.read || false
                        )
                        result.resources[newResource.name].readOwn.should.eql(
                          newResource.access.readOwn || false
                        )
                        result.resources[newResource.name].update.should.eql(
                          newResource.access.update || false
                        )
                        result.resources[newResource.name].updateOwn.should.eql(
                          newResource.access.updateOwn || false
                        )

                        result.resources[
                          initialResource.name
                        ].create.should.eql(true)
                        result.resources[
                          initialResource.name
                        ].delete.should.eql(true)
                        result.resources[
                          initialResource.name
                        ].deleteOwn.should.eql(false)
                        result.resources[initialResource.name].read.should.eql(
                          true
                        )
                        result.resources[
                          initialResource.name
                        ].readOwn.should.eql(false)
                        result.resources[
                          initialResource.name
                        ].update.should.eql(true)
                        result.resources[
                          initialResource.name
                        ].updateOwn.should.eql(false)

                        done()
                      })
                  })
              })
          })
      })
    })
  })
}
