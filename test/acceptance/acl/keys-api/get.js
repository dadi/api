const config = require('./../../../../config')
const help = require('./../../help')
const promiseQueue = require('js-promise-queue')
const request = require('supertest')

module.exports = () => {
  const client = request(
    `http://${config.get('server.host')}:${config.get('server.port')}`
  )

  describe('error states', () => {
    it('should return 401 if the request to /api/keys does not include a valid bearer token', done => {
      client
        .get('/api/keys')
        .set('content-type', 'application/json')
        .expect('content-type', 'application/json')
        .end((err, res) => {
          res.statusCode.should.eql(401)

          done(err)
        })
    })

    it('should return 401 if the request to /api/client/keys does not include a valid bearer token', done => {
      client
        .get('/api/client/keys')
        .set('content-type', 'application/json')
        .expect('content-type', 'application/json')
        .end((err, res) => {
          res.statusCode.should.eql(401)

          done(err)
        })
    })

    it('should return 401 if the request to /api/clients/<CLIENT-ID>/keys does not include a valid bearer token', done => {
      client
        .get('/api/clients/someClient/keys')
        .set('content-type', 'application/json')
        .expect('content-type', 'application/json')
        .end((err, res) => {
          res.statusCode.should.eql(401)

          done(err)
        })
    })
  })

  describe('success states', () => {
    describe('non-admin clients', () => {
      it('should see list of keys associated with their client record', done => {
        const testClient = {
          clientId: 'apiClient1',
          secret: 'someSecret'
        }

        help
          .createACLClient(testClient)
          .then(() => {
            const clients = [
              'apiClient1',
              'apiClient2',
              'apiClient3',
              'apiClient4'
            ]

            return promiseQueue(clients, clientId =>
              help.createACLKey({client: clientId})
            )
          })
          .then(keys => {
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
                  .get(`/api/client/keys`)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .expect('content-type', 'application/json')
                  .end((err, res) => {
                    const {results} = res.body

                    results.length.should.eql(1)
                    results[0].client.should.eql(testClient.clientId)
                    results[0].token.should.eql(keys[0].token.slice(-5))

                    done(err)
                  })
              })
          })
      })

      it('should see list of top-level keys created by themselves', done => {
        const testClient = {
          clientId: 'apiClient1',
          secret: 'someSecret'
        }

        help
          .createACLClient(testClient)
          .then(() => {
            const clients = [
              'apiClient1',
              'apiClient2',
              'apiClient3',
              'apiClient4'
            ]

            return promiseQueue(clients, clientId =>
              help.createACLKey({_createdBy: clientId})
            )
          })
          .then(keys => {
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
                  .get(`/api/keys`)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .expect('content-type', 'application/json')
                  .end((err, res) => {
                    const {results} = res.body

                    results.length.should.eql(1)
                    results[0]._createdBy.should.eql(testClient.clientId)
                    results[0].token.should.eql(keys[0].token.slice(-5))

                    done(err)
                  })
              })
          })
      })
    })

    describe('admin clients', () => {
      it('should see list of keys associated with their client record', done => {
        const testClient = {
          clientId: 'apiClient1',
          secret: 'someSecret',
          accessType: 'admin'
        }

        help
          .createACLClient(testClient)
          .then(() => {
            const clients = [
              'apiClient1',
              'apiClient2',
              'apiClient3',
              'apiClient4'
            ]

            return promiseQueue(clients, clientId =>
              help.createACLKey({client: clientId})
            )
          })
          .then(keys => {
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
                  .get(`/api/client/keys`)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .expect('content-type', 'application/json')
                  .end((err, res) => {
                    const {results} = res.body

                    results.length.should.eql(1)
                    results[0].client.should.eql(testClient.clientId)
                    results[0].token.should.eql(keys[0].token.slice(-5))

                    done(err)
                  })
              })
          })
      })

      it('should see list of all top-level keys', done => {
        const testClient = {
          clientId: 'apiClient1',
          secret: 'someSecret',
          accessType: 'admin'
        }

        help
          .createACLClient(testClient)
          .then(() => {
            const clients = [
              'apiClient1',
              'apiClient2',
              'apiClient3',
              'apiClient4'
            ]

            return promiseQueue(clients, clientId =>
              help.createACLKey({_createdBy: clientId})
            )
          })
          .then(keys => {
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
                  .get(`/api/keys`)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .expect('content-type', 'application/json')
                  .end((err, res) => {
                    const {results} = res.body

                    results.length.should.eql(4)
                    results[0]._createdBy.should.eql(keys[0]._createdBy)
                    results[0].token.should.eql(keys[0].token.slice(-5))
                    results[1]._createdBy.should.eql(keys[1]._createdBy)
                    results[1].token.should.eql(keys[1].token.slice(-5))
                    results[2]._createdBy.should.eql(keys[2]._createdBy)
                    results[2].token.should.eql(keys[2].token.slice(-5))
                    results[3]._createdBy.should.eql(keys[3]._createdBy)
                    results[3].token.should.eql(keys[3].token.slice(-5))

                    done(err)
                  })
              })
          })
      })
    })
  })
}
