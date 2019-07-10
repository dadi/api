const app = require('./../../dadi/lib/')
const config = require('./../../config')
const help = require('./help')
const request = require('supertest')
const client = request(
  `http://${config.get('server.host')}:${config.get('server.port')}`
)

const configBackup = config.get()

const schemas = [
  {
    fields: {
      title: {
        type: 'String',
        required: true
      }
    },
    settings: {
      cache: false,
      authenticate: true,
      count: 40
    }
  },
  {
    fields: {
      updatedTitle: {
        type: 'String'
      }
    },
    settings: {
      cache: false,
      authenticate: true,
      count: 40
    }
  }
]

describe('Collections seeds', () => {
  describe('when `schemas.loadSeeds` is false', () => {
    before(() => {
      config.set('paths.collections', 'seed-collections')
      config.set('schemas.loadSeeds', false)
    })

    after(done => {
      help.dropSchemas().then(() => {
        help.removeACLData(() => {
          config.set('paths.collections', configBackup.paths.collections)
          config.set('schemas.loadSeeds', configBackup.schemas.loadSeeds)

          done()
        })
      })
    })

    it('should not create collection from seed', done => {
      const schemaSource = JSON.stringify(schemas[0], null, 2)

      help.writeTempFile(
        'seed-collections/test/collection.books.json',
        schemaSource,
        cleanupFn => {
          app.start(() => {
            help.getBearerTokenWithAccessType('admin', (err, bearerToken) => {
              client
                .get(`/vtest/test/books`)
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .end((err, res) => {
                  res.statusCode.should.eql(404)

                  cleanupFn()

                  app.stop(done)
                })
            })
          })
        }
      )
    })
  })

  describe('when `schemas.loadSeeds` is true', () => {
    let cleanupFn

    before(done => {
      config.set(
        'paths.collections',
        'test/acceptance/temp-workspace/seed-collections'
      )
      config.set('schemas.loadSeeds', true)

      help.writeTempFile(
        'temp-workspace/seed-collections/test/collection.books.json',
        JSON.stringify(schemas[0], null, 2),
        callback => {
          cleanupFn = callback

          done()
        }
      )
    })

    after(done => {
      cleanupFn()

      help.dropSchemas().then(() => {
        help.removeACLData(() => {
          config.set('paths.collections', configBackup.paths.collections)
          config.set('schemas.loadSeeds', configBackup.schemas.loadSeeds)

          done()
        })
      })
    })

    it('should create remote collection from seed', done => {
      app.start(() => {
        help.getBearerTokenWithAccessType('admin', (err, bearerToken) => {
          setTimeout(() => {
            client
              .get(`/vtest/test/books`)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                res.statusCode.should.eql(200)

                app.stop(done)
              })
          }, 800)
        })
      })
    })

    it('should update remote collection if seed is more recent', done => {
      help
        .createSchemas([
          Object.assign({}, schemas[0], {
            fields: {
              subtitle: {
                type: 'string'
              }
            },
            version: 'vtest',
            property: 'test',
            name: 'books',
            timestamp: Date.now() / 2
          })
        ])
        .then(() => {
          app.start(() => {
            help.getBearerTokenWithAccessType('admin', (err, bearerToken) => {
              setTimeout(() => {
                client
                  .get(`/api/collections`)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .end((err, res) => {
                    res.statusCode.should.eql(200)

                    const {collections} = res.body

                    collections.length.should.eql(1)
                    collections[0].fields.should.eql(schemas[0].fields)

                    help.dropSchemas().then(() => {
                      app.stop(done)
                    })
                  })
              }, 800)
            })
          })
        })
    })

    it('should not update remote collection if remote is more recent', done => {
      const originalSchema = Object.assign({}, schemas[0], {
        fields: {
          subtitle: {
            type: 'string'
          }
        },
        version: 'vtest',
        property: 'test',
        name: 'books',
        timestamp: Date.now() * 2
      })

      help.createSchemas([originalSchema]).then(() => {
        app.start(() => {
          help.getBearerTokenWithAccessType('admin', (err, bearerToken) => {
            setTimeout(() => {
              client
                .get(`/api/collections`)
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .end((err, res) => {
                  res.statusCode.should.eql(200)

                  const {collections} = res.body

                  collections.length.should.eql(1)
                  collections[0].fields.should.eql(originalSchema.fields)

                  help.dropSchemas().then(() => {
                    app.stop(done)
                  })
                })
            }, 800)
          })
        })
      })
    })

    it('should update remote collection when seed file is changed', done => {
      const originalSchema = Object.assign({}, schemas[0], {
        fields: {
          subtitle: {
            type: 'string'
          }
        },
        version: 'vtest',
        property: 'test',
        name: 'books',
        timestamp: Date.now() + 10
      })

      help.createSchemas([originalSchema]).then(() => {
        app.start(() => {
          help.getBearerTokenWithAccessType('admin', (err, bearerToken) => {
            setTimeout(() => {
              client
                .get(`/api/collections`)
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .end((err, res) => {
                  res.statusCode.should.eql(200)

                  const {collections} = res.body

                  collections.length.should.eql(1)
                  collections[0].fields.should.eql(originalSchema.fields)

                  help.writeTempFile(
                    'temp-workspace/seed-collections/test/collection.books.json',
                    JSON.stringify(schemas[1], null, 2),
                    callback => {
                      setTimeout(() => {
                        client
                          .get(`/api/collections`)
                          .set('content-type', 'application/json')
                          .set('Authorization', `Bearer ${bearerToken}`)
                          .end((err, res) => {
                            res.statusCode.should.eql(200)

                            const {collections} = res.body

                            collections.length.should.eql(1)
                            collections[0].fields.should.eql(schemas[1].fields)

                            callback()

                            help.dropSchemas().then(() => {
                              app.stop(done)
                            })
                          })
                      }, 500)
                    }
                  )
                })
            }, 80)
          })
        })
      })
    }).timeout(8000)
  })
})
