var fs = require('fs');
var path = require('path');
var should = require('should');
var moment = require('moment');
var request = require('supertest');
var _ = require('underscore');
var config = require(__dirname + '/../../config');
var help = require(__dirname + '/help');
var app = require(__dirname + '/../../dadi/lib/');

var bearerToken; // scoped for all tests
var dirs = config.get('paths');
var newSchemaPath = path.resolve(dirs.collections + '/vtest/testdb/collection.test-validation-schema.json');

describe('validation', function () {
    before(function (done) {

        var newSchema = JSON.parse(JSON.stringify(require(path.resolve(dirs.collections + '/../validation/collections/vtest/testdb/collection.test-validation-schema.json'))));
        fs.writeFileSync(newSchemaPath, JSON.stringify(newSchema));

        app.start(function (err) {
            if (err) return done(err);

            help.dropDatabase('testdb', function (err) {
                if (err) return done(err);

                help.getBearerToken(function (err, token) {
                    if (err) return done(err);

                    bearerToken = token;

                    done();
                });
            });
        });
    });

    after(function (done) {

        try {
          fs.unlinkSync(newSchemaPath);
        }
        catch (err) {
          console.log(err)
        }

        help.removeTestClients(function() {
            app.stop(done);
        });
    });

    describe('field types', function () {
        describe('string', function () {
            it('should not allow setting non-string', function (done) {
                var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

                client
                .post('/vtest/testdb/test-validation-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({fieldString: 1337})
                .expect(400, done);
            });

            it('should allow setting string', function (done) {
                var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

                client
                .post('/vtest/testdb/test-validation-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({fieldString: '1337'})
                .expect(200, done);
            });
        });

        describe('DateTime', function () {
          describe('POST', function () {
            it('should not allow setting invalid DateTime', function (done) {
              var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

              client
              .post('/vtest/testdb/test-validation-schema')
              .set('Authorization', 'Bearer ' + bearerToken)
              .send({fieldDateTime: 'abcdef'})
              .expect(400)
              .end(function(err, res) {
                done()
              })
            });

            it('should allow setting DateTime', function (done) {
              var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));
              var date = new Date()
              client
              .post('/vtest/testdb/test-validation-schema')
              .set('Authorization', 'Bearer ' + bearerToken)
              .send({fieldDateTime: date})
              .expect(200)
              .end(function(err, res) {
                new Date(res.body.results[0].fieldDateTime).should.eql(date)
                done()
              })
            })
          })

          describe('PUT', function () {
            it('should not allow setting invalid DateTime', function (done) {
              var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));
              var date = new Date()
              client
              .post('/vtest/testdb/test-validation-schema')
              .set('Authorization', 'Bearer ' + bearerToken)
              .send({fieldDateTime: date})
              .expect(200)
              .end(function(err, res) {
                var doc = res.body.results[0]
                var id = doc._id

                doc.fieldDateTime = "abcdef"
                delete doc.createdAt
                delete doc.createdBy
                delete doc._id

                client
                .put('/vtest/testdb/test-validation-schema/' + id)
                .set('Authorization', 'Bearer ' + bearerToken)
                .send(doc)
                .expect(400)
                .end(function(err, res) {
                  res.body.success.should.eql(false)
                  done()
                })
              })
            });

            it('should allow setting DateTime', function (done) {
              var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));
              var date = new Date()
              client
              .post('/vtest/testdb/test-validation-schema')
              .set('Authorization', 'Bearer ' + bearerToken)
              .send({fieldDateTime: date})
              .expect(200)
              .end(function(err, res) {
                var doc = res.body.results[0]
                var id = doc._id

                var date2 = new Date()
                doc.fieldDateTime = date2
                delete doc.createdAt
                delete doc.createdBy
                delete doc._id
                delete doc.v

                client
                .put('/vtest/testdb/test-validation-schema/' + id)
                .set('Authorization', 'Bearer ' + bearerToken)
                .send(doc)
                .expect(200)
                .end(function(err, res) {

                  new Date(res.body.results[0].fieldDateTime).should.eql(date2)

                  done()
                })
              })
            });
          })
        });

        describe('number', function () {
            it('should not allow setting non-number', function (done) {
                var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

                client
                .post('/vtest/testdb/test-validation-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({fieldNumber: '123'})
                .expect(400, done);
            });

            it('should allow setting number', function (done) {
                var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

                client
                .post('/vtest/testdb/test-validation-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({fieldNumber: 1337})
                .expect(200, done);
            });
        });

        describe('boolean', function () {
            it('should not allow setting non-boolean', function (done) {
                var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

                client
                .post('/vtest/testdb/test-validation-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({fieldBool: 'true'})
                .expect(400, done);
            });

            it('should allow setting boolean', function (done) {
                var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

                client
                .post('/vtest/testdb/test-validation-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({fieldBool: true})
                .expect(200, done);
            });

            it('should allow setting a required boolean to `false`', function (done) {

                var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));
                var dirs = config.get('paths');
                var filepath = path.resolve(dirs.collections + '/../validation/collections/vtest/testdb/collection.test-validation-schema.json');

                // add a new field to the schema
                var originaljsSchemaString = fs.readFileSync(filepath, {encoding: 'utf8'});
                var schema = JSON.parse(originaljsSchemaString);

                // add a new field to the existing schema
                schema.fields.fieldBoolRequired = { type: "Boolean", required: true };

                var jsSchemaString = JSON.stringify(schema, null, 4);

                fs.writeFileSync(filepath, jsSchemaString);

                setTimeout(function () {
                    client
                    .post('/vtest/testdb/test-validation-schema')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .send({fieldBoolRequired: false})
                    .expect(200)
                    .end(function(err, res) {

                        // replace the old schema
                        setTimeout(function () {
                            fs.writeFileSync(filepath, originaljsSchemaString);
                            done();
                        }, 100);
                    });
                }, 100);
            });
        });

        describe('mixed', function () {
            it('should allow any type', function (done) {
                var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

                client
                .post('/vtest/testdb/test-validation-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({fieldMixed: true})
                .expect(200)
                .end(function (err, res) {
                    if (err) return done(err);

                    client
                    .post('/vtest/testdb/test-validation-schema')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .send({fieldMixed: 'stringy'})
                    .expect(200)
                    .end(function (err) {
                        if (err) return done(err);

                        client
                        .post('/vtest/testdb/test-validation-schema')
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .send({fieldMixed: 1337})
                        .expect(200)
                        .end(function (err) {
                            if (err) return done(err);

                            client
                            .post('/vtest/testdb/test-validation-schema')
                            .set('Authorization', 'Bearer ' + bearerToken)
                            .send({fieldMixed: { foo: new Date() }})  // foo must be included in the schema document to be validated
                            .expect(200)
                            .end(function (err, res) {
                                if (err) return done(err);

                                client
                                .post('/vtest/testdb/test-validation-schema')
                                .set('Authorization', 'Bearer ' + bearerToken)
                                .send({fieldObject: { "foo": "bar", "baz": "qux" }})
                                .expect(200)
                                .end(function (err, res) {
                                    if (err) return done(err);
                                    done();
                                });
                            });
                        });
                    });
                });
            });
        });

        describe('failure message', function () {
            it('should contain JSON body', function (done) {
                var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

                client
                .post('/vtest/testdb/test-validation-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({fieldBool: 'true'})
                .expect(400)
                .expect('content-type', 'application/json')
                .end(function (err, res) {
                    if (err) return done(err);

                    res.body.should.be.json;
                    res.body.success.should.be.false;
                    res.body.errors[0].field.should.equal('fieldBool');
                    res.body.errors[0].message.should.equal('is wrong type');

                    done();
                });
            });
        });
    });

    describe('field validation', function () {
        it('should allow fields that pass regex', function (done) {
            var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

            client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldRegex: 'qqqqq'})
            .expect(200, done);
        });

        it('should not allow fields that don\'t pass regex', function (done) {
            var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

            client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldRegex: 'qqpqq'})
            .expect(400, done);
        });

        describe('failure message', function () {
            it('should contain JSON body', function (done) {
                var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

                client
                .post('/vtest/testdb/test-validation-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({fieldRegex: 'qqpqq'})
                .expect(400)
                .expect('content-type', 'application/json')
                .end(function (err, res) {
                    if (err) return done(err);

                    res.body.should.be.json;
                    res.body.success.should.be.false;
                    res.body.errors[0].field.should.equal('fieldRegex');
                    res.body.errors[0].message.should.equal('should match the pattern ^q+$');

                    done();
                });
            });
        });
    });

    describe('field validation regex', function () {
        it('should allow fields that pass regex', function (done) {
            var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

            client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldValidationRegex: 'qqqqq'})
            .expect(200, done);
        });

        it('should not allow fields that don\'t pass regex', function (done) {
            var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

            client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldValidationRegex: 'qqpqq'})
            .expect(400, done);
        });

        describe('failure message', function () {
            it('should contain JSON body', function (done) {
                var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

                client
                .post('/vtest/testdb/test-validation-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({fieldValidationRegex: 'qqpqq'})
                .expect(400)
                .expect('content-type', 'application/json')
                .end(function (err, res) {
                    if (err) return done(err);

                    res.body.should.be.json;
                    res.body.success.should.be.false;
                    res.body.errors[0].field.should.equal('fieldValidationRegex');
                    res.body.errors[0].message.should.equal('should match the pattern ^q+$');

                    done();
                });
            });
        });
    });

    describe('field length', function () {

      it('should allow field lengths greater than or equal to `minLength`', function (done) {
          var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

          client
          .post('/vtest/testdb/test-validation-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({fieldMinLength: '1234'})
          .expect(200, done);
      });

      it('should not allow field lengths less than `minLength`', function (done) {
          var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

          client
          .post('/vtest/testdb/test-validation-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({fieldMinLength: '123'})
          .expect(400, done);
      });

      describe('minLength failure message', function () {
          it('should contain JSON body', function (done) {
              var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

              client
              .post('/vtest/testdb/test-validation-schema')
              .set('Authorization', 'Bearer ' + bearerToken)
              .send({fieldMinLength: '123'})
              .expect(400)
              .expect('content-type', 'application/json')
              .end(function (err, res) {
                  if (err) return done(err);

                  res.body.should.be.json;
                  res.body.success.should.be.false;
                  res.body.errors[0].field.should.equal('fieldMinLength');
                  res.body.errors[0].message.should.equal('is too short');

                  done();
              });
          });
      });

        it('should allow field lengths less than or equal to `maxLength`', function (done) {
            var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

            client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldMaxLength: '1234'})
            .expect(200, done);
        });

        it('should not allow field lengths greater than `maxLength`', function (done) {
            var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

            client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldMaxLength: '12345678'})
            .expect(400, done);
        });

        describe('maxLength failure message', function () {
            it('should contain JSON body', function (done) {
                var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

                client
                .post('/vtest/testdb/test-validation-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({fieldMaxLength: '12345678'})
                .expect(400)
                .expect('content-type', 'application/json')
                .end(function (err, res) {
                    if (err) return done(err);

                    res.body.should.be.json;
                    res.body.success.should.be.false;
                    res.body.errors[0].field.should.equal('fieldMaxLength');
                    res.body.errors[0].message.should.equal('is too long');

                    done();
                });
            });
        });
    });

    describe('default value', function () {
        it('should be added to the request object if not supplied', function (done) {
            var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

            client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldString: 'stringy'})
            .expect(200)
            .expect('content-type', 'application/json')
            .end(function (err, res) {
                if (err) return done(err);

                res.body.should.be.json;
                res.body.results.should.be.an.Array;
                res.body.results[0].fieldDefault.should.exist;
                res.body.results[0].fieldDefault.should.eql("FOO!");

                done();
            });
        });

        it('should not be added to the request object if it is already supplied', function (done) {
            var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

            client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldString: 'string', fieldDefault: 'bean'})
            .expect(200)
            .expect('content-type', 'application/json')
            .end(function (err, res) {
                if (err) return done(err);

                res.body.should.be.json;
                res.body.results.should.be.an.Array;
                res.body.results[0].fieldDefault.should.exist;
                res.body.results[0].fieldDefault.should.eql("bean");

                done();
            });
        });

        it('should not be added to the request object if it is Boolean and already supplied', function (done) {
            var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

            client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldString: 'string', fieldDefaultBoolean: false})
            .expect(200)
            .expect('content-type', 'application/json')
            .end(function (err, res) {
                if (err) return done(err);

                res.body.should.be.json;
                res.body.results.should.be.an.Array;
                res.body.results[0].fieldDefaultBoolean.should.exist;
                res.body.results[0].fieldDefaultBoolean.should.eql(false);

                done();
            });
        });
    });
});
