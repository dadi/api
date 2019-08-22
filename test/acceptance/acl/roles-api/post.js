const app = require('./../../../../dadi/lib')
const config = require('./../../../../config')
const help = require('./../../help')
const request = require('supertest')
const should = require('should')

module.exports = () => {
  const configBackup = config.get()
  const client = request(
    `http://${config.get('server.host')}:${config.get('server.port')}`
  )

  beforeEach(() => {
    return help
      .createACLRole({
        name: 'parent'
      })
      .then(() => {
        return help.createACLRole({
          name: 'child',
          extends: 'parent'
        })
      })
      .then(() => {
        return help.createACLRole({
          name: 'cousin'
        })
      })
  })

  describe('error states', () => {
    it('should return 401 if the request does not include a valid bearer token', done => {
      const newRole = {
        name: 'dadi-engineer'
      }

      client
        .post('/api/roles')
        .send(newRole)
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
        roles: ['dadi-engineer']
      }
      const newRole = {
        name: 'dadi-engineer'
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
              .post('/api/roles')
              .send(newRole)
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

    it('should return 403 if the request includes a valid bearer token without sufficient permissions on the "roles" resource (falsy access type)', done => {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          roles: {
            create: false,
            read: true
          }
        },
        roles: ['dadi-engineer']
      }
      const newRole = {
        name: 'dadi-engineer'
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
              .post('/api/roles')
              .send(newRole)
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

    it('should return 403 if the request body contains an `extends` property with a role which the requesting client does not have', done => {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          roles: {
            create: true
          }
        },
        roles: ['child']
      }
      const newRole = {
        name: 'dadi-engineer',
        extends: 'cousin'
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
              .post('/api/roles')
              .send(newRole)
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

    it('should return 400 if the request body does not include a `name` property', done => {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          roles: {
            create: true
          }
        },
        roles: ['some-other-role']
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
              .post('/api/roles')
              .send({
                someField: 'hello'
              })
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(400)
                res.body.success.should.eql(false)
                res.body.errors.should.be.Array
                res.body.errors[0].code.should.eql('ERROR_NOT_IN_SCHEMA')
                res.body.errors[0].field.should.eql('someField')
                res.body.errors[0].message.should.be.String
                res.body.errors[1].code.should.eql('ERROR_REQUIRED')
                res.body.errors[1].field.should.eql('name')
                res.body.errors[1].message.should.be.String
                done()
              })
          })
      })
    })

    it('should return 400 if the request body contains an unknown property', done => {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          roles: {
            create: true
          }
        },
        roles: ['some-other-role']
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
              .post('/api/roles')
              .send({
                name: 'a-brand-new-role',
                something: 'hello'
              })
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

    it('should return 400 if the request body contains an `extends` property referencing a role that does not exist', done => {
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
              .post('/api/roles')
              .send({
                name: 'a-new-role',
                extends: 'an-existing-role'
              })
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(400)
                res.body.success.should.eql(false)
                res.body.errors.should.be.Array
                res.body.errors[0].code.should.eql('ERROR_INVALID_PARENT_ROLE')
                res.body.errors[0].field.should.eql('extends')
                res.body.errors[0].message.should.be.String
                done()
              })
          })
      })
    })

    it('should return 409 if a role with the given name already exists', done => {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          roles: {
            create: true
          }
        }
      }
      const newRole = {
        name: 'dadi-engineer'
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
              .post('/api/roles')
              .send(newRole)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(201)

                client
                  .post('/api/roles')
                  .send(newRole)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .expect('content-type', 'application/json')
                  .end((err, res) => {
                    res.statusCode.should.eql(409)
                    res.body.success.should.eql(false)
                    res.body.errors.should.be.Array
                    res.body.errors[0].code.should.eql('ERROR_ROLE_EXISTS')
                    res.body.errors[0].field.should.eql('dadi-engineer')
                    res.body.errors[0].message.should.be.String

                    done()
                  })
              })
          })
      })
    })
  })

  describe('success states (the client has "create" access to the "roles" resource and to any role being extended)', () => {
    it('should create a role and return 201', done => {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          roles: {
            create: true
          }
        }
      }
      const newRole = {
        name: 'dadi-engineer'
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
              .post('/api/roles')
              .send(newRole)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(201)

                res.body.results.should.be.Array
                res.body.results.length.should.eql(1)
                res.body.results[0].name.should.eql(newRole.name)
                Object.keys(res.body.results[0].resources).should.eql(0)
                should.equal(res.body.results[0].extends, null)

                done()
              })
          })
      })
    })

    it('should create a role that extends another role that the client has direct access to', done => {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          roles: {
            create: true
          }
        },
        roles: ['parent']
      }
      const newRole = {
        name: 'dadi-engineer',
        extends: 'parent'
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
              .post('/api/roles')
              .send(newRole)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(201)

                res.body.results.should.be.Array
                res.body.results.length.should.eql(1)
                res.body.results[0].name.should.eql(newRole.name)
                res.body.results[0].extends.should.eql(newRole.extends)
                Object.keys(res.body.results[0].resources).should.eql(0)

                done()
              })
          })
      })
    })

    it('should create a role that extends another role that the client has access to through inheritance', done => {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          roles: {
            create: true
          }
        },
        roles: ['child']
      }
      const newRole = {
        name: 'dadi-engineer',
        extends: 'parent'
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
              .post('/api/roles')
              .send(newRole)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(201)

                res.body.results.should.be.Array
                res.body.results.length.should.eql(1)
                res.body.results[0].name.should.eql(newRole.name)
                res.body.results[0].extends.should.eql(newRole.extends)
                Object.keys(res.body.results[0].resources).should.eql(0)

                done()
              })
          })
      })
    })
  })
}
