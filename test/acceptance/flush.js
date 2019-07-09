const app = require('./../../dadi/lib/')
const assert = require('assert')
const cache = require('./../../dadi/lib/cache')
const config = require('./../../config')
const fakeredis = require('fakeredis')
const help = require('./help')
const request = require('supertest')
const Readable = require('stream').Readable

let bearerToken
let adminBearerToken
let c
let cacheKeys = []
let configBackup = config.get()

describe('Cache', function(done) {
  this.timeout(5000)

  describe('Invalidation API - Filesystem', function() {
    before(() => {
      config.set('caching.directory.enabled', true)
      config.set('cachibg.redis.enabled', false)

      cache.reset()
    })

    after(() => {
      config.set(
        'caching.directory.enabled',
        configBackup.caching.directory.enabled
      )
      config.set('cachibg.redis.enabled', configBackup.caching.redis.enabled)
    })

    beforeEach(function(done) {
      app.start(function() {
        help
          .createSchemas([
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
                cache: true,
                authenticate: true,
                count: 40
              },
              version: 'v1'
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
            }
          ])
          .then(() => {
            help.dropDatabase('testdb', null, function(err) {
              if (err) return done(err)

              help.dropDatabase('library', null, function(err) {
                if (err) return done(err)

                help.getBearerToken(function(err, token) {
                  if (err) return done(err)

                  adminBearerToken = token

                  help.getBearerTokenWithPermissions(
                    {roles: ['some-role']},
                    (err, token) => {
                      if (err) return done(err)

                      bearerToken = token

                      cacheKeys = [] // resets the array for the next test

                      setTimeout(() => {
                        help.createDoc(adminBearerToken, function(err, doc) {
                          if (err) return done(err)

                          const client = request(
                            'http://' +
                              config.get('server.host') +
                              ':' +
                              config.get('server.port')
                          )

                          client
                            .get('/vtest/testdb/test-schema')
                            .set('Authorization', `Bearer ${adminBearerToken}`)
                            .expect(200)
                            .end(function(err, res1) {
                              if (err) return done(err)
                              res1.headers['x-cache'].should.exist
                              res1.headers['x-cache'].should.eql('MISS')
                            })

                          setTimeout(() => {
                            client
                              .get('/vtest/testdb/test-schema')
                              .set(
                                'Authorization',
                                `Bearer ${adminBearerToken}`
                              )
                              .expect(200)
                              .end(function(err, res1) {
                                if (err) return done(err)
                                res1.headers['x-cache'].should.exist
                                res1.headers['x-cache'].should.eql('HIT')
                                done()
                              })
                          }, 300)
                        })
                      }, 300)
                    }
                  )
                })
              })
            })
          })
      })
    })

    afterEach(function(done) {
      help.removeTestClients(function() {
        help.dropSchemas().then(() => {
          app.stop(done)
        })
      })
    })

    it('should return 401 if the request does not contain a valid bearer token', done => {
      const client = request(
        'http://' + config.get('server.host') + ':' + config.get('server.port')
      )

      client
        .post('/api/flush')
        .send({path: '/vtest/testdb/test-schema'})
        .end((err, res) => {
          if (err) return done(err)

          res.statusCode.should.eql(401)

          setTimeout(() => {
            // test that cache documents still exist for /vtest/testdb/test-schema
            client
              .get('/vtest/testdb/test-schema')
              .set('Authorization', `Bearer ${adminBearerToken}`)
              .expect(200)
              .end(function(err, res) {
                if (err) return done(err)
                res.headers['x-cache'].should.exist
                res.headers['x-cache'].should.eql('HIT')

                done()
              })
          }, 500)
        })
    })

    it('should return 403 if the request contain a valid bearer token that does not have sufficient permissions to perform the operation', done => {
      const client = request(
        'http://' + config.get('server.host') + ':' + config.get('server.port')
      )

      client
        .post('/api/flush')
        .set('Authorization', `Bearer ${bearerToken}`)
        .send({path: '/vtest/testdb/test-schema'})
        .end((err, res) => {
          if (err) return done(err)

          res.statusCode.should.eql(403)

          setTimeout(() => {
            // test that cache documents still exist for /vtest/testdb/test-schema
            client
              .get('/vtest/testdb/test-schema')
              .set('Authorization', `Bearer ${adminBearerToken}`)
              .expect(200)
              .end(function(err, res) {
                if (err) return done(err)
                res.headers['x-cache'].should.exist
                res.headers['x-cache'].should.eql('HIT')

                done()
              })
          }, 500)
        })
    })

    it("should not flush cached items that don't match the specified path", function(done) {
      const client = request(
        'http://' + config.get('server.host') + ':' + config.get('server.port')
      )

      // create a document in another collection
      client
        .post('/v1/library/book')
        .set('Authorization', `Bearer ${adminBearerToken}`)
        .send({
          title: 'War and Peace',
          author: require('uuid')
            .v4()
            .toString()
        })
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err)

          // get first time, uncached version of /v1/library/book
          client
            .get('/v1/library/book')
            .set('Authorization', `Bearer ${adminBearerToken}`)
            .expect(200)
            .end(function(err, res) {
              if (err) return done(err)
              res.headers['x-cache'].should.exist
              res.headers['x-cache'].should.eql('MISS')

              setTimeout(function() {
                // get cached version of /v1/library/book
                client
                  .get('/v1/library/book')
                  .set('Authorization', `Bearer ${adminBearerToken}`)
                  .expect(200)
                  .end(function(err, res) {
                    if (err) return done(err)
                    res.headers['x-cache'].should.exist
                    res.headers['x-cache'].should.eql('HIT')

                    // get cached version of /vtest/testdb/test-schema
                    client
                      .get('/vtest/testdb/test-schema')
                      .set('Authorization', `Bearer ${adminBearerToken}`)
                      .expect(200)
                      .end(function(err, res) {
                        if (err) return done(err)

                        client
                          .get('/vtest/testdb/test-schema')
                          .set('Authorization', `Bearer ${adminBearerToken}`)
                          .expect(200)
                          .end(function(err, res) {
                            if (err) return done(err)

                            res.headers['x-cache'].should.exist
                            res.headers['x-cache'].should.eql('HIT')

                            // flush cache for /vtest/testdb/test-schema
                            client
                              .post('/api/flush')
                              .set(
                                'Authorization',
                                `Bearer ${adminBearerToken}`
                              )
                              .send({path: '/vtest/testdb/test-schema'})
                              .expect(200)
                              .end(function(err, res) {
                                if (err) return done(err)

                                res.body.result.should.equal('success')

                                setTimeout(function() {
                                  // test that cache documents still exist for /v1/library/book
                                  client
                                    .get('/v1/library/book')
                                    .set(
                                      'Authorization',
                                      `Bearer ${adminBearerToken}`
                                    )
                                    .expect(200)
                                    .end(function(err, res) {
                                      if (err) return done(err)
                                      res.headers['x-cache'].should.exist
                                      res.headers['x-cache'].should.eql('HIT')

                                      setTimeout(function() {
                                        // test that cache has been flushed for /vtest/testdb/test-schema
                                        client
                                          .get('/vtest/testdb/test-schema')
                                          .set(
                                            'Authorization',
                                            `Bearer ${adminBearerToken}`
                                          )
                                          .expect(200)
                                          .end(function(err, res) {
                                            if (err) return done(err)
                                            res.headers['x-cache'].should.exist
                                            res.headers['x-cache'].should.eql(
                                              'MISS'
                                            )
                                            done()
                                          })
                                      }, 500)
                                    })
                                }, 500)
                              })
                          })
                      })
                  })
              }, 500)
            })
        })
    })

    it('should flush only cached items matching the specified path', function(done) {
      this.timeout(4000)
      const client = request(
        'http://' + config.get('server.host') + ':' + config.get('server.port')
      )

      client
        .get('/vtest/testdb/test-schema')
        .set('Authorization', `Bearer ${adminBearerToken}`)
        .expect(200)
        .end(function(err, res1) {
          if (err) return done(err)
          res1.headers['x-cache'].should.exist
          res1.headers['x-cache'].should.eql('HIT')

          client
            .post('/api/flush')
            .set('Authorization', `Bearer ${adminBearerToken}`)
            .send({path: '/vtest/testdb/test-schema'})
            .expect(200)
            .end(function(err, res) {
              if (err) return done(err)

              res.body.result.should.equal('success')

              setTimeout(function() {
                client
                  .get('/vtest/testdb/test-schema')
                  .set('Authorization', `Bearer ${adminBearerToken}`)
                  .expect(200)
                  .end(function(err, res1) {
                    if (err) return done(err)
                    res1.headers['x-cache'].should.exist
                    res1.headers['x-cache'].should.eql('MISS')

                    done()
                  })
              }, 500)
            })
        })
    })

    it('should flush all cached items when no path is specified', function(done) {
      this.timeout(4000)
      const client = request(
        'http://' + config.get('server.host') + ':' + config.get('server.port')
      )

      // create a document in another collection
      client
        .post('/v1/library/book')
        .set('Authorization', `Bearer ${adminBearerToken}`)
        .send({
          title: 'War and Peace',
          author: require('uuid')
            .v4()
            .toString()
        })
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err)

          // get first tine, uncached version of /v1/library/book
          client
            .get('/v1/library/book')
            .set('Authorization', `Bearer ${adminBearerToken}`)
            .expect(200)
            .end(function(err, res) {
              if (err) return done(err)
              res.headers['x-cache'].should.exist
              res.headers['x-cache'].should.eql('MISS')

              // get cached version of /v1/library/book
              client
                .get('/v1/library/book')
                .set('Authorization', `Bearer ${adminBearerToken}`)
                .expect(200)
                .end(function(err, res) {
                  if (err) return done(err)
                  res.headers['x-cache'].should.exist
                  res.headers['x-cache'].should.eql('HIT')

                  // get cached version of /vtest/testdb/test-schema
                  client
                    .get('/vtest/testdb/test-schema')
                    .set('Authorization', `Bearer ${adminBearerToken}`)
                    .expect(200)
                    .end(function(err, res) {
                      if (err) return done(err)

                      res.headers['x-cache'].should.exist
                      res.headers['x-cache'].should.eql('HIT')

                      // flush cache for /vtest/testdb/test-schema
                      client
                        .post('/api/flush')
                        .set('Authorization', `Bearer ${adminBearerToken}`)
                        .send({path: '*'})
                        .expect(200)
                        .end(function(err, res) {
                          if (err) return done(err)

                          res.body.result.should.equal('success')

                          setTimeout(function() {
                            // test that cache has been flushed for /v1/library/book
                            client
                              .get('/v1/library/book')
                              .set(
                                'Authorization',
                                `Bearer ${adminBearerToken}`
                              )
                              .expect(200)
                              .end(function(err, res) {
                                if (err) return done(err)
                                res.headers['x-cache'].should.exist
                                assert(
                                  res.headers['x-cache'] === 'MISS',
                                  'Expected /v1/library/book to have no cached documents'
                                )

                                setTimeout(function() {
                                  // test that cache has been flushed for /vtest/testdb/test-schema
                                  client
                                    .get('/vtest/testdb/test-schema')
                                    .set(
                                      'Authorization',
                                      `Bearer ${adminBearerToken}`
                                    )
                                    .expect(200)
                                    .end(function(err, res) {
                                      if (err) return done(err)
                                      res.headers['x-cache'].should.exist
                                      assert(
                                        res.headers['x-cache'] === 'MISS',
                                        'Expected /vtest/testdb/test-schema to have no cached documents'
                                      )
                                      done()
                                    })
                                }, 500)
                              })
                          }, 500)
                        })
                    })
                })
            })
        })
    })
  })

  describe('Invalidation API - Redis', function() {
    before(() => {
      config.set('caching.directory.enabled', false)
      config.set('caching.redis.enabled', true)

      cache.reset()
    })

    after(() => {
      config.set(
        'caching.directory.enabled',
        configBackup.caching.directory.enabled
      )
      config.set('cachibg.redis.enabled', configBackup.caching.redis.enabled)
    })

    beforeEach(function(done) {
      cache.reset()
      help.clearCache()

      c = cache(app)
      c.cache.cacheHandler.redisClient = fakeredis.createClient()
      c.cache.cacheHandler.redisClient.status = 'ready'

      c.cache.cacheHandler.redisClient.scanStream = function(pattern) {
        const stream = new Readable({objectMode: true})

        for (let i = 0; i < cacheKeys.length; i++) {
          if (
            pattern.match === '*' ||
            cacheKeys[i].indexOf(
              pattern.match.substring(0, pattern.match.length - 1)
            ) === 0
          ) {
            stream.push([cacheKeys[i]])
          } else {
            // console.log('rejected key: ', cacheKeys[i])
          }
        }

        stream.push(null)

        return stream
      }

      app.start(function() {
        help
          .createSchemas([
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
                cache: true,
                authenticate: true,
                count: 40
              },
              version: 'v1'
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
            }
          ])
          .then(() => {
            help.dropDatabase('testdb', null, function(err) {
              if (err) return done(err)

              help.dropDatabase('library', null, function(err) {
                if (err) return done(err)

                help.getBearerToken(function(err, token) {
                  if (err) return done(err)

                  adminBearerToken = token

                  help.getBearerTokenWithPermissions(
                    {roles: ['some-role']},
                    (err, token) => {
                      if (err) return done(err)

                      bearerToken = token

                      cacheKeys = [] // resets the array for the next test

                      help.createDoc(adminBearerToken, function(err, doc) {
                        if (err) return done(err)

                        request(
                          `http://${config.get('server.host')}:${config.get(
                            'server.port'
                          )}`
                        )
                          .get('/vtest/testdb/test-schema')
                          .set('Accept-Encoding', 'deflate, gzip')
                          .set('Authorization', `Bearer ${adminBearerToken}`)
                          .expect(200)
                          .end(function(err, res1) {
                            if (err) return done(err)
                            res1.body.results.length.should.eql(1)
                            res1.headers['x-cache'].should.exist
                            res1.headers['x-cache'].should.eql('MISS')
                          })

                        setTimeout(() => {
                          request(
                            `http://${config.get('server.host')}:${config.get(
                              'server.port'
                            )}`
                          )
                            .get('/vtest/testdb/test-schema')
                            .set('Accept-Encoding', 'deflate, gzip')
                            .set('Authorization', `Bearer ${adminBearerToken}`)
                            .expect(200)
                            .end(function(err, res1) {
                              if (err) return done(err)
                              res1.body.results.length.should.eql(1)
                              res1.headers['x-cache'].should.exist
                              res1.headers['x-cache'].should.eql('HIT')

                              done()
                            })
                        }, 300)
                      })
                    }
                  )
                })
              })
            })
          })
      })
    })

    afterEach(function(done) {
      help.removeTestClients(function() {
        app.stop(done)
      })
    })

    it('should return 401 if the request does not contain a valid bearer token', done => {
      const client = request(
        'http://' + config.get('server.host') + ':' + config.get('server.port')
      )

      client
        .post('/api/flush')
        .send({path: '/vtest/testdb/test-schema'})
        .end((err, res) => {
          if (err) return done(err)

          res.statusCode.should.eql(401)

          setTimeout(() => {
            // test that cache documents still exist for /vtest/testdb/test-schema
            client
              .get('/vtest/testdb/test-schema')
              .set('Accept-Encoding', 'identity')
              .set('Authorization', `Bearer ${adminBearerToken}`)
              .expect(200)
              .end(function(err, res) {
                if (err) return done(err)
                res.headers['x-cache'].should.exist
                res.headers['x-cache'].should.eql('HIT')

                done()
              })
          }, 500)
        })
    })

    it('should return 403 if the request contain a valid bearer token that does not have sufficient permissions to perform the operation', done => {
      const client = request(
        'http://' + config.get('server.host') + ':' + config.get('server.port')
      )

      client
        .post('/api/flush')
        .set('Authorization', `Bearer ${bearerToken}`)
        .send({path: '/vtest/testdb/test-schema'})
        .end((err, res) => {
          if (err) return done(err)

          res.statusCode.should.eql(403)

          setTimeout(() => {
            // test that cache documents still exist for /vtest/testdb/test-schema
            client
              .get('/vtest/testdb/test-schema')
              .set('Accept-Encoding', 'identity')
              .set('Authorization', `Bearer ${adminBearerToken}`)
              .expect(200)
              .end(function(err, res) {
                if (err) return done(err)
                res.headers['x-cache'].should.exist
                res.headers['x-cache'].should.eql('HIT')

                done()
              })
          }, 500)
        })
    })

    it("should not flush cached items that don't match the specified path", function(done) {
      this.timeout(4000)

      const client = request(
        'http://' + config.get('server.host') + ':' + config.get('server.port')
      )

      // create a document in another collection
      client
        .post('/v1/library/book')
        .set('Authorization', `Bearer ${adminBearerToken}`)
        .send({
          title: 'War and Peace',
          author: require('uuid')
            .v4()
            .toString()
        })
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err)

          // get first time, uncached version of /v1/library/book
          client
            .get('/v1/library/book')
            .set('Accept-Encoding', 'identity')
            .set('Authorization', `Bearer ${adminBearerToken}`)
            .expect(200)
            .end(function(err, res) {
              if (err) return done(err)
              res.headers['x-cache'].should.exist
              res.headers['x-cache'].should.eql('MISS')

              setTimeout(function() {
                // get cached version of /v1/library/book
                client
                  .get('/v1/library/book')
                  .set('Accept-Encoding', 'identity')
                  .set('Authorization', `Bearer ${adminBearerToken}`)
                  .expect(200)
                  .end(function(err, res) {
                    if (err) return done(err)
                    res.headers['x-cache'].should.exist
                    res.headers['x-cache'].should.eql('HIT')

                    // get cached version of /vtest/testdb/test-schema
                    client
                      .get('/vtest/testdb/test-schema')
                      .set('Accept-Encoding', 'identity')
                      .set('Authorization', `Bearer ${adminBearerToken}`)
                      .expect(200)
                      .end(function(err, res) {
                        if (err) return done(err)

                        client
                          .get('/vtest/testdb/test-schema')
                          .set('Accept-Encoding', 'identity')
                          .set('Authorization', `Bearer ${adminBearerToken}`)
                          .expect(200)
                          .end(function(err, res) {
                            if (err) return done(err)

                            res.headers['x-cache'].should.exist
                            res.headers['x-cache'].should.eql('HIT')

                            // get the cache keys
                            c.cache.cacheHandler.redisClient.KEYS(
                              '*',
                              (err, keys) => {
                                cacheKeys = keys

                                // flush cache for /vtest/testdb/test-schema
                                client
                                  .post('/api/flush')
                                  .set(
                                    'Authorization',
                                    `Bearer ${adminBearerToken}`
                                  )
                                  .send({path: '/vtest/testdb/test-schema'})
                                  .expect(200)
                                  .end(function(err, res) {
                                    if (err) return done(err)
                                    res.body.result.should.equal('success')

                                    setTimeout(function() {
                                      // test that cache documents still exist for /v1/library/book
                                      client
                                        .get('/v1/library/book')
                                        .set('Accept-Encoding', 'identity')
                                        .set(
                                          'Authorization',
                                          `Bearer ${adminBearerToken}`
                                        )
                                        .expect(200)
                                        .end(function(err, res) {
                                          if (err) return done(err)
                                          res.headers['x-cache'].should.exist
                                          res.headers['x-cache'].should.eql(
                                            'HIT'
                                          )

                                          setTimeout(function() {
                                            // test that cache has been flushed for /vtest/testdb/test-schema
                                            client
                                              .get('/vtest/testdb/test-schema')
                                              .set(
                                                'Authorization',
                                                `Bearer ${adminBearerToken}`
                                              )
                                              .expect(200)
                                              .end(function(err, res) {
                                                if (err) return done(err)
                                                res
                                                  .headers['x-cache'].should.exist
                                                res.headers[
                                                  'x-cache'
                                                ].should.eql('MISS')
                                                done()
                                              })
                                          }, 500)
                                        })
                                    }, 500)
                                  })
                              }
                            )
                          })
                      })
                  })
              }, 500)
            })
        })
    })

    it('should flush only cached items matching the specified path', function(done) {
      this.timeout(4000)
      const client = request(
        'http://' + config.get('server.host') + ':' + config.get('server.port')
      )

      setTimeout(function() {
        client
          .get('/vtest/testdb/test-schema')
          .set('Authorization', `Bearer ${adminBearerToken}`)
          .expect(200)
          .end(function(err, res) {
            setTimeout(function() {
              client
                .get('/vtest/testdb/test-schema')
                .set('Accept-Encoding', 'identity')
                .set('Authorization', `Bearer ${adminBearerToken}`)
                .expect(200)
                .end(function(err, res1) {
                  res1.headers['x-cache'].should.exist
                  res1.headers['x-cache'].should.eql('HIT')

                  // get the cache keys
                  c.cache.cacheHandler.redisClient.KEYS('*', (err, keys) => {
                    cacheKeys = keys

                    client
                      .post('/api/flush')
                      .set('Authorization', `Bearer ${adminBearerToken}`)
                      .send({path: '/vtest/testdb/test-schema'})
                      .expect(200)
                      .end(function(err, res) {
                        if (err) return done(err)

                        res.body.result.should.equal('success')

                        setTimeout(function() {
                          client
                            .get('/vtest/testdb/test-schema')
                            .set('Accept-Encoding', 'identity')
                            .set('Authorization', `Bearer ${adminBearerToken}`)
                            .expect(200)
                            .end(function(err, res1) {
                              if (err) return done(err)
                              res1.headers['x-cache'].should.exist
                              res1.headers['x-cache'].should.eql('MISS')

                              done()
                            })
                        }, 500)
                      })
                  })
                })
            }, 500)
          })
      }, 500)
    })

    it('should flush all cached items when no path is specified', function(done) {
      this.timeout(4000)
      const client = request(
        'http://' + config.get('server.host') + ':' + config.get('server.port')
      )

      // create a document in another collection
      client
        .post('/v1/library/book')
        .set('Authorization', `Bearer ${adminBearerToken}`)
        .send({
          title: 'War and Peace',
          author: require('uuid')
            .v4()
            .toString()
        })
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err)

          // get first time, uncached version of /v1/library/book
          client
            .get('/v1/library/book')
            .set('Accept-Encoding', 'identity')
            .set('Authorization', `Bearer ${adminBearerToken}`)
            .expect(200)
            .end(function(err, res) {
              if (err) return done(err)
              res.headers['x-cache'].should.exist
              res.headers['x-cache'].should.eql('MISS')

              setTimeout(function() {
                // get cached version of /v1/library/book
                client
                  .get('/v1/library/book')
                  .set('Accept-Encoding', 'identity')
                  .set('Authorization', `Bearer ${adminBearerToken}`)
                  .expect(200)
                  .end(function(err, res) {
                    if (err) return done(err)
                    res.headers['x-cache'].should.exist
                    res.headers['x-cache'].should.eql('HIT')

                    setTimeout(function() {
                      // get cached version of /vtest/testdb/test-schema
                      client
                        .get('/vtest/testdb/test-schema')
                        .set('Accept-Encoding', 'identity')
                        .set('Authorization', `Bearer ${adminBearerToken}`)
                        .expect(200)
                        .end(function(err, res) {
                          if (err) return done(err)

                          res.headers['x-cache'].should.exist
                          res.headers['x-cache'].should.eql('HIT')

                          // get the cache keys
                          c.cache.cacheHandler.redisClient.KEYS(
                            '*',
                            (err, keys) => {
                              cacheKeys = keys

                              // flush cache for /vtest/testdb/test-schema
                              client
                                .post('/api/flush')
                                .set(
                                  'Authorization',
                                  `Bearer ${adminBearerToken}`
                                )
                                .send({path: '*'})
                                .expect(200)
                                .end(function(err, res) {
                                  if (err) return done(err)

                                  res.body.result.should.equal('success')

                                  setTimeout(function() {
                                    // test that cache has been flushed for /v1/library/book
                                    client
                                      .get('/v1/library/book')
                                      .set('Accept-Encoding', 'identity')
                                      .set(
                                        'Authorization',
                                        `Bearer ${adminBearerToken}`
                                      )
                                      .expect(200)
                                      .end(function(err, res) {
                                        if (err) return done(err)
                                        res.headers['x-cache'].should.exist
                                        assert(
                                          res.headers['x-cache'] === 'MISS',
                                          'Expected /v1/library/book to have no cached documents'
                                        )

                                        setTimeout(function() {
                                          // test that cache has been flushed for /vtest/testdb/test-schema
                                          client
                                            .get('/vtest/testdb/test-schema')
                                            .set('Accept-Encoding', 'identity')
                                            .set(
                                              'Authorization',
                                              `Bearer ${adminBearerToken}`
                                            )
                                            .expect(200)
                                            .end(function(err, res) {
                                              if (err) return done(err)
                                              res
                                                .headers['x-cache'].should.exist
                                              assert(
                                                res.headers['x-cache'] ===
                                                  'MISS',
                                                'Expected /vtest/testdb/test-schema to have no cached documents'
                                              )
                                              done()
                                            })
                                        }, 500)
                                      })
                                  }, 500)
                                })
                            }
                          )
                        })
                    }, 500)
                  })
              }, 500)
            })
        })
    })
  })
})
