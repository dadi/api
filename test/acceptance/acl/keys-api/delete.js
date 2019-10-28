const config = require('./../../../../config')
const help = require('./../../help')
const request = require('supertest')

module.exports = () => {
  const client = request(
    `http://${config.get('server.host')}:${config.get('server.port')}`
  )

  describe('error states', () => {
    it('should return 401 if the request does not include a valid bearer token', done => {
      help.createACLKey().then(key => {
        client
          .delete(`/api/keys/${key._id}`)
          .set('content-type', 'application/json')
          .expect('content-type', 'application/json')
          .end((err, res) => {
            res.statusCode.should.eql(401)

            done(err)
          })
      })
    })

    it('should return 404 if a non-admin client attempts to delete a key created by someone else', done => {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret'
      }

      help
        .createACLClient(testClient)
        .then(() => {
          return help.createACLKey({_createdBy: 'apiClient2'})
        })
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
                .delete(`/api/keys/${key._id}`)
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

    it('should return 403 if a non-admin client attempts to delete a key associated with another client', done => {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret'
      }

      help
        .createACLClient(testClient)
        .then(() => {
          return help.createACLKey({client: testClient.clientId})
        })
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
                .delete(`/api/clients/apiClient2/keys/${key._id}`)
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
      it('should delete any keys associated with their client record', done => {
        const testClient = {
          clientId: 'apiClient',
          secret: 'someSecret'
        }

        help
          .createACLClient(testClient)
          .then(() => {
            return help.createACLKey({client: testClient.clientId})
          })
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
                  .delete(`/api/clients/${testClient.clientId}/keys/${key._id}`)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .expect('content-type', 'application/json')
                  .end((err, res) => {
                    res.statusCode.should.eql(204)

                    done(err)
                  })
              })
          })
      })

      it('should delete any top-level keys created by themselves', done => {
        const testClient = {
          clientId: 'apiClient',
          secret: 'someSecret'
        }

        help
          .createACLClient(testClient)
          .then(() => {
            return help.createACLKey({_createdBy: testClient.clientId})
          })
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
                  .delete(`/api/keys/${key._id}`)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .expect('content-type', 'application/json')
                  .end((err, res) => {
                    res.statusCode.should.eql(204)

                    done(err)
                  })
              })
          })
      })
    })

    describe('admin clients', () => {
      it('should delete any keys associated with any client record', done => {
        const testClient = {
          clientId: 'apiClient',
          secret: 'someSecret'
        }
        const adminClient = {
          clientId: 'adminClient',
          secret: 'someSecret',
          accessType: 'admin'
        }

        help
          .createACLClient(testClient)
          .then(() => {
            return help.createACLClient(adminClient)
          })
          .then(() => {
            return help.createACLKey({client: testClient.clientId})
          })
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
                  .delete(`/api/clients/${testClient.clientId}/keys/${key._id}`)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .expect('content-type', 'application/json')
                  .end((err, res) => {
                    res.statusCode.should.eql(204)

                    done(err)
                  })
              })
          })
      })

      it('should delete any top-level keys created by anyone', done => {
        const testClient = {
          clientId: 'apiClient',
          secret: 'someSecret'
        }
        const adminClient = {
          clientId: 'adminClient',
          secret: 'someSecret',
          accessType: 'admin'
        }

        help
          .createACLClient(testClient)
          .then(() => {
            return help.createACLClient(adminClient)
          })
          .then(() => {
            return help.createACLKey({_createdBy: testClient.clientId})
          })
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
                  .delete(`/api/keys/${key._id}`)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .expect('content-type', 'application/json')
                  .end((err, res) => {
                    res.statusCode.should.eql(204)

                    done(err)
                  })
              })
          })
      })
    })
  })
}
