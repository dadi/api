var fs = require('fs');
var should = require('should');
var request = require('supertest');
var config = require(__dirname + '/../../config');
var help = require(__dirname + '/help');
var app = require(__dirname + '/../../bantam/lib/');

var bearerToken; // scoped for all tests

describe('validation', function () {
    before(function (done) {
        app.start({
            collectionPath: __dirname + '/workspace/validation/collections'
        }, function (err) {
            if (err) return done(err);

            help.dropDatabase(function (err) {
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
        help.removeTestClients(function() {
            app.stop(done);
        });
    });

    describe('field types', function () {
        describe('string', function () {
            it('should not allow setting non-string', function (done) {
                var client = request('http://' + config.server.host + ':' + config.server.port);

                client
                .post('/vtest/testdb/test-validation-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({fieldString: 1337})
                .expect(400, done);
            });

            it('should allow setting string', function (done) {
                var client = request('http://' + config.server.host + ':' + config.server.port);

                client
                .post('/vtest/testdb/test-validation-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({fieldString: '1337'})
                .expect(200, done);
            });
        });

        describe('number', function () {
            it('should not allow setting non-number', function (done) {
                var client = request('http://' + config.server.host + ':' + config.server.port);

                client
                .post('/vtest/testdb/test-validation-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({fieldNumber: '123'})
                .expect(400, done);
            });

            it('should allow setting number', function (done) {
                var client = request('http://' + config.server.host + ':' + config.server.port);

                client
                .post('/vtest/testdb/test-validation-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({fieldNumber: 1337})
                .expect(200, done);
            });
        });

        describe('boolean', function () {
            it('should not allow setting non-boolean', function (done) {
                var client = request('http://' + config.server.host + ':' + config.server.port);

                client
                .post('/vtest/testdb/test-validation-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({fieldBool: 'true'})
                .expect(400, done);
            });

            it('should allow setting boolean', function (done) {
                var client = request('http://' + config.server.host + ':' + config.server.port);

                client
                .post('/vtest/testdb/test-validation-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({fieldBool: true})
                .expect(200, done);
            });

            it('should allow setting a required boolean to `false`', function (done) {

                var client = request('http://' + config.server.host + ':' + config.server.port);
                var filepath = __dirname + '/workspace/validation/collections/vtest/testdb/collection.test-validation-schema.json';
                
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
                var client = request('http://' + config.server.host + ':' + config.server.port);

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
                var client = request('http://' + config.server.host + ':' + config.server.port);

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
            var client = request('http://' + config.server.host + ':' + config.server.port);

            client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldRegex: 'qqqqq'})
            .expect(200, done);
        });

        it('should not allow fields that don\'t pass regex', function (done) {
            var client = request('http://' + config.server.host + ':' + config.server.port);

            client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldRegex: 'qqpqq'})
            .expect(400, done);
        });

        describe('failure message', function () {
            it('should contain JSON body', function (done) {
                var client = request('http://' + config.server.host + ':' + config.server.port);

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

    describe('field length', function () {
        it('should allow field lengths less than or equal to `limit`', function (done) {
            var client = request('http://' + config.server.host + ':' + config.server.port);

            client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldLimit: '1234567'})
            .expect(200, done);
        });

        it('should not allow field lengths greater than `limit`', function (done) {
            var client = request('http://' + config.server.host + ':' + config.server.port);

            client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldLimit: '12345678'})
            .expect(400, done);
        });

        describe('failure message', function () {
            it('should contain JSON body', function (done) {
                var client = request('http://' + config.server.host + ':' + config.server.port);

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
            var client = request('http://' + config.server.host + ':' + config.server.port);

            client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldString: 'stringy'})
            .expect(200)
            .expect('content-type', 'application/json')
            .end(function (err, res) {
                if (err) return done(err);

                res.body.should.be.json;
                res.body.should.be.an.Array;
                res.body[0].fieldDefault.should.exist;
                res.body[0].fieldDefault.should.eql("FOO!");

                done();
            });
        });

        it('should not be added to the request object if it is already supplied', function (done) {
            var client = request('http://' + config.server.host + ':' + config.server.port);

            client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldString: 'string', fieldDefault: 'bean'})
            .expect(200)
            .expect('content-type', 'application/json')
            .end(function (err, res) {
                if (err) return done(err);

                res.body.should.be.json;
                res.body.should.be.an.Array;
                res.body[0].fieldDefault.should.exist;
                res.body[0].fieldDefault.should.eql("bean");

                done();
            });
        });
    });
});
