var fs = require('fs');
var should = require('should');
var request = require('supertest');
var needle = require('needle');
var url = require('url');

var config = require(__dirname + '/../../config');
var logger = require(__dirname + '/../../dadi/lib/log');
var help = require(__dirname + '/help');
var app = require(__dirname + '/../../dadi/lib/');

var bearerToken;
var connectionString = 'http://' + config.get('server.host') + ':' + config.get('server.port');
var logpath = config.get('logging').path + '/' + config.get('logging').filename + '.access.' + config.get('logging').extension;

var resetLog = function (done) {
    // empty the log for each test
    fs.writeFileSync(logpath, new Buffer(''));
    done();
};

describe('logger', function () {

  describe('general request', function () {

    beforeEach(resetLog);

    var cleanup = function (done) {
        // try to cleanup these tests directory tree
        // don't catch errors here, since the paths may not exist

        var dirs = config.get('paths');
        try {
            fs.unlinkSync(dirs.collections + '/v1/testdb/collection.test-schema.json');
        } catch (e) {}

        try {
            fs.rmdirSync(dirs.collections + '/v1/testdb');
        } catch (e) {}

        done();
    };

    before(function (done) {
        config.set('server.http2.enabled', false);

        help.dropDatabase('testdb', function (err) {
            if (err) return done(err);

            app.start(function() {

              help.getBearerTokenWithAccessType("admin", function (err, token) {
                  if (err) return done(err);

                  bearerToken = token;

                  // add a new field to the schema
                  var jsSchemaString = fs.readFileSync(__dirname + '/../new-schema.json', {encoding: 'utf8'});
                  jsSchemaString = jsSchemaString.replace('newField', 'field1');
                  var schema = JSON.parse(jsSchemaString);

                  var client = request(connectionString);

                  client
                  .post('/vtest/testdb/test-schema/config')
                  .send(JSON.stringify(schema, null, 4))
                  .set('content-type', 'text/plain')
                  .set('Authorization', 'Bearer ' + bearerToken)
                  .expect(200)
                  .expect('content-type', 'application/json')
                  .end(function (err, res) {
                      if (err) return done(err);

                      done();
                  });
              });
            });
        });
    });

    after(function (done) {
        // reset the schema
        var jsSchemaString = fs.readFileSync(__dirname + '/../new-schema.json', {encoding: 'utf8'});
        jsSchemaString = jsSchemaString.replace('newField', 'field1');
        var schema = JSON.parse(jsSchemaString);

        var client = request(connectionString);

        client
        .post('/vtest/testdb/test-schema/config')
        .send(JSON.stringify(schema, null, 4))
        .set('content-type', 'text/plain')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function (err, res) {
            if (err) return done(err);

            cleanup(function() {
              app.stop(done);
            });
        });
    });

    it('should log to the access log when collection endpoint is requested', function (done) {
      help.createDoc(bearerToken, function (err, doc) {
        if (err) return done(err);

        var client = request(connectionString);

        client
        .get('/vtest/testdb/test-schema')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err);

          res.body['results'].should.exist;
          res.body['results'].should.be.Array;
          res.body['results'].length.should.be.above(0)

          var logEntry = fs.readFileSync(logpath, {encoding: 'utf8'});
          logEntry.indexOf('/vtest/testdb/test-schema').should.be.above(0);

          done();
        });
      });
    });

    it('should determine the client IP address correctly', function (done) {
      help.createDoc(bearerToken, function (err, doc) {
        if (err) return done(err);

        var client = request(connectionString);

        client
        .get('/vtest/testdb/test-schema')
        .set('Authorization', 'Bearer ' + bearerToken)
        .set('x-forwarded-for', '52.101.34.175')
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err);

          var logEntry = fs.readFileSync(logpath, {encoding: 'utf8'});
          logEntry.indexOf('52.101.34.175').should.be.above(0);

          done();
        });
      });
    });
  });

  describe('http2 request', function () {

    beforeEach(resetLog);

    var cleanup = function (done) {
        // try to cleanup these tests directory tree
        // don't catch errors here, since the paths may not exist

        var dirs = config.get('paths');
        try {
            fs.unlinkSync(dirs.collections + '/v1/testdb/collection.test-schema.json');
        } catch (e) {}

        try {
            fs.rmdirSync(dirs.collections + '/v1/testdb');
        } catch (e) {}

        done();
    };

    before(function (done) {
        config.set('server.http2.enabled', true);

        help.dropDatabase('testdb', function (err) {
            if (err) return done(err);

            app.start(function() {

              help.getBearerTokenWithAccessTypeHttps("admin", function (err, token) {
                  if (err) return done(err);

                  bearerToken = token;

                  // add a new field to the schema
                  var jsSchemaString = fs.readFileSync(__dirname + '/../new-schema.json', {encoding: 'utf8'});
                  jsSchemaString = jsSchemaString.replace('newField', 'field1');
                  var schema = JSON.parse(jsSchemaString);

                  var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-schema/config';
                  var options = url.parse(doc_link);
                  options.key = fs.readFileSync(config.get('server.http2.key_path'));
                  options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                  options.headers = {
                    'content-type': 'text/plain',
                    'Authorization': 'Bearer ' + bearerToken
                  };
                  options.json = true;

                  needle.post(doc_link, schema, options, function(err, res) {
                      if (err) return done(err);
                      should(res.headers['content-type']).be.match(/json/);
                      should(res.statusCode).be.equal(200);
                      done();
                  });
              });
            });
        });
    });

    after(function (done) {
        // reset the schema
        var jsSchemaString = fs.readFileSync(__dirname + '/../new-schema.json', {encoding: 'utf8'});
        jsSchemaString = jsSchemaString.replace('newField', 'field1');
        var schema = JSON.parse(jsSchemaString);

        var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-schema/config';
        var options = url.parse(doc_link);
        options.key = fs.readFileSync(config.get('server.http2.key_path'));
        options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
        options.headers = {
          'content-type': 'text/plain',
          'Authorization': 'Bearer ' + bearerToken
        };
        options.json = true;
        needle.post(doc_link, schema, options, function(err, res) {
            if (err) return done(err);
            should(res.headers['content-type']).be.match(/json/);
            should(res.statusCode).be.equal(200);
            cleanup(function() {
              app.stop(done);
            });
        });

    });

    it('should log to the access log when collection endpoint is requested', function (done) {
      help.createDocHttps(bearerToken, function (err, doc) {
        if (err) return done(err);
        var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-schema';
        var options = url.parse(doc_link);
        options.key = fs.readFileSync(config.get('server.http2.key_path'));
        options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
        options.headers = {
            'Authorization': 'Bearer ' + bearerToken
        }
        needle.get(doc_link, options, function(err, res) {
          if (err) return done(err);
          should(res.headers['content-type']).be.match(/json/);
          should(res.statusCode).be.equal(200);
          res.body['results'].should.exist;
          res.body['results'].should.be.Array;
          res.body['results'].length.should.be.above(0)

          var logEntry = fs.readFileSync(logpath, {encoding: 'utf8'});
          logEntry.indexOf('/vtest/testdb/test-schema').should.be.above(0);

          done();
        });
      });
    });

    it('should determine the client IP address correctly', function (done) {
      help.createDocHttps(bearerToken, function (err, doc) {
        if (err) return done(err);
        var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-schema';
        var options = url.parse(doc_link);
        options.key = fs.readFileSync(config.get('server.http2.key_path'));
        options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
        options.headers = {
            'Authorization': 'Bearer ' + bearerToken,
            'x-forwarded-for': '52.101.34.175'
        }
        needle.get(doc_link, options, function(err, res) {
          if (err) return done(err);
          should(res.headers['content-type']).be.match(/json/);
          should(res.statusCode).be.equal(200);
          var logEntry = fs.readFileSync(logpath, {encoding: 'utf8'});
          logEntry.indexOf('52.101.34.175').should.be.above(0);

          done();
        });
      });
    });
  });
});
