const crypto = require('crypto')
const fs = require('fs')
const should = require('should')
const request = require('supertest')
// const redis = require('redis');
const fakeredis = require('fakeredis')
const sinon = require('sinon')
const url = require('url')

const config = require(__dirname + '/../../config.js')
const app = require(__dirname + '/../../dadi/lib/')
const cache = require(__dirname + '/../../dadi/lib/cache')
const help = require(__dirname + '/help')

let configBackup
let cacheKeys = []
let bearerToken

describe('Cache', function(done) {
  this.timeout(4000)

  before(() => {
    configBackup = config.get()
  })

  after(function(done) {
    config.set(
      'caching.directory.enabled',
      configBackup.caching.directory.enabled
    )
    config.set('caching.redis.enabled', configBackup.caching.redis.enabled)

    done()
  })

  beforeEach(function(done) {
    try {
      cache.reset()
    } catch (err) {
      // noop
    }

    done()
  })

  it('should use cache if available', function(done) {
    config.set('caching.directory.enabled', true)
    help.clearCache()

    app.start(function() {
      help.dropDatabase('testdb', function(err) {
        if (err) return done(err)

        help.getBearerToken(function(err, token) {
          if (err) return done(err)

          bearerToken = token

          const client = request(
            'http://' +
              config.get('server.host') +
              ':' +
              config.get('server.port')
          )

          client
            .get('/vtest/testdb/test-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end(function(err, res1) {
              if (err) return done(err)

              client
                .post('/vtest/testdb/test-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({field1: 'foo!'})
                .expect(200)
                .end(function(err, res) {
                  if (err) return done(err)

                  client
                    .get('/vtest/testdb/test-schema')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .end(function(err, res2) {
                      if (err) return done(err)

                      setTimeout(() => {
                        client
                          .get('/vtest/testdb/test-schema')
                          .set('Authorization', 'Bearer ' + bearerToken)
                          .expect(200)
                          .end(function(err, res3) {
                            if (err) return done(err)

                            res2.text.should.equal(res3.text)

                            should.exist(res3.headers['x-cache'])
                            res3.headers['x-cache'].should.eql('HIT')

                            help.removeTestClients(function() {
                              app.stop(done)
                            })
                          })
                      }, 300)
                    })
                })
            })
        })
      })
    })
  })

  it('should allow bypassing cache with query string flag', function(done) {
    config.set('caching.directory.enabled', true)
    help.clearCache()

    app.start(function() {
      help.dropDatabase('testdb', function(err) {
        if (err) return done(err)

        help.getBearerToken(function(err, token) {
          if (err) return done(err)

          bearerToken = token

          const client = request(
            'http://' +
              config.get('server.host') +
              ':' +
              config.get('server.port')
          )

          client
            .post('/vtest/testdb/test-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({field1: 'foo!'})
            .expect(200)
            .end(function(err, res) {
              if (err) return done(err)

              client
                .get('/vtest/testdb/test-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .end(function(err, res1) {
                  if (err) return done(err)

                  res1.body['results'].length.should.equal(1)

                  client
                    .get('/vtest/testdb/test-schema?cache=false')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .end(function(err, res2) {
                      if (err) return done(err)

                      should.exist(res2.headers['x-cache'])
                      res2.headers['x-cache'].should.eql('MISS')
                      should.exist(res2.headers['x-cache-lookup'])
                      res2.headers['x-cache-lookup'].should.eql('HIT')

                      help.removeTestClients(function() {
                        app.stop(done)
                      })
                    })
                })
            })
        })
      })
    })
  })

  it('should allow disabling through config', function(done) {
    config.set('caching.directory.enabled', false)
    config.set('caching.redis.enabled', false)
    help.clearCache()

    const spy = sinon.spy(fs, 'createWriteStream')

    app.start(function() {
      help.dropDatabase('testdb', function(err) {
        if (err) return done(err)
        help.getBearerToken(function(err, token) {
          if (err) return done(err)
          bearerToken = token

          const client = request(
            'http://' +
              config.get('server.host') +
              ':' +
              config.get('server.port')
          )

          client
            .get('/vtest/testdb/test-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end(function(err, res1) {
              if (err) return done(err)

              res1.body['results'].length.should.equal(0)

              client
                .post('/vtest/testdb/test-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({field1: 'foo!'})
                .expect(200)
                .end(function(err, res) {
                  if (err) return done(err)

                  client
                    .get('/vtest/testdb/test-schema')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .end(function(err, res2) {
                      if (err) return done(err)

                      res2.body['results'].length.should.equal(1)

                      const called = spy.called

                      spy.restore()
                      called.should.be.false

                      app.stop(done)
                    })
                })
            })
        })
      })
    })
  })

  describe('Filesystem', function(done) {
    beforeEach(function(done) {
      config.set('caching.directory.enabled', true)
      config.set('caching.redis.enabled', false)
      help.clearCache()

      app.start(function() {
        help.dropDatabase('testdb', function(err) {
          if (err) return done(err)

          help.getBearerToken(function(err, token) {
            if (err) return done(err)

            bearerToken = token
            done()
          })
        })
      })
    })

    afterEach(function(done) {
      help.removeTestClients(function() {
        app.stop(done)
      })
    })

    it('should save responses to the file system', function(done) {
      const cacheHandler = cache().cache.cacheHandler
      const spy = sinon.spy(cacheHandler, 'set')

      request(
        'http://' + config.get('server.host') + ':' + config.get('server.port')
      )
        .get('/vtest/testdb/test-schema')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err)

          setTimeout(function() {
            spy.called.should.be.true
            const args = spy.getCall(0).args

            spy.restore()
            args[0].indexOf('.gz').should.be.above(-1)

            done()
          }, 1000)
        })
    })

    it('should invalidate based on TTL', function(done) {
      this.timeout(4000)

      const oldTTL = config.get('caching.ttl')

      config.set('caching.ttl', 1)

      // cache.reset()

      const _done = done

      done = function(err) {
        config.set('caching.ttl', oldTTL)
        _done(err)
      }

      const client = request(
        'http://' + config.get('server.host') + ':' + config.get('server.port')
      )

      client
        .get('/vtest/testdb/test-schema')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .end(function(err, res1) {
          if (err) return done(err)
          client
            .post('/vtest/testdb/test-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({field1: 'foo!'})
            .expect(200)
            .end(function(err, res) {
              if (err) return done(err)

              setTimeout(function() {
                // ttl should have expired
                client
                  .get('/vtest/testdb/test-schema')
                  .set('Authorization', 'Bearer ' + bearerToken)
                  .expect(200)
                  .end(function(err, res2) {
                    if (err) return done(err)

                    res1.body['results'].length.should.equal(0)
                    res2.body['results'].length.should.equal(1)
                    res2.text.should.not.equal(res1.text)

                    done()
                  })
              }, 1000)
            })
        })
    })

    it('should flush on POST create request', function(done) {
      this.timeout(4000)
      help.createDoc(bearerToken, function(err, doc) {
        if (err) return done(err)

        help.createDoc(bearerToken, function(err, doc) {
          if (err) return done(err)

          const client = request(
            'http://' +
              config.get('server.host') +
              ':' +
              config.get('server.port')
          )

          setTimeout(() => {
            client
              .get('/vtest/testdb/test-schema')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .end(function(err, res1) {
                if (err) return done(err)

                client
                  .post('/vtest/testdb/test-schema')
                  .set('Authorization', 'Bearer ' + bearerToken)
                  .send({field1: 'foo!'})
                  .expect(200)
                  .end(function(err, res2) {
                    if (err) return done(err)

                    setTimeout(function() {
                      client
                        .get('/vtest/testdb/test-schema')
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .expect(200)
                        .end(function(err, res3) {
                          if (err) return done(err)

                          res1.body.results.length.should.eql(2)
                          res3.body.results.length.should.eql(3)
                          res3.text.should.not.equal(res1.text)

                          done()
                        })
                    }, 300)
                  })
              })
          }, 300)
        })
      })
    })

    it('should flush on PUT update request', function(done) {
      this.timeout(4000)

      help.createDoc(bearerToken, function(err, doc) {
        if (err) return done(err)

        help.createDoc(bearerToken, function(err, doc) {
          if (err) return done(err)

          const client = request(
            'http://' +
              config.get('server.host') +
              ':' +
              config.get('server.port')
          )

          setTimeout(() => {
            // GET
            client
              .get('/vtest/testdb/test-schema')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .end(function(err, getRes1) {
                if (err) return done(err)

                // CREATE
                client
                  .post('/vtest/testdb/test-schema')
                  .set('Authorization', 'Bearer ' + bearerToken)
                  .send({field1: 'foo!'})
                  .expect(200)
                  .end(function(err, postRes1) {
                    if (err) return done(err)

                    // save id for updating
                    const id = postRes1.body.results[0]._id

                    setTimeout(() => {
                      // GET AGAIN - should cache new results
                      client
                        .get('/vtest/testdb/test-schema')
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .expect(200)
                        .end(function(err, getRes2) {
                          if (err) return done(err)

                          setTimeout(function() {
                            // UPDATE again
                            client
                              .put('/vtest/testdb/test-schema/' + id)
                              .set('Authorization', 'Bearer ' + bearerToken)
                              .send({field1: 'foo bar baz!'})
                              .expect(200)
                              .end(function(err, postRes2) {
                                if (err) return done(err)

                                // WAIT, then GET again
                                setTimeout(function() {
                                  client
                                    .get('/vtest/testdb/test-schema')
                                    .set(
                                      'Authorization',
                                      'Bearer ' + bearerToken
                                    )
                                    .expect(200)
                                    .end(function(err, getRes3) {
                                      if (err) return done(err)

                                      const result = getRes3.body.results.find(
                                        item => item._id === id
                                      )

                                      result.field1.should.eql('foo bar baz!')

                                      done()
                                    })
                                }, 200)
                              })
                          }, 300)
                        })
                    }, 300)
                  })
              })
          }, 300)
        })
      })
    })

    it('should flush on DELETE request', function(done) {
      this.timeout(4000)
      help.createDoc(bearerToken, function(err, doc) {
        if (err) return done(err)

        help.createDoc(bearerToken, function(err, doc) {
          if (err) return done(err)

          const client = request(
            'http://' +
              config.get('server.host') +
              ':' +
              config.get('server.port')
          )

          setTimeout(() => {
            // GET
            client
              .get('/vtest/testdb/test-schema')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .end(function(err, getRes1) {
                if (err) return done(err)

                // CREATE
                client
                  .post('/vtest/testdb/test-schema')
                  .set('Authorization', 'Bearer ' + bearerToken)
                  .send({field1: 'foo!'})
                  .expect(200)
                  .end(function(err, postRes1) {
                    if (err) return done(err)

                    // save id for deleting
                    const id = postRes1.body.results[0]._id

                    setTimeout(() => {
                      // GET AGAIN - should cache new results
                      client
                        .get('/vtest/testdb/test-schema')
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .expect(200)
                        .end(function(err, getRes2) {
                          if (err) return done(err)

                          setTimeout(function() {
                            // DELETE
                            client
                              .delete('/vtest/testdb/test-schema/' + id)
                              .set('Authorization', 'Bearer ' + bearerToken)
                              .expect(204)
                              .end(function(err, postRes2) {
                                if (err) return done(err)

                                // WAIT, then GET again
                                setTimeout(function() {
                                  client
                                    .get('/vtest/testdb/test-schema')
                                    .set(
                                      'Authorization',
                                      'Bearer ' + bearerToken
                                    )
                                    .expect(200)
                                    .end(function(err, getRes3) {
                                      if (err) return done(err)

                                      const result = getRes3.body.results.find(
                                        item => item._id === id
                                      )

                                      should.not.exist(result)

                                      done()
                                    })
                                }, 300)
                              })
                          }, 700)
                        })
                    }, 300)
                  })
              })
          }, 300)
        })
      })
    })

    it('should preserve content-type', function(done) {
      const client = request(
        'http://' + config.get('server.host') + ':' + config.get('server.port')
      )

      client
        .get('/vtest/testdb/test-schema?callback=myCallback')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'text/javascript')
        .end(function(err, res1) {
          if (err) return done(err)

          client
            .post('/vtest/testdb/test-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({field1: 'foo!'})
            .expect(200)
            .end(function(err, res) {
              if (err) return done(err)

              setTimeout(() => {
                client
                  .get('/vtest/testdb/test-schema?callback=myCallback')
                  .set('Authorization', 'Bearer ' + bearerToken)
                  .expect(200)
                  .expect('content-type', 'text/javascript')
                  .end(function(err, res2) {
                    if (err) return done(err)

                    res2.text.should.not.equal(res1.text)
                    done()
                  })
              }, 300)
            })
        })
    })
  })

  describe('Redis', function(done) {
    beforeEach(function(done) {
      config.set('caching.directory.enabled', false)
      config.set('caching.redis.enabled', true)
      config.set('caching.ttl', configBackup.caching.ttl)

      cache.reset()

      cacheKeys = []

      done()
    })

    it('should check key exists in Redis', function(done) {
      delete require.cache[__dirname + '/../../dadi/lib/']

      cache.reset()
      const c = cache(app)

      c.cache.cacheHandler.redisClient = fakeredis.createClient()
      c.cache.cacheHandler.redisClient.status = 'ready'
      const spy = sinon.spy(c.cache.cacheHandler.redisClient, 'exists')

      // generate expected cacheKey
      const requestUrl = '/vtest/testdb/test-schema'
      const query = url.parse(requestUrl, true).query
      const modelDir = crypto
        .createHash('sha1')
        .update(url.parse(requestUrl).pathname)
        .digest('hex')
      const filename = crypto
        .createHash('sha1')
        .update(url.parse(requestUrl).pathname + JSON.stringify(query))
        .digest('hex')
      const cacheKey = modelDir + '_' + filename + '.gz'

      try {
        app.start(function() {
          help.dropDatabase('testdb', function(err) {
            if (err) return done(err)

            help.getBearerToken(function(err, token) {
              if (err) return done(err)
              bearerToken = token

              const client = request(
                'http://' +
                  config.get('server.host') +
                  ':' +
                  config.get('server.port')
              )

              client
                .get(requestUrl)
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .end(function(err, res) {
                  if (err) return done(err)

                  spy.called.should.eql(true)
                  spy.args[0][0].should.eql(cacheKey)

                  c.cache.cacheHandler.redisClient.exists.restore()
                  app.stop(done)
                })
            })
          })
        })
      } catch (err) {
        console.log(err)
        done()
      }
    })

    it('should return data if key exists in Redis, with correct headers', function(done) {
      delete require.cache[__dirname + '/../../dadi/lib/']

      // generate expected cacheKey
      const requestUrl = '/vtest/testdb/test-schema'
      const query = url.parse(requestUrl, true).query
      const modelDir = crypto
        .createHash('sha1')
        .update(url.parse(requestUrl).pathname)
        .digest('hex')
      const filename = crypto
        .createHash('sha1')
        .update(url.parse(requestUrl).pathname + JSON.stringify(query))
        .digest('hex')
      const cacheKey = modelDir + '_' + filename

      cache.reset()
      const c = cache(app)

      c.cache.cacheHandler.redisClient = fakeredis.createClient()
      c.cache.cacheHandler.redisClient.status = 'ready'
      c.cache.cacheHandler.redisClient.set(
        cacheKey,
        JSON.stringify({DATA: 'OK'})
      )

      try {
        app.start(function() {
          help.dropDatabase('testdb', function(err) {
            help.getBearerToken(function(err, token) {
              if (err) return done(err)
              bearerToken = token

              const client = request(
                'http://' +
                  config.get('server.host') +
                  ':' +
                  config.get('server.port')
              )

              client
                .get(requestUrl)
                .set('Accept-Encoding', 'identity')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .end(function(err, res) {
                  if (err) return done(err)

                  res.body.should.eql({DATA: 'OK'})
                  res.headers['x-cache'].should.eql('HIT')

                  app.stop(done)
                })
            })
          })
        })
      } catch (err) {
        console.log(err)
        done()
      }
    })

    it('should invalidate based on TTL', function(done) {
      this.timeout(6000)

      config.set('caching.ttl', 1)
      delete require.cache[__dirname + '/../../dadi/lib/']

      cache.reset()
      const c = cache(app)

      c.cache.cacheHandler.redisClient = fakeredis.createClient()
      c.cache.cacheHandler.redisClient.status = 'ready'

      c.cache.cacheHandler.redisClient.scanStream = function(pattern) {
        const Readable = require('stream').Readable
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

      try {
        app.start(function() {
          help.dropDatabase('testdb', function(err) {
            if (err) return done(err)

            help.getBearerToken(function(err, token) {
              if (err) return done(err)
              bearerToken = token

              const client = request(
                'http://' +
                  config.get('server.host') +
                  ':' +
                  config.get('server.port')
              )

              client
                .post('/vtest/testdb/test-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({field1: 'foo!'})
                .expect(200)
                .end(function(err, res) {
                  if (err) return done(err)

                  client
                    .get('/vtest/testdb/test-schema')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .end(function(err, res1) {
                      setTimeout(function() {
                        // get the cache keys
                        c.cache.cacheHandler.redisClient.KEYS(
                          '*',
                          (err, keys) => {
                            cacheKeys = keys

                            setTimeout(function() {
                              // ttl should have expired
                              client
                                .get('/vtest/testdb/test-schema')
                                .set('Authorization', 'Bearer ' + bearerToken)
                                .expect(200)
                                .end(function(err, res2) {
                                  if (err) return done(err)

                                  res2.headers['x-cache'].should.eql('MISS')
                                  res2.headers['x-cache-lookup'].should.eql(
                                    'MISS'
                                  )

                                  app.stop(done)
                                })
                            }, 1500)
                          }
                        )
                      }, 1500)
                    })
                })
            })
          })
        })
      } catch (err) {
        console.log(err)
        done()
      }
    })

    it('should flush on POST create request', function(done) {
      this.timeout(8000)

      delete require.cache[__dirname + '/../../config.js']
      delete require.cache[__dirname + '/../../dadi/lib/']

      config.loadFile(config.configPath())

      cache.reset()
      const c = cache(app)

      c.cache.cacheHandler.redisClient = fakeredis.createClient()
      c.cache.cacheHandler.redisClient.status = 'ready'

      c.cache.cacheHandler.redisClient.scanStream = function(pattern) {
        const Readable = require('stream').Readable
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

      try {
        app.start(function() {
          help.dropDatabase('testdb', function(err) {
            if (err) return done(err)

            help.getBearerToken(function(err, token) {
              if (err) return done(err)
              bearerToken = token

              help.createDoc(bearerToken, function(err, doc) {
                if (err) return done(err)

                help.createDoc(bearerToken, function(err, doc) {
                  if (err) return done(err)

                  const client = request(
                    'http://' +
                      config.get('server.host') +
                      ':' +
                      config.get('server.port')
                  )

                  client
                    .get('/vtest/testdb/test-schema')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .end(function(err, res1) {
                      if (err) return done(err)

                      setTimeout(function() {
                        // get the cache keys
                        c.cache.cacheHandler.redisClient.KEYS(
                          '*',
                          (err, keys) => {
                            cacheKeys = keys

                            client
                              .post('/vtest/testdb/test-schema')
                              .set('Authorization', 'Bearer ' + bearerToken)
                              .send({field1: 'foo!'})
                              .expect(200)
                              .end(function(err, res2) {
                                if (err) return done(err)

                                setTimeout(function() {
                                  client
                                    .get('/vtest/testdb/test-schema')
                                    .set(
                                      'Authorization',
                                      'Bearer ' + bearerToken
                                    )
                                    .expect(200)
                                    .end(function(err, res3) {
                                      if (err) return done(err)

                                      cache.reset()
                                      res1.body.results.length.should.eql(2)
                                      res3.body.results.length.should.eql(3)
                                      res3.text.should.not.equal(res1.text)

                                      app.stop(done)
                                    })
                                }, 500)
                              })
                          }
                        )
                      }, 500)
                    })
                })
              })
            })
          })
        })
      } catch (err) {
        console.log(err)
        done()
      }
    })

    it('should flush on PUT update request', function(done) {
      this.timeout(8000)

      delete require.cache[__dirname + '/../../config.js']
      delete require.cache[__dirname + '/../../dadi/lib/']

      config.loadFile(config.configPath())

      cache.reset()
      const c = cache(app)

      c.cache.cacheHandler.redisClient = fakeredis.createClient()
      c.cache.cacheHandler.redisClient.status = 'ready'

      c.cache.cacheHandler.redisClient.scanStream = function(pattern) {
        const Readable = require('stream').Readable
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

      try {
        app.start(function() {
          help.dropDatabase('testdb', function(err) {
            if (err) return done(err)

            help.getBearerToken(function(err, token) {
              if (err) return done(err)
              bearerToken = token

              help.createDoc(bearerToken, function(err, doc) {
                if (err) return done(err)

                help.createDoc(bearerToken, function(err, doc) {
                  if (err) return done(err)

                  const client = request(
                    'http://' +
                      config.get('server.host') +
                      ':' +
                      config.get('server.port')
                  )

                  // GET
                  client
                    .get('/vtest/testdb/test-schema')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .end(function(err, getRes1) {
                      if (err) return done(err)

                      // CREATE
                      client
                        .post('/vtest/testdb/test-schema')
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .send({field1: 'foo!'})
                        .expect(200)
                        .end(function(err, postRes1) {
                          if (err) return done(err)

                          // save id for updating
                          const id = postRes1.body.results[0]._id

                          // GET AGAIN - should cache new results
                          client
                            .get('/vtest/testdb/test-schema')
                            .set('Authorization', 'Bearer ' + bearerToken)
                            .expect(200)
                            .end(function(err, getRes2) {
                              if (err) return done(err)

                              setTimeout(function() {
                                // get the cache keys
                                c.cache.cacheHandler.redisClient.KEYS(
                                  '*',
                                  (err, keys) => {
                                    cacheKeys = keys

                                    // UPDATE again
                                    client
                                      .put('/vtest/testdb/test-schema/' + id)
                                      .set(
                                        'Authorization',
                                        'Bearer ' + bearerToken
                                      )
                                      .send({field1: 'foo bar baz!'})
                                      .expect(200)
                                      .end(function(err, postRes2) {
                                        // WAIT, then GET again
                                        setTimeout(function() {
                                          client
                                            .get('/vtest/testdb/test-schema')
                                            .set(
                                              'Authorization',
                                              'Bearer ' + bearerToken
                                            )
                                            .expect(200)
                                            .end(function(err, getRes3) {
                                              const result = getRes3.body.results.find(
                                                item => item._id === id
                                              )

                                              result.field1.should.eql(
                                                'foo bar baz!'
                                              )
                                              app.stop(done)
                                            })
                                        }, 500)
                                      })
                                  }
                                )
                              }, 500)
                            })
                        })
                    })
                })
              })
            })
          })
        })
      } catch (err) {
        console.log(err)
        done()
      }
    })

    it('should flush on DELETE request', function(done) {
      this.timeout(8000)

      delete require.cache[__dirname + '/../../config.js']
      delete require.cache[__dirname + '/../../dadi/lib/']

      config.loadFile(config.configPath())

      cache.reset()
      const c = cache(app)

      c.cache.cacheHandler.redisClient = fakeredis.createClient()
      c.cache.cacheHandler.redisClient.status = 'ready'

      c.cache.cacheHandler.redisClient.scanStream = function(pattern) {
        const Readable = require('stream').Readable
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

      try {
        app.start(function() {
          help.dropDatabase('testdb', function(err) {
            if (err) return done(err)

            help.getBearerToken(function(err, token) {
              if (err) return done(err)
              bearerToken = token

              help.createDoc(bearerToken, function(err, doc) {
                if (err) return done(err)

                help.createDoc(bearerToken, function(err, doc) {
                  if (err) return done(err)

                  const client = request(
                    'http://' +
                      config.get('server.host') +
                      ':' +
                      config.get('server.port')
                  )

                  // GET
                  client
                    .get('/vtest/testdb/test-schema')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .end(function(err, getRes1) {
                      if (err) return done(err)

                      // CREATE
                      client
                        .post('/vtest/testdb/test-schema')
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .send({field1: 'foo!'})
                        .expect(200)
                        .end(function(err, postRes1) {
                          if (err) return done(err)

                          // save id for deleting
                          const id = postRes1.body.results[0]._id

                          // GET AGAIN - should cache new results
                          client
                            .get('/vtest/testdb/test-schema')
                            .set('Authorization', 'Bearer ' + bearerToken)
                            .expect(200)
                            .end(function(err, getRes2) {
                              setTimeout(function() {
                                // get the cache keys
                                c.cache.cacheHandler.redisClient.KEYS(
                                  '*',
                                  (err, keys) => {
                                    cacheKeys = keys

                                    setTimeout(function() {
                                      // DELETE
                                      client
                                        .delete(
                                          '/vtest/testdb/test-schema/' + id
                                        )
                                        .set(
                                          'Authorization',
                                          'Bearer ' + bearerToken
                                        )
                                        .expect(204)
                                        .end(function(err, postRes2) {
                                          // WAIT, then GET again
                                          setTimeout(function() {
                                            client
                                              .get('/vtest/testdb/test-schema')
                                              .set(
                                                'Authorization',
                                                'Bearer ' + bearerToken
                                              )
                                              .expect(200)
                                              .end(function(err, getRes3) {
                                                const result = getRes3.body.results.find(
                                                  item => item._id === id
                                                )

                                                should.not.exist(result)
                                                app.stop(done)
                                              })
                                          }, 300)
                                        })
                                    }, 700)
                                  }
                                )
                              }, 500)
                            })
                        })
                    })
                })
              })
            })
          })
        })
      } catch (err) {
        console.log(err)
        done()
      }
    })

    it('should preserve content-type', function(done) {
      delete require.cache[__dirname + '/../../config.js']
      delete require.cache[__dirname + '/../../dadi/lib/']

      config.loadFile(config.configPath())

      cache.reset()
      const c = cache(app)

      c.cache.cacheHandler.redisClient = fakeredis.createClient()
      c.cache.cacheHandler.redisClient.status = 'ready'

      c.cache.cacheHandler.redisClient.scanStream = function(pattern) {
        const Readable = require('stream').Readable
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

      try {
        app.start(function() {
          const client = request(
            'http://' +
              config.get('server.host') +
              ':' +
              config.get('server.port')
          )

          help.dropDatabase('testdb', function(err) {
            if (err) return done(err)

            client
              .get('/vtest/testdb/test-schema?callback=myCallback')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .expect('content-type', 'text/javascript')
              .end(function(err, res1) {
                if (err) return done(err)

                setTimeout(function() {
                  // get the cache keys
                  c.cache.cacheHandler.redisClient.KEYS('*', (err, keys) => {
                    cacheKeys = keys

                    setTimeout(function() {
                      client
                        .post('/vtest/testdb/test-schema')
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .send({field1: 'foo!'})
                        .expect(200)
                        .end(function(err, res) {
                          if (err) return done(err)

                          client
                            .get(
                              '/vtest/testdb/test-schema?callback=myCallback'
                            )
                            .set('Authorization', 'Bearer ' + bearerToken)
                            .expect(200)
                            .expect('content-type', 'text/javascript')
                            .end(function(err, res2) {
                              if (err) return done(err)

                              res2.text.should.not.equal(res1.text)
                              app.stop(done)
                            })
                        })
                    }, 500)
                  })
                }, 500)
              })
          })
        })
      } catch (err) {
        // noop
      }
    })
  })
})
