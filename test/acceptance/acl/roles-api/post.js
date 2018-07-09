const app = require('./../../../../dadi/lib')
const config = require('./../../../../config')
const help = require('./../../help')
const request = require('supertest')
const should = require('should')

module.exports = () => {
  let configBackup = config.get()
  let client = request(`http://${config.get('server.host')}:${config.get('server.port')}`)

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
      let newRole = {
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
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        roles: ['dadi-engineer']
      }
      let newRole = {
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

          let bearerToken = res.body.accessToken

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
      let testClient = {
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
      let newRole = {
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

          let bearerToken = res.body.accessToken

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
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          roles: {
            create: true
          }
        },
        roles: ['child']
      }
      let newRole = {
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

          let bearerToken = res.body.accessToken

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
      let testClient = {
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

          let bearerToken = res.body.accessToken

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
            res.body.errors[0].should.eql(
              'Invalid input. Expected: {"name": String}'
            )
            done()
          })
        })
      })
    })

    it('should return 400 if the request body contains an `extends` property referencing a role that does not exist', done => {
      let testClient = {
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

          let bearerToken = res.body.accessToken

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
            res.body.errors[0].should.eql(
              'The specified parent role does not exist'
            )
            done()
          })
        })
      })
    })    

    it('should return 409 if a role with the given name already exists', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          roles: {
            create: true
          }
        }
      }
      let newRole = {
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

          let bearerToken = res.body.accessToken

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
              res.body.errors[0].should.eql(
                'The role already exists'
              )

              done()
            })
          })
        })
      })
    })
  })

  describe('success states (the client has "create" access to the "roles" resource and to any role being extended)', () => {
    it('should create a role and return 201', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          roles: {
            create: true
          }
        }
      }
      let newRole = {
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

          let bearerToken = res.body.accessToken

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
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          roles: {
            create: true
          }
        },
        roles: ['parent']
      }
      let newRole = {
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

          let bearerToken = res.body.accessToken

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
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          roles: {
            create: true
          }
        },
        roles: ['child']
      }
      let newRole = {
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

          let bearerToken = res.body.accessToken

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