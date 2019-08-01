const app = require('./../../dadi/lib/')
const config = require('./../../config')
const help = require('./help')
const modelStore = require('../../dadi/lib/model/')
const request = require('supertest')
const client = request(
  `http://${config.get('server.host')}:${config.get('server.port')}`
)
const should = require('should')

const schemas = [
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
      displayName: 'This is a human-friendly name',
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
]

describe('Collections endpoint', function() {
  describe('Deleting', () => {
    before(done => {
      help.removeACLData(() => {
        app.start(done)
      })
    })

    beforeEach(() => {
      return help.createSchemas([
        {
          name: 'books',
          property: 'library',
          version: '1.0',
          fields: {
            title: {
              type: 'string'
            }
          }
        }
      ])
    })

    after(done => {
      app.stop(done)
    })

    afterEach(done => {
      modelStore.unloadAll()

      help.dropSchemas().then(() => {
        help.removeACLData(() => done())
      })
    })

    it('should return 401 if the request does not contain a valid bearer token', done => {
      client
        .delete(`/api/collections/library/books`)
        .set('content-type', 'application/json')
        .end((err, res) => {
          res.statusCode.should.eql(401)

          done(err)
        })
    })

    it('should return 403 if the request contains a bearer token that does not have `delete` access to the `collections` resource', done => {
      const testClient = {
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

            const bearerToken = res.body.accessToken

            client
              .delete(`/api/collections/library/books`)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                res.statusCode.should.eql(403)

                done()
              })
          })
      })
    })

    it('should return 204 if the request contains an admin bearer token', done => {
      const testClient = {
        clientId: 'adminClient',
        secret: 'someSecret',
        accessType: 'admin'
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

            const bearerToken = res.body.accessToken

            client
              .delete(`/api/collections/library/books`)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                res.statusCode.should.eql(204)

                done(err)
              })
          })
      })
    })

    it('should return 204 if the request contains a bearer token that has `delete` access to the `collections` resource', done => {
      const testClient = {
        clientId: 'apiClient2',
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
          .send(testClient)
          .expect(200)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            if (err) return done(err)

            const bearerToken = res.body.accessToken

            client
              .delete(`/api/collections/library/books`)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                res.statusCode.should.eql(204)

                done(err)
              })
          })
      })
    })

    it('should make the schemas changes available after update', done => {
      const testClient = {
        clientId: 'apiClient2',
        secret: 'someSecret',
        accessType: 'admin'
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

            const bearerToken = res.body.accessToken

            client
              .get(`/library/books`)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                res.statusCode.should.eql(200)

                client
                  .delete(`/api/collections/library/books`)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .end((err, res) => {
                    res.statusCode.should.eql(204)

                    client
                      .get(`/library/books`)
                      .set('content-type', 'application/json')
                      .set('Authorization', `Bearer ${bearerToken}`)
                      .end((err, res) => {
                        res.statusCode.should.eql(404)

                        done(err)
                      })
                  })
              })
          })
      })
    })

    it('should return 404 if the collection does not exist', done => {
      const testClient = {
        clientId: 'apiClient2',
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
          .send(testClient)
          .expect(200)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            if (err) return done(err)

            const bearerToken = res.body.accessToken

            client
              .delete(`/api/collections/library/uhoh`)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                res.statusCode.should.eql(404)

                done(err)
              })
          })
      })
    })
  })

  describe('Listing', () => {
    before(done => {
      help.createSchemas(schemas).then(() => {
        help.removeACLData(() => {
          app.start(done)
        })
      })
    })

    after(done => {
      help.dropSchemas().then(() => {
        help.removeACLData(() => {
          app.stop(done)
        })
      })
    })

    it('should return 401 if the request does not contain a valid bearer token', done => {
      client
        .get(`/api/collections`)
        .set('content-type', 'application/json')
        .end((err, res) => {
          res.statusCode.should.eql(401)

          done()
        })
    })

    it('should return all the collections if the requesting client has admin access', done => {
      help
        .getBearerTokenWithPermissions({
          accessType: 'admin'
        })
        .then(token => {
          client
            .get(`/api/collections`)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${token}`)
            .end((err, res) => {
              const {collections} = res.body

              collections.length.should.eql(schemas.length)
              collections.forEach(collection => {
                const match = schemas.find(({name}) => name === collection.slug)

                match.fields.should.eql(collection.fields)
                match.name.should.eql(collection.displayName || collection.slug)
                match.property.should.eql(collection.property)
                match.settings.should.eql(collection.settings)
              })

              done()
            })
        })
    })

    it('should return only the collections the requesting client has read access to', done => {
      help
        .getBearerTokenWithPermissions({
          resources: {
            'collection:library_book': {
              read: true
            },
            'collection:library_person': {
              read: {
                fields: JSON.stringify({
                  fieldOne: 1
                })
              }
            },
            'collection:testdb_test-reference-schema': {
              create: true
            },
            'collection:testdb_test-schema': {
              read: false
            }
          }
        })
        .then(token => {
          client
            .get(`/api/collections`)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${token}`)
            .end((err, res) => {
              res.body.collections.length.should.eql(2)

              const collection1 = res.body.collections.some(collection => {
                return collection.path === '/library/book'
              })

              const collection2 = res.body.collections.some(collection => {
                return collection.path === '/library/person'
              })

              const collection3 = res.body.collections.some(collection => {
                return collection.path === '/testdb/test-schema'
              })

              const collection4 = res.body.collections.some(collection => {
                return collection.path === '/testdb/test-reference-schema'
              })

              collection1.should.eql(true)
              collection2.should.eql(true)
              collection3.should.eql(false)
              collection4.should.eql(false)

              done()
            })
        })
    })
  })

  describe('Creating', () => {
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

    afterEach(() => {
      modelStore.unloadAll()

      return help.dropSchemas()
    })

    it('should return 401 if the request does not contain a valid bearer token', done => {
      client
        .post(`/api/collections`)
        .send({
          name: 'books',
          property: 'library',
          version: '1.0',
          fields: {
            title: {
              type: 'string'
            }
          }
        })
        .set('content-type', 'application/json')
        .end((err, res) => {
          res.statusCode.should.eql(401)

          done(err)
        })
    })

    it('should return 403 if the request contains a bearer token that does not have `create` access to the `collections` resource', done => {
      const testClient = {
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

            const bearerToken = res.body.accessToken

            client
              .post(`/api/collections`)
              .send({
                name: 'books',
                property: 'library',
                version: '1.0',
                fields: {
                  title: {
                    type: 'string'
                  }
                }
              })
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                res.statusCode.should.eql(403)

                done()
              })
          })
      })
    })

    it('should return 200 if the request contains an admin bearer token', done => {
      const testClient = {
        clientId: 'adminClient',
        secret: 'someSecret',
        accessType: 'admin'
      }
      const schema = {
        name: 'books',
        property: 'library',
        version: '1.0',
        fields: {
          title: {
            type: 'string'
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

            const bearerToken = res.body.accessToken

            client
              .post(`/api/collections`)
              .send(schema)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                res.statusCode.should.eql(200)

                const {results} = res.body

                results.length.should.eql(1)
                results[0].name.should.eql(schema.name)
                results[0].property.should.eql(schema.property)
                results[0].fields.should.eql(schema.fields)

                done(err)
              })
          })
      })
    })

    it('should return 200 if the request contains a bearer token that has `create` access to the `collections` resource', done => {
      const testClient = {
        clientId: 'apiClient2',
        secret: 'someSecret',
        resources: {
          collections: {
            create: true
          }
        }
      }
      const schema = {
        name: 'books',
        property: 'library',
        version: '1.0',
        fields: {
          title: {
            type: 'string'
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

            const bearerToken = res.body.accessToken

            client
              .post(`/api/collections`)
              .send(schema)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                res.statusCode.should.eql(200)

                const {results} = res.body

                results.length.should.eql(1)
                results[0].name.should.eql(schema.name)
                results[0].property.should.eql(schema.property)
                results[0].fields.should.eql(schema.fields)

                done(err)
              })
          })
      })
    })

    it('should make the collection available after creation', done => {
      const testClient = {
        clientId: 'apiClient2',
        secret: 'someSecret',
        resources: {
          collections: {
            create: true
          },
          'collection:library_books': {
            create: true,
            read: true
          }
        }
      }
      const schema = {
        name: 'books',
        property: 'library',
        version: '1.0',
        fields: {
          title: {
            type: 'string'
          }
        }
      }
      const document = {
        title: 'A book about APIs'
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

            const bearerToken = res.body.accessToken

            client
              .get(`/library/books`)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                res.statusCode.should.eql(404)

                client
                  .post(`/api/collections`)
                  .send(schema)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .end((err, res) => {
                    res.statusCode.should.eql(200)

                    client
                      .post(`/library/books`)
                      .send(document)
                      .set('content-type', 'application/json')
                      .set('Authorization', `Bearer ${bearerToken}`)
                      .end((err, res) => {
                        res.statusCode.should.eql(200)

                        const {results} = res.body

                        results.length.should.eql(1)
                        results[0].title.should.eql(document.title)

                        client
                          .get(`/library/books`)
                          .set('content-type', 'application/json')
                          .set('Authorization', `Bearer ${bearerToken}`)
                          .end((err, res) => {
                            res.statusCode.should.eql(200)

                            const {results} = res.body

                            results.length.should.eql(1)
                            results[0].title.should.eql(document.title)

                            done(err)
                          })
                      })
                  })
              })
          })
      })
    })

    it('should return 409 if the collection already exists', done => {
      const testClient = {
        clientId: 'apiClient2',
        secret: 'someSecret',
        resources: {
          collections: {
            create: true
          }
        }
      }
      const schema = {
        name: 'books',
        property: 'library',
        version: '1.0',
        fields: {
          title: {
            type: 'string'
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

            const bearerToken = res.body.accessToken

            client
              .post(`/api/collections`)
              .send(schema)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                res.statusCode.should.eql(200)

                const {results} = res.body

                results.length.should.eql(1)

                client
                  .post(`/api/collections`)
                  .send(schema)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .end((err, res) => {
                    res.statusCode.should.eql(409)

                    res.body.success.should.eql(false)
                    res.body.errors[0].code.should.eql(
                      'ERROR_COLLECTION_EXISTS'
                    )
                    res.body.errors[0].message.should.eql(
                      'The collection already exists'
                    )

                    done(err)
                  })
              })
          })
      })
    })

    it('should return 400 if the request does not contain a `fields` property', done => {
      const testClient = {
        clientId: 'apiClient2',
        secret: 'someSecret',
        resources: {
          collections: {
            create: true
          }
        }
      }
      const schema = {
        name: 'books',
        property: 'library',
        version: '1.0'
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

            const bearerToken = res.body.accessToken

            client
              .post(`/api/collections`)
              .send(schema)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                res.statusCode.should.eql(400)
                res.body.success.should.eql(false)
                res.body.errors[0].code.should.eql('ERROR_INVALID_FIELDS')
                res.body.errors[0].field.should.eql('fields')
                res.body.errors[0].message.should.eql('must be an object')

                done(err)
              })
          })
      })
    })

    it('should return 400 if the request does not contain any fields', done => {
      const testClient = {
        clientId: 'apiClient2',
        secret: 'someSecret',
        resources: {
          collections: {
            create: true
          }
        }
      }
      const schema = {
        name: 'books',
        property: 'library',
        version: '1.0',
        fields: {}
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

            const bearerToken = res.body.accessToken

            client
              .post(`/api/collections`)
              .send(schema)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                res.statusCode.should.eql(400)
                res.body.success.should.eql(false)
                res.body.errors[0].code.should.eql('ERROR_EMPTY_FIELDS')
                res.body.errors[0].field.should.eql('fields')
                res.body.errors[0].message.should.eql(
                  'must contain at least one field'
                )

                done(err)
              })
          })
      })
    })

    it('should return 400 if the request contains a field with an invalid type', done => {
      const testClient = {
        clientId: 'apiClient2',
        secret: 'someSecret',
        resources: {
          collections: {
            create: true
          }
        }
      }
      const schema = {
        name: 'books',
        property: 'library',
        version: '1.0',
        fields: {
          title: {
            type: 'string'
          },
          ufo: {
            type: 'unknown'
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

            const bearerToken = res.body.accessToken

            client
              .post(`/api/collections`)
              .send(schema)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                res.statusCode.should.eql(400)
                res.body.success.should.eql(false)
                res.body.errors[0].code.should.eql('ERROR_INVALID_FIELD_TYPE')
                res.body.errors[0].field.should.eql('fields.ufo')
                res.body.errors[0].message.should.be.String

                done(err)
              })
          })
      })
    })

    it('should return 400 if the request contains a `settings` property that is not an object', done => {
      const testClient = {
        clientId: 'apiClient2',
        secret: 'someSecret',
        resources: {
          collections: {
            create: true
          }
        }
      }
      const schema = {
        name: 'books',
        property: 'library',
        version: '1.0',
        fields: {
          title: {
            type: 'string'
          }
        },
        settings: 13
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

            const bearerToken = res.body.accessToken

            client
              .post(`/api/collections`)
              .send(schema)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                res.statusCode.should.eql(400)
                res.body.success.should.eql(false)
                res.body.errors[0].code.should.eql('ERROR_INVALID_SETTINGS')
                res.body.errors[0].field.should.eql('settings')
                res.body.errors[0].message.should.be.String

                done(err)
              })
          })
      })
    })

    it('should return 400 if the request contains an invalid value for `settings.authenticate`', done => {
      const testClient = {
        clientId: 'apiClient2',
        secret: 'someSecret',
        resources: {
          collections: {
            create: true
          }
        }
      }
      const schema1 = {
        name: 'books',
        property: 'library',
        version: '1.0',
        fields: {
          title: {
            type: 'string'
          }
        },
        settings: {
          authenticate: 5
        }
      }
      const schema2 = {
        name: 'books',
        property: 'library',
        version: '1.0',
        fields: {
          title: {
            type: 'string'
          }
        },
        settings: {
          authenticate: ['GET', 'POST', 'WHATEVER']
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

            const bearerToken = res.body.accessToken

            client
              .post(`/api/collections`)
              .send(schema1)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                res.statusCode.should.eql(400)
                res.body.success.should.eql(false)
                res.body.errors[0].code.should.eql('ERROR_INVALID_SETTING')
                res.body.errors[0].field.should.eql('settings.authenticate')
                res.body.errors[0].message.should.be.String

                client
                  .post(`/api/collections`)
                  .send(schema2)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .end((err, res) => {
                    res.statusCode.should.eql(400)
                    res.body.success.should.eql(false)
                    res.body.errors[0].code.should.eql('ERROR_INVALID_SETTING')
                    res.body.errors[0].field.should.eql('settings.authenticate')
                    res.body.errors[0].message.should.be.String

                    done(err)
                  })
              })
          })
      })
    })

    it('should return 200 if the request contains a valid value for `settings.authenticate`', done => {
      const testClient = {
        clientId: 'apiClient2',
        secret: 'someSecret',
        resources: {
          collections: {
            create: true
          }
        }
      }
      const schema1 = {
        name: 'books1',
        property: 'library',
        version: '1.0',
        fields: {
          title: {
            type: 'string'
          }
        },
        settings: {
          authenticate: false
        }
      }
      const schema2 = {
        name: 'books2',
        property: 'library',
        version: '1.0',
        fields: {
          title: {
            type: 'string'
          }
        },
        settings: {
          authenticate: ['GET', 'POST']
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

            const bearerToken = res.body.accessToken

            client
              .post(`/api/collections`)
              .send(schema1)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                res.statusCode.should.eql(200)
                res.body.results.length.should.eql(1)
                res.body.results[0].fields.should.eql(schema1.fields)
                res.body.results[0].settings.should.eql(schema1.settings)

                client
                  .post(`/api/collections`)
                  .send(schema2)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .end((err, res) => {
                    res.statusCode.should.eql(200)
                    res.body.results.length.should.eql(1)
                    res.body.results[0].fields.should.eql(schema2.fields)
                    res.body.results[0].settings.should.eql(schema2.settings)

                    done(err)
                  })
              })
          })
      })
    })

    it('should return 400 if the request contains an invalid value for `settings.cache`', done => {
      const testClient = {
        clientId: 'apiClient2',
        secret: 'someSecret',
        resources: {
          collections: {
            create: true
          }
        }
      }
      const schema = {
        name: 'books',
        property: 'library',
        version: '1.0',
        fields: {
          title: {
            type: 'string'
          }
        },
        settings: {
          cache: 5
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

            const bearerToken = res.body.accessToken

            client
              .post(`/api/collections`)
              .send(schema)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                res.statusCode.should.eql(400)
                res.body.success.should.eql(false)
                res.body.errors[0].code.should.eql('ERROR_INVALID_SETTING')
                res.body.errors[0].field.should.eql('settings.cache')
                res.body.errors[0].message.should.be.String

                done(err)
              })
          })
      })
    })

    it('should return 200 if the request contains a valid value for `settings.cache`', done => {
      const testClient = {
        clientId: 'apiClient2',
        secret: 'someSecret',
        resources: {
          collections: {
            create: true
          }
        }
      }
      const schema1 = {
        name: 'books1',
        property: 'library',
        version: '1.0',
        fields: {
          title: {
            type: 'string'
          }
        },
        settings: {
          cache: false
        }
      }
      const schema2 = {
        name: 'books2',
        property: 'library',
        version: '1.0',
        fields: {
          title: {
            type: 'string'
          }
        },
        settings: {
          cache: true
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

            const bearerToken = res.body.accessToken

            client
              .post(`/api/collections`)
              .send(schema1)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                res.statusCode.should.eql(200)
                res.body.results.length.should.eql(1)
                res.body.results[0].fields.should.eql(schema1.fields)
                res.body.results[0].settings.should.eql(schema1.settings)

                client
                  .post(`/api/collections`)
                  .send(schema2)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .end((err, res) => {
                    res.statusCode.should.eql(200)
                    res.body.results.length.should.eql(1)
                    res.body.results[0].fields.should.eql(schema2.fields)
                    res.body.results[0].settings.should.eql(schema2.settings)

                    done(err)
                  })
              })
          })
      })
    })

    it('should return 400 if the request contains an invalid value for `settings.count`', done => {
      const testClient = {
        clientId: 'apiClient2',
        secret: 'someSecret',
        resources: {
          collections: {
            create: true
          }
        }
      }
      const schema1 = {
        name: 'books',
        property: 'library',
        version: '1.0',
        fields: {
          title: {
            type: 'string'
          }
        },
        settings: {
          count: true
        }
      }
      const schema2 = {
        name: 'books',
        property: 'library',
        version: '1.0',
        fields: {
          title: {
            type: 'string'
          }
        },
        settings: {
          count: 0
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

            const bearerToken = res.body.accessToken

            client
              .post(`/api/collections`)
              .send(schema1)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                res.statusCode.should.eql(400)
                res.body.success.should.eql(false)
                res.body.errors[0].code.should.eql('ERROR_INVALID_SETTING')
                res.body.errors[0].field.should.eql('settings.count')
                res.body.errors[0].message.should.be.String

                client
                  .post(`/api/collections`)
                  .send(schema2)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .end((err, res) => {
                    res.statusCode.should.eql(400)
                    res.body.success.should.eql(false)
                    res.body.errors[0].code.should.eql('ERROR_INVALID_SETTING')
                    res.body.errors[0].field.should.eql('settings.count')
                    res.body.errors[0].message.should.be.String

                    done(err)
                  })
              })
          })
      })
    })

    it('should return 200 if the request contains a valid value for `settings.count`', done => {
      const testClient = {
        clientId: 'apiClient2',
        secret: 'someSecret',
        resources: {
          collections: {
            create: true
          }
        }
      }
      const schema1 = {
        name: 'books1',
        property: 'library',
        version: '1.0',
        fields: {
          title: {
            type: 'string'
          }
        },
        settings: {
          count: 3
        }
      }
      const schema2 = {
        name: 'books2',
        property: 'library',
        version: '1.0',
        fields: {
          title: {
            type: 'string'
          }
        },
        settings: {
          count: 30
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

            const bearerToken = res.body.accessToken

            client
              .post(`/api/collections`)
              .send(schema1)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                res.statusCode.should.eql(200)
                res.body.results.length.should.eql(1)
                res.body.results[0].fields.should.eql(schema1.fields)
                res.body.results[0].settings.should.eql(schema1.settings)

                client
                  .post(`/api/collections`)
                  .send(schema2)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .end((err, res) => {
                    res.statusCode.should.eql(200)
                    res.body.results.length.should.eql(1)
                    res.body.results[0].fields.should.eql(schema2.fields)
                    res.body.results[0].settings.should.eql(schema2.settings)

                    done(err)
                  })
              })
          })
      })
    })

    it('should return 400 if the request contains an invalid value for `settings.callback`', done => {
      const testClient = {
        clientId: 'apiClient2',
        secret: 'someSecret',
        resources: {
          collections: {
            create: true
          }
        }
      }
      const schema1 = {
        name: 'books',
        property: 'library',
        version: '1.0',
        fields: {
          title: {
            type: 'string'
          }
        },
        settings: {
          callback: 5
        }
      }
      const schema2 = {
        name: 'books',
        property: 'library',
        version: '1.0',
        fields: {
          title: {
            type: 'string'
          }
        },
        settings: {
          callback: '   '
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

            const bearerToken = res.body.accessToken

            client
              .post(`/api/collections`)
              .send(schema1)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                res.statusCode.should.eql(400)
                res.body.success.should.eql(false)
                res.body.errors[0].code.should.eql('ERROR_INVALID_SETTING')
                res.body.errors[0].field.should.eql('settings.callback')
                res.body.errors[0].message.should.be.String

                client
                  .post(`/api/collections`)
                  .send(schema2)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .end((err, res) => {
                    res.statusCode.should.eql(400)
                    res.body.success.should.eql(false)
                    res.body.errors[0].code.should.eql('ERROR_INVALID_SETTING')
                    res.body.errors[0].field.should.eql('settings.callback')
                    res.body.errors[0].message.should.be.String

                    done(err)
                  })
              })
          })
      })
    })

    it('should return 200 if the request contains a valid value for `settings.callback`', done => {
      const testClient = {
        clientId: 'apiClient2',
        secret: 'someSecret',
        resources: {
          collections: {
            create: true
          }
        }
      }
      const schema1 = {
        name: 'books1',
        property: 'library',
        version: '1.0',
        fields: {
          title: {
            type: 'string'
          }
        },
        settings: {
          callback: 'myBooks'
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

            const bearerToken = res.body.accessToken

            client
              .post(`/api/collections`)
              .send(schema1)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                res.statusCode.should.eql(200)
                res.body.results.length.should.eql(1)
                res.body.results[0].fields.should.eql(schema1.fields)
                res.body.results[0].settings.should.eql(schema1.settings)

                done(err)
              })
          })
      })
    })

    it('should return 400 if the request contains an invalid value for `settings.displayName`', done => {
      const testClient = {
        clientId: 'apiClient2',
        secret: 'someSecret',
        resources: {
          collections: {
            create: true
          }
        }
      }
      const schema1 = {
        name: 'books',
        property: 'library',
        version: '1.0',
        fields: {
          title: {
            type: 'string'
          }
        },
        settings: {
          displayName: 5
        }
      }
      const schema2 = {
        name: 'books',
        property: 'library',
        version: '1.0',
        fields: {
          title: {
            type: 'string'
          }
        },
        settings: {
          displayName: '   '
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

            const bearerToken = res.body.accessToken

            client
              .post(`/api/collections`)
              .send(schema1)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                res.statusCode.should.eql(400)
                res.body.success.should.eql(false)
                res.body.errors[0].code.should.eql('ERROR_INVALID_SETTING')
                res.body.errors[0].field.should.eql('settings.displayName')
                res.body.errors[0].message.should.be.String

                client
                  .post(`/api/collections`)
                  .send(schema2)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .end((err, res) => {
                    res.statusCode.should.eql(400)
                    res.body.success.should.eql(false)
                    res.body.errors[0].code.should.eql('ERROR_INVALID_SETTING')
                    res.body.errors[0].field.should.eql('settings.displayName')
                    res.body.errors[0].message.should.be.String

                    done(err)
                  })
              })
          })
      })
    })

    it('should return 200 if the request contains a valid value for `settings.displayName`', done => {
      const testClient = {
        clientId: 'apiClient2',
        secret: 'someSecret',
        resources: {
          collections: {
            create: true
          }
        }
      }
      const schema1 = {
        name: 'books1',
        property: 'library',
        version: '1.0',
        fields: {
          title: {
            type: 'string'
          }
        },
        settings: {
          displayName: 'My books'
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

            const bearerToken = res.body.accessToken

            client
              .post(`/api/collections`)
              .send(schema1)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                res.statusCode.should.eql(200)
                res.body.results.length.should.eql(1)
                res.body.results[0].fields.should.eql(schema1.fields)
                res.body.results[0].settings.should.eql(schema1.settings)

                done(err)
              })
          })
      })
    })

    it('should return 400 if the request contains an invalid value for `settings.defaultFilters`', done => {
      const testClient = {
        clientId: 'apiClient2',
        secret: 'someSecret',
        resources: {
          collections: {
            create: true
          }
        }
      }
      const schema1 = {
        name: 'books',
        property: 'library',
        version: '1.0',
        fields: {
          title: {
            type: 'string'
          }
        },
        settings: {
          defaultFilters: true
        }
      }
      const schema2 = {
        name: 'books',
        property: 'library',
        version: '1.0',
        fields: {
          title: {
            type: 'string'
          }
        },
        settings: {
          defaultFilters: ['what', 'is', 'this', 'for?']
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

            const bearerToken = res.body.accessToken

            client
              .post(`/api/collections`)
              .send(schema1)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                res.statusCode.should.eql(400)
                res.body.success.should.eql(false)
                res.body.errors[0].code.should.eql('ERROR_INVALID_SETTING')
                res.body.errors[0].field.should.eql('settings.defaultFilters')
                res.body.errors[0].message.should.be.String

                client
                  .post(`/api/collections`)
                  .send(schema2)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .end((err, res) => {
                    res.statusCode.should.eql(400)
                    res.body.success.should.eql(false)
                    res.body.errors[0].code.should.eql('ERROR_INVALID_SETTING')
                    res.body.errors[0].field.should.eql(
                      'settings.defaultFilters'
                    )
                    res.body.errors[0].message.should.be.String

                    done(err)
                  })
              })
          })
      })
    })

    it('should return 200 if the request contains a valid value for `settings.defaultFilters`', done => {
      const testClient = {
        clientId: 'apiClient2',
        secret: 'someSecret',
        resources: {
          collections: {
            create: true
          }
        }
      }
      const schema1 = {
        name: 'books1',
        property: 'library',
        version: '1.0',
        fields: {
          title: {
            type: 'string'
          }
        },
        settings: {
          defaultFilters: {
            foo: 'bar'
          }
        }
      }
      const schema2 = {
        name: 'books2',
        property: 'library',
        version: '1.0',
        fields: {
          title: {
            type: 'string'
          }
        },
        settings: {
          defaultFilters: {
            bar: {
              $in: ['hello', 'world']
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
          .expect('content-type', 'application/json')
          .end((err, res) => {
            if (err) return done(err)

            const bearerToken = res.body.accessToken

            client
              .post(`/api/collections`)
              .send(schema1)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                res.statusCode.should.eql(200)
                res.body.results.length.should.eql(1)
                res.body.results[0].fields.should.eql(schema1.fields)
                res.body.results[0].settings.should.eql(schema1.settings)

                client
                  .post(`/api/collections`)
                  .send(schema2)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .end((err, res) => {
                    res.statusCode.should.eql(200)
                    res.body.results.length.should.eql(1)
                    res.body.results[0].fields.should.eql(schema2.fields)
                    res.body.results[0].settings.should.eql(schema2.settings)

                    done(err)
                  })
              })
          })
      })
    })

    it('should return 400 if the request contains an invalid value for `settings.enableVersioning`', done => {
      const testClient = {
        clientId: 'apiClient2',
        secret: 'someSecret',
        resources: {
          collections: {
            create: true
          }
        }
      }
      const schema = {
        name: 'books',
        property: 'library',
        version: '1.0',
        fields: {
          title: {
            type: 'string'
          }
        },
        settings: {
          enableVersioning: 5
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

            const bearerToken = res.body.accessToken

            client
              .post(`/api/collections`)
              .send(schema)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                res.statusCode.should.eql(400)
                res.body.success.should.eql(false)
                res.body.errors[0].code.should.eql('ERROR_INVALID_SETTING')
                res.body.errors[0].field.should.eql('settings.enableVersioning')
                res.body.errors[0].message.should.be.String

                done(err)
              })
          })
      })
    })

    it('should return 200 if the request contains a valid value for `settings.enableVersioning`', done => {
      const testClient = {
        clientId: 'apiClient2',
        secret: 'someSecret',
        resources: {
          collections: {
            create: true
          }
        }
      }
      const schema1 = {
        name: 'books1',
        property: 'library',
        version: '1.0',
        fields: {
          title: {
            type: 'string'
          }
        },
        settings: {
          enableVersioning: false
        }
      }
      const schema2 = {
        name: 'books2',
        property: 'library',
        version: '1.0',
        fields: {
          title: {
            type: 'string'
          }
        },
        settings: {
          enableVersioning: true
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

            const bearerToken = res.body.accessToken

            client
              .post(`/api/collections`)
              .send(schema1)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                res.statusCode.should.eql(200)
                res.body.results.length.should.eql(1)
                res.body.results[0].fields.should.eql(schema1.fields)
                res.body.results[0].settings.should.eql(schema1.settings)

                client
                  .post(`/api/collections`)
                  .send(schema2)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .end((err, res) => {
                    res.statusCode.should.eql(200)
                    res.body.results.length.should.eql(1)
                    res.body.results[0].fields.should.eql(schema2.fields)
                    res.body.results[0].settings.should.eql(schema2.settings)

                    done(err)
                  })
              })
          })
      })
    })

    it('should return 400 if the request contains an invalid value for `settings.fieldLimiters`', done => {
      const testClient = {
        clientId: 'apiClient2',
        secret: 'someSecret',
        resources: {
          collections: {
            create: true
          }
        }
      }
      const schema1 = {
        name: 'books',
        property: 'library',
        version: '1.0',
        fields: {
          title: {
            type: 'string'
          }
        },
        settings: {
          fieldLimiters: ['field1', 'field2']
        }
      }
      const schema2 = {
        name: 'books',
        property: 'library',
        version: '1.0',
        fields: {
          title: {
            type: 'string'
          }
        },
        settings: {
          fieldLimiters: {
            field1: 1,
            field2: 1,
            field3: 0
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

            const bearerToken = res.body.accessToken

            client
              .post(`/api/collections`)
              .send(schema1)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                res.statusCode.should.eql(400)
                res.body.success.should.eql(false)
                res.body.errors[0].code.should.eql('ERROR_INVALID_SETTING')
                res.body.errors[0].field.should.eql('settings.fieldLimiters')
                res.body.errors[0].message.should.be.String

                client
                  .post(`/api/collections`)
                  .send(schema2)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .end((err, res) => {
                    res.statusCode.should.eql(400)
                    res.body.success.should.eql(false)
                    res.body.errors[0].code.should.eql('ERROR_INVALID_SETTING')
                    res.body.errors[0].field.should.eql(
                      'settings.fieldLimiters'
                    )
                    res.body.errors[0].message.should.be.String

                    done(err)
                  })
              })
          })
      })
    })

    it('should return 200 if the request contains a valid value for `settings.fieldLimiters`', done => {
      const testClient = {
        clientId: 'apiClient2',
        secret: 'someSecret',
        resources: {
          collections: {
            create: true
          }
        }
      }
      const schema1 = {
        name: 'books1',
        property: 'library',
        version: '1.0',
        fields: {
          title: {
            type: 'string'
          }
        },
        settings: {
          fieldLimiters: {
            field1: 1,
            field2: 1
          }
        }
      }
      const schema2 = {
        name: 'books2',
        property: 'library',
        version: '1.0',
        fields: {
          title: {
            type: 'string'
          }
        },
        settings: {
          fieldLimiters: {
            field1: 0,
            field2: 0
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

            const bearerToken = res.body.accessToken

            client
              .post(`/api/collections`)
              .send(schema1)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                res.statusCode.should.eql(200)
                res.body.results.length.should.eql(1)
                res.body.results[0].fields.should.eql(schema1.fields)
                res.body.results[0].settings.should.eql(schema1.settings)

                client
                  .post(`/api/collections`)
                  .send(schema2)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .end((err, res) => {
                    res.statusCode.should.eql(200)
                    res.body.results.length.should.eql(1)
                    res.body.results[0].fields.should.eql(schema2.fields)
                    res.body.results[0].settings.should.eql(schema2.settings)

                    done(err)
                  })
              })
          })
      })
    })

    it('should return 400 if the request contains an invalid value for `settings.index`', done => {
      const testClient = {
        clientId: 'apiClient2',
        secret: 'someSecret',
        resources: {
          collections: {
            create: true
          }
        }
      }
      const schema1 = {
        name: 'books',
        property: 'library',
        version: '1.0',
        fields: {
          title: {
            type: 'string'
          }
        },
        settings: {
          index: ['field1', 'field2']
        }
      }
      const schema2 = {
        name: 'books',
        property: 'library',
        version: '1.0',
        fields: {
          title: {
            type: 'string'
          }
        },
        settings: {
          index: 'field1'
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

            const bearerToken = res.body.accessToken

            client
              .post(`/api/collections`)
              .send(schema1)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                res.statusCode.should.eql(400)
                res.body.success.should.eql(false)
                res.body.errors[0].code.should.eql('ERROR_INVALID_SETTING')
                res.body.errors[0].field.should.eql('settings.index')
                res.body.errors[0].message.should.be.String

                client
                  .post(`/api/collections`)
                  .send(schema2)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .end((err, res) => {
                    res.statusCode.should.eql(400)
                    res.body.success.should.eql(false)
                    res.body.errors[0].code.should.eql('ERROR_INVALID_SETTING')
                    res.body.errors[0].field.should.eql('settings.index')
                    res.body.errors[0].message.should.be.String

                    done(err)
                  })
              })
          })
      })
    })

    it('should return 200 if the request contains a valid value for `settings.index`', done => {
      const testClient = {
        clientId: 'apiClient2',
        secret: 'someSecret',
        resources: {
          collections: {
            create: true
          }
        }
      }
      const schema1 = {
        name: 'books1',
        property: 'library',
        version: '1.0',
        fields: {
          title: {
            type: 'string'
          }
        },
        settings: {
          index: {
            keys: {field1: 1, field2: 1}
          }
        }
      }
      const schema2 = {
        name: 'books2',
        property: 'library',
        version: '1.0',
        fields: {
          title: {
            type: 'string'
          }
        },
        settings: {
          index: {
            keys: {field1: 1, field2: 1},
            options: {unique: true}
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

            const bearerToken = res.body.accessToken

            client
              .post(`/api/collections`)
              .send(schema1)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                res.statusCode.should.eql(200)
                res.body.results.length.should.eql(1)
                res.body.results[0].fields.should.eql(schema1.fields)
                res.body.results[0].settings.should.eql(schema1.settings)

                client
                  .post(`/api/collections`)
                  .send(schema2)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .end((err, res) => {
                    res.statusCode.should.eql(200)
                    res.body.results.length.should.eql(1)
                    res.body.results[0].fields.should.eql(schema2.fields)
                    res.body.results[0].settings.should.eql(schema2.settings)

                    done(err)
                  })
              })
          })
      })
    })
  })

  describe('Updating', () => {
    before(done => {
      help.removeACLData(() => {
        app.start(done)
      })
    })

    beforeEach(() => {
      return help.createSchemas([
        {
          name: 'books',
          property: 'library',
          fields: {
            title: {
              type: 'string'
            },
            isbn: {
              type: 'number'
            }
          }
        }
      ])
    })

    after(done => {
      app.stop(done)
    })

    afterEach(done => {
      modelStore.unloadAll()

      help.dropSchemas().then(() => {
        help.removeACLData(() => done())
      })
    })

    describe('Adding fields', () => {
      it('should return 401 if the request does not contain a valid bearer token', done => {
        client
          .post(`/api/collections/library/books/fields`)
          .send({
            name: 'myNewField',
            type: 'number'
          })
          .set('content-type', 'application/json')
          .end((err, res) => {
            res.statusCode.should.eql(401)

            done(err)
          })
      })

      it('should return 403 if the request contains a bearer token that does not have `update` access to the `collections` resource', done => {
        const testClient = {
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

              const bearerToken = res.body.accessToken

              client
                .post(`/api/collections/library/books/fields`)
                .send({
                  name: 'myNewField',
                  type: 'number'
                })
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .end((err, res) => {
                  res.statusCode.should.eql(403)

                  done(err)
                })
            })
        })
      })

      it('should create a field if the request contains an admin bearer token', done => {
        const testClient = {
          clientId: 'adminClient',
          secret: 'someSecret',
          accessType: 'admin'
        }
        const field = {
          name: 'myNewField',
          type: 'number'
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

              const bearerToken = res.body.accessToken

              client
                .post(`/api/collections/library/books/fields`)
                .send(field)
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .end((err, res) => {
                  res.statusCode.should.eql(200)
                  res.body.fields.title.type.should.eql('string')
                  res.body.fields.myNewField.type.should.eql(field.type)

                  done(err)
                })
            })
        })
      })

      it('should create a field if the request contains a bearer token that has `update` access to the `collections` resource', done => {
        const testClient = {
          clientId: 'apiClient2',
          secret: 'someSecret',
          resources: {
            collections: {
              update: true
            }
          }
        }
        const field = {
          name: 'myNewField',
          type: 'number'
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

              const bearerToken = res.body.accessToken

              client
                .post(`/api/collections/library/books/fields`)
                .send(field)
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .end((err, res) => {
                  res.statusCode.should.eql(200)
                  res.body.fields.title.type.should.eql('string')
                  res.body.fields.myNewField.type.should.eql(field.type)

                  done(err)
                })
            })
        })
      })

      it('should make the schemas changes available after updating a field', done => {
        const testClient = {
          clientId: 'apiClient2',
          secret: 'someSecret',
          accessType: 'admin'
        }
        const field = {
          name: 'myNewField',
          type: 'number'
        }
        const document = {
          title: 'A new document',
          myNewField: 1337
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

              const bearerToken = res.body.accessToken

              client
                .post(`/library/books`)
                .send(document)
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .end((err, res) => {
                  res.statusCode.should.eql(400)

                  client
                    .post(`/api/collections/library/books/fields`)
                    .send(field)
                    .set('content-type', 'application/json')
                    .set('Authorization', `Bearer ${bearerToken}`)
                    .end((err, res) => {
                      res.statusCode.should.eql(200)

                      client
                        .post(`/library/books`)
                        .send(document)
                        .set('content-type', 'application/json')
                        .set('Authorization', `Bearer ${bearerToken}`)
                        .end((err, res) => {
                          res.statusCode.should.eql(200)

                          const {results} = res.body

                          results.length.should.eql(1)
                          results[0].title.should.eql(document.title)
                          results[0].myNewField.should.eql(document.myNewField)

                          client
                            .get(`/library/books/${results[0]._id}`)
                            .set('content-type', 'application/json')
                            .set('Authorization', `Bearer ${bearerToken}`)
                            .end((err, res) => {
                              res.statusCode.should.eql(200)

                              const {results} = res.body

                              results.length.should.eql(1)
                              results[0].title.should.eql(document.title)
                              results[0].myNewField.should.eql(
                                document.myNewField
                              )

                              done(err)
                            })
                        })
                    })
                })
            })
        })
      })

      it('should return 404 if the collection does not exist', done => {
        const testClient = {
          clientId: 'apiClient2',
          secret: 'someSecret',
          resources: {
            collections: {
              update: true
            }
          }
        }
        const field = {
          name: 'myNewField',
          type: 'number'
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

              const bearerToken = res.body.accessToken

              client
                .post(`/api/collections/library/uhoh/fields`)
                .send(field)
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .end((err, res) => {
                  res.statusCode.should.eql(404)

                  done(err)
                })
            })
        })
      })
    })

    describe('Updating fields', () => {
      it('should return 401 if the request does not contain a valid bearer token', done => {
        client
          .put(`/api/collections/library/books/fields/title`)
          .send({
            type: 'number'
          })
          .set('content-type', 'application/json')
          .end((err, res) => {
            res.statusCode.should.eql(401)

            done(err)
          })
      })

      it('should return 403 if the request contains a bearer token that does not have `update` access to the `collections` resource', done => {
        const testClient = {
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

              const bearerToken = res.body.accessToken

              client
                .put(`/api/collections/library/books/fields/title`)
                .send({
                  type: 'number'
                })
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .end((err, res) => {
                  res.statusCode.should.eql(403)

                  done(err)
                })
            })
        })
      })

      it('should update a field if the request contains an admin bearer token', done => {
        const testClient = {
          clientId: 'adminClient',
          secret: 'someSecret',
          accessType: 'admin'
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

              const bearerToken = res.body.accessToken

              client
                .put(`/api/collections/library/books/fields/title`)
                .send({type: 'number'})
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .end((err, res) => {
                  res.statusCode.should.eql(200)
                  res.body.fields.title.type.should.eql('number')

                  done(err)
                })
            })
        })
      })

      it('should update a field if the request contains a bearer token that has `update` access to the `collections` resource', done => {
        const testClient = {
          clientId: 'apiClient2',
          secret: 'someSecret',
          resources: {
            collections: {
              update: true
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

              const bearerToken = res.body.accessToken

              client
                .put(`/api/collections/library/books/fields/title`)
                .send({type: 'number'})
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .end((err, res) => {
                  res.statusCode.should.eql(200)
                  res.body.fields.title.type.should.eql('number')

                  done(err)
                })
            })
        })
      })

      it('should make the schemas changes available after updating a field', done => {
        const testClient = {
          clientId: 'apiClient2',
          secret: 'someSecret',
          accessType: 'admin'
        }
        const document = {
          title: 1337
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

              const bearerToken = res.body.accessToken

              client
                .post(`/library/books`)
                .send(document)
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .end((err, res) => {
                  res.statusCode.should.eql(400)

                  client
                    .put(`/api/collections/library/books/fields/title`)
                    .send({type: 'number'})
                    .set('content-type', 'application/json')
                    .set('Authorization', `Bearer ${bearerToken}`)
                    .end((err, res) => {
                      res.statusCode.should.eql(200)

                      client
                        .post(`/library/books`)
                        .send(document)
                        .set('content-type', 'application/json')
                        .set('Authorization', `Bearer ${bearerToken}`)
                        .end((err, res) => {
                          res.statusCode.should.eql(200)

                          const {results} = res.body

                          results.length.should.eql(1)
                          results[0].title.should.eql(document.title)

                          client
                            .get(`/library/books/${results[0]._id}`)
                            .set('content-type', 'application/json')
                            .set('Authorization', `Bearer ${bearerToken}`)
                            .end((err, res) => {
                              res.statusCode.should.eql(200)

                              const {results} = res.body

                              results.length.should.eql(1)
                              results[0].title.should.eql(document.title)

                              done(err)
                            })
                        })
                    })
                })
            })
        })
      })

      it('should make the schemas changes available after renaming a field', done => {
        const testClient = {
          clientId: 'apiClient2',
          secret: 'someSecret',
          accessType: 'admin'
        }
        const document = {
          subtitle: 'A subtitle'
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

              const bearerToken = res.body.accessToken

              client
                .post(`/library/books`)
                .send(document)
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .end((err, res) => {
                  res.statusCode.should.eql(400)

                  client
                    .put(`/api/collections/library/books/fields/title`)
                    .send({name: 'subtitle'})
                    .set('content-type', 'application/json')
                    .set('Authorization', `Bearer ${bearerToken}`)
                    .end((err, res) => {
                      res.statusCode.should.eql(200)

                      client
                        .post(`/library/books`)
                        .send(document)
                        .set('content-type', 'application/json')
                        .set('Authorization', `Bearer ${bearerToken}`)
                        .end((err, res) => {
                          res.statusCode.should.eql(200)

                          const {results} = res.body

                          results.length.should.eql(1)
                          results[0].subtitle.should.eql(document.subtitle)

                          client
                            .get(`/library/books/${results[0]._id}`)
                            .set('content-type', 'application/json')
                            .set('Authorization', `Bearer ${bearerToken}`)
                            .end((err, res) => {
                              res.statusCode.should.eql(200)

                              const {results} = res.body

                              results.length.should.eql(1)
                              results[0].subtitle.should.eql(document.subtitle)

                              done(err)
                            })
                        })
                    })
                })
            })
        })
      })

      it('should return 404 if the collection does not exist', done => {
        const testClient = {
          clientId: 'apiClient2',
          secret: 'someSecret',
          resources: {
            collections: {
              update: true
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

              const bearerToken = res.body.accessToken

              client
                .put(`/api/collections/library/uhoh/fields/title`)
                .send({type: 'number'})
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .end((err, res) => {
                  res.statusCode.should.eql(404)

                  done(err)
                })
            })
        })
      })

      it('should return 404 if the field does not exist', done => {
        const testClient = {
          clientId: 'apiClient2',
          secret: 'someSecret',
          resources: {
            collections: {
              update: true
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

              const bearerToken = res.body.accessToken

              client
                .put(`/api/collections/library/books/fields/uhoh`)
                .send({type: 'number'})
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .end((err, res) => {
                  res.statusCode.should.eql(404)

                  done(err)
                })
            })
        })
      })
    })

    describe('Deleting fields', () => {
      it('should return 401 if the request does not contain a valid bearer token', done => {
        client
          .delete(`/api/collections/library/books/fields/isbn`)
          .set('content-type', 'application/json')
          .end((err, res) => {
            res.statusCode.should.eql(401)

            done(err)
          })
      })

      it('should return 403 if the request contains a bearer token that does not have `update` access to the `collections` resource', done => {
        const testClient = {
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

              const bearerToken = res.body.accessToken

              client
                .delete(`/api/collections/library/books/fields/isbn`)
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .end((err, res) => {
                  res.statusCode.should.eql(403)

                  done(err)
                })
            })
        })
      })

      it('should delete a field if the request contains an admin bearer token', done => {
        const testClient = {
          clientId: 'adminClient',
          secret: 'someSecret',
          accessType: 'admin'
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

              const bearerToken = res.body.accessToken

              client
                .delete(`/api/collections/library/books/fields/isbn`)
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .end((err, res) => {
                  res.statusCode.should.eql(200)
                  res.body.fields.title.type.should.eql('string')
                  should.not.exist(res.body.fields.isbn)

                  done(err)
                })
            })
        })
      })

      it('should delete a field if the request contains a bearer token that has `update` access to the `collections` resource', done => {
        const testClient = {
          clientId: 'apiClient2',
          secret: 'someSecret',
          resources: {
            collections: {
              update: true
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

              const bearerToken = res.body.accessToken

              client
                .delete(`/api/collections/library/books/fields/isbn`)
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .end((err, res) => {
                  res.statusCode.should.eql(200)
                  res.body.fields.title.type.should.eql('string')
                  should.not.exist(res.body.fields.isbn)

                  done(err)
                })
            })
        })
      })

      it('should make the schemas changes available after updating a field', done => {
        const testClient = {
          clientId: 'apiClient2',
          secret: 'someSecret',
          accessType: 'admin'
        }
        const field = {
          name: 'myNewField',
          type: 'number'
        }
        const document = {
          title: 'A new document',
          isbn: 1337
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

              const bearerToken = res.body.accessToken

              client
                .post(`/library/books`)
                .send(document)
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .end((err, res) => {
                  res.statusCode.should.eql(200)

                  const {results} = res.body

                  results.length.should.eql(1)
                  results[0].title.should.eql(document.title)
                  results[0].isbn.should.eql(document.isbn)

                  client
                    .delete(`/api/collections/library/books/fields/isbn`)
                    .set('content-type', 'application/json')
                    .set('Authorization', `Bearer ${bearerToken}`)
                    .end((err, res) => {
                      res.statusCode.should.eql(200)

                      client
                        .post(`/library/books`)
                        .send(document)
                        .set('content-type', 'application/json')
                        .set('Authorization', `Bearer ${bearerToken}`)
                        .end((err, res) => {
                          res.statusCode.should.eql(400)

                          done(err)
                        })
                    })
                })
            })
        })
      })

      it('should return 404 if the collection does not exist', done => {
        const testClient = {
          clientId: 'apiClient2',
          secret: 'someSecret',
          resources: {
            collections: {
              update: true
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

              const bearerToken = res.body.accessToken

              client
                .delete(`/api/collections/library/uhoh/fields/title`)
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .end((err, res) => {
                  res.statusCode.should.eql(404)

                  done(err)
                })
            })
        })
      })

      it('should return 404 if the field does not exist', done => {
        const testClient = {
          clientId: 'apiClient2',
          secret: 'someSecret',
          resources: {
            collections: {
              update: true
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

              const bearerToken = res.body.accessToken

              client
                .delete(`/api/collections/library/books/fields/uhoh`)
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .end((err, res) => {
                  res.statusCode.should.eql(404)

                  done(err)
                })
            })
        })
      })
    })

    describe('Settings', () => {
      it('should return 401 if the request does not contain a valid bearer token', done => {
        client
          .put(`/api/collections/library/books/settings`)
          .send({
            cache: false
          })
          .set('content-type', 'application/json')
          .end((err, res) => {
            res.statusCode.should.eql(401)

            done(err)
          })
      })

      it('should return 403 if the request contains a bearer token that does not have `update` access to the `collections` resource', done => {
        const testClient = {
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

              const bearerToken = res.body.accessToken

              client
                .put(`/api/collections/library/books/settings`)
                .send({
                  cache: false
                })
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .end((err, res) => {
                  res.statusCode.should.eql(403)

                  done()
                })
            })
        })
      })

      it('should update settings if the request contains an admin bearer token', done => {
        const testClient = {
          clientId: 'adminClient',
          secret: 'someSecret',
          accessType: 'admin'
        }
        const update = {
          displayName: 'My awesome collection'
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

              const bearerToken = res.body.accessToken

              client
                .put(`/api/collections/library/books/settings`)
                .send(update)
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .end((err, res) => {
                  res.statusCode.should.eql(200)

                  const {settings} = res.body

                  settings.displayName.should.eql(update.displayName)

                  done(err)
                })
            })
        })
      })

      it('should update settings if the request contains a bearer token that has `update` access to the `collections` resource', done => {
        const testClient = {
          clientId: 'apiClient2',
          secret: 'someSecret',
          resources: {
            collections: {
              update: true
            }
          }
        }
        const update = {
          displayName: 'My awesome collection'
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

              const bearerToken = res.body.accessToken

              client
                .put(`/api/collections/library/books/settings`)
                .send(update)
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .end((err, res) => {
                  res.statusCode.should.eql(200)

                  const {settings} = res.body

                  settings.displayName.should.eql(update.displayName)

                  done(err)
                })
            })
        })
      })
    })
  })
})
