const config = require('./../../../../config')
const help = require('./../../help')
const request = require('supertest')
const should = require('should')

module.exports = () => {
  let client = request(`http://${config.get('server.host')}:${config.get('server.port')}`)

  describe('error states', () => {
    it('should return 401 if the request does not include a valid bearer token', done => {
      client
      .post('/api/collections/1.0/testdb/newCollection')
      .send({
        fields: {},
        settings: {}
      })
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
          .post('/api/collections/1.0/testdb/newCollection')
          .send({
            fields: {},
            settings: {}
          })
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
            create: false,
            read: true
          }
        }
      }

      let schema = {
        fields: {},
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
            res.statusCode.should.eql(403)

            done()
          })
        })
      })
    })

    it('should return 400 if the request does not include all required properties', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          collections: {
            create: true
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
          .post('/api/collections/1.0/testdb/newCollection')
          .send({
            name: 'newCollection'
          })
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect('content-type', 'application/json')
          .end((_err, res) => {
            res.statusCode.should.eql(400)
            res.body.success.should.eql(false)
            res.body.errors.should.be.Array
            res.body.errors[0].should.eql(
              'Invalid input. Expected: {"fields": Object, "settings": Object}'
            )

            done()
          })
        })
      })
    })

    it('should return 400 if the request body includes an unknown property', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          collections: {
            create: true
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
          .post('/api/collections/1.0/testdb/newCollection')
          .send({
            something: 'else',
            fields: {},
            settings: {}
          })
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            res.statusCode.should.eql(400)

            res.body.success.should.eql(false)
            res.body.errors.should.be.Array
            res.body.errors[0].should.eql(
              'Invalid field: something'
            )

            done()
          })
        })
      })
    })

    it('should return 409 if a schema with the given name already exists', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          collections: {
            create: true
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
          .post('/api/collections/1.0/testdb/newCollection')
          .send({
            fields: {
              one: {
                type: 'Number'
              }
            },
            settings: {}
          })
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect('content-type', 'application/json')
          .end((_err, res) => {
            client
            .post('/api/collections/1.0/testdb/newCollection')
            .send({
              fields: {
                one: {
                  type: 'Number'
                }
              },
              settings: {}
            })
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((_err, res) => {
              res.statusCode.should.eql(409)
              res.body.success.should.eql(false)
              res.body.errors.should.be.Array
              res.body.errors[0].should.eql(
                'The collection already exists'
              )

              done()
            })
          })
        })
      })
    })
  })

  describe('success states (the client has "create" access to the "collections" resource)', () => {
    it('should create a schema and return a 201', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          collections: {
            create: true
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

            res.body.results.should.be.Array
            res.body.results.length.should.eql(1)
            res.body.results[0].name.should.eql('newCollection')
            res.body.results[0].version.should.eql('1.0')

            done()
          })
        })
      })
    })

    it('should respond with 200 when querying new schema route', done => {
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

              done()
            })
          })
        })
      })
    })
  })
}
