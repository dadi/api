const crypto = require('crypto')
const fs = require('fs')
const should = require('should')
const request = require('supertest')
const sinon = require('sinon')
const url = require('url')

const config = require(__dirname + '/../../config.js')
const app = require(__dirname + '/../../dadi/lib/')
const cache = require(__dirname + '/../../dadi/lib/cache')
const help = require(__dirname + '/help')

const client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))

const createSchemas = () => {
  return help.createSchemas([
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
}

/**
 * Start the app: initialise the database, create schemas, and retrieve a bearer token.
 * @returns {Promise<string>}
 */
function startApp() {
  return new Promise((res, rej) => {
    app.start(function() {
      help.dropDatabase('testdb', function(err) {
        if (err) return rej(err)

        createSchemas()
          .then(() => {
            help.getBearerToken(function(err, token) {
              if (err) return rej(err)
              res(token)
            })
          })
          .catch(rej)
      })
    })
  })
}

/** Stop the app (counterpart of `startApp`) - should be called in `finally` blocks when a test has completed. */
async function stopApp() {
  await help.dropSchemas()
  app.stop()
}

/**
 * Wait arbitrarily for a specified number of milliseconds.
 *
 * @param {number} ms
 * @returns {Promise<void>}
 */
function wait(ms) {
  return new Promise(res => {
    setTimeout(res, ms)
  })
}

describe('Cache', function() {
  let bearerToken
  let previousConfig

  this.timeout(4000)

  before(() => {
    previousConfig = config.get()
    config.set('caching.directory.enabled', true)
  })

  after(done => {
    config.set('caching.directory.enabled', previousConfig.caching.directory.enabled)
    config.set('caching.redis.enabled', previousConfig.caching.redis.enabled)
    done()
  })

  beforeEach(done => {
    cache.reset()
    help.clearCache()
    done()
  })

  it('should use cache if available', async function() {
    try {
      const bearerToken = await startApp()

      await new Promise((res, rej) => {
        client
          .get('/testdb/test-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end((err, result) => {
            if (err) return rej(err)
            res(result)
          })
      })

      await new Promise((res, rej) => {
        client
          .post('/testdb/test-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({field1: 'foo!'})
          .expect(200)
          .end(function(err, result) {
            if (err) return rej(err)
            res(result)
          })
      })

      const res2 = await new Promise((res, rej) => {
        client
          .get('/testdb/test-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end(function(err, result) {
            if (err) return rej(err)
            res(result)
          })
      })

      await wait(300)

      const res3 = await new Promise((res, rej) => {
        client
          .get('/testdb/test-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end(function(err, result) {
            if (err) return rej(err)
            res(result)
          })
      })

      res2.text.should.equal(res3.text)
      should.exist(res3.headers['x-cache'])
      res3.headers['x-cache'].should.eql('HIT')
    } finally {
      await new Promise((res, rej) => {
        help.removeTestClients(err => {
          if (err) return rej(err)
          res()
        })
      })
      await stopApp()
    }
  })

  it('should allow bypassing cache with query string flag', async function() {
    config.set('caching.directory.enabled', true)

    try {
      const bearerToken = await startApp()

      await new Promise((res, rej) => {
        client
          .post('/testdb/test-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({field1: 'foo!'})
          .expect(200)
          .end(function(err, result) {
            if (err) return rej(err)
            res(result)
          })
      })

      const res1 = await new Promise((res, rej) => {
        client
          .get('/testdb/test-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end(function(err, result) {
            if (err) return rej(err)
            res(result)
          })
      })

      res1.body['results'].length.should.equal(1)

      const res2 = await new Promise((res, rej) => {
        client
          .get('/testdb/test-schema?cache=false')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end(function(err, result) {
            if (err) return rej(err)
            res(result)
          })
      })

      should.exist(res2.headers['x-cache'])
      res2.headers['x-cache'].should.eql('MISS')
      should.exist(res2.headers['x-cache-lookup'])
      res2.headers['x-cache-lookup'].should.eql('HIT')
    }
    finally {
      await stopApp()
    }
  })

  it('should allow disabling through config', async function() {
    config.set('caching.directory.enabled', false)
    config.set('caching.redis.enabled', false)
    help.clearCache()

    const spy = sinon.spy(fs, 'createWriteStream')

    try {
      const bearerToken = await startApp()

      const res1 = await new Promise((res, rej) => {
        client
          .get('/testdb/test-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end(function(err, result) {
            if (err) return rej(err)
            res(result)
          })
      })

      res1.body['results'].length.should.equal(0)

      await new Promise((res, rej) => {
        client
          .post('/testdb/test-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({field1: 'foo!'})
          .expect(200)
          .end(function(err, result) {
            if (err) return rej(err)
            res(result)
          })
      })

      const res2 = await new Promise((res, rej) => {
        client
          .get('/testdb/test-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end(function(err, result) {
            if (err) return rej(err)
            res(result)
          })
      })

      res2.body['results'].length.should.equal(1)

      const called = spy.called

      spy.restore()
      called.should.be.false
    } finally {
      await stopApp()
    }
  })

  describe('Filesystem', function() {
    before(done => {
      config.set('caching.directory.enabled', true)
      config.set('caching.redis.enabled', false)
      done()
    })

    after(done => {
      config.set('caching.directory.enabled', previousConfig.caching.directory.enabled)
      config.set('caching.redis.enabled', previousConfig.caching.redis.enabled)
      done()
    })

    beforeEach(async function() {
      cache.reset()
      help.clearCache()

      // app.start(function() {
      //   createSchemas().then(() => {
      //     help.dropDatabase('testdb', function(err) {
      //       if (err) return done(err)

      //       help.getBearerToken(function(err, token) {
      //         if (err) return done(err)

      //         bearerToken = token
      //         done()
      //       })
      //     })
      //   })
      // })
    })

    // afterEach(function(done) {
    //   help.removeTestClients(function() {
    //     help.dropSchemas().then(() => {
    //       app.stop(done)
    //     })
    //   })
    // })

    it('should save responses to the file system', async function() {
      const cacheHandler = cache().cache.cacheHandler
      const spy = sinon.spy(cacheHandler, 'set')

      try {
        const bearerToken = await startApp()

        await new Promise((res, rej) => {
          client
            .get('/testdb/test-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end(function(err, result) {
              if (err) return rej(err)
              res(result)
            })
        })

        await wait(1000)

        spy.called.should.be.true
        const args = spy.getCall(0).args

        spy.restore()
        args[0].indexOf('.gz').should.be.above(-1)
      }
      finally {
        await stopApp()
      }
    })

    it('should invalidate based on TTL', async function() {
      this.timeout(4000)

      try {
        config.set('caching.ttl', 1)

        const bearerToken = await startApp()

        const res1 = await new Promise((res, rej) => {
          client
            .get('/testdb/test-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end(function(err, result) {
              if (err) return rej(err)
              res(result)
            })
        })

        await new Promise((res, rej) => {
          client
            .post('/testdb/test-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({field1: 'foo!'})
            .expect(200)
            .end(function(err, result) {
              if (err) return rej(err)
              res(result)
            })
        })

        await wait(1000)

        const res2 = await new Promise((res, rej) => {
          // ttl should have expired
          client
            .get('/testdb/test-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end(function(err, result) {
              if (err) return rej(err)
              res(result)
            })
        })

        res1.body['results'].length.should.equal(0)
        res2.body['results'].length.should.equal(1)
        res2.text.should.not.equal(res1.text)
      }
      finally {
        config.set('caching.ttl', previousConfig.caching.ttl)
        await stopApp()
      }
    })

    it('should flush on POST create request', async function() {
      this.timeout(4000)

      try {
        const bearerToken = await startApp()

        await new Promise((res, rej) => {
          help.createDoc(bearerToken, function(err, result) {
            if (err) return rej(err)
            res(result)
          })
        })

        await new Promise((res, rej) => {
          help.createDoc(bearerToken, function(err, result) {
            if (err) return rej(err)
            res(result)
          })
        })

        await wait(300)

        const res1 = await new Promise((res, rej) => {
          client
            .get('/testdb/test-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end(function(err, result) {
              if (err) return rej(err)
              res(result)
            })
        })

        await new Promise((res, rej) => {
          client
            .post('/testdb/test-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({field1: 'foo!'})
            .expect(200)
            .end(function(err, result) {
              if (err) return rej(err)
              res(result)
            })
        })

        await wait(300)

        const res3 = await new Promise((res, rej) => {
          client
            .get('/testdb/test-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end(function(err, result) {
              if (err) return rej(err)
              res(result)
            })
        })

        res1.body.results.length.should.eql(2)
        res3.body.results.length.should.eql(3)
        res3.text.should.not.equal(res1.text)
      }
      finally {
        await stopApp()
      }
    })

    it('should flush on PUT update request', async function() {
      this.timeout(4000)

      try {
        const bearerToken = await startApp()

        await new Promise((res, rej) => {
          help.createDoc(bearerToken, function(err, doc) {
            if (err) return rej(err)
            res(doc)
          })
        })
        await new Promise((res, rej) => {
          help.createDoc(bearerToken, function(err, doc) {
            if (err) return rej(err)
            res(doc)
          })
        })

        await wait(300)

        // eslint-disable-next-line no-unused-vars
        const getRes1 = await new Promise((res, rej) => {
          client
            .get('/testdb/test-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end(function(err, result) {
              if (err) return rej(err)
              res(result)
            })
        })

        const postRes1 = await new Promise((res, rej) => {
          client
            .post('/testdb/test-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({field1: 'foo!'})
            .expect(200)
            .end(function(err, result) {
              if (err) return rej(err)
              res(result)
            })
        })
        // save id for updating
        const id = postRes1.body.results[0]._id

        await wait(300)

        // eslint-disable-next-line no-unused-vars
        const getRes2 = await new Promise((res, rej) => {
          client
            .get('/testdb/test-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end(function(err, result) {
              if (err) return rej(err)
              res(result)
            })
        })

        await wait(300)

        // eslint-disable-next-line no-unused-vars
        const postRes2 = await new Promise((res, rej) => {
          // UPDATE again
          client
            .put('/testdb/test-schema/' + id)
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({field1: 'foo bar baz!'})
            .expect(200)
            .end(function(err, result) {
              if (err) return rej(err)
              res(result)
            })
        })

        await wait(200)

        const getRes3 = await new Promise((res, rej) => {
          client
            .get('/testdb/test-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end(function(err, result) {
              if (err) return rej(err)
              res(result)
            })
        })

        const result = getRes3.body.results.find(item => item._id === id)

        result.field1.should.eql('foo bar baz!')
      }
      finally {
        await stopApp()
      }
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
              .get('/testdb/test-schema')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .end(function(err, getRes1) {
                if (err) return done(err)

                // CREATE
                client
                  .post('/testdb/test-schema')
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
                        .get('/testdb/test-schema')
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .expect(200)
                        .end(function(err, getRes2) {
                          if (err) return done(err)

                          setTimeout(function() {
                            // DELETE
                            client
                              .delete('/testdb/test-schema/' + id)
                              .set('Authorization', 'Bearer ' + bearerToken)
                              .expect(204)
                              .end(function(err, postRes2) {
                                if (err) return done(err)

                                // WAIT, then GET again
                                setTimeout(function() {
                                  client
                                    .get('/testdb/test-schema')
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
        .get('/testdb/test-schema?callback=myCallback')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'text/javascript')
        .end(function(err, res1) {
          if (err) return done(err)

          client
            .post('/testdb/test-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({field1: 'foo!'})
            .expect(200)
            .end(function(err, res) {
              if (err) return done(err)

              setTimeout(() => {
                client
                  .get('/testdb/test-schema?callback=myCallback')
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
    before(() => {
      config.set('caching.redis.enabled', true)
    })

    beforeEach(function(done) {
      config.set('caching.directory.enabled', false)
      config.set('caching.ttl', previousConfig.caching.ttl)

      cache.reset()

      done()
    })

    it('should check key exists in Redis', async function() {
      delete require.cache[__dirname + '/../../dadi/lib/']

      const c = cache(app)

      const spy = sinon.spy(c.cache.cacheHandler.redisClient, 'exists')

      // generate expected cacheKey
      const requestUrl = '/testdb/test-schema'
      const query = url.parse(requestUrl, true).query
      const modelDir = crypto.createHash('sha1').update(url.parse(requestUrl).pathname).digest('hex')
      const filename = crypto.createHash('sha1').update(url.parse(requestUrl).pathname + JSON.stringify(query)).digest('hex')
      const cacheKey = modelDir + '_' + filename + '.gz'

      try {
        const bearerToken = await startApp()
        const client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))

        await new Promise((res, rej) => {
          client
            .get(requestUrl)
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end(function(err, result) {
              if (err) return rej(err)
              res(result)
            })
        })

        spy.called.should.eql(true)
        spy.args[0][0].should.eql(cacheKey)

        c.cache.cacheHandler.redisClient.exists.restore()
      } finally {
        await stopApp()
      }
    })

    it('should return data if key exists in Redis, with correct headers', async function() {
      delete require.cache[__dirname + '/../../dadi/lib/']

      // generate expected cacheKey
      const requestUrl = '/testdb/test-schema'
      const query = url.parse(requestUrl, true).query
      const modelDir = crypto.createHash('sha1').update(url.parse(requestUrl).pathname).digest('hex')
      const filename = crypto.createHash('sha1').update(url.parse(requestUrl).pathname + JSON.stringify(query)).digest('hex')
      const cacheKey = modelDir + '_' + filename

      cache.reset()
      const c = cache(app)

      c.cache.cacheHandler.redisClient.set(
        cacheKey,
        JSON.stringify({DATA: 'OK'})
      )

      try {
        const bearerToken = await startApp()
        const client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))

        const res = await new Promise((res, rej) => {
          client
            .get(requestUrl)
            .set('Accept-Encoding', 'identity')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end(function(err, result) {
              if (err) return rej(err)
              res(result)
            })
        })

        res.body.should.eql({DATA: 'OK'})
        res.headers['x-cache'].should.eql('HIT')
      } finally {
        await stopApp()
      }
    })

    it('should invalidate based on TTL', async function() {
      this.timeout(6000)

      delete require.cache[__dirname + '/../../dadi/lib/']

      cache.reset()
      const c = cache(app)

      try {
        config.set('caching.ttl', 1)

        const bearerToken = await startApp()
        const client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))

        await new Promise((res, rej) => {
          client
            .post('/testdb/test-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({field1: 'foo!'})
            .expect(200)
            .end(function(err, result) {
              if (err) return rej(err)
              res(result)
            })
        })

        await new Promise((res, rej) => {
          client
            .get('/testdb/test-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end(function(err, result) {
              if (err) return rej(err)
              res(result)
            })
        })

        // eslint-disable-next-line no-unused-vars
        const cacheKeys = await new Promise((res, rej) => {
          setTimeout(function() {
            // get the cache keys
            c.cache.cacheHandler.redisClient.KEYS('*', (err, keys) => {
              if (err) return rej(err)
              res(keys)
            })
          }, 1500)
        })

        const res = await new Promise((res, rej) => {
          setTimeout(function() {
            // ttl should have expired
            client
              .get('/testdb/test-schema')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .end(function(err, result) {
                if (err) return rej(err)
                res(result)
              })
          })
        })

        res.headers['x-cache'].should.eql('MISS')
        res.headers['x-cache-lookup'].should.eql('MISS')
      } finally {
        config.set('caching.ttl', oldTTL)
        await stopApp()
      }
    })

    it('should flush on POST create request', async function() {
      this.timeout(8000)

      delete require.cache[__dirname + '/../../config.js']
      delete require.cache[__dirname + '/../../dadi/lib/']

      config.loadFile(config.configPath())

      cache.reset()
      const c = cache(app)

      try {
        const bearerToken = await startApp()

        await new Promise((res, rej) => {
          help.createDoc(bearerToken, function(err, doc) {
            if (err) return rej(err)
            res(doc)
          })
        })
        await new Promise((res, rej) => {
          help.createDoc(bearerToken, function(err, doc) {
            if (err) return rej(err)
            res(doc)
          })
        })

        const client = request('http://' + config.get('server.host') + ':' + config.get('server.port'))

        const res1 = await new Promise((res, rej) => {
          client
            .get('/testdb/test-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end(function(err, result) {
              if (err) return rej(err)
              res(result)
            })
        })

        // eslint-disable-next-line no-unused-vars
        const cacheKeys = await new Promise((res, rej) => {
          setTimeout(function() {
            // get the cache keys
            c.cache.cacheHandler.redisClient.KEYS('*', (err, keys) => {
              if (err) return rej(err)
              res(keys)
            })
          }, 500)
        })

        await new Promise((res, rej) => {
          client
            .post('/testdb/test-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({field1: 'foo!'})
            .expect(200)
            .end(function(err, result) {
              if (err) return rej(err)
              res(result)
            })
        })

        const res2 = await new Promise((res, rej) => {
          setTimeout(function() {
            client
              .get('/testdb/test-schema')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .end(function(err, result) {
                if (err) return rej(err)
                res(result)
              })
          })
        })

        // cache.reset()
        res1.body.results.length.should.eql(2)
        res2.body.results.length.should.eql(3)
        res2.text.should.not.equal(res1.text)
      }
      finally {
        await stopApp()
      }
    })

    it('should flush on PUT update request', function(done) {
      this.timeout(8000)

      delete require.cache[__dirname + '/../../config.js']
      delete require.cache[__dirname + '/../../dadi/lib/']

      config.loadFile(config.configPath())

      cache.reset()
      const c = cache(app)

      try {
        app.start(function() {
          help.dropDatabase('testdb', function(err) {
            if (err) return done(err)

            createSchemas().then(() => {
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
                      .get('/testdb/test-schema')
                      .set('Authorization', 'Bearer ' + bearerToken)
                      .expect(200)
                      .end(function(err, getRes1) {
                        if (err) return done(err)

                        // CREATE
                        client
                          .post('/testdb/test-schema')
                          .set('Authorization', 'Bearer ' + bearerToken)
                          .send({field1: 'foo!'})
                          .expect(200)
                          .end(function(err, postRes1) {
                            if (err) return done(err)

                            // save id for updating
                            const id = postRes1.body.results[0]._id

                            // GET AGAIN - should cache new results
                            client
                              .get('/testdb/test-schema')
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
                                        .put('/testdb/test-schema/' + id)
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
                                              .get('/testdb/test-schema')
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

                                                help.dropSchemas().then(() => {
                                                  app.stop(done)
                                                })
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

      try {
        app.start(function() {
          help.dropDatabase('testdb', function(err) {
            if (err) return done(err)

            createSchemas().then(() => {
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
                      .get('/testdb/test-schema')
                      .set('Authorization', 'Bearer ' + bearerToken)
                      .expect(200)
                      .end(function(err, getRes1) {
                        if (err) return done(err)

                        // CREATE
                        client
                          .post('/testdb/test-schema')
                          .set('Authorization', 'Bearer ' + bearerToken)
                          .send({field1: 'foo!'})
                          .expect(200)
                          .end(function(err, postRes1) {
                            if (err) return done(err)

                            // save id for deleting
                            const id = postRes1.body.results[0]._id

                            // GET AGAIN - should cache new results
                            client
                              .get('/testdb/test-schema')
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
                                          .delete('/testdb/test-schema/' + id)
                                          .set(
                                            'Authorization',
                                            'Bearer ' + bearerToken
                                          )
                                          .expect(204)
                                          .end(function(err, postRes2) {
                                            // WAIT, then GET again
                                            setTimeout(function() {
                                              client
                                                .get('/testdb/test-schema')
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

                                                  help
                                                    .dropSchemas()
                                                    .then(() => {
                                                      app.stop(done)
                                                    })
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

            createSchemas().then(() => {
              client
                .get('/testdb/test-schema?callback=myCallback')
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
                          .post('/testdb/test-schema')
                          .set('Authorization', 'Bearer ' + bearerToken)
                          .send({field1: 'foo!'})
                          .expect(200)
                          .end(function(err, res) {
                            if (err) return done(err)

                            client
                              .get('/testdb/test-schema?callback=myCallback')
                              .set('Authorization', 'Bearer ' + bearerToken)
                              .expect(200)
                              .expect('content-type', 'text/javascript')
                              .end(function(err, res2) {
                                if (err) return done(err)

                                res2.text.should.not.equal(res1.text)

                                help.dropSchemas().then(() => {
                                  app.stop(done)
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
      } catch (err) {
        // noop
      }
    })
  })
})
