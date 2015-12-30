var should = require('should');
var fs = require('fs');
var path = require('path');
var request = require('supertest');
var _ = require('underscore');
var config = require(__dirname + '/../../config');
var help = require(__dirname + '/help');
var app = require(__dirname + '/../../dadi/lib/');

// variables scoped for use throughout tests
var bearerToken;
var connectionString = 'http://' + config.get('server.host') + ':' + config.get('server.port');

describe('API Documentation', function () {

  describe('GET', function () {

    before(function (done) {

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

              schema.fields.field2 = _.extend({}, schema.fields.newField, {
                  type: 'Number',
                  required: true,
                  message: 'Provide a value here, please!'
              });

              schema.fields.field3 = _.extend({}, schema.fields.newField, {
                  type: 'ObjectID',
                  required: false
              });

              schema.settings.displayName = 'Test Collection';
              schema.settings.description = 'Test Collection';

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

            app.stop(done);
        });
    })

    it('should get an HTML document referencing loaded components', function (done) {

      var doc = { field1: "Test", field2: 1234 };

      help.createDocWithParams(bearerToken, doc, function (err, doc) {
        if (err) return done(err);

        var client = request(connectionString);

            client
            .get('/api/docs')
            .expect(200)
            .expect('content-type', 'text/html')
            .end(function (err, res) {
                if (err) return done(err);

                var model = res.text.indexOf('test-schema');
                var display = res.text.indexOf('Test Collection');
                var message = res.text.indexOf('Provide a value');

                model.should.be.above(0);
                display.should.be.above(0);
                message.should.be.above(0);

                done();
            });
        });
    });
  });
});
