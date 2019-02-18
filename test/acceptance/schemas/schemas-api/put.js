const config = require('./../../../../config')
const help = require('./../../help')
const request = require('supertest')
const should = require('should')

module.exports = () => {
  let client = request(`http://${config.get('server.host')}:${config.get('server.port')}`)

  describe('error states', () => {
    it('should return 401 if the request does not include a valid bearer token', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          collections: {
            create: true,
            update: true
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
            .put('/api/collections/1.0/testdb/newCollection/fields')
            .send(schema.fields)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer XXX`)
            .expect('content-type', 'application/json')
            .end((_err, res) => {
              res.statusCode.should.eql(401)

              done()
            })
          })
        })
      })
    })

    it.skip('should return 403 if the request includes a valid bearer token without sufficient permissions on the "collections" resource (no resource)', done => {
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
          .post('/api/collections')
          .send({
            database: 'testdb',
            name: 'newCollection',
            version: '1.0'
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
            create: true,
            update: false
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

            schema.fields.two = {
              type: 'Number'
            }

            client
            .put('/api/collections/1.0/testdb/newCollection/fields')
            .send(schema.fields)
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

    it('should return 400 if the request does not include all required properties', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          collections: {
            create: true,
            update: true
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

            schema.fields.two = {
              typex: 'Number'
            }

            client
            .put('/api/collections/1.0/testdb/newCollection/fields')
            .send(schema.fields)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((_err, res) => {
              res.statusCode.should.eql(400)
              res.body.success.should.eql(false)
              res.body.errors.should.be.Array
              res.body.errors[0].should.eql(
                'Missing field: type'
              )

              done()
            })
          })
        })
      })
    })

    it('should return 400 if the request contains an unknown property', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          collections: {
            create: true,
            update: true
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

            schema.fields.two = {
              type: 'Number',
              schmoofle: true
            }

            client
            .put('/api/collections/1.0/testdb/newCollection/fields')
            .send(schema.fields)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((_err, res) => {
              res.statusCode.should.eql(400)
              res.body.success.should.eql(false)
              res.body.errors.should.be.Array
              res.body.errors[0].should.eql(
                'Invalid field: schmoofle'
              )

              done()
            })
          })
        })
      })
    })
  })

  describe('success states (the client has "update" access to the "collections" resource)', () => {
    it('should update a schema\'s fields and return 200', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          collections: {
            create: true,
            update: true
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

            schema.fields.two = {
              type: 'Number'
            }

            client
            .put('/api/collections/1.0/testdb/newCollection/fields')
            .send(schema.fields)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((_err, res) => {
              res.statusCode.should.eql(200)

              res.body.results.should.be.Array
              res.body.results.length.should.eql(1)
              res.body.results[0].name.should.eql('newCollection')
              res.body.results[0].version.should.eql('1.0')

              res.body.results[0].fields.two.should.exist

              done()
            })
          })
        })
      })
    })

    it('should update a schema\'s settings and return 200', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          collections: {
            create: true,
            update: true
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

            schema.settings = {
              cache: false,
              compose: true,
              description: 'Updated by API'
            }

            client
            .put('/api/collections/1.0/testdb/newCollection/settings')
            .send(schema.settings)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((_err, res) => {
              res.statusCode.should.eql(200)

              res.body.results.should.be.Array
              res.body.results.length.should.eql(1)
              res.body.results[0].name.should.eql('newCollection')
              res.body.results[0].version.should.eql('1.0')

              res.body.results[0].settings.description.should.exist
              res.body.results[0].settings.description.should.eql('Updated by API')

              done()
            })
          })
        })
      })
    })

    it('should allow POST and GET using schema\'s new fields', done => {
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

            schema.fields.two = {
              type: 'Number'
            }

            client
            .put('/api/collections/1.0/testdb/newCollection/fields')
            .send(schema.fields)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((_err, res) => {
              res.statusCode.should.eql(200)

              res.body.results.should.be.Array
              res.body.results.length.should.eql(1)
              res.body.results[0].name.should.eql('newCollection')
              res.body.results[0].version.should.eql('1.0')

              res.body.results[0].fields.two.should.exist

              client
              .post('/1.0/testdb/newCollection')
              .send({
                one: 1001,
                two: 2000
              })
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((_err, res) => {
                client
                .get('/1.0/testdb/newCollection?fields={"two":1}')
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .expect('content-type', 'application/json')
                .end((_err, res) => {
                  res.statusCode.should.eql(200)

                  res.body.results.should.be.Array
                  res.body.results.length.should.eql(1)
                  res.body.results[0].two.should.eql(2000)
                  should.not.exist(res.body.results[0].one)

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
