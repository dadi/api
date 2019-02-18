const config = require('./../../../../config')
const help = require('./../../help')
const request = require('supertest')
const should = require('should')

module.exports = () => {
  let client = request(`http://${config.get('server.host')}:${config.get('server.port')}`)

  describe('error states', () => {
    it('should return 401 if the request to /api/collections does not include a valid bearer token', done => {
      client
      .get('/api/collections')
      .set('content-type', 'application/json')
      .expect('content-type', 'application/json')
      .end((_err, res) => {
        res.statusCode.should.eql(401)

        done()
      })
    })

    it('should return 401 if the request to /api/collections/{ID} does not include a valid bearer token', done => {
      client
      .get('/api/collections/v1/testdb/test')
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
          .get('/api/collections')
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

          let bearerToken = res.body.accessToken

          client
          .get('/api/collections')
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

    it('should return 401 for an unauthenticated request trying to access a schema that does not exist', done => {
      client
      .get('/api/collections/v1/testdb/test')
      .set('content-type', 'application/json')
      .expect('content-type', 'application/json')
      .end((_err, res) => {
        res.statusCode.should.eql(401)

        done()
      })
    })

    it('should return 403 for an unauthorised request trying to access a schema that does not exist', done => {
      let testClient = {
        clientId: 'apiClient2',
        secret: 'someOtherSecret',
        resources: {
          collections: {
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

          let bearerToken = res.body.accessToken

          client
          .get('/api/collections/v1/testdb/test')
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

    it('should return 200 and an empty array for an authorised request trying to access a schema that does not exist', done => {
      let testClient = {
        clientId: 'apiClient2',
        secret: 'someOtherSecret',
        resources: {
          collections: {
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

          let bearerToken = res.body.accessToken

          client
          .get('/api/collections/v1/xxx/testdb')
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect('content-type', 'application/json')
          .end((_err, res) => {
            res.statusCode.should.eql(200)

            res.body.collections.should.be.Array
            res.body.collections.length.should.eql(0)

            done()
          })
        })
      })
    })
  })

  describe('success states (the client has "read" access to the "collections" resource)', () => {
    it('should list existing schemas', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          collections: {
            create: true,
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

          let bearerToken = res.body.accessToken

          let schema = {
            fields: {
              one: {
                type: 'Number'
              }
            },
            settings: {}
          }

          client
          .post('/api/collections/1.0/testdb/newCollection')
          .send(schema)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect('content-type', 'application/json')
          .end((_err, res) => {
            client
            .get('/api/collections')
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((_err, res) => {
              res.statusCode.should.eql(200)

              res.body.collections.should.be.Array

              let collection = res.body.collections.find(c => c.name === 'newCollection')

              collection.should.exist
              collection.database.should.eql('testdb')
              collection.version.should.eql('1.0')

              done()
            })
          })
        })
      })
    })

    it('should retrieve schemas by version/database/name', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          collections: {
            create: true,
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

          let bearerToken = res.body.accessToken

          let schema = {
            fields: {
              one: {
                type: 'Number'
              }
            },
            settings: {}
          }

          client
          .post('/api/collections/1.0/testdb/newCollection')
          .send(schema)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect('content-type', 'application/json')
          .end((_err, res) => {
            client
            .get('/api/collections/1.0/testdb/newCollection')
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((_err, res) => {
              res.statusCode.should.eql(200)

              res.body.collections.should.be.Array
              res.body.collections.length.should.eql(1)
              res.body.collections[0].name.should.eql('newCollection')
              res.body.collections[0].database.should.eql('testdb')
              res.body.collections[0].version.should.eql('1.0')

              done()
            })
          })
        })
      })
    })
  })
}
