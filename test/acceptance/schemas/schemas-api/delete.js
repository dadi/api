const config = require('./../../../../config')
const help = require('./../../help')
const request = require('supertest')
const should = require('should')

module.exports = () => {
  let client = request(`http://${config.get('server.host')}:${config.get('server.port')}`)

  describe('error states', () => {
    it('should return 401 if the request does not include a valid bearer token', done => {
      client
      .delete('/api/collections/1.0/testdb/newCollection')
      .set('content-type', 'application/json')
      .expect('content-type', 'application/json')
      .end((_err, res) => {
        res.statusCode.should.eql(401)

        done()
      })
    })

    it('should return 403 if the request includes a valid bearer token without sufficient permissions on the "collections" resource (no resource)', done => {
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
          .delete('/api/collections/1.0/testdb/newCollection')
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect('content-type', 'application/json')
          .end((_err, res) => {
            res.statusCode.should.eql(403)

            done()
          })
        })
      })
    })

    it('should return 403 if the request includes a valid bearer token without sufficient permissions on the "collections" resource (falsy access type)', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          collections: {
            create: true,
            read: true,
            delete: false
          }
        }
      }

      let schema = {
        fields: {
          one: {
            type: 'String'
          }
        },
        settings: {}
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
          .post('/api/collections/1.0/testdb/newCollection')
          .send(schema)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect('content-type', 'application/json')
          .end((_err, res) => {
            client
            .delete('/api/collections/1.0/testdb/newCollection')
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((_err, res) => {
              res.statusCode.should.eql(403)

              done()
            })
          })
        })
      })
    })

    it('should return 404 if the collection does not exist', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          collections: {
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
          .delete('/api/collections/1.0/test/test')
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect('content-type', 'application/json')
          .end((_err, res) => {
            res.statusCode.should.eql(404)

            done()
          })
        })
      })
    })
  })

  describe('success states (the client has "delete" access to the "collections" resource)', () => {
    it('should delete a schema and return 204', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          collections: {
            create: true,
            read: true,
            delete: true
          }
        }
      }

      let schema = {
        fields: {
          one: {
            type: 'Number'
          }
        },
        settings: {}
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
          .post('/api/collections/1.0/testdb/newCollection')
          .send(schema)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect('content-type', 'application/json')
          .end((_err, res) => {
            res.statusCode.should.eql(201)

            client
            .delete('/api/collections/1.0/testdb/newCollection')
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((_err, res) => {
              res.statusCode.should.eql(204)

              done()
            })
          })
        })
      })
    })

    it('should respond with 404 when querying deleted schema route', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        accessType: 'admin'
      }

      let schema = {
        fields: {
          one: {
            type: 'Number'
          }
        },
        settings: {}
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
          .post('/api/collections/1.0/testdb/newCollection')
          .send(schema)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect('content-type', 'application/json')
          .end((_err, res) => {
            res.statusCode.should.eql(201)

            client
            .get('/1.0/testdb/newCollection')
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((_err, res) => {
              res.statusCode.should.eql(200)

              client
              .delete('/api/collections/1.0/testdb/newCollection')
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((_err, res) => {
                res.statusCode.should.eql(204)

                client
                .get('/1.0/testdb/newCollection')
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .expect('content-type', 'application/json')
                .end((_err, res) => {
                  res.statusCode.should.eql(404)

                  done()
                })
              })
            })
          })
        })
      })
    })
  })
}
