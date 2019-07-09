const app = require('./../../../dadi/lib')
const config = require('./../../../config')
const help = require('./../help')
const request = require('supertest')
const should = require('should')

const PERMISSIONS = {
  ALL: {create: true, read: true, update: true, delete: true},
  NO_READ: {read: false},
  CREATE: {create: true, read: true, update: false, delete: false},
  READ: {create: false, read: true, update: false, delete: false},
  UPDATE: {create: false, read: true, update: true, delete: false},
  DELETE: {create: false, read: false, update: false, delete: true},
  READ_EXCLUDE_FIELDS: {read: {fields: {title: 0}}},
  FILTER: {read: {filter: '{"title":"very long title"}'}}
}

const client = request(
  `http://${config.get('server.host')}:${config.get('server.port')}`
)
let docs

describe('Collections API', () => {
  before(done => {
    config.set('search.enabled', true)
    config.set('search.minQueryLength', 3)
    config.set('search.wordCollection', 'words')
    config.set('search.datastore', './../../../test/test-connector')
    config.set('search.database', 'testdb')

    app.start(err => {
      if (err) return done(err)

      setTimeout(done, 300)
    })
  })

  beforeEach(done => {
    // Before each test, clear ACL, create a dummy document, clear ACL
    help.removeACLData(() => {
      const creatingClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          'collection:testdb_test-schema': PERMISSIONS.CREATE
        }
      }

      help
        .createACLClient(creatingClient)
        .then(() => {
          return help.createSchemas([
            {
              fields: {
                title: {
                  type: 'String',
                  required: true
                },
                author: {
                  type: 'Reference',
                  settings: {
                    collection: 'person',
                    fields: ['name', 'spouse']
                  }
                },
                booksInSeries: {
                  type: 'Reference',
                  settings: {
                    collection: 'book',
                    multiple: true
                  }
                }
              },
              name: 'book',
              property: 'library',
              settings: {
                cache: false,
                authenticate: true,
                count: 40
              },
              version: '1.0'
            },

            {
              fields: {
                name: {
                  type: 'String',
                  required: true
                },
                occupation: {
                  type: 'String',
                  required: false
                },
                nationality: {
                  type: 'String',
                  required: false
                },
                education: {
                  type: 'String',
                  required: false
                },
                spouse: {
                  type: 'Reference'
                }
              },
              name: 'person',
              property: 'library',
              settings: {
                cache: false,
                authenticate: true,
                count: 40
              },
              version: '1.0'
            },

            {
              fields: {
                field1: {
                  type: 'String',
                  label: 'Title',
                  comments: 'The title of the entry',
                  validation: {},
                  required: false
                },
                title: {
                  type: 'String',
                  label: 'Title',
                  comments: 'The title of the entry',
                  validation: {},
                  required: false,
                  search: {
                    weight: 2
                  }
                },
                leadImage: {
                  type: 'Media'
                },
                leadImageJPEG: {
                  type: 'Media',
                  validation: {
                    mimeTypes: ['image/jpeg']
                  }
                },
                legacyImage: {
                  type: 'Reference',
                  settings: {
                    collection: 'mediaStore'
                  }
                },
                fieldReference: {
                  type: 'Reference',
                  settings: {
                    collection: 'test-reference-schema'
                  }
                }
              },
              name: 'test-schema',
              property: 'testdb',
              settings: {
                cache: true,
                cacheTTL: 300,
                authenticate: true,
                count: 40,
                sortOrder: 1,
                storeRevisions: true,
                revisionCollection: 'testSchemaHistory'
              },
              version: 'vtest'
            },

            {
              fields: {
                refField1: {
                  type: 'String',
                  required: false
                },
                refField2: {
                  type: 'Number',
                  required: false
                }
              },
              name: 'test-reference-schema',
              property: 'testdb',
              settings: {},
              version: 'vtest'
            },

            {
              fields: {
                field1: {
                  type: 'String',
                  required: true
                },
                field2: {
                  type: 'String',
                  required: false
                }
              },
              name: 'test-required-schema',
              property: 'testdb',
              settings: {},
              version: 'vtest'
            },

            {
              fields: {
                field1: {
                  type: 'String',
                  label: 'Title',
                  comments: 'The title of the entry',
                  validation: {},
                  required: false
                },
                title: {
                  type: 'String',
                  label: 'Title',
                  comments: 'The title of the entry',
                  validation: {},
                  required: false,
                  search: {
                    weight: 2
                  }
                }
              },
              name: 'test-authenticate-false',
              property: 'testdb',
              settings: {
                authenticate: false
              },
              version: 'vtest'
            },

            {
              fields: {
                field1: {
                  type: 'String',
                  label: 'Title',
                  comments: 'The title of the entry',
                  validation: {},
                  required: false
                },
                title: {
                  type: 'String',
                  label: 'Title',
                  comments: 'The title of the entry',
                  validation: {},
                  required: false,
                  search: {
                    weight: 2
                  }
                }
              },
              name: 'test-authenticate-post-put-delete',
              property: 'testdb',
              settings: {
                authenticate: ['POST', 'PUT', 'DELETE']
              },
              version: 'vtest'
            },

            {
              fields: {
                field1: {
                  type: 'String',
                  label: 'Title',
                  comments: 'The title of the entry',
                  validation: {},
                  required: false
                },
                title: {
                  type: 'String',
                  label: 'Title',
                  comments: 'The title of the entry',
                  validation: {},
                  required: false,
                  search: {
                    weight: 2
                  }
                }
              },
              name: 'test-authenticate-get-put-delete',
              property: 'testdb',
              settings: {
                authenticate: ['GET', 'PUT', 'DELETE']
              },
              version: 'vtest'
            },

            {
              fields: {
                field1: {
                  type: 'String',
                  label: 'Title',
                  comments: 'The title of the entry',
                  validation: {},
                  required: false
                },
                title: {
                  type: 'String',
                  label: 'Title',
                  comments: 'The title of the entry',
                  validation: {},
                  required: false,
                  search: {
                    weight: 2
                  }
                }
              },
              name: 'test-authenticate-get-post-delete',
              property: 'testdb',
              settings: {
                authenticate: ['GET', 'POST', 'DELETE']
              },
              version: 'vtest'
            },

            {
              fields: {
                field1: {
                  type: 'String',
                  label: 'Title',
                  comments: 'The title of the entry',
                  validation: {},
                  required: false
                },
                title: {
                  type: 'String',
                  label: 'Title',
                  comments: 'The title of the entry',
                  validation: {},
                  required: false,
                  search: {
                    weight: 2
                  }
                }
              },
              name: 'test-authenticate-get-post-put',
              property: 'testdb',
              settings: {
                authenticate: ['GET', 'POST', 'PUT']
              },
              version: 'vtest'
            },

            {
              fields: {
                field1: {
                  type: 'String',
                  label: 'Title',
                  comments: 'The title of the entry',
                  validation: {},
                  required: false
                },
                title: {
                  type: 'String',
                  label: 'Title',
                  comments: 'The title of the entry',
                  validation: {},
                  required: false,
                  search: {
                    weight: 2
                  }
                }
              },
              name: 'test-authenticate-get-post-put-delete',
              property: 'testdb',
              settings: {
                authenticate: ['GET', 'POST', 'PUT', 'DELETE']
              },
              version: 'vtest'
            }
          ])
        })
        .then(() => {
          client
            .post(config.get('auth.tokenUrl'))
            .set('content-type', 'application/json')
            .send(creatingClient)
            .end(async (err, res) => {
              createToken = res.body.accessToken

              try {
                await help.dropDatabase('library', 'person')
                await help.dropDatabase('library', 'book')
                await help.dropDatabase('testdb', 'test-schema')
                await help.dropDatabase('testdb', 'test-reference-schema')
                await help.dropDatabase('testdb', 'test-required-schema')
                await help.dropDatabase(
                  config.get('search.database'),
                  config.get('search.wordCollection')
                )
                await help.dropDatabase(
                  config.get('search.database'),
                  config.get('search.indexCollection')
                )

                const op1 = await help.createDocument({
                  version: 'vtest',
                  database: 'testdb',
                  collection: 'test-schema',
                  document: {field1: '7', title: 'test doc'},
                  token: res.body.accessToken
                })

                const op2 = await help.createDocument({
                  version: 'vtest',
                  database: 'testdb',
                  collection: 'test-schema',
                  document: {
                    field1: '11',
                    title: 'very long title'
                  },
                  token: res.body.accessToken
                })

                docs = [op1.results[0]._id, op2.results[0]._id]

                help.removeACLData(done)
              } catch (error) {
                done(err)
              }
            })
        })
    })
  })

  after(done => {
    help.removeACLData(() => {
      config.set('search.enabled', false)
      config.set('search.minQueryLength', 3)
      config.set('search.wordCollection', 'words')
      config.set('search.datastore', './../../../test/test-connector')
      config.set('search.database', 'testdb')

      help.dropSchemas().then(() => {
        app.stop(done)
      })
    })
  })

  describe('Search', function() {
    it('should return 403 with no permissions', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {'collection:testdb_test-schema': {}}
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
              .get(`/vtest/testdb/test-schema/search?q=xyz`)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                if (err) return done(err)
                res.statusCode.should.eql(403)
                done()
              })
          })
      })
    })

    it('should return 403 with no read permission', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {'collection:testdb_test-schema': PERMISSIONS.NO_READ}
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
              .get(`/vtest/testdb/test-schema/search?q=xyz`)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                if (err) return done(err)
                res.statusCode.should.eql(403)
                done()
              })
          })
      })
    })

    it('should return 200 with read permission', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {'collection:testdb_test-schema': PERMISSIONS.READ}
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
              .get(`/vtest/testdb/test-schema/search?q=fghj`)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                if (err) return done(err)
                res.statusCode.should.eql(200)
                done()
              })
          })
      })
    })
  })

  describe('GET', function() {
    it('should return 403 with no permissions', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {'collection:testdb_test-schema': {}}
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
              .get(`/vtest/testdb/test-schema`)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                if (err) return done(err)
                res.statusCode.should.eql(403)
                done()
              })
          })
      })
    })

    it('should return 403 with no read permission', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {'collection:testdb_test-schema': PERMISSIONS.NO_READ}
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
              .get(`/vtest/testdb/test-schema`)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                if (err) return done(err)
                res.statusCode.should.eql(403)
                done()
              })
          })
      })
    })

    it('should return 200 with read permission', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {'collection:testdb_test-schema': PERMISSIONS.READ}
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
              .get(`/vtest/testdb/test-schema`)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                if (err) return done(err)
                res.statusCode.should.eql(200)
                done()
              })
          })
      })
    })

    it('should return 200 with create,read,update,delete permission', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {'collection:testdb_test-schema': PERMISSIONS.ALL}
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
              .get(`/vtest/testdb/test-schema`)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                if (err) return done(err)
                res.statusCode.should.eql(200)
                done()
              })
          })
      })
    })

    it('should return 200 with read permission and a field excluded', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          'collection:testdb_test-schema': PERMISSIONS.READ_EXCLUDE_FIELDS
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
              .get('/vtest/testdb/test-schema/?fields={"field1":1,"title":1}')
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                if (err) return done(err)
                res.statusCode.should.eql(200)

                const type = typeof res.body.results[0].title

                type.should.eql('undefined')

                done()
              })
          })
      })
    })

    it('should return 200 and compose a Reference field if the client read permissions on both the parent and referenced collections', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          'collection:library_book': PERMISSIONS.READ,
          'collection:library_person': PERMISSIONS.READ
        }
      }

      let authorId

      help
        .getBearerTokenWithPermissions({
          accessType: 'admin'
        })
        .then(adminToken => {
          return help
            .createDocument({
              version: '1.0',
              database: 'library',
              collection: 'person',
              document: {
                name: 'James Lambie'
              },
              token: adminToken
            })
            .then(response => {
              authorId = response.results[0]._id

              return help.createDocument({
                version: '1.0',
                database: 'library',
                collection: 'book',
                document: {
                  title: "A Kiwi's guide to DADI API",
                  author: authorId
                },
                token: adminToken
              })
            })
        })
        .then(response => {
          return help.createACLClient(testClient).then(() => {
            client
              .post(config.get('auth.tokenUrl'))
              .set('content-type', 'application/json')
              .send(testClient)
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)

                const bearerToken = res.body.accessToken

                client
                  .get(
                    `/1.0/library/book/${response.results[0]._id}?compose=true`
                  )
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .end((err, res) => {
                    if (err) return done(err)

                    res.statusCode.should.eql(200)
                    res.body.results.length.should.eql(1)
                    res.body.results[0].author.name.should.eql('James Lambie')

                    done()
                  })
              })
          })
        })
    })

    it('should return 200 if the client has read permission on the given collection, but not compose a Reference field if they do not have read permissions on the referenced collection', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          'collection:library_book': PERMISSIONS.READ,
          'collection:library_person': PERMISSIONS.NO_READ
        }
      }

      let authorId

      help
        .getBearerTokenWithPermissions({
          accessType: 'admin'
        })
        .then(adminToken => {
          return help
            .createDocument({
              version: '1.0',
              database: 'library',
              collection: 'person',
              document: {
                name: 'James Lambie'
              },
              token: adminToken
            })
            .then(response => {
              authorId = response.results[0]._id

              return help.createDocument({
                version: '1.0',
                database: 'library',
                collection: 'book',
                document: {
                  title: "A Kiwi's guide to DADI API",
                  author: authorId
                },
                token: adminToken
              })
            })
        })
        .then(response => {
          return help.createACLClient(testClient).then(() => {
            client
              .post(config.get('auth.tokenUrl'))
              .set('content-type', 'application/json')
              .send(testClient)
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)

                const bearerToken = res.body.accessToken

                client
                  .get(
                    `/1.0/library/book/${response.results[0]._id}?compose=true`
                  )
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .end((err, res) => {
                    if (err) return done(err)

                    res.statusCode.should.eql(200)
                    res.body.results.length.should.eql(1)
                    res.body.results[0].author.should.eql(authorId)
                    should.not.exist(res.body.results[0]._composed)

                    done()
                  })
              })
          })
        })
    })

    it('should return 200 with a filter permission', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {'collection:testdb_test-schema': PERMISSIONS.FILTER}
      }

      const params = {
        filter: JSON.stringify({title: 'very long title'})
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
            const query = require('querystring').stringify(params)

            client
              .get(`/vtest/testdb/test-schema/?${query}`)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                if (err) return done(err)
                res.statusCode.should.eql(200)

                const allCorrect = res.body.results.every(record => {
                  return record.title === 'very long title'
                })

                allCorrect.should.eql(true)

                done()
              })
          })
      })
    })

    it('should return 200 with a result set with results from the filter permission, even when no query is supplied', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {'collection:testdb_test-schema': PERMISSIONS.FILTER}
      }

      const params = {
        filter: JSON.stringify({})
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
            const query = require('querystring').stringify(params)

            client
              .get(`/vtest/testdb/test-schema/?${query}`)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                if (err) return done(err)
                res.statusCode.should.eql(200)

                res.body.results.length.should.be.above(0)

                const allCorrect = res.body.results.every(record => {
                  return record.title === 'very long title'
                })

                allCorrect.should.eql(true)

                done()
              })
          })
      })
    })

    it('should return 200 with an empty result set when the query differs from the filter permission', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {'collection:testdb_test-schema': PERMISSIONS.FILTER}
      }

      const params = {
        filter: JSON.stringify({title: 'test doc'})
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
            const query = require('querystring').stringify(params)

            client
              .get(`/vtest/testdb/test-schema/?${query}`)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                if (err) return done(err)
                res.statusCode.should.eql(200)

                res.body.results.length.should.eql(0)

                done()
              })
          })
      })
    })

    it('should return 200 without bearer token if `settings.authenticate` is `false`', function(done) {
      client
        .get(`/vtest/testdb/test-authenticate-false`)
        .set('content-type', 'application/json')
        .end((err, res) => {
          if (err) return done(err)

          res.statusCode.should.eql(200)

          done()
        })
    })

    it('should return 200 without bearer token if `settings.authenticate` is set to an array that does not include `GET`', function(done) {
      client
        .get(`/vtest/testdb/test-authenticate-post-put-delete`)
        .set('content-type', 'application/json')
        .end((err, res) => {
          if (err) return done(err)
          res.statusCode.should.eql(200)

          done()
        })
    })

    it('should return 401 without bearer token if `settings.authenticate` is set to an array that includes `GET`', function(done) {
      client
        .get(`/vtest/testdb/test-authenticate-get-post-put-delete`)
        .set('content-type', 'application/json')
        .end((err, res) => {
          if (err) return done(err)

          done()
        })
    })
  })

  describe('COUNT', function() {
    it('should return 400 for an invalid query', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {'collection:testdb_test-schema': PERMISSIONS.READ}
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
              .get(
                `/vtest/testdb/test-schema/count?filter={"$where":{"title":"xxx"}}`
              )
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                if (err) return done(err)
                res.statusCode.should.eql(400)
                done()
              })
          })
      })
    })

    it('should return 403 with no permissions', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {'collection:testdb_test-schema': {}}
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
              .get(`/vtest/testdb/test-schema/count`)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                if (err) return done(err)
                res.statusCode.should.eql(403)
                done()
              })
          })
      })
    })

    it('should return 403 with no read permission', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {'collection:testdb_test-schema': PERMISSIONS.NO_READ}
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
              .get(`/vtest/testdb/test-schema/count`)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                if (err) return done(err)
                res.statusCode.should.eql(403)
                done()
              })
          })
      })
    })

    it('should return 200 with read permission', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {'collection:testdb_test-schema': PERMISSIONS.READ}
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
              .get(`/vtest/testdb/test-schema/count`)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                if (err) return done(err)
                res.statusCode.should.eql(200)
                done()
              })
          })
      })
    })

    it('should only count the documents that match the ACL filter, if one is set', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          'collection:testdb_test-schema': {
            read: {
              filter: JSON.stringify({
                field1: 'Value one'
              })
            }
          }
        }
      }

      const documents = [
        {field1: 'Value one'},
        {field1: 'Value one'},
        {field1: 'Value one'},
        {field1: 'Value two'},
        {field1: 'Value three'}
      ]

      help
        .getBearerTokenWithPermissions({
          accessType: 'admin'
        })
        .then(adminToken => {
          client
            .post(`/vtest/testdb/test-schema`)
            .send(documents)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${adminToken}`)
            .end((err, res) => {
              if (err) return done(err)

              res.body.results.length.should.eql(documents.length)

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
                      .get(`/vtest/testdb/test-schema/count`)
                      .set('content-type', 'application/json')
                      .set('Authorization', `Bearer ${bearerToken}`)
                      .end((err, res) => {
                        if (err) return done(err)

                        res.statusCode.should.eql(200)
                        res.body.metadata.totalCount.should.eql(
                          documents.filter(doc => doc.field1 === 'Value one')
                            .length
                        )

                        done()
                      })
                  })
              })
            })
        })
    })

    it('should return a count of zero if there is an ACL filter set that does not match any document in the collection', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          'collection:testdb_test-schema': {
            read: {
              filter: JSON.stringify({
                field1: 'Value one'
              })
            }
          }
        }
      }

      const documents = [
        {field1: 'Value two'},
        {field1: 'Value three'},
        {field1: 'Value four'}
      ]

      help
        .getBearerTokenWithPermissions({
          accessType: 'admin'
        })
        .then(adminToken => {
          client
            .post(`/vtest/testdb/test-schema`)
            .send(documents)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${adminToken}`)
            .end((err, res) => {
              if (err) return done(err)

              res.body.results.length.should.eql(documents.length)

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
                      .get(`/vtest/testdb/test-schema/count`)
                      .set('content-type', 'application/json')
                      .set('Authorization', `Bearer ${bearerToken}`)
                      .end((err, res) => {
                        if (err) return done(err)

                        res.statusCode.should.eql(200)
                        res.body.metadata.totalCount.should.eql(0)

                        done()
                      })
                  })
              })
            })
        })
    })
  })

  describe('POST', function() {
    it('should return 400 with invalid payload', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {'collection:testdb_test-schema': PERMISSIONS.CREATE}
      }

      const payload = {fieldOne: 'fieldValue', title: 'title'}

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
              .post(`/vtest/testdb/test-schema/`)
              .send(payload)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                if (err) return done(err)

                res.statusCode.should.eql(400)

                done()
              })
          })
      })
    })

    it('should return 403 with no create permission', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {'collection:testdb_test-schema': PERMISSIONS.READ}
      }

      const payload = {field1: 'fieldValue', title: 'title'}

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
              .post(`/vtest/testdb/test-schema/`)
              .send(payload)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                if (err) return done(err)

                res.statusCode.should.eql(403)

                done()
              })
          })
      })
    })

    it('should return 200 with create permission', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {'collection:testdb_test-schema': PERMISSIONS.CREATE}
      }

      const payload = {field1: 'fieldValue', title: 'title'}

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
              .post(`/vtest/testdb/test-schema/`)
              .send(payload)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                if (err) return done(err)

                res.statusCode.should.eql(200)
                res.body.results.length.should.eql(1)
                res.body.results[0].field1.should.eql(payload.field1)
                res.body.results[0].title.should.eql(payload.title)

                done()
              })
          })
      })
    })

    it('should return 200 without bearer token if `settings.authenticate` is `false`', function(done) {
      const payload = {
        field1: 'fieldValue',
        title: 'title'
      }

      client
        .post(`/vtest/testdb/test-authenticate-false`)
        .send(payload)
        .set('content-type', 'application/json')
        .end((err, res) => {
          if (err) return done(err)

          res.statusCode.should.eql(200)
          res.body.results.length.should.eql(1)
          res.body.results[0].field1.should.eql(payload.field1)
          res.body.results[0].title.should.eql(payload.title)

          done()
        })
    })

    it('should return 200 without bearer token if `settings.authenticate` is set to an array that does not include `POST`', function(done) {
      const payload = {
        field1: 'fieldValue',
        title: 'title'
      }

      client
        .post(`/vtest/testdb/test-authenticate-get-put-delete`)
        .send(payload)
        .end((err, res) => {
          if (err) return done(err)

          res.statusCode.should.eql(200)
          res.body.results.length.should.eql(1)
          res.body.results[0].field1.should.eql(payload.field1)
          res.body.results[0].title.should.eql(payload.title)

          done()
        })
    })

    it('should create the document but return just the IDs if the client does not have read permissions on the collection', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          'collection:testdb_test-schema': {
            create: true,
            read: false
          }
        }
      }

      const payload = {field1: 'fieldValue', title: 'title'}

      help
        .getBearerTokenWithPermissions({
          accessType: 'admin'
        })
        .then(adminToken => {
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
                  .post(`/vtest/testdb/test-schema/`)
                  .send(payload)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .end((err, res) => {
                    if (err) return done(err)

                    res.statusCode.should.eql(200)
                    res.body.results.length.should.eql(1)
                    Object.keys(res.body.results[0]).should.eql(['_id'])

                    const id = res.body.results[0]._id

                    client
                      .get(`/vtest/testdb/test-schema/${id}`)
                      .set('content-type', 'application/json')
                      .set('Authorization', `Bearer ${adminToken}`)
                      .end((err, res) => {
                        res.body.results.length.should.eql(1)
                        res.body.results[0]._id.should.eql(id)
                        res.body.results[0].field1.should.eql(payload.field1)
                        res.body.results[0].title.should.eql(payload.title)

                        done(err)
                      })
                  })
              })
          })
        })
    })

    it('should create the document but return just the fields defined in the client\'s read permissions (projection of type "includes")', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          'collection:testdb_test-schema': {
            create: true,
            read: {
              fields: {
                _createdAt: 1,
                field1: 1
              }
            }
          }
        }
      }

      const payload = {field1: 'fieldValue', title: 'title'}

      help
        .getBearerTokenWithPermissions({
          accessType: 'admin'
        })
        .then(adminToken => {
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
                  .post(`/vtest/testdb/test-schema/`)
                  .send(payload)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .end((err, res) => {
                    if (err) return done(err)

                    res.statusCode.should.eql(200)
                    res.body.results.length.should.eql(1)
                    Object.keys(res.body.results[0]).length.should.eql(3)
                    res.body.results[0]._createdAt.should.be.instanceOf(Number)
                    res.body.results[0]._id.should.be.instanceOf(String)
                    res.body.results[0].field1.should.eql(payload.field1)

                    const id = res.body.results[0]._id

                    client
                      .get(`/vtest/testdb/test-schema/${id}`)
                      .set('content-type', 'application/json')
                      .set('Authorization', `Bearer ${adminToken}`)
                      .end((err, res) => {
                        res.body.results.length.should.eql(1)
                        res.body.results[0]._id.should.eql(id)
                        res.body.results[0].field1.should.eql(payload.field1)
                        res.body.results[0].title.should.eql(payload.title)

                        done(err)
                      })
                  })
              })
          })
        })
    })

    it('should create the document but return just the fields defined in the client\'s read permissions (projection of type "excludes")', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          'collection:testdb_test-schema': {
            create: true,
            read: {
              fields: {
                _createdAt: 0,
                field1: 0
              }
            }
          }
        }
      }

      const payload = {field1: 'fieldValue', title: 'title'}

      help
        .getBearerTokenWithPermissions({
          accessType: 'admin'
        })
        .then(adminToken => {
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
                  .post(`/vtest/testdb/test-schema/`)
                  .send(payload)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .end((err, res) => {
                    if (err) return done(err)

                    res.statusCode.should.eql(200)
                    res.body.results.length.should.eql(1)
                    res.body.results[0]._createdBy.should.be.instanceOf(String)
                    res.body.results[0]._id.should.be.instanceOf(String)
                    res.body.results[0].title.should.eql(payload.title)
                    should.not.exist(res.body.results[0]._createdAt)
                    should.not.exist(res.body.results[0].field1)

                    const id = res.body.results[0]._id

                    client
                      .get(`/vtest/testdb/test-schema/${id}`)
                      .set('content-type', 'application/json')
                      .set('Authorization', `Bearer ${adminToken}`)
                      .end((err, res) => {
                        res.body.results.length.should.eql(1)
                        res.body.results[0]._id.should.eql(id)
                        res.body.results[0].field1.should.eql(payload.field1)
                        res.body.results[0].title.should.eql(payload.title)

                        done(err)
                      })
                  })
              })
          })
        })
    })

    it('should create the document but not compose a reference field if the client does not have read permissions on the referenced collection', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          'collection:testdb_test-schema': {
            create: true,
            read: true
          },
          'collection:testdb_test-reference-schema': {
            read: false
          }
        }
      }

      const referencePayload = {
        refField1: 'hello',
        refField2: 123
      }

      help
        .getBearerTokenWithPermissions({
          accessType: 'admin'
        })
        .then(adminToken => {
          client
            .post(`/vtest/testdb/test-reference-schema/`)
            .send(referencePayload)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              const id = res.body.results[0]._id
              const payload = {
                field1: 'something',
                title: 'hello',
                fieldReference: id
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
                      .post(`/vtest/testdb/test-schema?compose=true`)
                      .send(payload)
                      .set('content-type', 'application/json')
                      .set('Authorization', `Bearer ${bearerToken}`)
                      .end((err, res) => {
                        if (err) return done(err)

                        res.statusCode.should.eql(200)
                        res.body.results.length.should.eql(1)
                        res.body.results[0].field1.should.eql(payload.field1)
                        res.body.results[0].title.should.eql(payload.title)
                        res.body.results[0].fieldReference.should.eql(
                          payload.fieldReference
                        )

                        const id = res.body.results[0]._id

                        client
                          .get(`/vtest/testdb/test-schema/${id}?compose=true`)
                          .set('content-type', 'application/json')
                          .set('Authorization', `Bearer ${adminToken}`)
                          .end((err, res) => {
                            res.body.results[0].fieldReference.refField1.should.eql(
                              referencePayload.refField1
                            )
                            res.body.results[0].fieldReference.refField2.should.eql(
                              referencePayload.refField2
                            )

                            done(err)
                          })
                      })
                  })
              })
            })
        })
    })

    it('should create the document and compose a reference field so that the response respects the `fields` object defined in the read permissions of the referenced collection (projection of type "includes")', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          'collection:testdb_test-schema': {
            create: true,
            read: true
          },
          'collection:testdb_test-reference-schema': {
            read: {
              fields: {
                refField2: 1
              }
            }
          }
        }
      }

      const referencePayload = {
        refField1: 'hello',
        refField2: 123
      }

      help
        .getBearerTokenWithPermissions({
          accessType: 'admin'
        })
        .then(adminToken => {
          client
            .post(`/vtest/testdb/test-reference-schema/`)
            .send(referencePayload)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              const id = res.body.results[0]._id
              const payload = {
                field1: 'something',
                title: 'hello',
                fieldReference: id
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
                      .post(`/vtest/testdb/test-schema?compose=true`)
                      .send(payload)
                      .set('content-type', 'application/json')
                      .set('Authorization', `Bearer ${bearerToken}`)
                      .end((err, res) => {
                        if (err) return done(err)

                        res.statusCode.should.eql(200)
                        res.body.results.length.should.eql(1)
                        res.body.results[0].field1.should.eql(payload.field1)
                        res.body.results[0].title.should.eql(payload.title)
                        Object.keys(
                          res.body.results[0].fieldReference
                        ).length.should.eql(2)
                        res.body.results[0].fieldReference._id.should.eql(
                          payload.fieldReference
                        )
                        res.body.results[0].fieldReference.refField2.should.eql(
                          referencePayload.refField2
                        )

                        const id = res.body.results[0]._id

                        client
                          .get(`/vtest/testdb/test-schema/${id}?compose=true`)
                          .set('content-type', 'application/json')
                          .set('Authorization', `Bearer ${adminToken}`)
                          .end((err, res) => {
                            res.body.results[0].fieldReference.refField1.should.eql(
                              referencePayload.refField1
                            )
                            res.body.results[0].fieldReference.refField2.should.eql(
                              referencePayload.refField2
                            )

                            done(err)
                          })
                      })
                  })
              })
            })
        })
    })

    it('should create the document and compose a reference field so that the response respects the `fields` object defined in the read permissions of the referenced collection (projection of type "excludes")', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          'collection:testdb_test-schema': {
            create: true,
            read: true
          },
          'collection:testdb_test-reference-schema': {
            read: {
              fields: {
                refField2: 0
              }
            }
          }
        }
      }

      const referencePayload = {
        refField1: 'hello',
        refField2: 123
      }

      help
        .getBearerTokenWithPermissions({
          accessType: 'admin'
        })
        .then(adminToken => {
          client
            .post(`/vtest/testdb/test-reference-schema/`)
            .send(referencePayload)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              const id = res.body.results[0]._id
              const payload = {
                field1: 'something',
                title: 'hello',
                fieldReference: id
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
                      .post(`/vtest/testdb/test-schema?compose=true`)
                      .send(payload)
                      .set('content-type', 'application/json')
                      .set('Authorization', `Bearer ${bearerToken}`)
                      .end((err, res) => {
                        if (err) return done(err)

                        res.statusCode.should.eql(200)
                        res.body.results.length.should.eql(1)
                        res.body.results[0].field1.should.eql(payload.field1)
                        res.body.results[0].title.should.eql(payload.title)
                        res.body.results[0].fieldReference._id.should.eql(
                          payload.fieldReference
                        )
                        res.body.results[0].fieldReference.refField1.should.eql(
                          referencePayload.refField1
                        )
                        should.exist(
                          res.body.results[0].fieldReference._createdAt
                        )
                        should.exist(
                          res.body.results[0].fieldReference._createdBy
                        )
                        should.exist(
                          res.body.results[0].fieldReference._apiVersion
                        )
                        should.not.exist(
                          res.body.results[0].fieldReference.refField2
                        )

                        const id = res.body.results[0]._id

                        client
                          .get(`/vtest/testdb/test-schema/${id}?compose=true`)
                          .set('content-type', 'application/json')
                          .set('Authorization', `Bearer ${adminToken}`)
                          .end((err, res) => {
                            res.body.results[0].fieldReference.refField1.should.eql(
                              referencePayload.refField1
                            )
                            res.body.results[0].fieldReference.refField2.should.eql(
                              referencePayload.refField2
                            )

                            done(err)
                          })
                      })
                  })
              })
            })
        })
    })

    it('should create only the fields defined in the `create.fields` object, if defined (projection of type "includes")', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          'collection:testdb_test-schema': {
            create: {
              fields: {
                title: 1
              }
            },
            read: true
          }
        }
      }

      const payload = {
        field1: 'fieldValue',
        title: 'title'
      }

      help
        .getBearerTokenWithPermissions({
          accessType: 'admin'
        })
        .then(adminToken => {
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
                  .post(`/vtest/testdb/test-schema`)
                  .send(payload)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .expect(200)
                  .end((err, res) => {
                    res.body.results.length.should.eql(1)
                    res.body.results[0]._createdBy.should.be.instanceOf(String)
                    res.body.results[0]._id.should.be.instanceOf(String)
                    res.body.results[0].title.should.eql(payload.title)
                    should.not.exist(res.body.results[0].field1)

                    client
                      .get(
                        `/vtest/testdb/test-schema/${res.body.results[0]._id}`
                      )
                      .set('content-type', 'application/json')
                      .set('Authorization', `Bearer ${adminToken}`)
                      .expect(200)
                      .end((err, res) => {
                        if (err) return done(err)

                        res.body.results.length.should.eql(1)
                        res.body.results[0]._createdBy.should.be.instanceOf(
                          String
                        )
                        res.body.results[0]._id.should.be.instanceOf(String)
                        res.body.results[0].title.should.eql(payload.title)
                        should.not.exist(res.body.results[0].field1)

                        done(err)
                      })
                  })
              })
          })
        })
    })

    it('should create only the fields defined in the `create.fields` object, if defined (projection of type "excludes")', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          'collection:testdb_test-schema': {
            create: {
              fields: {
                title: 0
              }
            },
            read: true
          }
        }
      }

      const payload = {
        field1: 'fieldValue',
        title: 'title'
      }

      help
        .getBearerTokenWithPermissions({
          accessType: 'admin'
        })
        .then(adminToken => {
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
                  .post(`/vtest/testdb/test-schema`)
                  .send(payload)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .expect(200)
                  .end((err, res) => {
                    res.body.results.length.should.eql(1)
                    res.body.results[0]._createdBy.should.be.instanceOf(String)
                    res.body.results[0]._id.should.be.instanceOf(String)
                    res.body.results[0].field1.should.eql(payload.field1)
                    should.not.exist(res.body.results[0].title)

                    client
                      .get(
                        `/vtest/testdb/test-schema/${res.body.results[0]._id}`
                      )
                      .set('content-type', 'application/json')
                      .set('Authorization', `Bearer ${adminToken}`)
                      .expect(200)
                      .end((err, res) => {
                        if (err) return done(err)

                        res.body.results.length.should.eql(1)
                        res.body.results[0]._createdBy.should.be.instanceOf(
                          String
                        )
                        res.body.results[0]._id.should.be.instanceOf(String)
                        res.body.results[0].field1.should.eql(payload.field1)
                        should.not.exist(res.body.results[0].title)

                        done(err)
                      })
                  })
              })
          })
        })
    })

    it('should return a 400 when one of the validation errors results from the `create.fields` ACL permissions blocking the client from writing to a required field', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          'collection:testdb_test-required-schema': {
            create: {
              fields: {
                field1: 0
              }
            },
            read: true
          }
        }
      }

      const payload = {
        field1: 'one',
        field2: 1337
      }

      help
        .getBearerTokenWithPermissions({
          accessType: 'admin'
        })
        .then(adminToken => {
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
                  .post(`/vtest/testdb/test-required-schema`)
                  .send(payload)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .expect(400)
                  .end((err, res) => {
                    res.body.success.should.eql(false)
                    res.body.errors.length.should.eql(2)
                    res.body.errors[0].code.should.eql('ERROR_UNAUTHORISED')
                    res.body.errors[0].field.should.eql('field1')
                    res.body.errors[0].message.should.be.instanceOf(String)
                    res.body.errors[1].code.should.eql('ERROR_VALUE_INVALID')
                    res.body.errors[1].field.should.eql('field2')
                    res.body.errors[1].message.should.be.instanceOf(String)

                    done(err)
                  })
              })
          })
        })
    })

    it('should return a 403 when all the validation errors result from the `create.fields` ACL permissions blocking the client from writing to a required field', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          'collection:testdb_test-required-schema': {
            create: {
              fields: {
                field1: 0
              }
            },
            read: true
          }
        }
      }

      const payload = {
        field1: 'one',
        field2: 'two'
      }

      help
        .getBearerTokenWithPermissions({
          accessType: 'admin'
        })
        .then(adminToken => {
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
                  .post(`/vtest/testdb/test-required-schema`)
                  .send(payload)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .expect(403)
                  .end((err, res) => {
                    res.body.success.should.eql(false)
                    res.body.errors.length.should.eql(1)
                    res.body.errors[0].code.should.eql('ERROR_UNAUTHORISED')
                    res.body.errors[0].field.should.eql('field1')
                    res.body.errors[0].message.should.be.instanceOf(String)

                    done(err)
                  })
              })
          })
        })
    })

    it('should return 401 without bearer token if `settings.authenticate` is set to an array that includes `POST`', function(done) {
      client
        .post(`/vtest/testdb/test-authenticate-get-post-put-delete`)
        .send({
          field1: 'fieldValue',
          title: 'title'
        })
        .set('content-type', 'application/json')
        .end((err, res) => {
          if (err) return done(err)

          res.statusCode.should.eql(401)

          done()
        })
    })
  })

  describe('PUT', function() {
    it('should return 403 with no update permission (query in body)', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {'collection:testdb_test-schema': PERMISSIONS.READ}
      }

      const payload = {query: {field1: '7'}, update: {title: 'updated title'}}

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
              .put(`/vtest/testdb/test-schema/`)
              .send(payload)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                if (err) return done(err)
                res.statusCode.should.eql(403)
                done()
              })
          })
      })
    })

    it('should return 403 with no update permission (querying by ID)', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {'collection:testdb_test-schema': PERMISSIONS.READ}
      }

      const update = {title: 'updated title'}

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
              .put(`/vtest/testdb/test-schema/${docs[0]}`)
              .send(update)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                if (err) return done(err)
                res.statusCode.should.eql(403)
                done()
              })
          })
      })
    })

    it('should return 200 with all permissions (query in body)', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {'collection:testdb_test-schema': PERMISSIONS.ALL}
      }

      const payload = {query: {field1: '7'}, update: {title: 'updated title'}}

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
              .put(`/vtest/testdb/test-schema/`)
              .send(payload)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                if (err) return done(err)
                res.statusCode.should.eql(200)
                done()
              })
          })
      })
    })

    it('should return 200 with all permissions (query by ID)', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {'collection:testdb_test-schema': PERMISSIONS.ALL}
      }

      const update = {title: 'updated title'}

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
              .put(`/vtest/testdb/test-schema/${docs[0]}`)
              .send(update)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                if (err) return done(err)

                res.statusCode.should.eql(200)
                res.body.results.length.should.eql(1)
                res.body.results[0].title.should.eql(update.title)

                done()
              })
          })
      })
    })

    it('should return 200 with update permissions (query in body)', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {'collection:testdb_test-schema': PERMISSIONS.UPDATE}
      }

      const payload = {query: {field1: '7'}, update: {title: 'updated title'}}

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
              .put(`/vtest/testdb/test-schema/`)
              .send(payload)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                if (err) return done(err)
                res.statusCode.should.eql(200)
                done()
              })
          })
      })
    })

    it('should return 200 with update permissions (query by ID)', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {'collection:testdb_test-schema': PERMISSIONS.UPDATE}
      }

      const update = {title: 'updated title'}

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
              .put(`/vtest/testdb/test-schema/${docs[0]}`)
              .send(update)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                if (err) return done(err)

                res.statusCode.should.eql(200)
                res.body.results.length.should.eql(1)
                res.body.results[0].title.should.eql(update.title)

                done()
              })
          })
      })
    })

    it('should return 200 with update permissions after they have been updated', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          'collection:testdb_test-schema': {
            create: true,
            deleteOwn: true,
            readOwn: true,
            updateOwn: true
          }
        }
      }

      help
        .getBearerTokenWithPermissions({
          accessType: 'admin'
        })
        .then(adminToken => {
          help.createDoc(adminToken, (err, document) => {
            help.createACLClient(testClient).then(() => {
              client
                .post(config.get('auth.tokenUrl'))
                .set('content-type', 'application/json')
                .send(testClient)
                .expect(200)
                .end((err, res) => {
                  if (err) return done(err)

                  const userToken = res.body.accessToken

                  client
                    .put(`/vtest/testdb/test-schema/${document._id}`)
                    .send({
                      field1: 'something new'
                    })
                    .set('content-type', 'application/json')
                    .set('Authorization', `Bearer ${userToken}`)
                    .end((err, res) => {
                      if (err) return done(err)

                      res.statusCode.should.eql(404)

                      client
                        .put(
                          `/api/clients/${testClient.clientId}/resources/collection:testdb_test-schema`
                        )
                        .send({
                          read: true,
                          update: true
                        })
                        .set('content-type', 'application/json')
                        .set('Authorization', `Bearer ${adminToken}`)
                        .end((err, res) => {
                          if (err) return done(err)

                          setTimeout(() => {
                            client
                              .put(`/vtest/testdb/test-schema/${document._id}`)
                              .send({
                                field1: 'something new'
                              })
                              .set('content-type', 'application/json')
                              .set('Authorization', `Bearer ${userToken}`)
                              .end((err, res) => {
                                if (err) return done(err)

                                res.statusCode.should.eql(200)
                                res.body.results.length.should.eql(1)
                                res.body.results[0].field1.should.eql(
                                  'something new'
                                )

                                done()
                              })
                          }, 1000)
                        })
                    })
                })
            })
          })
        })
    })

    it('should return 200 and not update any documents when the query differs from the filter permission', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          'collection:testdb_test-schema': {
            read: true,
            update: {
              filter: JSON.stringify({
                title: 'some title'
              })
            }
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
              .put(`/vtest/testdb/test-schema`)
              .send({
                query: {
                  title: 'test doc'
                },
                update: {
                  field1: 'updated'
                }
              })
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                if (err) return done(err)

                res.statusCode.should.eql(200)
                res.body.results.length.should.eql(0)

                client
                  .get(`/vtest/testdb/test-schema?filter={"title":"test doc"}`)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .end((err, res) => {
                    if (err) return done(err)

                    res.statusCode.should.eql(200)
                    res.body.results.length.should.eql(1)

                    res.body.results[0].field1.should.eql('7')

                    done()
                  })
              })
          })
      })
    })

    it('should return 200 without bearer token if `settings.authenticate` is `false`', function(done) {
      client
        .put(`/vtest/testdb/test-authenticate-false`)
        .send({
          query: {
            title: 'test doc'
          },
          update: {
            field1: 'updated'
          }
        })
        .set('content-type', 'application/json')
        .end((err, res) => {
          if (err) return done(err)
          res.statusCode.should.eql(200)

          done()
        })
    })

    it('should return 200 without bearer token if `settings.authenticate` is set to an array that does not include `PUT`', function(done) {
      client
        .put(`/vtest/testdb/test-authenticate-get-post-delete`)
        .send({
          query: {
            title: 'test doc'
          },
          update: {
            field1: 'updated'
          }
        })
        .end((err, res) => {
          if (err) return done(err)
          res.statusCode.should.eql(200)

          done()
        })
    })

    it('should update the document but return just the IDs if the client does not have read permissions on the collection', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          'collection:testdb_test-schema': {
            read: false,
            update: true
          }
        }
      }

      const original = {
        field1: 'fieldValue',
        title: 'title'
      }

      help
        .getBearerTokenWithPermissions({
          accessType: 'admin'
        })
        .then(adminToken => {
          client
            .post(`/vtest/testdb/test-schema/`)
            .send(original)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              const id = res.body.results[0]._id

              help.createACLClient(testClient).then(() => {
                client
                  .post(config.get('auth.tokenUrl'))
                  .set('content-type', 'application/json')
                  .send(testClient)
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done(err)

                    const bearerToken = res.body.accessToken
                    const update = {
                      title: 'new title'
                    }

                    client
                      .put(`/vtest/testdb/test-schema/${id}`)
                      .send(update)
                      .set('content-type', 'application/json')
                      .set('Authorization', `Bearer ${bearerToken}`)
                      .expect(200)
                      .end((err, res) => {
                        res.body.results.length.should.eql(1)
                        res.body.results[0].should.eql({
                          _id: id
                        })

                        client
                          .get(`/vtest/testdb/test-schema/${id}`)
                          .set('content-type', 'application/json')
                          .set('Authorization', `Bearer ${adminToken}`)
                          .expect(200)
                          .end((err, res) => {
                            res.body.results.length.should.eql(1)
                            res.body.results[0]._id.should.eql(id)
                            res.body.results[0].field1.should.eql(
                              original.field1
                            )
                            res.body.results[0].title.should.eql(update.title)

                            done(err)
                          })
                      })
                  })
              })
            })
        })
    })

    it('should update the document but return just the fields defined in the client\'s read permissions (projection of type "includes")', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          'collection:testdb_test-schema': {
            read: {
              fields: {
                _createdAt: 1,
                field1: 1
              }
            },
            update: true
          }
        }
      }

      const original = {
        field1: 'fieldValue',
        title: 'title'
      }

      help
        .getBearerTokenWithPermissions({
          accessType: 'admin'
        })
        .then(adminToken => {
          client
            .post(`/vtest/testdb/test-schema/`)
            .send(original)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              const id = res.body.results[0]._id

              help.createACLClient(testClient).then(() => {
                client
                  .post(config.get('auth.tokenUrl'))
                  .set('content-type', 'application/json')
                  .send(testClient)
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done(err)

                    const bearerToken = res.body.accessToken
                    const update = {
                      title: 'new title'
                    }

                    client
                      .put(`/vtest/testdb/test-schema/${id}`)
                      .send(update)
                      .set('content-type', 'application/json')
                      .set('Authorization', `Bearer ${bearerToken}`)
                      .expect(200)
                      .end((err, res) => {
                        res.body.results.length.should.eql(1)
                        Object.keys(res.body.results[0]).length.should.eql(3)
                        res.body.results[0]._createdAt.should.be.instanceOf(
                          Number
                        )
                        res.body.results[0]._id.should.be.instanceOf(String)
                        res.body.results[0].field1.should.eql(original.field1)

                        client
                          .get(`/vtest/testdb/test-schema/${id}`)
                          .set('content-type', 'application/json')
                          .set('Authorization', `Bearer ${adminToken}`)
                          .expect(200)
                          .end((err, res) => {
                            res.body.results.length.should.eql(1)
                            res.body.results[0]._id.should.eql(id)
                            res.body.results[0].field1.should.eql(
                              original.field1
                            )
                            res.body.results[0].title.should.eql(update.title)

                            done(err)
                          })
                      })
                  })
              })
            })
        })
    })

    it('should update the document but return just the fields defined in the client\'s read permissions (projection of type "excludes")', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          'collection:testdb_test-schema': {
            read: {
              fields: {
                _createdAt: 0,
                field1: 0
              }
            },
            update: true
          }
        }
      }

      const original = {
        field1: 'fieldValue',
        title: 'title'
      }

      help
        .getBearerTokenWithPermissions({
          accessType: 'admin'
        })
        .then(adminToken => {
          client
            .post(`/vtest/testdb/test-schema/`)
            .send(original)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              const id = res.body.results[0]._id

              help.createACLClient(testClient).then(() => {
                client
                  .post(config.get('auth.tokenUrl'))
                  .set('content-type', 'application/json')
                  .send(testClient)
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done(err)

                    const bearerToken = res.body.accessToken
                    const update = {
                      title: 'new title'
                    }

                    client
                      .put(`/vtest/testdb/test-schema/${id}`)
                      .send(update)
                      .set('content-type', 'application/json')
                      .set('Authorization', `Bearer ${bearerToken}`)
                      .expect(200)
                      .end((err, res) => {
                        res.body.results.length.should.eql(1)
                        res.body.results[0]._createdBy.should.be.instanceOf(
                          String
                        )
                        res.body.results[0]._id.should.be.instanceOf(String)
                        res.body.results[0].title.should.eql(update.title)
                        should.not.exist(res.body.results[0]._createdAt)
                        should.not.exist(res.body.results[0].field1)

                        client
                          .get(`/vtest/testdb/test-schema/${id}`)
                          .set('content-type', 'application/json')
                          .set('Authorization', `Bearer ${adminToken}`)
                          .expect(200)
                          .end((err, res) => {
                            res.body.results.length.should.eql(1)
                            res.body.results[0]._id.should.eql(id)
                            res.body.results[0].field1.should.eql(
                              original.field1
                            )
                            res.body.results[0].title.should.eql(update.title)

                            done(err)
                          })
                      })
                  })
              })
            })
        })
    })

    it('should update the document but not compose a reference field if the client does not have read permissions on the referenced collection', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          'collection:testdb_test-schema': {
            read: true,
            update: true
          },
          'collection:testdb_test-reference-schema': {
            read: false
          }
        }
      }

      const referencePayload = {
        refField1: 'hello',
        refField2: 123
      }

      help
        .getBearerTokenWithPermissions({
          accessType: 'admin'
        })
        .then(adminToken => {
          client
            .post(`/vtest/testdb/test-reference-schema/`)
            .send(referencePayload)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              const referenceId = res.body.results[0]._id
              const original = {
                field1: 'something',
                title: 'hello',
                fieldReference: referenceId
              }

              client
                .post(`/vtest/testdb/test-schema?compose=true`)
                .send(original)
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${adminToken}`)
                .end((err, res) => {
                  if (err) return done(err)

                  const id = res.body.results[0]._id

                  help.createACLClient(testClient).then(() => {
                    client
                      .post(config.get('auth.tokenUrl'))
                      .set('content-type', 'application/json')
                      .send(testClient)
                      .expect(200)
                      .end((err, res) => {
                        if (err) return done(err)

                        const bearerToken = res.body.accessToken
                        const update = {
                          title: 'new title'
                        }

                        client
                          .put(`/vtest/testdb/test-schema/${id}?compose=true`)
                          .send(update)
                          .set('content-type', 'application/json')
                          .set('Authorization', `Bearer ${bearerToken}`)
                          .expect(200)
                          .end((err, res) => {
                            res.body.results.length.should.eql(1)
                            res.body.results[0].field1.should.eql(
                              original.field1
                            )
                            res.body.results[0].title.should.eql(update.title)
                            res.body.results[0].fieldReference.should.eql(
                              original.fieldReference
                            )

                            client
                              .get(
                                `/vtest/testdb/test-schema/${id}?compose=true`
                              )
                              .set('content-type', 'application/json')
                              .set('Authorization', `Bearer ${adminToken}`)
                              .end((err, res) => {
                                res.body.results[0].fieldReference.refField1.should.eql(
                                  referencePayload.refField1
                                )
                                res.body.results[0].fieldReference.refField2.should.eql(
                                  referencePayload.refField2
                                )

                                done(err)
                              })
                          })
                      })
                  })
                })
            })
        })
    })

    it('should update the document and compose a reference field so that the response respects the `fields` object defined in the read permissions of the referenced collection (projection of type "includes")', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          'collection:testdb_test-schema': {
            read: true,
            update: true
          },
          'collection:testdb_test-reference-schema': {
            read: {
              fields: {
                refField2: 1
              }
            }
          }
        }
      }

      const referencePayload = {
        refField1: 'hello',
        refField2: 123
      }

      help
        .getBearerTokenWithPermissions({
          accessType: 'admin'
        })
        .then(adminToken => {
          client
            .post(`/vtest/testdb/test-reference-schema/`)
            .send(referencePayload)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              const referenceId = res.body.results[0]._id
              const original = {
                field1: 'something',
                title: 'hello',
                fieldReference: referenceId
              }

              client
                .post(`/vtest/testdb/test-schema?compose=true`)
                .send(original)
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${adminToken}`)
                .end((err, res) => {
                  if (err) return done(err)

                  const id = res.body.results[0]._id

                  help.createACLClient(testClient).then(() => {
                    client
                      .post(config.get('auth.tokenUrl'))
                      .set('content-type', 'application/json')
                      .send(testClient)
                      .expect(200)
                      .end((err, res) => {
                        if (err) return done(err)

                        const bearerToken = res.body.accessToken
                        const update = {
                          title: 'new title'
                        }

                        client
                          .put(`/vtest/testdb/test-schema/${id}?compose=true`)
                          .send(update)
                          .set('content-type', 'application/json')
                          .set('Authorization', `Bearer ${bearerToken}`)
                          .expect(200)
                          .end((err, res) => {
                            res.body.results.length.should.eql(1)
                            res.body.results[0].field1.should.eql(
                              original.field1
                            )
                            res.body.results[0].title.should.eql(update.title)
                            Object.keys(
                              res.body.results[0].fieldReference
                            ).length.should.eql(2)
                            res.body.results[0].fieldReference._id.should.eql(
                              original.fieldReference
                            )
                            res.body.results[0].fieldReference.refField2.should.eql(
                              referencePayload.refField2
                            )

                            client
                              .get(
                                `/vtest/testdb/test-schema/${id}?compose=true`
                              )
                              .set('content-type', 'application/json')
                              .set('Authorization', `Bearer ${adminToken}`)
                              .end((err, res) => {
                                res.body.results[0].fieldReference.refField1.should.eql(
                                  referencePayload.refField1
                                )
                                res.body.results[0].fieldReference.refField2.should.eql(
                                  referencePayload.refField2
                                )

                                done(err)
                              })
                          })
                      })
                  })
                })
            })
        })
    })

    it('should update the document and compose a reference field so that the response respects the `fields` object defined in the read permissions of the referenced collection (projection of type "excludes")', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          'collection:testdb_test-schema': {
            read: true,
            update: true
          },
          'collection:testdb_test-reference-schema': {
            read: {
              fields: {
                refField2: 0
              }
            }
          }
        }
      }

      const referencePayload = {
        refField1: 'hello',
        refField2: 123
      }

      help
        .getBearerTokenWithPermissions({
          accessType: 'admin'
        })
        .then(adminToken => {
          client
            .post(`/vtest/testdb/test-reference-schema/`)
            .send(referencePayload)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              const referenceId = res.body.results[0]._id
              const original = {
                field1: 'something',
                title: 'hello',
                fieldReference: referenceId
              }

              client
                .post(`/vtest/testdb/test-schema?compose=true`)
                .send(original)
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${adminToken}`)
                .end((err, res) => {
                  if (err) return done(err)

                  const id = res.body.results[0]._id

                  help.createACLClient(testClient).then(() => {
                    client
                      .post(config.get('auth.tokenUrl'))
                      .set('content-type', 'application/json')
                      .send(testClient)
                      .expect(200)
                      .end((err, res) => {
                        if (err) return done(err)

                        const bearerToken = res.body.accessToken
                        const update = {
                          title: 'new title'
                        }

                        client
                          .put(`/vtest/testdb/test-schema/${id}?compose=true`)
                          .send(update)
                          .set('content-type', 'application/json')
                          .set('Authorization', `Bearer ${bearerToken}`)
                          .expect(200)
                          .end((err, res) => {
                            res.body.results.length.should.eql(1)
                            res.body.results[0].field1.should.eql(
                              original.field1
                            )
                            res.body.results[0].title.should.eql(update.title)
                            res.body.results[0].fieldReference._id.should.eql(
                              original.fieldReference
                            )
                            res.body.results[0].fieldReference.refField1.should.eql(
                              referencePayload.refField1
                            )
                            should.exist(
                              res.body.results[0].fieldReference._createdAt
                            )
                            should.exist(
                              res.body.results[0].fieldReference._createdBy
                            )
                            should.exist(
                              res.body.results[0].fieldReference._apiVersion
                            )
                            should.not.exist(
                              res.body.results[0].fieldReference.refField2
                            )

                            client
                              .get(
                                `/vtest/testdb/test-schema/${id}?compose=true`
                              )
                              .set('content-type', 'application/json')
                              .set('Authorization', `Bearer ${adminToken}`)
                              .end((err, res) => {
                                res.body.results[0].fieldReference.refField1.should.eql(
                                  referencePayload.refField1
                                )
                                res.body.results[0].fieldReference.refField2.should.eql(
                                  referencePayload.refField2
                                )

                                done(err)
                              })
                          })
                      })
                  })
                })
            })
        })
    })

    it('should limit the update to the fields defined in the `update.fields` object, if defined (projection of type "includes")', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          'collection:testdb_test-schema': {
            read: true,
            update: {
              fields: {
                title: 1
              }
            }
          }
        }
      }

      const original = {
        field1: 'fieldValue',
        title: 'title'
      }

      help
        .getBearerTokenWithPermissions({
          accessType: 'admin'
        })
        .then(adminToken => {
          client
            .post(`/vtest/testdb/test-schema/`)
            .send(original)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              const id = res.body.results[0]._id

              help.createACLClient(testClient).then(() => {
                client
                  .post(config.get('auth.tokenUrl'))
                  .set('content-type', 'application/json')
                  .send(testClient)
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done(err)

                    const bearerToken = res.body.accessToken
                    const update = {
                      title: 'new title',
                      field1: 'new field1'
                    }

                    client
                      .put(`/vtest/testdb/test-schema/${id}`)
                      .send(update)
                      .set('content-type', 'application/json')
                      .set('Authorization', `Bearer ${bearerToken}`)
                      .expect(200)
                      .end((err, res) => {
                        res.body.results.length.should.eql(1)
                        res.body.results[0]._createdBy.should.be.instanceOf(
                          String
                        )
                        res.body.results[0]._id.should.be.instanceOf(String)
                        res.body.results[0].field1.should.eql(original.field1)
                        res.body.results[0].title.should.eql(update.title)

                        done(err)
                      })
                  })
              })
            })
        })
    })

    it('should limit the update to the fields defined in the `update.fields` object, if defined (projection of type "excludes")', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          'collection:testdb_test-schema': {
            read: true,
            update: {
              fields: {
                title: 0
              }
            }
          }
        }
      }

      const original = {
        field1: 'fieldValue',
        title: 'title'
      }

      help
        .getBearerTokenWithPermissions({
          accessType: 'admin'
        })
        .then(adminToken => {
          client
            .post(`/vtest/testdb/test-schema/`)
            .send(original)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${adminToken}`)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              const id = res.body.results[0]._id

              help.createACLClient(testClient).then(() => {
                client
                  .post(config.get('auth.tokenUrl'))
                  .set('content-type', 'application/json')
                  .send(testClient)
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done(err)

                    const bearerToken = res.body.accessToken
                    const update = {
                      title: 'new title',
                      field1: 'new field1'
                    }

                    client
                      .put(`/vtest/testdb/test-schema/${id}`)
                      .send(update)
                      .set('content-type', 'application/json')
                      .set('Authorization', `Bearer ${bearerToken}`)
                      .expect(200)
                      .end((err, res) => {
                        res.body.results.length.should.eql(1)
                        res.body.results[0]._createdBy.should.be.instanceOf(
                          String
                        )
                        res.body.results[0]._id.should.be.instanceOf(String)
                        res.body.results[0].field1.should.eql(update.field1)
                        res.body.results[0].title.should.eql(original.title)

                        done(err)
                      })
                  })
              })
            })
        })
    })

    it('should return 401 without bearer token if `settings.authenticate` is set to an array that includes `PUT`', function(done) {
      client
        .put(`/vtest/testdb/test-authenticate-get-post-put-delete`)
        .send({
          query: {
            title: 'test doc'
          },
          update: {
            field1: 'updated'
          }
        })
        .set('content-type', 'application/json')
        .end((err, res) => {
          if (err) return done(err)

          res.statusCode.should.eql(401)

          done()
        })
    })
  })

  describe('DELETE', function() {
    it('should return 403 with no delete permission (query in body)', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {'collection:testdb_test-schema': PERMISSIONS.READ}
      }

      const payload = {query: {field1: 'fieldValue'}}

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
              .delete(`/vtest/testdb/test-schema/`)
              .send(payload)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                if (err) return done(err)
                res.statusCode.should.eql(403)
                done()
              })
          })
      })
    })

    it('should return 403 with no delete permission (query by ID)', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {'collection:testdb_test-schema': PERMISSIONS.READ}
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
              .delete(`/vtest/testdb/test-schema/${docs[0]}`)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                if (err) return done(err)
                res.statusCode.should.eql(403)
                done()
              })
          })
      })
    })

    it('should return 204 with delete permission (query in body)', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          'collection:testdb_test-schema': {
            read: true,
            delete: true
          }
        }
      }

      const payload = {query: {field1: 'fieldValue'}}

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
              .delete(`/vtest/testdb/test-schema/`)
              .send(payload)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                if (err) return done(err)
                res.statusCode.should.eql(204)

                client
                  .get(
                    `/vtest/testdb/test-schema?filter={"field1":"fieldValue"}`
                  )
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .end((err, res) => {
                    if (err) return done(err)
                    res.statusCode.should.eql(200)
                    res.body.results.should.be.Array
                    res.body.results.length.should.eql(0)

                    done()
                  })
              })
          })
      })
    })

    it('should return 204 with delete permission (query by ID)', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          'collection:testdb_test-schema': {
            read: true,
            delete: true
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
              .delete(`/vtest/testdb/test-schema/${docs[0]}`)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                if (err) return done(err)
                res.statusCode.should.eql(204)

                client
                  .get(`/vtest/testdb/test-schema/${docs[0]}`)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .end((err, res) => {
                    if (err) return done(err)
                    res.statusCode.should.eql(404)

                    done()
                  })
              })
          })
      })
    })

    it('should return 204 and not delete any documents when the query differs from the filter permission', function(done) {
      const testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          'collection:testdb_test-schema': {
            read: true,
            delete: {
              filter: JSON.stringify({
                title: 'some title'
              })
            }
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
              .delete(`/vtest/testdb/test-schema`)
              .send({
                query: {
                  title: 'test doc'
                }
              })
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                if (err) return done(err)

                res.statusCode.should.eql(204)

                client
                  .get(`/vtest/testdb/test-schema?filter={"title":"test doc"}`)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .end((err, res) => {
                    if (err) return done(err)

                    res.statusCode.should.eql(200)
                    res.body.results.length.should.eql(1)

                    res.body.results[0].field1.should.eql('7')

                    done()
                  })
              })
          })
      })
    })

    it('should return 204 without bearer token if `settings.authenticate` is `false`', function(done) {
      help
        .getBearerTokenWithPermissions({
          accessType: 'admin'
        })
        .then(adminToken => {
          return help.createDocument({
            version: 'vtest',
            database: 'testdb',
            collection: 'test-authenticate-false',
            document: {field1: '7', title: 'test doc'},
            token: adminToken
          })
        })
        .then(({results}) => {
          client
            .delete(`/vtest/testdb/test-authenticate-false/${results[0]._id}`)
            .set('content-type', 'application/json')
            .end((err, res) => {
              if (err) return done(err)
              res.statusCode.should.eql(204)

              done()
            })
        })
    })

    it('should return 204 without bearer token if `settings.authenticate` is set to an array that does not include `DELETE`', function(done) {
      help
        .getBearerTokenWithPermissions({
          accessType: 'admin'
        })
        .then(adminToken => {
          return help.createDocument({
            version: 'vtest',
            database: 'testdb',
            collection: 'test-authenticate-get-post-put',
            document: {field1: '7', title: 'test doc'},
            token: adminToken
          })
        })
        .then(({results}) => {
          client
            .delete(
              `/vtest/testdb/test-authenticate-get-post-put/${results[0]._id}`
            )
            .set('content-type', 'application/json')
            .end((err, res) => {
              if (err) return done(err)
              res.statusCode.should.eql(204)

              done()
            })
        })
    })

    it('should return 401 without bearer token if `settings.authenticate` is set to an array that includes `DELETE`', function(done) {
      help
        .getBearerTokenWithPermissions({
          accessType: 'admin'
        })
        .then(adminToken => {
          return help
            .createDocument({
              version: 'vtest',
              database: 'testdb',
              collection: 'test-authenticate-get-post-put-delete',
              document: {field1: '7', title: 'test doc'},
              token: adminToken
            })
            .then(({results}) => {
              client
                .delete(
                  `/vtest/testdb/test-authenticate-get-post-put-delete/${results[0]._id}`
                )
                .set('content-type', 'application/json')
                .end((err, res) => {
                  if (err) return done(err)

                  res.statusCode.should.eql(401)

                  client
                    .delete(
                      `/vtest/testdb/test-authenticate-get-post-put-delete/${results[0]._id}`
                    )
                    .set('content-type', 'application/json')
                    .set('Authorization', `Bearer ${adminToken}`)
                    .end((err, res) => {
                      if (err) return done(err)

                      res.statusCode.should.eql(204)

                      done()
                    })
                })
            })
        })
    })
  })
})
