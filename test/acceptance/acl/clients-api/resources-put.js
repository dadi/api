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
  const resource = 'collection:library_book'
  const targetClient = {
    clientId: 'targetClient',
    secret: 'someSecret',
    resources: {
      [resource]: {
        read: true
      }
    }
  }

  beforeEach(() => {
    return help.createACLClient(targetClient)
  })

  describe('error states', () => {
    it('should return 401 if the request does not include a valid bearer token', done => {
      client
        .put(`/api/clients/${targetClient.clientId}/resources/${resource}`)
        .send({
          read: false
        })
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
              .put(
                `/api/clients/${targetClient.clientId}/resources/${resource}`
              )
              .send({
                read: false
              })
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
              .put(
                `/api/clients/${targetClient.clientId}/resources/${resource}`
              )
              .send({
                read: false
              })
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
          [resource]: {
            create: true,
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

            const bearerToken = res.body.accessToken

            client
              .put(
                `/api/clients/${targetClient.clientId}/resources/${resource}`
              )
              .send({
                read: false
              })
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
              .put(
                `/api/clients/${targetClient.clientId}/resources/${resource}`
              )
              .send({
                invalidType: true,
                read: {
                  invalidField: 35
                }
              })
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(400)

                res.body.success.should.eql(false)
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

    it('should return 404 if the client does not have permission to access the resource', done => {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          clients: {
            update: true
          },
          'other:resource': {
            read: true
          },
          [resource]: {
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

            const bearerToken = res.body.accessToken

            client
              .put(
                `/api/clients/${targetClient.clientId}/resources/other:resource`
              )
              .send({
                read: false
              })
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

  describe('success states (the client has "update" access to the "clients" resource as well as access to the referenced resource for each of the access types they are attempting to grant)', () => {
    it("should update the client's permissions to access a resource (Boolean)", done => {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          clients: {
            update: true
          },
          [resource]: {
            read: true,
            update: true
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
              .put(
                `/api/clients/${targetClient.clientId}/resources/${resource}`
              )
              .send({
                read: false,
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

                result.clientId.should.eql(targetClient.clientId)
                result.resources[resource].create.should.eql(false)
                result.resources[resource].delete.should.eql(false)
                result.resources[resource].deleteOwn.should.eql(false)
                result.resources[resource].read.should.eql(false)
                result.resources[resource].readOwn.should.eql(false)
                result.resources[resource].update.should.eql(true)
                result.resources[resource].updateOwn.should.eql(false)

                done()
              })
          })
      })
    })

    it("should update the client's permissions to access a resource (Object with filter)", done => {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          clients: {
            update: true
          },
          [resource]: {
            read: true
          }
        }
      }
      const newReadValue = {
        filter: {
          fieldOne: 'valueOne',
          fieldTwo: {
            $in: ['valueTwo', 'valueThree']
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
              .put(
                `/api/clients/${targetClient.clientId}/resources/${resource}`
              )
              .send({
                read: newReadValue
              })
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(200)

                res.body.results.should.be.Array
                res.body.results.length.should.eql(1)

                const result = res.body.results[0]

                result.clientId.should.eql(targetClient.clientId)
                result.resources[resource].create.should.eql(false)
                result.resources[resource].delete.should.eql(false)
                result.resources[resource].deleteOwn.should.eql(false)
                result.resources[resource].read.should.eql(newReadValue)
                result.resources[resource].readOwn.should.eql(false)
                result.resources[resource].update.should.eql(false)
                result.resources[resource].updateOwn.should.eql(false)

                done()
              })
          })
      })
    })

    it("should update the client's permissions to access a resource (Object with fields)", done => {
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
      const newReadValue = {
        fields: {
          someField: 1,
          someOtherField: 1
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
              .put(
                `/api/clients/${targetClient.clientId}/resources/${resource}`
              )
              .send({
                read: newReadValue
              })
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(200)

                res.body.results.should.be.Array
                res.body.results.length.should.eql(1)

                const result = res.body.results[0]

                result.clientId.should.eql(targetClient.clientId)
                result.resources[resource].create.should.eql(false)
                result.resources[resource].delete.should.eql(false)
                result.resources[resource].deleteOwn.should.eql(false)
                result.resources[resource].read.should.eql(newReadValue)
                result.resources[resource].readOwn.should.eql(false)
                result.resources[resource].update.should.eql(false)
                result.resources[resource].updateOwn.should.eql(false)

                done()
              })
          })
      })
    })
  })
}
