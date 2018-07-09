const app = require('./../../../../dadi/lib')
const config = require('./../../../../config')
const help = require('./../../help')
const request = require('supertest')
const should = require('should')

let configBackup = config.get()
let client = request(`http://${config.get('server.host')}:${config.get('server.port')}`)

module.exports = () => {
  let targetClient = {
    clientId: 'targetClient',
    secret: 'someSecret'
  }

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
    }).then(() => {
      return help.createACLClient(targetClient)  
    })
  })

  describe('error states', () => {
    it('should return 401 if the request does not include a valid bearer token', done => {
      client
      .post(`/api/clients/${targetClient.clientId}/roles`)
      .send(['cousin'])
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

          let bearerToken = res.body.accessToken

          client
          .post(`/api/clients/${targetClient.clientId}/roles`)
          .send(['cousin'])
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
          .post(`/api/clients/${targetClient.clientId}/roles`)
          .send(['cousin'])
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

    it('should return 403 if the request includes a valid bearer token without sufficient permissions (requesting client does not have one of the assigned roles)', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
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
          .post(`/api/clients/${targetClient.clientId}/roles`)
          .send(['cousin'])
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

    it('should return 400 if the request body is not an array of roles', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
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
          .post(`/api/clients/${targetClient.clientId}/roles`)
          .send({role: 'cousin'})
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            res.statusCode.should.eql(400)

            res.body.success.should.eql(false)
            res.body.errors.should.be.Array
            res.body.errors.length.should.eql(1)
            res.body.errors[0].should.eql(
              'Invalid input. Expecting array of roles.'
            )

            done()
          })
        })
      })
    })

    it('should return 400 if the request body contains one or more invalid roles', done => {
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
          .post(`/api/clients/${targetClient.clientId}/roles`)
          .send(['cousin', 'child', 'sibling'])
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            res.statusCode.should.eql(400)

            res.body.success.should.eql(false)
            res.body.errors.should.be.Array
            res.body.errors.length.should.eql(1)
            res.body.errors[0].should.eql(
              'Invalid role: sibling'
            )

            done()
          })
        })
      })
    })    
  })

  describe('success states (the client has "update" access to the "clients" resource and has all the roles they are trying to assign)', () => {
    it('should assign a role to a client', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          clients: {
            read: true,
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
          .get(`/api/clients/${targetClient.clientId}`)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            res.statusCode.should.eql(200)
            res.body.results[0].roles.should.eql([])

            client
            .post(`/api/clients/${targetClient.clientId}/roles`)
            .send(['cousin'])
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              res.statusCode.should.eql(200)

              client
              .get(`/api/clients/${targetClient.clientId}`)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(200)
                res.body.results[0].roles.should.eql(['cousin'])

                done()
              })
            })
          })
        })
      })
    })

    it('should assign multiple roles to a client, ignoring any roles they already have', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          clients: {
            read: true,
            update: true
          }
        },
        roles: ['child', 'parent', 'cousin']
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
          .get(`/api/clients/${targetClient.clientId}`)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            res.statusCode.should.eql(200)
            res.body.results[0].roles.length.should.eql(0)

            client
            .post(`/api/clients/${targetClient.clientId}/roles`)
            .send(['cousin'])
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              res.statusCode.should.eql(200)

              client
              .get(`/api/clients/${targetClient.clientId}`)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(200)

                res.body.results[0].roles.length.should.eql(1)
                res.body.results[0].roles.includes('cousin').should.eql(true)

                client
                .post(`/api/clients/${targetClient.clientId}/roles`)
                .send(['cousin', 'child', 'parent'])
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .expect('content-type', 'application/json')
                .end((err, res) => {
                  res.statusCode.should.eql(200)

                  client
                  .get(`/api/clients/${targetClient.clientId}`)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .expect('content-type', 'application/json')
                  .end((err, res) => {
                    res.statusCode.should.eql(200)

                    res.body.results[0].roles.length.should.eql(3)
                    res.body.results[0].roles.includes('cousin').should.eql(true)
                    res.body.results[0].roles.includes('child').should.eql(true)
                    res.body.results[0].roles.includes('parent').should.eql(true)

                    done()
                  })
                })                
              })
            })
          })
        })
      })
    })    
  })
}