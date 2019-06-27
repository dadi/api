const app = require('./../../dadi/lib/')
const config = require('./../../config')
const fs = require('fs')
const help = require('./help')
const path = require('path')
const request = require('supertest')
const should = require('should')
const sinon = require('sinon')

const client = request(
  `http://${config.get('server.host')}:${config.get('server.port')}`
)

describe('Resources endpoint', function() {
  let bearerToken

  before(done => {
    help.removeACLData(() => {
      app.start(done)
    })
  })

  after(done => {
    help.removeACLData(() => {
      app.stop(done)
    })
  })

  it('should return 401 if the request does not contain a valid bearer token', done => {
    client
      .get(`/api/resources`)
      .set('content-type', 'application/json')
      .end((err, res) => {
        res.statusCode.should.eql(401)

        done()
      })
  })

  it('should list collection, media and custom endpoint resources', done => {
    help
      .getBearerTokenWithPermissions({
        accessType: 'admin'
      })
      .then(bearerToken => {
        client
          .get(`/api/resources`)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .end((err, res) => {
            Object.keys(app.components).forEach(key => {
              const component = app.components[key]
              let aclKey

              switch (component._type) {
                case app.COMPONENT_TYPE.COLLECTION:
                case app.COMPONENT_TYPE.MEDIA_COLLECTION:
                  aclKey = component.model.getAclKey()

                  break

                case app.COMPONENT_TYPE.CUSTOM_ENDPOINT:
                  aclKey = component.aclKey

                  break
              }

              if (!aclKey) return

              const match = res.body.results.some(result => {
                return result.name === aclKey
              })

              match.should.eql(true)
            })

            done()
          })
      })
  })

  it('should only list collection, media and custom endpoint resources for which the client has any type of access to (no resources)', done => {
    const testClient = {
      clientId: 'apiClient',
      secret: 'someSecret',
      resources: {
        'collection:testdb_test-schema': {
          create: false,
          read: false,
          update: false
        },
        'collection:testdb_test-required-schema': {
          delete: false,
          readOwn: false
        }
      }
    }

    help.createACLClient(testClient).then(() => {
      client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(testClient)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          const bearerToken = res.body.accessToken

          client
            .get(`/api/resources`)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect(200)
            .end((err, res) => {
              res.body.results.length.should.eql(0)

              done(err)
            })
        })
    })
  })

  it('should only list collection, media and custom endpoint resources for which the client has any type of access to (create access set to `true`)', done => {
    const testClient = {
      clientId: 'apiClient',
      secret: 'someSecret',
      resources: {
        'collection:testdb_test-schema': {
          create: true
        },
        'collection:testdb_test-required-schema': {
          delete: false
        }
      }
    }

    help.createACLClient(testClient).then(() => {
      client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(testClient)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          const bearerToken = res.body.accessToken

          client
            .get(`/api/resources`)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect(200)
            .end((err, res) => {
              res.body.results.length.should.eql(1)
              res.body.results[0].name.should.eql(
                'collection:testdb_test-schema'
              )

              done(err)
            })
        })
    })
  })

  it('should only list collection, media and custom endpoint resources for which the client has any type of access to (create access with `fields`)', done => {
    const testClient = {
      clientId: 'apiClient',
      secret: 'someSecret',
      resources: {
        'collection:testdb_test-schema': {
          create: {
            fields: {
              field1: 1
            }
          }
        },
        'collection:testdb_test-required-schema': {
          delete: false
        }
      }
    }

    help.createACLClient(testClient).then(() => {
      client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(testClient)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          const bearerToken = res.body.accessToken

          client
            .get(`/api/resources`)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect(200)
            .end((err, res) => {
              res.body.results.length.should.eql(1)
              res.body.results[0].name.should.eql(
                'collection:testdb_test-schema'
              )

              done(err)
            })
        })
    })
  })

  it('should only list collection, media and custom endpoint resources for which the client has any type of access to (create access with `filter`)', done => {
    const testClient = {
      clientId: 'apiClient',
      secret: 'someSecret',
      resources: {
        'collection:testdb_test-schema': {
          create: {
            filter: {
              field1: 'something'
            }
          }
        },
        'collection:testdb_test-required-schema': {
          delete: false
        }
      }
    }

    help.createACLClient(testClient).then(() => {
      client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(testClient)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          const bearerToken = res.body.accessToken

          client
            .get(`/api/resources`)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect(200)
            .end((err, res) => {
              res.body.results.length.should.eql(1)
              res.body.results[0].name.should.eql(
                'collection:testdb_test-schema'
              )

              done(err)
            })
        })
    })
  })

  it('should only list collection, media and custom endpoint resources for which the client has any type of access to (delete access set to `true`)', done => {
    const testClient = {
      clientId: 'apiClient',
      secret: 'someSecret',
      resources: {
        'collection:testdb_test-schema': {
          delete: true
        },
        'collection:testdb_test-required-schema': {
          delete: false
        }
      }
    }

    help.createACLClient(testClient).then(() => {
      client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(testClient)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          const bearerToken = res.body.accessToken

          client
            .get(`/api/resources`)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect(200)
            .end((err, res) => {
              res.body.results.length.should.eql(1)
              res.body.results[0].name.should.eql(
                'collection:testdb_test-schema'
              )

              done(err)
            })
        })
    })
  })

  it('should only list collection, media and custom endpoint resources for which the client has any type of access to (delete access with `filter`)', done => {
    const testClient = {
      clientId: 'apiClient',
      secret: 'someSecret',
      resources: {
        'collection:testdb_test-schema': {
          delete: {
            filter: {
              field1: 'something'
            }
          }
        },
        'collection:testdb_test-required-schema': {
          delete: false
        }
      }
    }

    help.createACLClient(testClient).then(() => {
      client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(testClient)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          const bearerToken = res.body.accessToken

          client
            .get(`/api/resources`)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect(200)
            .end((err, res) => {
              res.body.results.length.should.eql(1)
              res.body.results[0].name.should.eql(
                'collection:testdb_test-schema'
              )

              done(err)
            })
        })
    })
  })

  it('should only list collection, media and custom endpoint resources for which the client has any type of access to (read access set to `true`)', done => {
    const testClient = {
      clientId: 'apiClient',
      secret: 'someSecret',
      resources: {
        'collection:testdb_test-schema': {
          read: true
        },
        'collection:testdb_test-required-schema': {
          delete: false
        }
      }
    }

    help.createACLClient(testClient).then(() => {
      client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(testClient)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          const bearerToken = res.body.accessToken

          client
            .get(`/api/resources`)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect(200)
            .end((err, res) => {
              res.body.results.length.should.eql(1)
              res.body.results[0].name.should.eql(
                'collection:testdb_test-schema'
              )

              done(err)
            })
        })
    })
  })

  it('should only list collection, media and custom endpoint resources for which the client has any type of access to (read access with `fields`)', done => {
    const testClient = {
      clientId: 'apiClient',
      secret: 'someSecret',
      resources: {
        'collection:testdb_test-schema': {
          read: {
            fields: {
              field1: 1
            }
          }
        },
        'collection:testdb_test-required-schema': {
          delete: false
        }
      }
    }

    help.createACLClient(testClient).then(() => {
      client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(testClient)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          const bearerToken = res.body.accessToken

          client
            .get(`/api/resources`)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect(200)
            .end((err, res) => {
              res.body.results.length.should.eql(1)
              res.body.results[0].name.should.eql(
                'collection:testdb_test-schema'
              )

              done(err)
            })
        })
    })
  })

  it('should only list collection, media and custom endpoint resources for which the client has any type of access to (read access with `filter`)', done => {
    const testClient = {
      clientId: 'apiClient',
      secret: 'someSecret',
      resources: {
        'collection:testdb_test-schema': {
          read: {
            filter: {
              field1: 'something'
            }
          }
        },
        'collection:testdb_test-required-schema': {
          delete: false
        }
      }
    }

    help.createACLClient(testClient).then(() => {
      client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(testClient)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          const bearerToken = res.body.accessToken

          client
            .get(`/api/resources`)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect(200)
            .end((err, res) => {
              res.body.results.length.should.eql(1)
              res.body.results[0].name.should.eql(
                'collection:testdb_test-schema'
              )

              done(err)
            })
        })
    })
  })

  it('should only list collection, media and custom endpoint resources for which the client has any type of access to (update access set to `true`)', done => {
    const testClient = {
      clientId: 'apiClient',
      secret: 'someSecret',
      resources: {
        'collection:testdb_test-schema': {
          update: true
        },
        'collection:testdb_test-required-schema': {
          delete: false
        }
      }
    }

    help.createACLClient(testClient).then(() => {
      client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(testClient)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          const bearerToken = res.body.accessToken

          client
            .get(`/api/resources`)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect(200)
            .end((err, res) => {
              res.body.results.length.should.eql(1)
              res.body.results[0].name.should.eql(
                'collection:testdb_test-schema'
              )

              done(err)
            })
        })
    })
  })

  it('should only list collection, media and custom endpoint resources for which the client has any type of access to (update access with `fields`)', done => {
    const testClient = {
      clientId: 'apiClient',
      secret: 'someSecret',
      resources: {
        'collection:testdb_test-schema': {
          update: {
            fields: {
              field1: 1
            }
          }
        },
        'collection:testdb_test-required-schema': {
          delete: false
        }
      }
    }

    help.createACLClient(testClient).then(() => {
      client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(testClient)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          const bearerToken = res.body.accessToken

          client
            .get(`/api/resources`)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect(200)
            .end((err, res) => {
              res.body.results.length.should.eql(1)
              res.body.results[0].name.should.eql(
                'collection:testdb_test-schema'
              )

              done(err)
            })
        })
    })
  })

  it('should only list collection, media and custom endpoint resources for which the client has any type of access to (update access with `filter`)', done => {
    const testClient = {
      clientId: 'apiClient',
      secret: 'someSecret',
      resources: {
        'collection:testdb_test-schema': {
          update: {
            filter: {
              field1: 'something'
            }
          }
        },
        'collection:testdb_test-required-schema': {
          delete: false
        }
      }
    }

    help.createACLClient(testClient).then(() => {
      client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(testClient)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          const bearerToken = res.body.accessToken

          client
            .get(`/api/resources`)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect(200)
            .end((err, res) => {
              res.body.results.length.should.eql(1)
              res.body.results[0].name.should.eql(
                'collection:testdb_test-schema'
              )

              done(err)
            })
        })
    })
  })
})
