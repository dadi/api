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
    secret: 'someSecret',
    roles: ['cousin']
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

  afterEach(done => {
    help.removeACLData(done)
  })

  describe('error states', () => {
    it('should return 401 if the request does not include a valid bearer token', done => {
      client
      .delete(`/api/clients/${targetClient.clientId}/roles/cousin`)
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
          .delete(`/api/clients/${targetClient.clientId}/roles/cousin`)
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
          .delete(`/api/clients/${targetClient.clientId}/roles/cousin`)
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
        resources: {
          clients: {
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
          .delete(`/api/clients/${targetClient.clientId}/roles/cousin`)
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

    it('should return 404 if the target client does not have the role supplied', done => {
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
          .delete(`/api/clients/${targetClient.clientId}/roles/parent`)
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

  describe('success states (the client has "update" access to the "clients" resource and has all the roles they are trying to assign)', () => {
    it('should remove a role from a client', done => {
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
            res.body.results[0].roles.should.eql(['cousin'])

            client
            .delete(`/api/clients/${targetClient.clientId}/roles/cousin`)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              res.statusCode.should.eql(204)

              client
              .get(`/api/clients/${targetClient.clientId}`)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(200)
                res.body.results[0].roles.should.eql([])

                done()
              })
            })
          })
        })
      })
    })
  })
}