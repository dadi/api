var crypto = require('crypto');
var fs = require('fs');
var path = require('path');
var should = require('should');
var request = require('supertest');
var redis = require('redis');
var fakeredis = require('fakeredis');
var sinon = require('sinon');
var proxyquire =  require('proxyquire');
var url =  require('url');
var _ = require('underscore');

var config = require(__dirname + '/../../config.js');
var app = require(__dirname + '/../../dadi/lib/');
var api = require(__dirname + '/../../dadi/lib/api');
var Server = require(__dirname + '/../../dadi/lib');
var cache = require(__dirname + '/../../dadi/lib/cache');
var help = require(__dirname + '/help');

var testConfigString;

var bearerToken;

describe('Cache', function (done) {
  this.timeout(4000)
  
  after(function(done) {
    testConfigString = fs.readFileSync(config.configPath());

    var newTestConfig = JSON.parse(testConfigString);
    newTestConfig.caching.directory.enabled = true;
    newTestConfig.caching.redis.enabled = false;
    fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2));
    done();
  });

  beforeEach(function(done) {
    try {
      app.stop(function(){});
      done();
    }
    catch (err) {
      done();
    }
  });

  it('should use cache if available', function (done) {
    var spy = sinon.spy(fs, 'createReadStream');

    app.start(function() {
      help.dropDatabase('test', function (err) {
        if (err) return done(err);

        help.getBearerToken(function (err, token) {
          if (err) return done(err);

          bearerToken = token;
          help.clearCache();

          var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

          client
          .get('/vtest/testdb/test-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end(function (err, res1) {
            if (err) return done(err);


            client
            .post('/vtest/testdb/test-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({field1: 'foo!'})
            .expect(200)
            .end(function (err, res) {
              if (err) return done(err);

              client
              .get('/vtest/testdb/test-schema')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .end(function (err, res2) {
                if (err) return done(err);

                client
                .get('/vtest/testdb/test-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .end(function (err, res3) {
                  if (err) return done(err);

                  res2.text.should.equal(res3.text);

                  spy.called.should.be.true;
                  spy.restore();

                  help.removeTestClients(function() {
                    help.clearCache();
                    app.stop(done);
                  });
                });
              });
            });
          });
        });
      });
    });
  });

  it('should allow bypassing cache with query string flag', function (done) {

    app.start(function() {
      help.dropDatabase('test', function (err) {
        if (err) return done(err);

        help.getBearerToken(function (err, token) {
          if (err) return done(err);

          bearerToken = token;
          help.clearCache();

          var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

          client
          .post('/vtest/testdb/test-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({field1: 'foo!'})
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err);

            client
            .get('/vtest/testdb/test-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end(function (err, res1) {
              if (err) return done(err);

              res1.body['results'].length.should.equal(1);

              client
              .get('/vtest/testdb/test-schema?cache=false')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .end(function (err, res2) {
                if (err) return done(err);

                res2.headers['x-cache'].should.exist;
                res2.headers['x-cache'].should.eql('MISS');
                res2.headers['x-cache-lookup'].should.exist;
                res2.headers['x-cache-lookup'].should.eql('HIT');

                help.removeTestClients(function() {
                  help.clearCache();
                  app.stop(done);
                });
              });
            });
          });
        });
      });
    });
  });

  it('should allow disabling through config', function (done) {

    testConfigString = fs.readFileSync(config.configPath());

    var newTestConfig = JSON.parse(testConfigString);
    newTestConfig.caching.directory.enabled = false;
    newTestConfig.caching.redis.enabled = false;

    fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2));

    cache.reset();

    delete require.cache[__dirname + '/../../config'];
    delete require.cache[__dirname + '/../../dadi/lib/'];
    config = require(__dirname + '/../../config');
    config.loadFile(config.configPath());

    var spy = sinon.spy(fs, 'createWriteStream');

    app.start(function() {
      help.dropDatabase('test', function (err) {
        if (err) return done(err);
      help.getBearerToken(function (err, token) {
         if (err) return done(err);
         bearerToken = token;
         help.clearCache();

        var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

        client
        .get('/vtest/testdb/test-schema')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .end(function (err, res1) {
          if (err) return done(err);

          res1.body['results'].length.should.equal(0);

          client
          .post('/vtest/testdb/test-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({field1: 'foo!'})
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err);

            client
            .get('/vtest/testdb/test-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end(function (err, res2) {
              if (err) return done(err);


              res2.body['results'].length.should.equal(1);

              var called = spy.called;
              spy.restore();
              called.should.be.false;

              fs.writeFileSync(config.configPath(), testConfigString);
              cache.reset();
              delete require.cache[__dirname + '/../../config'];
              config = require(__dirname + '/../../config');
              config.loadFile(config.configPath());

              app.stop(function(){});
              done();
            });
          });
        });
        });
      });
    });
  });

  describe('Filesystem', function(done) {

    beforeEach(function (done) {
      app.start(function() {
        help.dropDatabase('test', function (err) {
          if (err) return done(err);

          help.getBearerToken(function (err, token) {
            if (err) return done(err);

            bearerToken = token;
            help.clearCache();
            done();
          });
        });
      });
    });

    afterEach(function (done) {
      help.removeTestClients(function() {
        //help.clearCache();
        app.stop(done);
      });
    });

    it('should save responses to the file system', function (done) {

      var spy = sinon.spy(fs, 'createWriteStream');

      request('http://' + config.get('server.host') + ':' + config.get('server.port'))
      .get('/vtest/testdb/test-schema')
      .set('Authorization', 'Bearer ' + bearerToken)
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);

        setTimeout(function() {
          spy.called.should.be.true;
          var args = spy.getCall(0).args;

          args[0].indexOf('cache/api').should.be.above(-1);

          spy.restore();
          done();

        }, 1000);
      });
    });

    it.skip('should invalidate based on TTL', function (done) {
      this.timeout(4000);

      var oldTTL = config.get('caching.ttl');
      config.set('caching.ttl', 1);

      var _done = done;
      done = function (err) {
        config.set('caching.ttl', oldTTL);
        _done(err);
      };

      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

      client
      .get('/vtest/testdb/test-schema')
      .set('Authorization', 'Bearer ' + bearerToken)
      .expect(200)
      .end(function (err, res1) {
        if (err) return done(err);


        client
        .post('/vtest/testdb/test-schema')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send({field1: 'foo!'})
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);

          setTimeout(function () {

            // ttl should have expired
            client
            .get('/vtest/testdb/test-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end(function (err, res2) {
              if (err) return done(err);

              res1.body['results'].length.should.equal(0);
              res2.body['results'].length.should.equal(1);
              res2.text.should.not.equal(res1.text);

              done();
            });
          }, 1000);
        });
      });
    });

    it('should flush on POST create request', function (done) {
  	  this.timeout(4000);
      help.createDoc(bearerToken, function (err, doc) {
        if (err) return done(err);

        help.createDoc(bearerToken, function (err, doc) {
          if (err) return done(err);

          var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

          client
          .get('/vtest/testdb/test-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end(function (err, res1) {
            if (err) return done(err);

            client
            .post('/vtest/testdb/test-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({field1: 'foo!'})
            .expect(200)
            .end(function (err, res2) {
              if (err) return done(err);

              setTimeout(function () {

                client
                .get('/vtest/testdb/test-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .end(function (err, res3) {
                  if (err) return done(err);

                  res1.body.results.length.should.eql(2);
                  res3.body.results.length.should.eql(3);
                  res3.text.should.not.equal(res1.text);

                  done();
                });
              }, 300);
            });
          });
        });
      });
    });

    it('should flush on PUT update request', function (done) {
  	   this.timeout(4000);

      help.createDoc(bearerToken, function (err, doc) {
        if (err) return done(err);

        help.createDoc(bearerToken, function (err, doc) {
          if (err) return done(err);

          var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

          // GET
          client
          .get('/vtest/testdb/test-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end(function (err, getRes1) {
            if (err) return done(err);

            // CREATE
            client
            .post('/vtest/testdb/test-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({field1: 'foo!'})
            .expect(200)
            .end(function (err, postRes1) {
              if (err) return done(err);

              // save id for updating
              var id = postRes1.body.results[0]._id;

              // GET AGAIN - should cache new results
              client
              .get('/vtest/testdb/test-schema')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .end(function (err, getRes2) {
                if (err) return done(err);

                setTimeout(function () {

                  // UPDATE again
                  client
                  .put('/vtest/testdb/test-schema/' + id)
                  .set('Authorization', 'Bearer ' + bearerToken)
                  .send({field1: 'foo bar baz!'})
                  .expect(200)
                  .end(function (err, postRes2) {
                    if (err) return done(err);

                    // WAIT, then GET again
                    setTimeout(function () {

                      client
                      .get('/vtest/testdb/test-schema')
                      .set('Authorization', 'Bearer ' + bearerToken)
                      .expect(200)
                      .end(function (err, getRes3) {
                        if (err) return done(err);

                        var result = _.findWhere(getRes3.body.results, { "_id": id });

                        result.field1.should.eql('foo bar baz!');

                        done();
                      });
                    }, 200);
                  });
                }, 300);
              });
            });
          });
        });
      });
    });

    it('should flush on DELETE request', function (done) {
  	  this.timeout(4000);
      help.createDoc(bearerToken, function (err, doc) {
        if (err) return done(err);

        help.createDoc(bearerToken, function (err, doc) {
          if (err) return done(err);

          var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

          // GET
          client
          .get('/vtest/testdb/test-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end(function (err, getRes1) {
            if (err) return done(err);

            // CREATE
            client
            .post('/vtest/testdb/test-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({field1: 'foo!'})
            .expect(200)
            .end(function (err, postRes1) {
              if (err) return done(err);

              // save id for deleting
              var id = postRes1.body.results[0]._id;

              // GET AGAIN - should cache new results
              client
              .get('/vtest/testdb/test-schema')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .end(function (err, getRes2) {
                if (err) return done(err);

                setTimeout(function () {

                  // DELETE
                  client
                  .delete('/vtest/testdb/test-schema/' + id)
                  .set('Authorization', 'Bearer ' + bearerToken)
                  .expect(204)
                  .end(function (err, postRes2) {
                    if (err) return done(err);

                    // WAIT, then GET again
                    setTimeout(function () {

                      client
                      .get('/vtest/testdb/test-schema')
                      .set('Authorization', 'Bearer ' + bearerToken)
                      .expect(200)
                      .end(function (err, getRes3) {
                        if (err) return done(err);

                        var result = _.findWhere(getRes3.body.results, { "_id": id });

                        should.not.exist(result);

                        done();
                      });
                    }, 300);
                  });
                }, 700);
              });
            });
          });
        });
      });
    });

    it('should preserve content-type', function (done) {
      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

      client
      .get('/vtest/testdb/test-schema?callback=myCallback')
      .set('Authorization', 'Bearer ' + bearerToken)
      .expect(200)
      .expect('content-type', 'text/javascript')
      .end(function (err, res1) {
        if (err) return done(err);

        client
        .post('/vtest/testdb/test-schema')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send({field1: 'foo!'})
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);

          client
          .get('/vtest/testdb/test-schema?callback=myCallback')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .expect('content-type', 'text/javascript')
          .end(function (err, res2) {
            if (err) return done(err);

            res2.text.should.not.equal(res1.text);
            done();
          });
        });
      });
    });
  });

  describe.skip('Redis', function(done) {

    beforeEach(function (done) {
      testConfigString = fs.readFileSync(config.configPath());

      var newTestConfig = JSON.parse(testConfigString);
      newTestConfig.caching.directory.enabled = false;
      newTestConfig.caching.redis.enabled = true;

      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2));

      // delete require.cache[__dirname + '/cache'];
      //
      // delete require.cache[__dirname + '/../../dadi/lib/cache'];
      // cache = require(__dirname + '/../../dadi/lib/cache');
      //
      delete require.cache[__dirname + '/../../config'];
      config = require(__dirname + '/../../config');

      done();
    });

    afterEach(function(done) {
      fs.writeFileSync(config.configPath(), testConfigString);
      done();
    });

    it('should throw error if can\'t connect to Redis client', function(done) {

      delete require.cache[__dirname + '/../../config.js'];
      delete require.cache[__dirname + '/../../dadi/lib/'];

      config.loadFile(config.configPath());

      try {
        app.stop(function(){});
        should.throws(function() { app.start(function(){}); }, Error);
      }
      catch (err) {
      }

      done();

    });

    it('should initialise Redis client', function(done) {

      delete require.cache[__dirname + '/../../config.js'];
      config.loadFile(config.configPath());

      sinon.stub(redis, 'createClient', fakeredis.createClient);

      delete require.cache[__dirname + '/../../dadi/lib/'];
      cache.reset();

      try {
        app.stop(function(){});
        //app.start(function(){});
      }
      catch (err) {
      }

      var  c = cache(app);
      redis.createClient.restore();
      c.redisClient.should.not.be.null;
      //app.stop(function(){});
      done();
    });

    it('should fallback to directory cache if Redis client fails', function(done) {

      delete require.cache[__dirname + '/../../config.js'];
      config.loadFile(config.configPath());

      var EventEmitter = require('events');
      var util = require('util');

      /* Fake redis client */
      function Client() {
        this.end = function(reallyEnd) { }
        EventEmitter.call(this);
      }

      util.inherits(Client, EventEmitter);
      var redisClient = new Client();
      /* End Fake redis client */

      sinon.stub(redis, 'createClient').returns(redisClient);

      delete require.cache[__dirname + '/../../dadi/lib/'];
      cache.reset();

      var c = cache(app);
      redis.createClient.restore();

      setTimeout(function() {
        // emit an error event
        redisClient.emit('error', { code: 'CONNECTION_BROKEN'});

        config.get('caching.directory.enabled').should.eql(true)

        try {
          app.stop(function(){});
        }
        catch (err) {
        }

        done();
      }, 1000)

    });

    it('should check key exists in Redis', function(done) {
      delete require.cache[__dirname + '/../../config.js'];
      config.loadFile(config.configPath());

      var client = sinon.stub(redis, 'createClient', fakeredis.createClient);

      delete require.cache[__dirname + '/../../dadi/lib/'];

      var  c = cache(app);
      c.redisClient = fakeredis.createClient();
      var spy = sinon.spy(c.redisClient, 'exists');

      // generate expected cacheKey
      var requestUrl = '/vtest/testdb/test-schema';
      var query = url.parse(requestUrl, true).query;
      var modelDir = crypto.createHash('sha1').update(url.parse(requestUrl).pathname).digest('hex');
      var filename = crypto.createHash('sha1').update(url.parse(requestUrl).pathname + JSON.stringify(query)).digest('hex');
      var cacheKey = modelDir + '_' + filename;

      try {
        app.start(function() {
         help.getBearerToken(function (err, token) {
            if (err) return done(err);
            bearerToken = token;

            var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

            client
            .get(requestUrl)
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end(function (err, res) {
              if (err) return done(err);

              spy.called.should.eql(true);
              spy.args[0][0].should.eql(cacheKey);

              c.redisClient.exists.restore();
              redis.createClient.restore();

              app.stop(function(){});
              done();
            });

          });
        });
      }
      catch (err) {
        console.log(err)
        done();
      }
    });

    it('should return data if key exists in Redis, with correct headers', function(done) {
      delete require.cache[__dirname + '/../../config.js'];
      config.loadFile(config.configPath());

      delete require.cache[__dirname + '/../../dadi/lib/'];

      // generate expected cacheKey
      var requestUrl = '/vtest/testdb/test-schema';
      var query = url.parse(requestUrl, true).query;
      var modelDir = crypto.createHash('sha1').update(url.parse(requestUrl).pathname).digest('hex');
      var filename = crypto.createHash('sha1').update(url.parse(requestUrl).pathname + JSON.stringify(query)).digest('hex');
      var cacheKey = modelDir + '_' + filename;

      var  c = cache(app);
      c.redisClient = fakeredis.createClient();
      c.redisClient.set(cacheKey, 'DATA');

      try {
        app.start(function() {
         help.getBearerToken(function (err, token) {
            if (err) return done(err);
            bearerToken = token;

            var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

            client
            .get(requestUrl)
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end(function (err, res) {
              if (err) return done(err);

              res.text.should.eql('DATA');
              res.headers['x-cache'].should.eql('HIT');

              app.stop(function(){});
              done();
            });

          });
        });
      }
      catch (err) {
        console.log(err)
        done();
      }
    });

    it('should invalidate based on TTL', function(done) {
      this.timeout(6000);

      var configString = fs.readFileSync(config.configPath());
      var newTestConfig = JSON.parse(configString);
      newTestConfig.caching.ttl = 1;
      fs.writeFileSync(config.configPath(), JSON.stringify(newTestConfig, null, 2));
      delete require.cache[__dirname + '/../../config'];
      //config = require(__dirname + '/../../config');

      delete require.cache[__dirname + '/../../config.js'];
      delete require.cache[__dirname + '/../../dadi/lib/'];
      cache.reset();

      config.loadFile(config.configPath());

      var redisClient = fakeredis.createClient();
      sinon.stub(redis, 'createClient', function () { return redisClient; });

      var  c = cache(app);

      try {
        app.start(function() {
          help.dropDatabase('test', function (err) {
            if (err) return done(err);

           help.getBearerToken(function (err, token) {
              if (err) return done(err);
              bearerToken = token;

              var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

              client
              .post('/vtest/testdb/test-schema')
              .set('Authorization', 'Bearer ' + bearerToken)
              .send({field1: 'foo!'})
              .expect(200)
              .end(function (err, res) {
                if (err) return done(err);

                client
                .get('/vtest/testdb/test-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .end(function (err, res1) {
                  if (err) return done(err);

                  setTimeout(function () {

                    // ttl should have expired
                    client
                    .get('/vtest/testdb/test-schema')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .end(function (err, res2) {
                      if (err) return done(err);

                      redis.createClient.restore();

                      res2.headers['x-cache'].should.eql('MISS');
                      res2.headers['x-cache-lookup'].should.eql('MISS');

                      app.stop(function(){});
                      done();

                    });
                  }, 1500);
                });
              });
            });
          });
        });
      }
      catch (err) {
        console.log(err);
        done();
      }
    });

    it('should flush on POST create request', function(done) {
      this.timeout(4000);

      delete require.cache[__dirname + '/../../config.js'];
      delete require.cache[__dirname + '/../../dadi/lib/'];
      cache.reset();

      config.loadFile(config.configPath());

      var redisClient = fakeredis.createClient(config.get('caching.redis.port'), config.get('caching.redis.host'), {detect_buffers: true, max_attempts: 3});
      sinon.stub(redis, 'createClient', function () { return redisClient; });

      try {
        app.start(function() {
          help.dropDatabase('test', function (err) {
            if (err) return done(err);

            help.getBearerToken(function (err, token) {
               if (err) return done(err);
               bearerToken = token;

              help.createDoc(bearerToken, function (err, doc) {
                if (err) return done(err);

                help.createDoc(bearerToken, function (err, doc) {
                  if (err) return done(err);

                  var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

                  client
                  .get('/vtest/testdb/test-schema')
                  .set('Authorization', 'Bearer ' + bearerToken)
                  .expect(200)
                  .end(function (err, res1) {
                    if (err) return done(err);

                    client
                    .post('/vtest/testdb/test-schema')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .send({field1: 'foo!'})
                    .expect(200)
                    .end(function (err, res2) {
                      if (err) return done(err);

                      setTimeout(function () {

                        client
                        .get('/vtest/testdb/test-schema')
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .expect(200)
                        .end(function (err, res3) {
                          if (err) return done(err);

                          redis.createClient.restore();

                          res1.body.results.length.should.eql(2);
                          res3.body.results.length.should.eql(3);
                          res3.text.should.not.equal(res1.text);

                          app.stop(function(){});
                          done();
                        });
                      }, 600);
                    });
                  });
                });
              });
            });
          });
        });
      }
      catch (err) {
        console.log(err);
        done();
      }
    });

    it('should flush on PUT update request', function(done) {
      this.timeout(4000);

      delete require.cache[__dirname + '/../../config.js'];
      delete require.cache[__dirname + '/../../dadi/lib/'];
      cache.reset();

      config.loadFile(config.configPath());

      var redisClient = fakeredis.createClient(config.get('caching.redis.port'), config.get('caching.redis.host'), {detect_buffers: true, max_attempts: 3});
      sinon.stub(redis, 'createClient', function () { return redisClient; });

      try {
        app.start(function() {
          help.dropDatabase('test', function (err) {
            if (err) return done(err);

            help.getBearerToken(function (err, token) {
               if (err) return done(err);
               bearerToken = token;

               help.createDoc(bearerToken, function (err, doc) {
                 if (err) return done(err);

                 help.createDoc(bearerToken, function (err, doc) {
                   if (err) return done(err);

                   var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

                   // GET
                   client
                   .get('/vtest/testdb/test-schema')
                   .set('Authorization', 'Bearer ' + bearerToken)
                   .expect(200)
                   .end(function (err, getRes1) {
                     if (err) return done(err);

                     // CREATE
                     client
                     .post('/vtest/testdb/test-schema')
                     .set('Authorization', 'Bearer ' + bearerToken)
                     .send({field1: 'foo!'})
                     .expect(200)
                     .end(function (err, postRes1) {
                       if (err) return done(err);

                       // save id for updating
                       var id = postRes1.body.results[0]._id;

                       // GET AGAIN - should cache new results
                       client
                       .get('/vtest/testdb/test-schema')
                       .set('Authorization', 'Bearer ' + bearerToken)
                       .expect(200)
                       .end(function (err, getRes2) {
                         if (err) return done(err);

                         setTimeout(function () {

                           // UPDATE again
                           client
                           .put('/vtest/testdb/test-schema/' + id)
                           .set('Authorization', 'Bearer ' + bearerToken)
                           .send({field1: 'foo bar baz!'})
                           .expect(200)
                           .end(function (err, postRes2) {
                             if (err) return done(err);

                             // WAIT, then GET again
                             setTimeout(function () {

                               client
                               .get('/vtest/testdb/test-schema')
                               .set('Authorization', 'Bearer ' + bearerToken)
                               .expect(200)
                               .end(function (err, getRes3) {
                                 if (err) return done(err);

                                 redis.createClient.restore();

                                // console.log(getRes2.body)
                                //  console.log(getRes3.body)
                                 var result = _.findWhere(getRes3.body.results, { "_id": id });

                                 result.field1.should.eql('foo bar baz!');

                                 app.stop(function(){});
                                 done();
                               });
                             }, 200);
                           });
                         }, 300);
                       });
                     });
                   });
                 });
               });
            });
          });
        });
      }
      catch (err) {
        console.log(err);
        done();
      }
    });

    it('should flush on DELETE request', function(done) {
      this.timeout(4000);

      delete require.cache[__dirname + '/../../config.js'];
      delete require.cache[__dirname + '/../../dadi/lib/'];
      cache.reset();

      config.loadFile(config.configPath());

      var redisClient = fakeredis.createClient(config.get('caching.redis.port'), config.get('caching.redis.host'), {detect_buffers: true, max_attempts: 3});
      sinon.stub(redis, 'createClient', function () { return redisClient; });

      try {
        app.start(function() {
          help.dropDatabase('test', function (err) {
            if (err) return done(err);

            help.getBearerToken(function (err, token) {
               if (err) return done(err);
               bearerToken = token;

                help.createDoc(bearerToken, function (err, doc) {
                  if (err) return done(err);

                  help.createDoc(bearerToken, function (err, doc) {
                    if (err) return done(err);

                    var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

                    // GET
                    client
                    .get('/vtest/testdb/test-schema')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .end(function (err, getRes1) {
                      if (err) return done(err);

                      // CREATE
                      client
                      .post('/vtest/testdb/test-schema')
                      .set('Authorization', 'Bearer ' + bearerToken)
                      .send({field1: 'foo!'})
                      .expect(200)
                      .end(function (err, postRes1) {
                        if (err) return done(err);

                        // save id for deleting
                        var id = postRes1.body.results[0]._id;

                        // GET AGAIN - should cache new results
                        client
                        .get('/vtest/testdb/test-schema')
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .expect(200)
                        .end(function (err, getRes2) {
                          if (err) return done(err);

                          setTimeout(function () {

                            // DELETE
                            client
                            .delete('/vtest/testdb/test-schema/' + id)
                            .set('Authorization', 'Bearer ' + bearerToken)
                            .expect(204)
                            .end(function (err, postRes2) {
                              if (err) return done(err);

                              // WAIT, then GET again
                              setTimeout(function () {

                                client
                                .get('/vtest/testdb/test-schema')
                                .set('Authorization', 'Bearer ' + bearerToken)
                                .expect(200)
                                .end(function (err, getRes3) {
                                  if (err) return done(err);

                                  var result = _.findWhere(getRes3.body.results, { "_id": id });

                                  redis.createClient.restore();

                                  should.not.exist(result);

                                  app.stop(function(){});
                                  done();
                                });
                              }, 300);
                            });
                          }, 700);
                        });
                      });
                    });
                  });
                });
            });
          });
        });
      }
      catch (err) {
        console.log(err);
        done();
      }
    });

    it('should preserve content-type', function(done) {

      delete require.cache[__dirname + '/../../config.js'];
      delete require.cache[__dirname + '/../../dadi/lib/'];
      cache.reset();

      config.loadFile(config.configPath());

      var redisClient = fakeredis.createClient(config.get('caching.redis.port'), config.get('caching.redis.host'), {detect_buffers: true, max_attempts: 3});
      sinon.stub(redis, 'createClient', function () { return redisClient; });

      try {
        app.start(function() {

        var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

        client
        .get('/vtest/testdb/test-schema?callback=myCallback')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'text/javascript')
        .end(function (err, res1) {
          if (err) return done(err);

          client
          .post('/vtest/testdb/test-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({field1: 'foo!'})
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err);

            client
            .get('/vtest/testdb/test-schema?callback=myCallback')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .expect('content-type', 'text/javascript')
            .end(function (err, res2) {
              if (err) return done(err);

              res2.text.should.not.equal(res1.text);
              app.stop(function(){});
              done();
            });
          });
        });
      });
    }
    catch(err) {

    }
  });
  });
});
