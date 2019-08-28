const config = require('./../../../../config')
const help = require('./../../help')
const request = require('supertest')

module.exports = () => {
  const client = request(
    `http://${config.get('server.host')}:${config.get('server.port')}`
  )

  describe('error states', () => {
    it('should return 401 if the request to /api/keys does not include a valid bearer token', done => {
      client
        .post('/api/keys')
        .send({description: 'test key'})
        .set('content-type', 'application/json')
        .expect('content-type', 'application/json')
        .end((err, res) => {
          res.statusCode.should.eql(401)

          done(err)
        })
    })

    it('should return 401 if the request to /api/client/keys does not include a valid bearer token', done => {
      client
        .post('/api/client/keys')
        .send({description: 'test key'})
        .set('content-type', 'application/json')
        .expect('content-type', 'application/json')
        .end((err, res) => {
          res.statusCode.should.eql(401)

          done(err)
        })
    })

    it('should return 401 if the request to /api/clients/<CLIENT-ID>/keys does not include a valid bearer token', done => {
      client
        .post('/api/clients/someClient/keys')
        .send({description: 'test key'})
        .set('content-type', 'application/json')
        .expect('content-type', 'application/json')
        .end((err, res) => {
          res.statusCode.should.eql(401)

          done(err)
        })
    })

    it('should return 401 if the resources object contains an access type which the requesting client does not have', done => {
      const testClient = {
        clientId: 'apiClient1',
        secret: 'someSecret',
        resources: {
          clients: {
            read: true
          }
        }
      }
      const testKey = {
        description: 'hello world',
        resources: {
          clients: {
            read: true,
            update: true
          }
        }
      }

      help.createACLClient(testClient).then(key => {
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
              .post(`/api/keys`)
              .send(testKey)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(401)

                done(err)
              })
          })
      })
    })
  })

  describe('success states', () => {
    describe('non-admin clients', () => {
      it('should create a key associated with their client record', done => {
        const testClient = {
          clientId: 'apiClient1',
          secret: 'someSecret',
          resources: {
            clients: {
              read: true
            }
          }
        }

        help.createACLClient(testClient).then(key => {
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
                .post(`/api/client/keys`)
                .send({
                  resources: {
                    clients: {
                      read: true
                    }
                  }
                })
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .expect('content-type', 'application/json')
                .end((err, res) => {
                  const {results} = res.body

                  results.length.should.eql(1)
                  results[0]._id.should.be.String
                  results[0].token.should.be.String

                  client
                    .get(`/api/clients`)
                    .set('content-type', 'application/json')
                    .set('Authorization', `Bearer ${results[0].token}`)
                    .expect('content-type', 'application/json')
                    .end((err, res) => {
                      const {results} = res.body

                      results.length.should.eql(1)
                      results[0].clientId.should.eql(testClient.clientId)

                      done(err)
                    })
                })
            })
        })
      })

      it('should create a top-level key', done => {
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
        const testKey = {
          description: 'hello world',
          resources: {
            'collection:library_book': {
              read: true,
              create: true
            }
          }
        }
        const testDocument = {
          title: 'Building APIs'
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
                .post(`/api/keys`)
                .send(testKey)
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .expect('content-type', 'application/json')
                .end((err, res) => {
                  const {results} = res.body

                  results.length.should.eql(1)
                  results[0]._id.should.be.String
                  results[0].token.should.be.String
                  results[0].description.should.eql(testKey.description)

                  client
                    .post(`/library/book`)
                    .send(testDocument)
                    .set('content-type', 'application/json')
                    .set('Authorization', `Bearer ${results[0].token}`)
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
      it('should create a key associated with their client record', done => {
        const testClient = {
          clientId: 'apiClient1',
          secret: 'someSecret',
          accessType: 'admin'
        }

        help.createACLClient(testClient).then(key => {
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
                .post(`/api/client/keys`)
                .send({
                  resources: {
                    clients: {
                      read: true
                    }
                  }
                })
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .expect('content-type', 'application/json')
                .end((err, res) => {
                  const {results} = res.body

                  results.length.should.eql(1)
                  results[0]._id.should.be.String
                  results[0].token.should.be.String

                  client
                    .get(`/api/client`)
                    .set('content-type', 'application/json')
                    .set('Authorization', `Bearer ${results[0].token}`)
                    .expect('content-type', 'application/json')
                    .end((err, res) => {
                      const {results} = res.body

                      results.length.should.eql(1)
                      results[0].clientId.should.eql(testClient.clientId)

                      done(err)
                    })
                })
            })
        })
      })

      it('should create a key associated with any client record', done => {
        const testClient1 = {
          clientId: 'apiClient1',
          secret: 'someSecret',
          accessType: 'admin'
        }
        const testClient2 = {
          clientId: 'apiClient2',
          secret: 'someSecret'
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
              .send(testClient1)
              .expect(200)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                if (err) return done(err)

                res.body.accessToken.should.be.String

                const bearerToken = res.body.accessToken

                client
                  .post(`/api/clients/apiClient2/keys`)
                  .send({
                    resources: {
                      clients: {
                        read: true
                      }
                    }
                  })
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .expect('content-type', 'application/json')
                  .end((err, res) => {
                    const {results} = res.body

                    results.length.should.eql(1)
                    results[0]._id.should.be.String
                    results[0].token.should.be.String

                    client
                      .get(`/api/client`)
                      .set('content-type', 'application/json')
                      .set('Authorization', `Bearer ${results[0].token}`)
                      .expect('content-type', 'application/json')
                      .end((err, res) => {
                        const {results} = res.body

                        results.length.should.eql(1)
                        results[0].clientId.should.eql(testClient2.clientId)

                        done(err)
                      })
                  })
              })
          })
      })

      it('should create a top-level key', done => {
        const testClient = {
          clientId: 'apiClient1',
          secret: 'someSecret',
          accessType: 'admin'
        }
        const testKey = {
          description: 'hello world',
          resources: {
            'collection:library_book': {
              read: true,
              create: true
            }
          }
        }
        const testDocument = {
          title: 'Building APIs'
        }

        help.createACLClient(testClient).then(key => {
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
                .post(`/api/keys`)
                .send(testKey)
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .expect('content-type', 'application/json')
                .end((err, res) => {
                  const {results} = res.body

                  results.length.should.eql(1)
                  results[0]._id.should.be.String
                  results[0].token.should.be.String
                  results[0].description.should.eql(testKey.description)

                  client
                    .post(`/library/book`)
                    .send(testDocument)
                    .set('content-type', 'application/json')
                    .set('Authorization', `Bearer ${results[0].token}`)
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
