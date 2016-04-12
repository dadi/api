var fs = require('fs');
var path = require('path');
var should = require('should');
var request = require('supertest');
var _ = require('underscore');
var needle = require('needle');
var url = require('url');
var config = require(__dirname + '/../../config');
var help = require(__dirname + '/help');
var app = require(__dirname + '/../../dadi/lib/');

var bearerToken; // scoped for all tests
var dirs = config.get('paths');
var newSchemaPath = path.resolve(dirs.collections + '/vtest/testdb/collection.test-validation-schema.json');

describe('validation', function () {
    describe('general request', function () {
        before(function (done) {
            config.set('server.http2.enabled', false);
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

            // describe('date', function () {
            //     it('should not allow setting non-date', function (done) {
            //         var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

            //         client
            //         .post('/vtest/testdb/test-validation-schema')
            //         .set('Authorization', 'Bearer ' + bearerToken)
            //         .send({fieldDate: 1337})
            //         .expect(400, done);
            //     });

            //     it('should allow setting date', function (done) {
            //         var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

            //         client
            //         .post('/vtest/testdb/test-validation-schema')
            //         .set('Authorization', 'Bearer ' + bearerToken)
            //         .send({fieldDate: "2013/12/08"})
            //         .expect(200, done);
            //     });
            // });

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

        describe('field validationRule', function () {
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
                        res.body.errors[0].message.should.equal('is invalid');

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
                .send({fieldLimit: '1234'})
                .expect(200, done);
            });

            it('should not allow field lengths greater than `maxLength`', function (done) {
                var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

                client
                .post('/vtest/testdb/test-validation-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({fieldLimit: '12345678'})
                .expect(400, done);
            });

            describe('maxLength failure message', function () {
                it('should contain JSON body', function (done) {
                    var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

                    client
                    .post('/vtest/testdb/test-validation-schema')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .send({fieldLimit: '12345678'})
                    .expect(400)
                    .expect('content-type', 'application/json')
                    .end(function (err, res) {
                        if (err) return done(err);

                        res.body.should.be.json;
                        res.body.success.should.be.false;
                        res.body.errors[0].field.should.equal('fieldLimit');
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
    
    describe('HTTP2 request', function () {
        before(function (done) {
            config.set('server.http2.enabled', true);
            var newSchema = JSON.parse(JSON.stringify(require(path.resolve(dirs.collections + '/../validation/collections/vtest/testdb/collection.test-validation-schema.json'))));
            fs.writeFileSync(newSchemaPath, JSON.stringify(newSchema));

            app.start(function (err) {
                if (err) return done(err);

                help.dropDatabase('testdb', function (err) {
                    if (err) return done(err);

                    help.getBearerTokenHttps(function (err, token) {
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
                    var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-validation-schema';
                    var options = url.parse(doc_link);
                    options.key = fs.readFileSync(config.get('server.http2.key_path'));
                    options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                    options.headers = {
                        'Authorization': 'Bearer ' + bearerToken
                    };
                    needle.post(doc_link, {fieldString: 1337}, options, function(err, res) {
                        if (err) return done(err);
                        should(res.statusCode).be.equal(400);
                        done();
                    });
                });

                it('should allow setting string', function (done) {
                    var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-validation-schema';
                    var options = url.parse(doc_link);
                    options.key = fs.readFileSync(config.get('server.http2.key_path'));
                    options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                    options.headers = {
                        'Authorization': 'Bearer ' + bearerToken
                    };
                    needle.post(doc_link, {fieldString: '1337'}, options, function(err, res) {
                        if (err) return done(err);
                        should(res.statusCode).be.equal(200);
                        done();
                    });
                });
            });

            describe('number', function () {
                it('should not allow setting non-number', function (done) {
                    var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-validation-schema';
                    var options = url.parse(doc_link);
                    options.key = fs.readFileSync(config.get('server.http2.key_path'));
                    options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                    options.headers = {
                        'Authorization': 'Bearer ' + bearerToken
                    };
                    needle.post(doc_link, {fieldNumber: '123'}, options, function(err, res) {
                        if (err) return done(err);
                        should(res.statusCode).be.equal(400);
                        done();
                    });
                });

                it('should allow setting number', function (done) {
                    var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-validation-schema';
                    var options = url.parse(doc_link);
                    options.key = fs.readFileSync(config.get('server.http2.key_path'));
                    options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                    options.headers = {
                        'Authorization': 'Bearer ' + bearerToken
                    };
                    needle.post(doc_link, {fieldNumber: 1337}, options, function(err, res) {
                        if (err) return done(err);
                        should(res.statusCode).be.equal(200);
                        done();
                    });
                });
            });

            describe('boolean', function () {
                it('should not allow setting non-boolean', function (done) {
                    var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-validation-schema';
                    var options = url.parse(doc_link);
                    options.key = fs.readFileSync(config.get('server.http2.key_path'));
                    options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                    options.headers = {
                        'Authorization': 'Bearer ' + bearerToken
                    };
                    needle.post(doc_link, {fieldBool: 'true'}, options, function(err, res) {
                        if (err) return done(err);
                        should(res.statusCode).be.equal(400);
                        done();
                    });
                });

                it('should allow setting boolean', function (done) {
                    var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-validation-schema';
                    var options = url.parse(doc_link);
                    options.key = fs.readFileSync(config.get('server.http2.key_path'));
                    options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                    options.headers = {
                        'Authorization': 'Bearer ' + bearerToken
                    };
                    needle.post(doc_link, {fieldBool: true}, options, function(err, res) {
                        if (err) return done(err);
                        should(res.statusCode).be.equal(200);
                        done();
                    });
                });

                it('should allow setting a required boolean to `false`', function (done) {

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
                        var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-validation-schema';
                        var options = url.parse(doc_link);
                        options.key = fs.readFileSync(config.get('server.http2.key_path'));
                        options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                        options.headers = {
                            'Authorization': 'Bearer ' + bearerToken
                        };
                        needle.post(doc_link, {fieldBoolRequired: false}, options, function(err, res) {
                            if (err) return done(err);
                            should(res.statusCode).be.equal(200);
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
                    var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-validation-schema';
                    var options = url.parse(doc_link);
                    options.key = fs.readFileSync(config.get('server.http2.key_path'));
                    options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                    options.headers = {
                        'Authorization': 'Bearer ' + bearerToken
                    };
                    needle.post(doc_link, {fieldMixed: true}, options, function(err, res) {
                        if (err) return done(err);
                        should(res.statusCode).be.equal(200);
                        needle.post(doc_link, {fieldMixed: 'stringy'}, options, function(err, res) {
                            if (err) return done(err);
                            should(res.statusCode).be.equal(200);
                            needle.post(doc_link, {fieldMixed: 1337}, options, function(err, res) {
                                if (err) return done(err);
                                should(res.statusCode).be.equal(200);
                                options.json = true;
                                needle.post(doc_link, {fieldMixed: { foo: new Date() }}, options, function(err, res) {
                                    if (err) return done(err);
                                    should(res.statusCode).be.equal(200);
                                    needle.post(doc_link, {fieldObject: { "foo": "bar", "baz": "qux" }}, options, function(err, res) {
                                        if (err) return done(err);
                                        should(res.statusCode).be.equal(200);
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
                    var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-validation-schema';
                    var options = url.parse(doc_link);
                    options.key = fs.readFileSync(config.get('server.http2.key_path'));
                    options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                    options.headers = {
                        'Authorization': 'Bearer ' + bearerToken
                    };
                    needle.post(doc_link, {fieldBool: 'true'}, options, function(err, res) {
                        if (err) return done(err);
                        should(res.statusCode).be.equal(400);
                        should(res.headers['content-type']).be.match(/json/);
                        res.body.should.be.json;
                        res.body.success.should.be.false;
                        res.body.errors[0].field.should.equal('fieldBool');
                        res.body.errors[0].message.should.equal('is wrong type');

                        done();
                    });
                });
            });
        });

        describe('field validationRule', function () {
            it('should allow fields that pass regex', function (done) {
                var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-validation-schema';
                var options = url.parse(doc_link);
                options.key = fs.readFileSync(config.get('server.http2.key_path'));
                options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                options.headers = {
                    'Authorization': 'Bearer ' + bearerToken
                };
                needle.post(doc_link, {fieldRegex: 'qqqqq'}, options, function(err, res) {
                    if (err) return done(err);
                    should(res.statusCode).be.equal(200);
                    done();
                });
            });

            it('should not allow fields that don\'t pass regex', function (done) {
                var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-validation-schema';
                var options = url.parse(doc_link);
                options.key = fs.readFileSync(config.get('server.http2.key_path'));
                options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                options.headers = {
                    'Authorization': 'Bearer ' + bearerToken
                };
                needle.post(doc_link, {fieldRegex: 'qqpqq'}, options, function(err, res) {
                    if (err) return done(err);
                    should(res.statusCode).be.equal(400);
                    done();
                });
            });

            describe('failure message', function () {
                it('should contain JSON body', function (done) {
                    var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-validation-schema';
                    var options = url.parse(doc_link);
                    options.key = fs.readFileSync(config.get('server.http2.key_path'));
                    options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                    options.headers = {
                        'Authorization': 'Bearer ' + bearerToken
                    };
                    needle.post(doc_link, {fieldRegex: 'qqpqq'}, options, function(err, res) {
                        if (err) return done(err);
                        should(res.statusCode).be.equal(400);
                        should(res.headers['content-type']).be.match(/json/);
                        res.body.should.be.json;
                        res.body.success.should.be.false;
                        res.body.errors[0].field.should.equal('fieldRegex');
                        res.body.errors[0].message.should.equal('is invalid');

                        done();
                    });
                });
            });
        });

        describe('field validation regex', function () {
            it('should allow fields that pass regex', function (done) {
                var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-validation-schema';
                var options = url.parse(doc_link);
                options.key = fs.readFileSync(config.get('server.http2.key_path'));
                options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                options.headers = {
                    'Authorization': 'Bearer ' + bearerToken
                };
                needle.post(doc_link, {fieldValidationRegex: 'qqqqq'}, options, function(err, res) {
                    if (err) return done(err);
                    should(res.statusCode).be.equal(200);
                    done();
                });
            });

            it('should not allow fields that don\'t pass regex', function (done) {
                var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-validation-schema';
                var options = url.parse(doc_link);
                options.key = fs.readFileSync(config.get('server.http2.key_path'));
                options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                options.headers = {
                    'Authorization': 'Bearer ' + bearerToken
                };
                needle.post(doc_link, {fieldValidationRegex: 'qqpqq'}, options, function(err, res) {
                    if (err) return done(err);
                    should(res.statusCode).be.equal(400);
                    done();
                });
            });

            describe('failure message', function () {
                it('should contain JSON body', function (done) {
                    var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-validation-schema';
                    var options = url.parse(doc_link);
                    options.key = fs.readFileSync(config.get('server.http2.key_path'));
                    options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                    options.headers = {
                        'Authorization': 'Bearer ' + bearerToken
                    };
                    needle.post(doc_link, {fieldValidationRegex: 'qqpqq'}, options, function(err, res) {
                        if (err) return done(err);
                        should(res.statusCode).be.equal(400);
                        should(res.headers['content-type']).be.match(/json/);
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
                var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-validation-schema';
                var options = url.parse(doc_link);
                options.key = fs.readFileSync(config.get('server.http2.key_path'));
                options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                options.headers = {
                    'Authorization': 'Bearer ' + bearerToken
                };
                needle.post(doc_link, {fieldMinLength: '1234'}, options, function(err, res) {
                    if (err) return done(err);
                    should(res.statusCode).be.equal(200);
                    done();
                });
            });

            it('should not allow field lengths less than `minLength`', function (done) {
                var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-validation-schema';
                var options = url.parse(doc_link);
                options.key = fs.readFileSync(config.get('server.http2.key_path'));
                options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                options.headers = {
                    'Authorization': 'Bearer ' + bearerToken
                };
                needle.post(doc_link, {fieldMinLength: '123'}, options, function(err, res) {
                    if (err) return done(err);
                    should(res.statusCode).be.equal(400);
                    done();
                });
            });

            describe('minLength failure message', function () {
                it('should contain JSON body', function (done) {
                var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-validation-schema';
                var options = url.parse(doc_link);
                options.key = fs.readFileSync(config.get('server.http2.key_path'));
                options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                options.headers = {
                    'Authorization': 'Bearer ' + bearerToken
                };
                needle.post(doc_link, {fieldMinLength: '123'}, options, function(err, res) {
                    if (err) return done(err);
                    should(res.statusCode).be.equal(400);
                    should(res.headers['content-type']).be.match(/json/);
                    res.body.should.be.json;
                    res.body.success.should.be.false;
                    res.body.errors[0].field.should.equal('fieldMinLength');
                    res.body.errors[0].message.should.equal('is too short');
                    done();
                  });
                });
            });

            it('should allow field lengths less than or equal to `maxLength`', function (done) {
                var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-validation-schema';
                var options = url.parse(doc_link);
                options.key = fs.readFileSync(config.get('server.http2.key_path'));
                options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                options.headers = {
                    'Authorization': 'Bearer ' + bearerToken
                };
                needle.post(doc_link, {fieldLimit: '1234'}, options, function(err, res) {
                    if (err) return done(err);
                    should(res.statusCode).be.equal(200);
                    done();
                });
            });

            it('should not allow field lengths greater than `maxLength`', function (done) {
                var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-validation-schema';
                var options = url.parse(doc_link);
                options.key = fs.readFileSync(config.get('server.http2.key_path'));
                options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                options.headers = {
                    'Authorization': 'Bearer ' + bearerToken
                };
                needle.post(doc_link, {fieldLimit: '12345678'}, options, function(err, res) {
                    if (err) return done(err);
                    should(res.statusCode).be.equal(400);
                    done();
                });
            });

            describe('maxLength failure message', function () {
                it('should contain JSON body', function (done) {
                    var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-validation-schema';
                    var options = url.parse(doc_link);
                    options.key = fs.readFileSync(config.get('server.http2.key_path'));
                    options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                    options.headers = {
                        'Authorization': 'Bearer ' + bearerToken
                    };
                    needle.post(doc_link, {fieldLimit: '12345678'}, options, function(err, res) {
                        if (err) return done(err);
                        should(res.statusCode).be.equal(400);
                        should(res.headers['content-type']).be.match(/json/);
                        res.body.should.be.json;
                        res.body.success.should.be.false;
                        res.body.errors[0].field.should.equal('fieldLimit');
                        res.body.errors[0].message.should.equal('is too long');

                        done();
                    });
                });
            });
        });

        describe('default value', function () {
            it('should be added to the request object if not supplied', function (done) {
                var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-validation-schema';
                var options = url.parse(doc_link);
                options.key = fs.readFileSync(config.get('server.http2.key_path'));
                options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                options.headers = {
                    'Authorization': 'Bearer ' + bearerToken
                };
                needle.post(doc_link, {fieldString: 'stringy'}, options, function(err, res) {
                    if (err) return done(err);
                    should(res.statusCode).be.equal(200);
                    should(res.headers['content-type']).be.match(/json/);
                    res.body.should.be.json;
                    res.body.results.should.be.an.Array;
                    res.body.results[0].fieldDefault.should.exist;
                    res.body.results[0].fieldDefault.should.eql("FOO!");

                    done();
                });
            });

            it('should not be added to the request object if it is already supplied', function (done) {
                var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-validation-schema';
                var options = url.parse(doc_link);
                options.key = fs.readFileSync(config.get('server.http2.key_path'));
                options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                options.headers = {
                    'Authorization': 'Bearer ' + bearerToken
                };
                needle.post(doc_link, {fieldString: 'string', fieldDefault: 'bean'}, options, function(err, res) {
                    if (err) return done(err);
                    should(res.statusCode).be.equal(200);
                    should(res.headers['content-type']).be.match(/json/);
                    res.body.should.be.json;
                    res.body.results.should.be.an.Array;
                    res.body.results[0].fieldDefault.should.exist;
                    res.body.results[0].fieldDefault.should.eql("bean");

                    done();
                });
            });

            it('should not be added to the request object if it is Boolean and already supplied', function (done) {
                var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-validation-schema';
                var options = url.parse(doc_link);
                options.key = fs.readFileSync(config.get('server.http2.key_path'));
                options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                options.headers = {
                    'Authorization': 'Bearer ' + bearerToken
                };
                needle.post(doc_link, {fieldString: 'string', fieldDefaultBoolean: false}, options, function(err, res) {
                    if (err) return done(err);
                    should(res.statusCode).be.equal(200);
                    should(res.headers['content-type']).be.match(/json/);
                    res.body.should.be.json;
                    res.body.results.should.be.an.Array;
                    res.body.results[0].fieldDefaultBoolean.should.exist;
                    res.body.results[0].fieldDefaultBoolean.should.eql(false);

                    done();
                });
            });
        });
    });
});
