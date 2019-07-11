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
      name: {
        type: 'String',
        required: true
      }
    },
    name: 'event',
    property: 'library',
    settings: {
      displayName: 'This is a human-friendly name',
      cache: false,
      authenticate: true,
      count: 40
    },
    version: '1.0'
  }
]

describe('Resources endpoint', function() {
  before(done => {
    help.removeACLData(() => {
      help.createSchemas(schemas).then(() => {
        app.start(done)
      })
    })
  })

  after(done => {
    help.removeACLData(() => {
      help.dropSchemas().then(() => {
        app.stop(done)
      })
    })
  })

  it('should return 401 if the request does not contain a valid bearer token', done => {
    client
      .get(`/api/resources`)
      .set('content-type', 'application/json')
      .end((err, res) => {
        res.statusCode.should.eql(401)

        done(err)
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
            // Checking custom endpoints.
            Object.keys(app.components).forEach(key => {
              const component = app.components[key]

              if (component._type === app.COMPONENT_TYPE.CUSTOM_ENDPOINT) {
                const match = res.body.results.some(result => {
                  return result.name === component.aclKey
                })

                match.should.eql(true)
              }
            })

            // Checking media buckets.
            config
              .get('media.buckets')
              .concat(config.get('media.defaultBucket'))
              .forEach(bucketName => {
                const match = res.body.results.some(result => {
                  return result.name === `media:${bucketName}`
                })

                match.should.eql(true)
              })

            // Checking collections.
            schemas.forEach(schema => {
              const match = res.body.results.some(result => {
                return (
                  result.name === `collection:${schema.property}_${schema.name}`
                )
              })

              match.should.eql(true)
            })

            done()
          })
      })
  })

  it('should only list resources for which the client has any type of access to (no resources)', done => {
    const testClient = {
      clientId: 'apiClient',
      secret: 'someSecret',
      resources: {
        'collection:library_book': {
          create: false,
          read: false,
          update: false
        },
        'collection:library_event': {
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

  it('should only list resources for which the client has any type of access to (create access set to `true`)', done => {
    const testClient = {
      clientId: 'apiClient',
      secret: 'someSecret',
      resources: {
        'collection:library_book': {
          create: true
        },
        'collection:library_person': {
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
              res.body.results[0].name.should.eql('collection:library_book')

              done(err)
            })
        })
    })
  })

  it('should only list resources for which the client has any type of access to (create access with `fields`)', done => {
    const testClient = {
      clientId: 'apiClient',
      secret: 'someSecret',
      resources: {
        'collection:library_book': {
          create: {
            fields: {
              field1: 1
            }
          }
        },
        'collection:library_person': {
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
              res.body.results[0].name.should.eql('collection:library_book')

              done(err)
            })
        })
    })
  })

  it('should only list resources for which the client has any type of access to (create access with `filter`)', done => {
    const testClient = {
      clientId: 'apiClient',
      secret: 'someSecret',
      resources: {
        'collection:library_book': {
          create: {
            filter: {
              field1: 'something'
            }
          }
        },
        'collection:library_person': {
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
              res.body.results[0].name.should.eql('collection:library_book')

              done(err)
            })
        })
    })
  })

  it('should only list resources for which the client has any type of access to (delete access set to `true`)', done => {
    const testClient = {
      clientId: 'apiClient',
      secret: 'someSecret',
      resources: {
        'collection:library_book': {
          delete: true
        },
        'collection:library_person': {
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
              res.body.results[0].name.should.eql('collection:library_book')

              done(err)
            })
        })
    })
  })

  it('should only list resources for which the client has any type of access to (delete access with `filter`)', done => {
    const testClient = {
      clientId: 'apiClient',
      secret: 'someSecret',
      resources: {
        'collection:library_book': {
          delete: {
            filter: {
              field1: 'something'
            }
          }
        },
        'collection:library_person': {
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
              res.body.results[0].name.should.eql('collection:library_book')

              done(err)
            })
        })
    })
  })

  it('should only list resources for which the client has any type of access to (read access set to `true`)', done => {
    const testClient = {
      clientId: 'apiClient',
      secret: 'someSecret',
      resources: {
        'collection:library_book': {
          read: true
        },
        'collection:library_person': {
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
              res.body.results[0].name.should.eql('collection:library_book')

              done(err)
            })
        })
    })
  })

  it('should only list resources for which the client has any type of access to (read access with `fields`)', done => {
    const testClient = {
      clientId: 'apiClient',
      secret: 'someSecret',
      resources: {
        'collection:library_book': {
          read: {
            fields: {
              field1: 1
            }
          }
        },
        'collection:library_person': {
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
              res.body.results[0].name.should.eql('collection:library_book')

              done(err)
            })
        })
    })
  })

  it('should only list resources for which the client has any type of access to (read access with `filter`)', done => {
    const testClient = {
      clientId: 'apiClient',
      secret: 'someSecret',
      resources: {
        'collection:library_book': {
          read: {
            filter: {
              field1: 'something'
            }
          }
        },
        'collection:library_person': {
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
              res.body.results[0].name.should.eql('collection:library_book')

              done(err)
            })
        })
    })
  })

  it('should only list resources for which the client has any type of access to (update access set to `true`)', done => {
    const testClient = {
      clientId: 'apiClient',
      secret: 'someSecret',
      resources: {
        'collection:library_book': {
          update: true
        },
        'collection:library_person': {
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
              res.body.results[0].name.should.eql('collection:library_book')

              done(err)
            })
        })
    })
  })

  it('should only list resources for which the client has any type of access to (update access with `fields`)', done => {
    const testClient = {
      clientId: 'apiClient',
      secret: 'someSecret',
      resources: {
        'collection:library_book': {
          update: {
            fields: {
              field1: 1
            }
          }
        },
        'collection:library_person': {
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
              res.body.results[0].name.should.eql('collection:library_book')

              done(err)
            })
        })
    })
  })

  it('should only list resources for which the client has any type of access to (update access with `filter`)', done => {
    const testClient = {
      clientId: 'apiClient',
      secret: 'someSecret',
      resources: {
        'collection:library_book': {
          update: {
            filter: {
              field1: 'something'
            }
          }
        },
        'collection:library_person': {
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
              res.body.results[0].name.should.eql('collection:library_book')

              done(err)
            })
        })
    })
  })
})
