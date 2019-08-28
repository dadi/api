const config = require('./../../../../config')
const help = require('./../../help')
const request = require('supertest')

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
    it('should return 401 if the request does not include a valid bearer token (client key via /api/clients)', done => {
      client
        .delete(
          `/api/clients/${targetClient.clientId}/keys/5d6552aadb23a6b73f9d6b36/resources/${resource}`
        )
        .set('content-type', 'application/json')
        .expect('content-type', 'application/json')
        .end((err, res) => {
          res.statusCode.should.eql(401)

          done(err)
        })
    })

    it('should return 401 if the request does not include a valid bearer token (client key via /api/client)', done => {
      client
        .delete(
          `/api/client/keys/5d6552aadb23a6b73f9d6b36/resources/${resource}`
        )
        .set('content-type', 'application/json')
        .expect('content-type', 'application/json')
        .end((err, res) => {
          res.statusCode.should.eql(401)

          done(err)
        })
    })

    it('should return 401 if the request does not include a valid bearer token (top-level key)', done => {
      client
        .delete(`/api/keys/5d6552aadb23a6b73f9d6b36/resources/${resource}`)
        .set('content-type', 'application/json')
        .expect('content-type', 'application/json')
        .end((err, res) => {
          res.statusCode.should.eql(401)

          done(err)
        })
    })

    it('should return 403 if a non-admin client is trying to delete a resource from a key that is associated with another client record', done => {
      const testClient1 = {
        clientId: 'apiClient1',
        secret: 'someSecret',
        resources: {
          'collection:library_book': {
            read: true,
            create: true
          }
        }
      }
      const testClient2 = {
        clientId: 'apiClient2',
        secret: 'someSecret'
      }

      help
        .createACLClient(testClient1)
        .then(() => help.createACLClient(testClient2))
        .then(() =>
          help.createACLKey({
            client: testClient2.clientId,
            resources: {
              'collection:library_book': {
                read: true
              }
            }
          })
        )
        .then(key => {
          client
            .post(config.get('auth.tokenUrl'))
            .set('content-type', 'application/json')
            .send(testClient1)
            .expect(200)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              if (err) return done(err)

              res.body.accessToken.should.be.String

              const bearerToken = res.body.accessToken

              client
                .delete(
                  `/api/clients/${testClient2.clientId}/keys/${key._id}/resources/collection:library_book`
                )
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .expect('content-type', 'application/json')
                .end((err, res) => {
                  res.statusCode.should.eql(403)

                  done(err)
                })
            })
        })
    })

    it('should return 404 if a non-admin client is trying to delete a resource from a key that is associated with another client record', done => {
      const testClient1 = {
        clientId: 'apiClient1',
        secret: 'someSecret',
        resources: {
          'collection:library_book': {
            read: true,
            create: true
          }
        }
      }
      const testClient2 = {
        clientId: 'apiClient2',
        secret: 'someSecret'
      }

      help
        .createACLClient(testClient1)
        .then(() => help.createACLClient(testClient2))
        .then(() =>
          help.createACLKey({
            _createdBy: testClient2.clientId,
            resources: {
              'collection:library_book': {
                read: true
              }
            }
          })
        )
        .then(key => {
          client
            .post(config.get('auth.tokenUrl'))
            .set('content-type', 'application/json')
            .send(testClient1)
            .expect(200)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              if (err) return done(err)

              res.body.accessToken.should.be.String

              const bearerToken = res.body.accessToken

              client
                .delete(
                  `/api/keys/${key._id}/resources/collection:library_book`
                )
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .expect('content-type', 'application/json')
                .end((err, res) => {
                  res.statusCode.should.eql(404)

                  done(err)
                })
            })
        })
    })
  })

  describe('success states', () => {
    describe('non-admin clients', () => {
      it('should delete a resource from a key that is associated with their client record', done => {
        const testClient = {
          clientId: 'apiClient1',
          secret: 'someSecret',
          resources: {
            'collection:library_book': {
              read: true,
              create: true
            }
          }
        }

        help
          .createACLClient(testClient)
          .then(() =>
            help.createACLKey({
              client: testClient.clientId,
              resources: {
                'collection:library_book': {
                  read: true
                }
              }
            })
          )
          .then(key => {
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
                  .delete(
                    `/api/client/keys/${key._id}/resources/collection:library_book`
                  )
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .expect('content-type', 'application/json')
                  .end((err, res) => {
                    res.statusCode.should.eql(204)

                    client
                      .get(`/api/client/keys`)
                      .set('content-type', 'application/json')
                      .set('Authorization', `Bearer ${bearerToken}`)
                      .expect('content-type', 'application/json')
                      .end((err, res) => {
                        const {results} = res.body

                        results.length.should.eql(1)
                        results[0]._id.should.eql(key._id)
                        Object.keys(results[0].resources).length.should.eql(0)

                        done(err)
                      })
                  })
              })
          })
      })

      it('should delete a resource from a top-level key that was created by themselves', done => {
        const testClient = {
          clientId: 'apiClient1',
          secret: 'someSecret',
          resources: {
            'collection:library_book': {
              read: true,
              create: true
            }
          }
        }

        help
          .createACLClient(testClient)
          .then(() =>
            help.createACLKey({
              _createdBy: testClient.clientId,
              resources: {
                'collection:library_book': {
                  read: true
                }
              }
            })
          )
          .then(key => {
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
                  .delete(
                    `/api/keys/${key._id}/resources/collection:library_book`
                  )
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .expect('content-type', 'application/json')
                  .end((err, res) => {
                    res.statusCode.should.eql(204)

                    client
                      .get(`/api/keys`)
                      .set('content-type', 'application/json')
                      .set('Authorization', `Bearer ${bearerToken}`)
                      .expect('content-type', 'application/json')
                      .end((err, res) => {
                        const {results} = res.body

                        results.length.should.eql(1)
                        results[0]._id.should.eql(key._id)
                        Object.keys(results[0].resources).length.should.eql(0)

                        done(err)
                      })
                  })
              })
          })
      })
    })

    describe('admin clients', () => {
      it('should delete a resource from a key that is associated with any client record', done => {
        const testClient = {
          clientId: 'apiClient1',
          secret: 'someSecret',
          resources: {
            'collection:library_book': {
              read: true,
              create: true
            }
          }
        }
        const adminClient = {
          clientId: 'apiClient2',
          secret: 'someSecret',
          accessType: 'admin'
        }

        help
          .createACLClient(testClient)
          .then(() => help.createACLClient(adminClient))
          .then(() =>
            help.createACLKey({
              client: testClient.clientId,
              resources: {
                'collection:library_book': {
                  read: true
                }
              }
            })
          )
          .then(key => {
            client
              .post(config.get('auth.tokenUrl'))
              .set('content-type', 'application/json')
              .send(adminClient)
              .expect(200)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                if (err) return done(err)

                res.body.accessToken.should.be.String

                const bearerToken = res.body.accessToken

                client
                  .delete(
                    `/api/clients/${testClient.clientId}/keys/${key._id}/resources/collection:library_book`
                  )
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .expect('content-type', 'application/json')
                  .end((err, res) => {
                    res.statusCode.should.eql(204)

                    client
                      .get(`/api/clients/${testClient.clientId}/keys`)
                      .set('content-type', 'application/json')
                      .set('Authorization', `Bearer ${bearerToken}`)
                      .expect('content-type', 'application/json')
                      .end((err, res) => {
                        const {results} = res.body

                        results.length.should.eql(1)
                        results[0]._id.should.eql(key._id)
                        Object.keys(results[0].resources).length.should.eql(0)

                        done(err)
                      })
                  })
              })
          })
      })

      it('should delete a resource from any top-level key', done => {
        const testClient = {
          clientId: 'apiClient1',
          secret: 'someSecret',
          resources: {
            'collection:library_book': {
              read: true,
              create: true
            }
          }
        }
        const adminClient = {
          clientId: 'apiClient2',
          secret: 'someSecret',
          accessType: 'admin'
        }

        help
          .createACLClient(testClient)
          .then(() => help.createACLClient(adminClient))
          .then(() =>
            help.createACLKey({
              _createdBy: testClient.clientId,
              resources: {
                'collection:library_book': {
                  read: true
                }
              }
            })
          )
          .then(key => {
            client
              .post(config.get('auth.tokenUrl'))
              .set('content-type', 'application/json')
              .send(adminClient)
              .expect(200)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                if (err) return done(err)

                res.body.accessToken.should.be.String

                const bearerToken = res.body.accessToken

                client
                  .delete(
                    `/api/keys/${key._id}/resources/collection:library_book`
                  )
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .expect('content-type', 'application/json')
                  .end((err, res) => {
                    res.statusCode.should.eql(204)

                    client
                      .get(`/api/keys`)
                      .set('content-type', 'application/json')
                      .set('Authorization', `Bearer ${bearerToken}`)
                      .expect('content-type', 'application/json')
                      .end((err, res) => {
                        const {results} = res.body

                        results.length.should.eql(1)
                        results[0]._id.should.eql(key._id)
                        Object.keys(results[0].resources).length.should.eql(0)

                        done(err)
                      })
                  })
              })
          })
      })
    })
  })
}
