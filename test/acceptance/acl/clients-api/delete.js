const app = require('./../../../../dadi/lib')
const config = require('./../../../../config')
const help = require('./../../help')
const request = require('supertest')
const should = require('should')

module.exports = () => {
  let configBackup = config.get()
  let client = request(`http://${config.get('server.host')}:${config.get('server.port')}`)

  describe('error states', () => {
    it('should return 401 if the request does not include a valid bearer token', done => {
      client
      .delete('/api/clients/someClient')
      .set('content-type', 'application/json')
      .expect('content-type', 'application/json')
      .end((err, res) => {
        res.statusCode.should.eql(401)

        done()
      })
    })

    it('should return 403 if the request includes a valid bearer token without sufficient permissions on the "clients" resource (no resource)', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret'
      }

      help.createACLClient(testClient).then(() => {
        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(testClient)
        .expect(200)
        .expect('content-type', 'application/json')
        .end((err, res) => {
          if (err) return done(err)

          res.body.accessToken.should.be.String

          let bearerToken = res.body.accessToken

          client
          .delete('/api/clients/someClient')
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

    it('should return 403 if the request includes a valid bearer token without sufficient permissions on the "clients" resource (falsy access type)', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          clients: {
            delete: false,
            read: true
          }
        }
      }

      help.createACLClient(testClient).then(() => {
        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(testClient)
        .expect(200)
        .expect('content-type', 'application/json')
        .end((err, res) => {
          if (err) return done(err)

          res.body.accessToken.should.be.String

          let bearerToken = res.body.accessToken

          client
          .delete('/api/clients/someClient')
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

    it('should return 404 if an authorised request tries to delete a client that does not exist', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          clients: {
            delete: true
          }
        }
      }

      help.createACLClient(testClient).then(() => {
        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(testClient)
        .expect(200)
        .expect('content-type', 'application/json')
        .end((err, res) => {
          if (err) return done(err)

          res.body.accessToken.should.be.String

          let bearerToken = res.body.accessToken

          client
          .delete('/api/clients/someClient')
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

  describe('success states (the client has "delete" access to the "clients" resource)', () => {
    it('should delete a client and return 204', done => {
      let testClient1 = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          clients: {
            delete: true,
            read: true
          }
        }
      }
      let testClient2 = {
        clientId: 'someClient',
        secret: 'someSecret'
      }

      help.createACLClient(testClient1).then(() => {
        return help.createACLClient(testClient2)
      }).then(() => {
        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send({
          clientId: testClient1.clientId,
          secret: testClient1.secret
        })
        .expect(200)
        .expect('content-type', 'application/json')
        .end((err, res) => {
          if (err) return done(err)

          res.body.accessToken.should.be.String

          let bearerToken = res.body.accessToken

          client
          .get(`/api/clients/${testClient2.clientId}`)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            res.statusCode.should.eql(200)

            res.body.results[0].clientId.should.eql(testClient2.clientId)

            client
            .delete(`/api/clients/${testClient2.clientId}`)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              res.statusCode.should.eql(204)

              client
              .get(`/api/clients/${testClient2.clientId}`)
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
    })

    it('should not issue tokens to clients that have been deleted', done => {
      let testClient1 = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          clients: {
            delete: true,
            read: true
          }
        }
      }
      let testClient2 = {
        clientId: 'someClient',
        secret: 'someSecret'
      }

      help.createACLClient(testClient1).then(() => {
        return help.createACLClient(testClient2)
      }).then(() => {
        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send({
          clientId: testClient1.clientId,
          secret: testClient1.secret
        })
        .expect(200)
        .expect('content-type', 'application/json')
        .end((err, res) => {
          if (err) return done(err)

          res.body.accessToken.should.be.String

          let bearerToken = res.body.accessToken

          client
          .post(config.get('auth.tokenUrl'))
          .set('content-type', 'application/json')
          .send({
            clientId: testClient2.clientId,
            secret: testClient2.secret
          })
          .expect(200)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            if (err) return done(err)

            res.statusCode.should.eql(200)
            res.body.accessToken.should.be.String

            client
            .delete(`/api/clients/${testClient2.clientId}`)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              res.statusCode.should.eql(204)

              client
              .post(config.get('auth.tokenUrl'))
              .set('content-type', 'application/json')
              .send({
                clientId: testClient2.clientId,
                secret: testClient2.secret
              })
              .expect('content-type', 'application/json')
              .end((err, res) => {
                if (err) return done(err)

                res.statusCode.should.eql(401)

                done()
              })
            })              
          })
        })
      })
    })
  })
}