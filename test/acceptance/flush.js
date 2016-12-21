var _ = require('underscore')
var assert = require('assert')
var fakeredis = require('fakeredis');
var fs = require('fs')
var should = require('should')
var request = require('supertest')
var Readable = require('stream').Readable

var app = require(__dirname + '/../../dadi/lib/')
var config = require(__dirname + '/../../config')
var cache = require(__dirname + '/../../dadi/lib/cache')
var help = require(__dirname + '/help')

var bearerToken
var c
var cacheKeys = []

describe('Cache', function (done) {
  describe('Invalidation API - Filesystem', function () {
    before(function (done) {
      var testConfigString = fs.readFileSync(config.configPath())

      var newTestConfig = JSON.parse(testConfigString)
      newTestConfig.caching.directory.enabled = true
      newTestConfig.caching.redis.enabled = false

      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))
      delete require.cache[__dirname + '/../../config']
      cache.reset()

      config.loadFile(config.configPath())

      done()
    })

    beforeEach(function (done) {
      app.start(function () {
        help.dropDatabase('test', function (err) {
          if (err) return done(err)

          help.getBearerToken(function (err, token) {
            if (err) return done(err)

            bearerToken = token

            help.clearCache()

            cacheKeys = [] // resets the array for the next test

            help.createDoc(bearerToken, function (err, doc) {
              if (err) return done(err)

              help.createDoc(bearerToken, function (err, doc) {
                if (err) return done(err)

                var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))

                client
                .get('/vtest/testdb/test-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .end(function (err, res1) {
                  if (err) return done(err)
                  res1.headers['x-cache'].should.exist
                  res1.headers['x-cache'].should.eql('MISS')
                  done()
                })
              })
            })
          })
        })
      })
    })

    afterEach(function (done) {
      help.removeTestClients(function () {
        app.stop(done)
      })
    })

    it("should not flush cached items that don't match the specified path", function (done) {
      this.timeout(4000)

      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))

      // create a document in another collection
      client
      .post('/v1/library/book')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send({'title': 'War and Peace', 'author': 'b8b285ae-53d1-47a5-9e69-ec04' })
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err)

        // get first time, uncached version of /v1/library/book
        client
        .get('/v1/library/book')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err)
          res.headers['x-cache'].should.exist
          res.headers['x-cache'].should.eql('MISS')

          setTimeout(function () {
            // get cached version of /v1/library/book
            client
            .get('/v1/library/book')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end(function (err, res) {
              if (err) return done(err)
              res.headers['x-cache'].should.exist
              res.headers['x-cache'].should.eql('HIT')

              // get cached version of /vtest/testdb/test-schema
              client
              .get('/vtest/testdb/test-schema')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .end(function (err, res) {
                if (err) return done(err)

                client
                .get('/vtest/testdb/test-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .end(function (err, res) {
                  if (err) return done(err)

                  res.headers['x-cache'].should.exist
                  res.headers['x-cache'].should.eql('HIT')

                  // flush cache for /vtest/testdb/test-schema
                  client
                  .post('/api/flush')
                  .set('Authorization', 'Bearer ' + bearerToken)
                  .send({path: '/vtest/testdb/test-schema'})
                  .expect(200)
                  .end(function (err, res) {
                    if (err) return done(err)

                    res.body.result.should.equal('success')

                    setTimeout(function () {

                      // test that cache documents still exist for /v1/library/book
                      client
                      .get('/v1/library/book')
                      .set('Authorization', 'Bearer ' + bearerToken)
                      .expect(200)
                      .end(function (err, res) {
                        if (err) return done(err)
                        res.headers['x-cache'].should.exist
                        res.headers['x-cache'].should.eql('HIT')

                        setTimeout(function () {
                          // test that cache has been flushed for /vtest/testdb/test-schema
                          client
                          .get('/vtest/testdb/test-schema')
                          .set('Authorization', 'Bearer ' + bearerToken)
                          .expect(200)
                          .end(function (err, res) {
                            if (err) return done(err)
                            res.headers['x-cache'].should.exist
                            res.headers['x-cache'].should.eql('MISS')
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

    it('should flush only cached items matching the specified path', function (done) {
      this.timeout(4000)
      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))

      client
        .get('/vtest/testdb/test-schema')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .end(function (err, res1) {
          if (err) return done(err)
          res1.headers['x-cache'].should.exist
          res1.headers['x-cache'].should.eql('HIT')

          client
            .post('/api/flush')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({path: '/vtest/testdb/test-schema'})
            .expect(200)
            .end(function (err, res) {
              if (err) return done(err)

              res.body.result.should.equal('success')

              setTimeout(function () {
                client
                  .get('/vtest/testdb/test-schema')
                  .set('Authorization', 'Bearer ' + bearerToken)
                  .expect(200)
                  .end(function (err, res1) {
                    if (err) return done(err)
                    res1.headers['x-cache'].should.exist
                    res1.headers['x-cache'].should.eql('MISS')

                    done()
                  })
              }, 500)
            })
        })
    })

    it('should flush all cached items when no path is specified', function (done) {
      this.timeout(4000)
      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))

      // create a document in another collection
      client
        .post('/v1/library/book')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send({'title': 'War and Peace', 'author': 'b8b285ae-53d1-47a5-9e69-ec04' })
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err)

          // get first tine, uncached version of /v1/library/book
          client
            .get('/v1/library/book')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end(function (err, res) {
              if (err) return done(err)
              res.headers['x-cache'].should.exist
              res.headers['x-cache'].should.eql('MISS')

              // get cached version of /v1/library/book
              client
                .get('/v1/library/book')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .end(function (err, res) {
                  if (err) return done(err)
                  res.headers['x-cache'].should.exist
                  res.headers['x-cache'].should.eql('HIT')

                  // get cached version of /vtest/testdb/test-schema
                  client
                    .get('/vtest/testdb/test-schema')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .end(function (err, res) {
                      if (err) return done(err)

                      res.headers['x-cache'].should.exist
                      res.headers['x-cache'].should.eql('HIT')

                      // flush cache for /vtest/testdb/test-schema
                      client
                        .post('/api/flush')
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .send({path: '*'})
                        .expect(200)
                        .end(function (err, res) {
                          if (err) return done(err)

                          res.body.result.should.equal('success')

                          setTimeout(function () {

                            // test that cache has been flushed for /v1/library/book
                            client
                              .get('/v1/library/book')
                              .set('Authorization', 'Bearer ' + bearerToken)
                              .expect(200)
                              .end(function (err, res) {
                                if (err) return done(err)
                                res.headers['x-cache'].should.exist
                                assert(res.headers['x-cache'] === 'MISS', 'Expected /v1/library/book to have no cached documents')

                                setTimeout(function () {

                                  // test that cache has been flushed for /vtest/testdb/test-schema
                                  client
                                    .get('/vtest/testdb/test-schema')
                                    .set('Authorization', 'Bearer ' + bearerToken)
                                    .expect(200)
                                    .end(function (err, res) {
                                      if (err) return done(err)
                                      res.headers['x-cache'].should.exist
                                      assert(res.headers['x-cache'] === 'MISS', 'Expected /vtest/testdb/test-schema to have no cached documents')
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

  describe('Invalidation API - Redis', function () {
    before(function (done) {
      var testConfigString = fs.readFileSync(config.configPath())

      var newTestConfig = JSON.parse(testConfigString)
      newTestConfig.caching.directory.enabled = false
      newTestConfig.caching.redis.enabled = true

      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2))
      delete require.cache[__dirname + '/../../config']

      config.loadFile(config.configPath())

      done()
    })

    beforeEach(function (done) {
      cache.reset()

      c = cache(app)
      c.cache.cacheHandler.redisClient = fakeredis.createClient()
      c.cache.cacheHandler.redisClient.status = 'ready'

      c.cache.cacheHandler.redisClient.scanStream = function (pattern) {
        var stream = new Readable({objectMode: true})

        for (var i = 0; i < cacheKeys.length; i++) {
          if (pattern.match === '*' || cacheKeys[i].indexOf(pattern.match.substring(0, pattern.match.length-1)) === 0) {
            stream.push([cacheKeys[i]])
          } else {
            // console.log('rejected key: ', cacheKeys[i])
          }
        }

        stream.push(null)
        return stream
      }

      app.start(function () {
        help.dropDatabase('test', function (err) {
          if (err) return done(err)

          help.getBearerToken(function (err, token) {
            if (err) return done(err)

            bearerToken = token

            help.clearCache()

            help.createDoc(bearerToken, function (err, doc) {
              if (err) return done(err)

              help.createDoc(bearerToken, function (err, doc) {
                if (err) return done(err)

                var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))

                client
                .get('/vtest/testdb/test-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .end(function (err, res1) {
                  if (err) return done(err)
                  res1.headers['x-cache'].should.exist
                  res1.headers['x-cache'].should.eql('MISS')
                  done()
                })
              })
            })
          })
        })
      })
    })

    afterEach(function (done) {
      help.removeTestClients(function () {
        app.stop(done)
      })
    })

    it("should not flush cached items that don't match the specified path", function (done) {
      this.timeout(4000)

      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))

      // create a document in another collection
      client
      .post('/v1/library/book')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send({'title': 'War and Peace', 'author': 'b8b285ae-53d1-47a5-9e69-ec04' })
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err)

        // get first time, uncached version of /v1/library/book
        client
        .get('/v1/library/book')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err)
          res.headers['x-cache'].should.exist
          res.headers['x-cache'].should.eql('MISS')

          setTimeout(function () {
            // get cached version of /v1/library/book
            client
            .get('/v1/library/book')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end(function (err, res) {
              if (err) return done(err)
              res.headers['x-cache'].should.exist
              res.headers['x-cache'].should.eql('HIT')

              // get cached version of /vtest/testdb/test-schema
              client
              .get('/vtest/testdb/test-schema')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .end(function (err, res) {
                if (err) return done(err)

                client
                .get('/vtest/testdb/test-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .end(function (err, res) {
                  if (err) return done(err)

                  res.headers['x-cache'].should.exist
                  res.headers['x-cache'].should.eql('HIT')

                  // get the cache keys
                  c.cache.cacheHandler.redisClient.KEYS('*', (err, keys) => {
                    cacheKeys = keys

                    // flush cache for /vtest/testdb/test-schema
                    client
                    .post('/api/flush')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .send({path: '/vtest/testdb/test-schema'})
                    .expect(200)
                    .end(function (err, res) {
                      if (err) return done(err)
                      res.body.result.should.equal('success')

                      setTimeout(function () {
                        // test that cache documents still exist for /v1/library/book
                        client
                        .get('/v1/library/book')
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .expect(200)
                        .end(function (err, res) {
                          if (err) return done(err)
                          res.headers['x-cache'].should.exist
                          res.headers['x-cache'].should.eql('HIT')

                          setTimeout(function () {
                            // test that cache has been flushed for /vtest/testdb/test-schema
                            client
                            .get('/vtest/testdb/test-schema')
                            .set('Authorization', 'Bearer ' + bearerToken)
                            .expect(200)
                            .end(function (err, res) {
                              if (err) return done(err)
                              res.headers['x-cache'].should.exist
                              res.headers['x-cache'].should.eql('MISS')
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
          }, 500)
        })
      })
    })

    it('should flush only cached items matching the specified path', function (done) {
      this.timeout(4000)
      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))

      setTimeout(function () {
        client
        .get('/vtest/testdb/test-schema')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .end(function (err, res) {
          setTimeout(function () {
            client
            .get('/vtest/testdb/test-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end(function (err, res1) {
              res1.headers['x-cache'].should.exist
              res1.headers['x-cache'].should.eql('HIT')

              // get the cache keys
              c.cache.cacheHandler.redisClient.KEYS('*', (err, keys) => {
                cacheKeys = keys

                client
                .post('/api/flush')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({path: '/vtest/testdb/test-schema'})
                .expect(200)
                .end(function (err, res) {
                  if (err) return done(err)

                  res.body.result.should.equal('success')

                  setTimeout(function () {
                    client
                    .get('/vtest/testdb/test-schema')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .end(function (err, res1) {
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

    it('should flush all cached items when no path is specified', function (done) {
      this.timeout(4000)
      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))

      // create a document in another collection
      client
      .post('/v1/library/book')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send({'title': 'War and Peace', 'author': 'b8b285ae-53d1-47a5-9e69-ec04' })
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err)

        // get first tine, uncached version of /v1/library/book
        client
        .get('/v1/library/book')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err)
          res.headers['x-cache'].should.exist
          res.headers['x-cache'].should.eql('MISS')

          setTimeout(function() {
            // get cached version of /v1/library/book
            client
            .get('/v1/library/book')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end(function (err, res) {
              if (err) return done(err)
              res.headers['x-cache'].should.exist
              res.headers['x-cache'].should.eql('HIT')

              setTimeout(function() {
                // get cached version of /vtest/testdb/test-schema
                client
                .get('/vtest/testdb/test-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .end(function (err, res) {
                  if (err) return done(err)

                  res.headers['x-cache'].should.exist
                  res.headers['x-cache'].should.eql('HIT')

                  // get the cache keys
                  c.cache.cacheHandler.redisClient.KEYS('*', (err, keys) => {
                    cacheKeys = keys

                    // flush cache for /vtest/testdb/test-schema
                    client
                    .post('/api/flush')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .send({path: '*'})
                    .expect(200)
                    .end(function (err, res) {
                      if (err) return done(err)

                      res.body.result.should.equal('success')

                      setTimeout(function () {
                        // test that cache has been flushed for /v1/library/book
                        client
                        .get('/v1/library/book')
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .expect(200)
                        .end(function (err, res) {
                          if (err) return done(err)
                          res.headers['x-cache'].should.exist
                          assert(res.headers['x-cache'] === 'MISS', 'Expected /v1/library/book to have no cached documents')

                          setTimeout(function () {
                            // test that cache has been flushed for /vtest/testdb/test-schema
                            client
                            .get('/vtest/testdb/test-schema')
                            .set('Authorization', 'Bearer ' + bearerToken)
                            .expect(200)
                            .end(function (err, res) {
                              if (err) return done(err)
                              res.headers['x-cache'].should.exist
                              assert(res.headers['x-cache'] === 'MISS', 'Expected /vtest/testdb/test-schema to have no cached documents')
                              done()
                            })
                          }, 500)
                        })
                      }, 500)
                    })
                  })
                })
              }, 500)
            })
          }, 500)
        })
      })
    })
  })
})
