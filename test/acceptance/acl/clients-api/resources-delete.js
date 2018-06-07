const app = require('./../../../../dadi/lib')
const config = require('./../../../../config')
const help = require('./../../help')
const request = require('supertest')
const should = require('should')

let configBackup = config.get()
let client = request(`http://${config.get('server.host')}:${config.get('server.port')}`)

module.exports = () => {
  let resource = 'collection:library_book'
  let targetClient = {
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
      .delete(`/api/clients/${targetClient.clientId}/resources/${resource}`)
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
          .delete(`/api/clients/${targetClient.clientId}/resources/${resource}`)
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
          .delete(`/api/clients/${targetClient.clientId}/resources/${resource}`)
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

    it('should return 403 if the request includes a valid bearer token without sufficient permissions (no full access to the referenced resource)', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          clients: {
            read: true,
            update: true
          },            
          [resource]: {
            create: true,
            delete: true
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
          .get(`/api/clients/${targetClient.clientId}`)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            res.body.results.should.be.Array
            res.body.results.length.should.eql(1)

            let result = res.body.results[0]

            should.exist(result.resources[resource])

            client
            .delete(`/api/clients/${targetClient.clientId}/resources/${resource}`)
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
    })    

    it('should return 404 if the referenced resource does not exist', done => {
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
          .delete(`/api/clients/${targetClient.clientId}/resources/other:resource`)
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
    it('should remove the client\'s permissions to access a resource', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          clients: {
            read: true,
            update: true
          },            
          [resource]: {
            create: true,
            delete: true,
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

          let bearerToken = res.body.accessToken

          client
          .get(`/api/clients/${targetClient.clientId}`)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            res.body.results.should.be.Array
            res.body.results.length.should.eql(1)

            let result = res.body.results[0]

            should.exist(result.resources[resource])

            client
            .delete(`/api/clients/${targetClient.clientId}/resources/${resource}`)
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
                res.body.results.should.be.Array
                res.body.results.length.should.eql(1)

                let result = res.body.results[0]

                should.not.exist(result.resources[resource])

                done()
              })
            })
          })
        })
      })
    })
  })
}