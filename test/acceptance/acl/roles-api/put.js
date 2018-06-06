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
      let update = {
        extends: 'child'
      }

      client
      .put('/api/roles/cousin')
      .send(update)
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
        roles: ['child', 'cousin']
      }
      let update = {
        extends: 'child'
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
          .put('/api/roles/cousin')
          .send(update)
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
            update: false,
            read: true
          }
        },
        roles: ['child', 'cousin']
      }
      let update = {
        extends: 'child'
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
          .put('/api/roles/cousin')
          .send(update)
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
            update: true
          }
        },
        roles: ['cousin']
      }
      let update = {
        extends: 'child'
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
          .put('/api/roles/cousin')
          .send(update)
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

    it('should return 400 if the request attempts to change the `name` property', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          roles: {
            update: true
          }
        },
        roles: ['cousin']
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
          .put('/api/roles/cousin')
          .send({
            name: 'a-new-name'
          })
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            res.statusCode.should.eql(400)
            res.body.success.should.eql(false)
            res.body.errors.should.be.Array
            res.body.errors[0].should.eql(
              'Role names cannot be changed'
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
          .put('/api/roles/cousin')
          .send({
            extends: 'does-not-exist'
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
  })

  describe('success states (the client has "update" access to the "roles" resource and to any role being extended)', () => {
    it('should remove the inheritance from a role', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          roles: {
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
            res.body.results[0].name.should.eql('child')
            Object.keys(res.body.results[0].resources).should.eql(0)
            res.body.results[0].extends.should.eql('parent')

            client
            .put('/api/roles/child')
            .send({
              extends: null
            })
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              res.statusCode.should.eql(200)

              res.body.results.should.be.Array
              res.body.results.length.should.eql(1)
              res.body.results[0].name.should.eql('child')
              Object.keys(res.body.results[0].resources).should.eql(0)
              should.equal(res.body.results[0].extends, null)

              client
              .get('/api/roles/child')
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(200)

                res.body.results.should.be.Array
                res.body.results.length.should.eql(1)
                res.body.results[0].name.should.eql('child')
                Object.keys(res.body.results[0].resources).should.eql(0)
                should.equal(res.body.results[0].extends, null)

                done()
              })
            })
          })
        })
      })
    })

    it('should add inheritance to a role, as long as the requesting client has access to the inherited role', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          roles: {
            read: true,
            update: true
          }
        },
        roles: ['child', 'cousin']
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
          .get('/api/roles/cousin')
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            res.statusCode.should.eql(200)

            res.body.results.should.be.Array
            res.body.results.length.should.eql(1)
            res.body.results[0].name.should.eql('cousin')
            Object.keys(res.body.results[0].resources).should.eql(0)
            should.equal(res.body.results[0].extends, null)

            client
            .put('/api/roles/cousin')
            .send({
              extends: 'child'
            })
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              res.statusCode.should.eql(200)

              res.body.results.should.be.Array
              res.body.results.length.should.eql(1)
              res.body.results[0].name.should.eql('cousin')
              Object.keys(res.body.results[0].resources).should.eql(0)
              res.body.results[0].extends.should.eql('child')

              client
              .get('/api/roles/cousin')
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(200)

                res.body.results.should.be.Array
                res.body.results.length.should.eql(1)
                res.body.results[0].name.should.eql('cousin')
                Object.keys(res.body.results[0].resources).should.eql(0)
                res.body.results[0].extends.should.eql('child')

                done()
              })
            })
          })
        })
      })
    })

    it('should change the inheritance of a role, as long as the requesting client has access to the new inherited role', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          roles: {
            read: true,
            update: true
          }
        },
        roles: ['child', 'cousin']
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
            res.body.results[0].name.should.eql('child')
            Object.keys(res.body.results[0].resources).should.eql(0)
            res.body.results[0].extends.should.eql('parent')

            client
            .put('/api/roles/child')
            .send({
              extends: 'cousin'
            })
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              res.statusCode.should.eql(200)

              res.body.results.should.be.Array
              res.body.results.length.should.eql(1)
              res.body.results[0].name.should.eql('child')
              Object.keys(res.body.results[0].resources).should.eql(0)
              res.body.results[0].extends.should.eql('cousin')

              client
              .get('/api/roles/child')
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(200)

                res.body.results.should.be.Array
                res.body.results.length.should.eql(1)
                res.body.results[0].name.should.eql('child')
                Object.keys(res.body.results[0].resources).should.eql(0)
                res.body.results[0].extends.should.eql('cousin')

                done()
              })
            })
          })
        })
      })
    })
  })
}