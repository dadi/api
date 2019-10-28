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

  beforeEach(() => {
    return help
      .createACLRole({
        name: 'parent'
      })
      .then(() => {
        return help.createACLRole({
          name: 'child',
          extends: 'parent'
        })
      })
      .then(() => {
        return help.createACLRole({
          name: 'cousin'
        })
      })
  })

  describe('error states', () => {
    it('should return 401 if the request does not include a valid bearer token', done => {
      client
        .get('/api/roles')
        .set('content-type', 'application/json')
        .expect('content-type', 'application/json')
        .end((err, res) => {
          res.statusCode.should.eql(401)

          done()
        })
    })

    it('should return 403 if the request includes a valid bearer token without sufficient permissions on the "roles" resource (no resource)', done => {
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
              .get('/api/roles')
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

    it('should return 403 if the request includes a valid bearer token without sufficient permissions on the "roles" resource (falsy access type)', done => {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          roles: {
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
              .get('/api/roles')
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

    it('should return 404 when trying to get a role that does not exist', done => {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          roles: {
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
              .get('/api/roles/does-not-exist')
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

  describe('success states (the client has "read" access to the "roles" resource)', () => {
    it('should return a list of roles and sort them alphabetically by name', done => {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          roles: {
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
              .get('/api/roles')
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(200)

                const results = res.body.results

                results.should.be.Array
                results.length.should.eql(3)

                results[0].name.should.eql('child')
                results[0].extends.should.eql('parent')
                Object.keys(results[0].resources).length.should.eql(0)

                results[1].name.should.eql('cousin')
                should.equal(results[1].extends, null)
                Object.keys(results[1].resources).length.should.eql(0)

                results[2].name.should.eql('parent')
                should.equal(results[2].extends, null)
                Object.keys(results[2].resources).length.should.eql(0)

                done()
              })
          })
      })
    })

    it('should list new roles after they are added', done => {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          roles: {
            create: true,
            read: true
          }
        },
        roles: ['cousin']
      }
      const newRole = {
        name: 'aaaa',
        extends: 'cousin'
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
              .get('/api/roles')
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(200)

                const results = res.body.results

                results.should.be.Array
                results.length.should.eql(3)

                results[0].name.should.eql('child')
                results[0].extends.should.eql('parent')
                Object.keys(results[0].resources).length.should.eql(0)

                results[1].name.should.eql('cousin')
                should.equal(results[1].extends, null)
                Object.keys(results[1].resources).length.should.eql(0)

                results[2].name.should.eql('parent')
                should.equal(results[2].extends, null)
                Object.keys(results[2].resources).length.should.eql(0)

                client
                  .post('/api/roles')
                  .send(newRole)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .expect('content-type', 'application/json')
                  .end((err, res) => {
                    res.statusCode.should.eql(201)

                    res.body.results.should.be.Array
                    res.body.results.length.should.eql(1)
                    res.body.results[0].name.should.eql(newRole.name)
                    res.body.results[0].extends.should.eql(newRole.extends)
                    Object.keys(res.body.results[0].resources).should.eql(0)

                    client
                      .get('/api/roles')
                      .set('content-type', 'application/json')
                      .set('Authorization', `Bearer ${bearerToken}`)
                      .expect('content-type', 'application/json')
                      .end((err, res) => {
                        res.statusCode.should.eql(200)

                        const results = res.body.results

                        results.should.be.Array
                        results.length.should.eql(4)

                        results[0].name.should.eql(newRole.name)
                        results[0].extends.should.eql(newRole.extends)
                        Object.keys(results[0].resources).length.should.eql(0)

                        results[1].name.should.eql('child')
                        results[1].extends.should.eql('parent')
                        Object.keys(results[1].resources).length.should.eql(0)

                        results[2].name.should.eql('cousin')
                        should.equal(results[2].extends, null)
                        Object.keys(results[2].resources).length.should.eql(0)

                        results[3].name.should.eql('parent')
                        should.equal(results[3].extends, null)
                        Object.keys(results[3].resources).length.should.eql(0)

                        done()
                      })
                  })
              })
          })
      })
    })

    it('should not list roles after they have been deleted', done => {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          roles: {
            delete: true,
            read: true
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

            const bearerToken = res.body.accessToken

            client
              .get('/api/roles')
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(200)

                const results = res.body.results

                results.should.be.Array
                results.length.should.eql(3)

                results[0].name.should.eql('child')
                results[0].extends.should.eql('parent')
                Object.keys(results[0].resources).length.should.eql(0)

                results[1].name.should.eql('cousin')
                should.equal(results[1].extends, null)
                Object.keys(results[1].resources).length.should.eql(0)

                results[2].name.should.eql('parent')
                should.equal(results[2].extends, null)
                Object.keys(results[2].resources).length.should.eql(0)

                client
                  .delete('/api/roles/cousin')
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .expect('content-type', 'application/json')
                  .end((err, res) => {
                    res.statusCode.should.eql(204)

                    client
                      .get('/api/roles')
                      .set('content-type', 'application/json')
                      .set('Authorization', `Bearer ${bearerToken}`)
                      .expect('content-type', 'application/json')
                      .end((err, res) => {
                        res.statusCode.should.eql(200)

                        const results = res.body.results

                        results.should.be.Array
                        results.length.should.eql(2)

                        results[0].name.should.eql('child')
                        results[0].extends.should.eql('parent')
                        Object.keys(results[0].resources).length.should.eql(0)

                        results[1].name.should.eql('parent')
                        should.equal(results[1].extends, null)
                        Object.keys(results[1].resources).length.should.eql(0)

                        done()
                      })
                  })
              })
          })
      })
    })

    it('should get a role by name', done => {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          roles: {
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
              .get('/api/roles/child')
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(200)

                const results = res.body.results

                results.should.be.Array
                results.length.should.eql(1)

                results[0].name.should.eql('child')
                results[0].extends.should.eql('parent')
                Object.keys(results[0].resources).length.should.eql(0)

                done()
              })
          })
      })
    })
  })
}
