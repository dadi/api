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

  describe('error states', () => {
    it('should return 401 if the request to /api/clients does not include a valid bearer token', done => {
      client
        .get('/api/clients')
        .set('content-type', 'application/json')
        .expect('content-type', 'application/json')
        .end((err, res) => {
          res.statusCode.should.eql(401)

          done()
        })
    })

    it('should return 401 if the request to /api/clients/{ID} does not include a valid bearer token', done => {
      client
        .get('/api/clients/testClient')
        .set('content-type', 'application/json')
        .expect('content-type', 'application/json')
        .end((err, res) => {
          res.statusCode.should.eql(401)

          done()
        })
    })

    it('should return 401 if the request to /api/client does not include a valid bearer token', done => {
      client
        .get('/api/client')
        .set('content-type', 'application/json')
        .expect('content-type', 'application/json')
        .end((err, res) => {
          res.statusCode.should.eql(401)

          done()
        })
    })

    it('should return 403 if the request includes a valid bearer token without sufficient permissions on the "clients" resource (no resource)', done => {
      const testClient = {
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

            const bearerToken = res.body.accessToken

            client
              .get('/api/clients')
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
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          clients: {
            create: true,
            read: false
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

            const bearerToken = res.body.accessToken

            client
              .get('/api/clients')
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

    it('should return 401 for an unauthenticated request trying to access a client that does not exist', done => {
      client
        .get('/api/clients/johndoe')
        .set('content-type', 'application/json')
        .expect('content-type', 'application/json')
        .end((err, res) => {
          res.statusCode.should.eql(401)

          done()
        })
    })

    it('should return 403 for an unauthorised request trying to access a client that does not exist', done => {
      const testClient = {
        clientId: 'apiClient2',
        secret: 'someOtherSecret',
        resources: {
          clients: {
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
              .get('/api/clients/johndoe')
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

    it('should return 404 for an authorised request trying to access a client that does not exist', done => {
      const testClient = {
        clientId: 'apiClient2',
        secret: 'someOtherSecret',
        resources: {
          clients: {
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
              .get('/api/clients/johndoe')
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

  describe('success states (the client has "read" access to the "clients" resource)', () => {
    it('should list existing clients', done => {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          clients: {
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
              .get('/api/clients')
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(200)

                res.body.results.should.be.Array
                res.body.results.length.should.eql(1)
                res.body.results[0].clientId.should.eql(testClient.clientId)
                res.body.results[0].accessType.should.eql('user')

                should.not.exist(res.body.results[0].secret)

                Object.keys(res.body.results[0].resources).should.eql([
                  'clients'
                ])

                res.body.results[0].resources.clients.create.should.eql(false)
                res.body.results[0].resources.clients.delete.should.eql(false)
                res.body.results[0].resources.clients.deleteOwn.should.eql(
                  false
                )
                res.body.results[0].resources.clients.read.should.eql(true)
                res.body.results[0].resources.clients.readOwn.should.eql(false)
                res.body.results[0].resources.clients.update.should.eql(false)
                res.body.results[0].resources.clients.updateOwn.should.eql(
                  false
                )

                done()
              })
          })
      })
    })

    it('should retrieve clients by name, ommitting the `secret` property', done => {
      const testClient1 = {
        clientId: 'apiClient1',
        secret: 'someSecret'
      }

      const testClient2 = {
        clientId: 'apiClient2',
        secret: 'someOtherSecret',
        resources: {
          clients: {
            read: true
          }
        }
      }

      help
        .createACLClient(testClient1)
        .then(() => {
          return help.createACLClient(testClient2)
        })
        .then(() => {
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

              res.body.accessToken.should.be.String

              const bearerToken = res.body.accessToken

              client
                .get(`/api/clients/${testClient1.clientId}`)
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .expect('content-type', 'application/json')
                .end((err, res) => {
                  res.statusCode.should.eql(200)

                  res.body.results.should.be.Array
                  res.body.results.length.should.eql(1)
                  res.body.results[0].clientId.should.eql(testClient1.clientId)
                  res.body.results[0].accessType.should.eql('user')

                  should.not.exist(res.body.results[0].secret)

                  Object.keys(res.body.results[0].resources).length.should.eql(
                    0
                  )

                  done()
                })
            })
        })
    })

    it('should retrieve a data object associated with a client', done => {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret'
      }
      const newData = {
        keyOne: 1
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
              .put(`/api/clients/${testClient.clientId}`)
              .send({
                data: newData
              })
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(200)

                res.body.results.should.be.Array
                res.body.results.length.should.eql(1)
                res.body.results[0].clientId.should.eql(testClient.clientId)
                res.body.results[0].data.should.eql(newData)

                should.not.exist(res.body.results[0].secret)

                client
                  .get(`/api/clients/${testClient.clientId}`)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .expect('content-type', 'application/json')
                  .end((err, res) => {
                    res.statusCode.should.eql(200)

                    res.body.results.should.be.Array
                    res.body.results.length.should.eql(1)
                    res.body.results[0].clientId.should.eql(testClient.clientId)
                    res.body.results[0].data.should.eql(newData)

                    done()
                  })
              })
          })
      })
    })

    it('should display protected properties present in the data object associated with a client', done => {
      const testClient1 = {
        clientId: 'apiClient',
        secret: 'someSecret'
      }
      const testClient2 = {
        clientId: 'adminClient',
        secret: 'someSecret',
        accessType: 'admin'
      }
      const newData = {
        _keyOne: 1
      }

      help
        .createACLClient(testClient1)
        .then(() => {
          return help.createACLClient(testClient2)
        })
        .then(() => {
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

              res.body.accessToken.should.be.String

              const adminToken = res.body.accessToken

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

                  res.body.accessToken.should.be.String

                  const bearerToken = res.body.accessToken

                  client
                    .put(`/api/clients/${testClient1.clientId}`)
                    .send({
                      data: newData
                    })
                    .set('content-type', 'application/json')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .expect('content-type', 'application/json')
                    .end((err, res) => {
                      res.statusCode.should.eql(200)

                      res.body.results.should.be.Array
                      res.body.results.length.should.eql(1)
                      res.body.results[0].clientId.should.eql(
                        testClient1.clientId
                      )
                      res.body.results[0].data.should.eql(newData)

                      should.not.exist(res.body.results[0].secret)

                      client
                        .get(`/api/clients/${testClient1.clientId}`)
                        .set('content-type', 'application/json')
                        .set('Authorization', `Bearer ${bearerToken}`)
                        .expect('content-type', 'application/json')
                        .end((err, res) => {
                          res.statusCode.should.eql(200)

                          res.body.results.should.be.Array
                          res.body.results.length.should.eql(1)
                          res.body.results[0].clientId.should.eql(
                            testClient1.clientId
                          )
                          res.body.results[0].data.should.eql(newData)

                          done()
                        })
                    })
                })
            })
        })
    })
  })

  describe('success states (the client is retrieving his own record)', () => {
    it('should list existing clients', done => {
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
              .get('/api/client')
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(200)

                res.body.results.should.be.Array
                res.body.results.length.should.eql(1)
                res.body.results[0].clientId.should.eql(testClient.clientId)
                res.body.results[0].accessType.should.eql('user')

                should.not.exist(res.body.results[0].secret)

                done()
              })
          })
      })
    })
  })
}
