const app = require('./../../dadi/lib/')
const config = require('./../../config')
const help = require('./help')
const request = require('supertest')
const client = request(
  `http://${config.get('server.host')}:${config.get('server.port')}`
)

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
              match.version.should.eql(collection.version)
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
              return collection.path === '/1.0/library/book'
            })

            const collection2 = res.body.collections.some(collection => {
              return collection.path === '/1.0/library/person'
            })

            const collection3 = res.body.collections.some(collection => {
              return collection.path === '/vtest/testdb/test-schema'
            })

            const collection4 = res.body.collections.some(collection => {
              return collection.path === '/vtest/testdb/test-reference-schema'
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
