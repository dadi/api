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
        .post(
          `/api/clients/${targetClient.clientId}/keys/5d6552aadb23a6b73f9d6b36/resources`
        )
        .send({name: 'collection:library_book', access: {read: true}})
        .set('content-type', 'application/json')
        .expect('content-type', 'application/json')
        .end((err, res) => {
          res.statusCode.should.eql(401)

          done(err)
        })
    })

    it('should return 401 if the request does not include a valid bearer token (client key via /api/client)', done => {
      client
        .post(`/api/client/keys/5d6552aadb23a6b73f9d6b36/resources`)
        .send({name: 'collection:library_book', access: {read: true}})
        .set('content-type', 'application/json')
        .expect('content-type', 'application/json')
        .end((err, res) => {
          res.statusCode.should.eql(401)

          done(err)
        })
    })

    it('should return 401 if the request does not include a valid bearer token (top-level key)', done => {
      client
        .post(`/api/keys/5d6552aadb23a6b73f9d6b36/resources`)
        .send({name: 'collection:library_book', access: {read: true}})
        .set('content-type', 'application/json')
        .expect('content-type', 'application/json')
        .end((err, res) => {
          res.statusCode.should.eql(401)

          done(err)
        })
    })

    it('should return 403 if a non-admin client is trying to add a resource to a key that is associated with another client record', done => {
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
            client: testClient2.clientId
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
                .post(
                  `/api/clients/${testClient2.clientId}/keys/${key._id}/resources`
                )
                .send({
                  name: 'collection:library_book',
                  access: {
                    read: true,
                    create: true
                  }
                })
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

    it('should return 404 if a non-admin client is trying to add a resource to a top-level key that was created by another client', done => {
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
            _createdBy: testClient2.clientId
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
                .post(`/api/keys/${key._id}/resources`)
                .send({
                  name: 'collection:library_book',
                  access: {
                    read: true,
                    create: true
                  }
                })
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

    it('should return 403 if a non-admin client is trying to add a resource which they do not have access to themselves', done => {
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

      help
        .createACLClient(testClient1)
        .then(() =>
          help.createACLKey({
            _createdBy: testClient1.clientId
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
                .post(`/api/keys/${key._id}/resources`)
                .send({
                  name: 'collection:library_book',
                  access: {
                    read: true,
                    create: true,
                    update: true
                  }
                })
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
  })

  describe('success states', () => {
    describe('non-admin clients', () => {
      it('should add a resource to a key that is associated with their client record', done => {
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
        const testDocument = {
          title: 'Hello world!'
        }

        help
          .createACLClient(testClient)
          .then(() =>
            help.createACLKey({
              client: testClient.clientId
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
                  .post(`/api/client/keys/${key._id}/resources`)
                  .send({
                    name: 'collection:library_book',
                    access: {
                      read: true,
                      create: true
                    }
                  })
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .expect('content-type', 'application/json')
                  .end((err, res) => {
                    res.statusCode.should.eql(201)

                    client
                      .post(`/library/book`)
                      .send(testDocument)
                      .set('content-type', 'application/json')
                      .set('Authorization', `Bearer ${key.token}`)
                      .expect('content-type', 'application/json')
                      .end((err, res) => {
                        const {results} = res.body

                        results.length.should.eql(1)
                        results[0]._id.should.be.String
                        results[0].title.should.eql(testDocument.title)

                        done(err)
                      })
                  })
              })
          })
      })

      it('should add a resource to a top-level key that has been created by themselves', done => {
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
        const testDocument = {
          title: 'Hello world!'
        }

        help
          .createACLClient(testClient)
          .then(() =>
            help.createACLKey({
              _createdBy: testClient.clientId
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
                  .post(`/api/keys/${key._id}/resources`)
                  .send({
                    name: 'collection:library_book',
                    access: {
                      read: true,
                      create: true
                    }
                  })
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .expect('content-type', 'application/json')
                  .end((err, res) => {
                    res.statusCode.should.eql(201)

                    client
                      .post(`/library/book`)
                      .send(testDocument)
                      .set('content-type', 'application/json')
                      .set('Authorization', `Bearer ${key.token}`)
                      .expect('content-type', 'application/json')
                      .end((err, res) => {
                        const {results} = res.body

                        results.length.should.eql(1)
                        results[0]._id.should.be.String
                        results[0].title.should.eql(testDocument.title)

                        done(err)
                      })
                  })
              })
          })
      })
    })

    describe('admin clients', () => {
      it('should add a resource to a key that is associated with any client record', done => {
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
        const testDocument = {
          title: 'Hello world!'
        }

        help
          .createACLClient(testClient)
          .then(() => help.createACLClient(adminClient))
          .then(() =>
            help.createACLKey({
              client: testClient.clientId
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
                  .post(
                    `/api/clients/${testClient.clientId}/keys/${key._id}/resources`
                  )
                  .send({
                    name: 'collection:library_book',
                    access: {
                      read: true,
                      create: true
                    }
                  })
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .expect('content-type', 'application/json')
                  .end((err, res) => {
                    res.statusCode.should.eql(201)

                    client
                      .post(`/library/book`)
                      .send(testDocument)
                      .set('content-type', 'application/json')
                      .set('Authorization', `Bearer ${key.token}`)
                      .expect('content-type', 'application/json')
                      .end((err, res) => {
                        const {results} = res.body

                        results.length.should.eql(1)
                        results[0]._id.should.be.String
                        results[0].title.should.eql(testDocument.title)

                        done(err)
                      })
                  })
              })
          })
      })

      it('should add a resource to any top-level key', done => {
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
        const testDocument = {
          title: 'Hello world!'
        }

        help
          .createACLClient(testClient)
          .then(() => help.createACLClient(adminClient))
          .then(() =>
            help.createACLKey({
              _createdBy: testClient.clientId
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
                  .post(`/api/keys/${key._id}/resources`)
                  .send({
                    name: 'collection:library_book',
                    access: {
                      read: true,
                      create: true
                    }
                  })
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .expect('content-type', 'application/json')
                  .end((err, res) => {
                    res.statusCode.should.eql(201)

                    client
                      .post(`/library/book`)
                      .send(testDocument)
                      .set('content-type', 'application/json')
                      .set('Authorization', `Bearer ${key.token}`)
                      .expect('content-type', 'application/json')
                      .end((err, res) => {
                        const {results} = res.body

                        results.length.should.eql(1)
                        results[0]._id.should.be.String
                        results[0].title.should.eql(testDocument.title)

                        done(err)
                      })
                  })
              })
          })
      })
    })
  })
}
