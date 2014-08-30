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
        app.stop(done);
    });

    describe('field types', function () {
        describe('string', function () {
            it('should not allow setting non-string', function (done) {
                var client = request('http://' + config.server.host + ':' + config.server.port);

                client
                .post('/vtest/testdb/test-validation-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({field_string: 1337})
                .expect(400, done);
            });

            it('should allow setting string', function (done) {
                var client = request('http://' + config.server.host + ':' + config.server.port);

                client
                .post('/vtest/testdb/test-validation-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({field_string: '1337'})
                .expect(200, done);
            });
        });

        describe('number', function () {
            it('should not allow setting non-number', function (done) {
                var client = request('http://' + config.server.host + ':' + config.server.port);

                client
                .post('/vtest/testdb/test-validation-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({field_number: '123'})
                .expect(400, done);
            });

            it('should allow setting number', function (done) {
                var client = request('http://' + config.server.host + ':' + config.server.port);

                client
                .post('/vtest/testdb/test-validation-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({field_number: 1337})
                .expect(200, done);
            });
        });

        describe('boolean', function () {
            it('should not allow setting non-boolean', function (done) {
                var client = request('http://' + config.server.host + ':' + config.server.port);

                client
                .post('/vtest/testdb/test-validation-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({field_bool: 'true'})
                .expect(400, done);
            });

            it('should allow setting boolean', function (done) {
                var client = request('http://' + config.server.host + ':' + config.server.port);

                client
                .post('/vtest/testdb/test-validation-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({field_bool: true})
                .expect(200, done);
            });
        });

        describe('mixed', function () {
            it('should allow any type', function (done) {
                var client = request('http://' + config.server.host + ':' + config.server.port);

                client
                .post('/vtest/testdb/test-validation-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({field_mixed: true})
                .expect(200)
                .end(function (err, res) {
                    if (err) return done(err);

                    client
                    .post('/vtest/testdb/test-validation-schema')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .send({field_mixed: 'stringy'})
                    .expect(200)
                    .end(function (err) {
                        if (err) return done(err);

                        client
                        .post('/vtest/testdb/test-validation-schema')
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .send({field_mixed: 1337})
                        .expect(200)
                        .end(function (err) {
                            if (err) return done(err);

                            client
                            .post('/vtest/testdb/test-validation-schema')
                            .set('Authorization', 'Bearer ' + bearerToken)
                            .send({field_mixed: { foo: new Date() }})
                            .expect(200, done);
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
                .send({field_bool: 'true'})
                .expect(400)
                .expect('content-type', 'application/json')
                .end(function (err, res) {
                    if (err) return done(err);

                    res.body.should.be.json;
                    res.body.success.should.be.false;
                    res.body.errors[0].field.should.equal('field_bool');
                    res.body.errors[0].message.should.equal('is wrong type');

                    done();
                });
            });
        });
    });

    describe('field validation_rule', function () {
        it('should allow fields that pass regex', function (done) {
            var client = request('http://' + config.server.host + ':' + config.server.port);

            client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({field_regex: 'qqqqq'})
            .expect(200, done);
        });

        it('should not allow fields that don\'t pass regex', function (done) {
            var client = request('http://' + config.server.host + ':' + config.server.port);

            client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({field_regex: 'qqpqq'})
            .expect(400, done);
        });

        describe('failure message', function () {
            it('should contain JSON body', function (done) {
                var client = request('http://' + config.server.host + ':' + config.server.port);

                client
                .post('/vtest/testdb/test-validation-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({field_regex: 'qqpqq'})
                .expect(400)
                .expect('content-type', 'application/json')
                .end(function (err, res) {
                    if (err) return done(err);

                    res.body.should.be.json;
                    res.body.success.should.be.false;
                    res.body.errors[0].field.should.equal('field_regex');
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
            .send({field_limit: '1234567'})
            .expect(200, done);
        });

        it('should not allow field lengths greater than `limit`', function (done) {
            var client = request('http://' + config.server.host + ':' + config.server.port);

            client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({field_limit: '12345678'})
            .expect(400, done);
        });

        describe('failure message', function () {
            it('should contain JSON body', function (done) {
                var client = request('http://' + config.server.host + ':' + config.server.port);

                client
                .post('/vtest/testdb/test-validation-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({field_limit: '12345678'})
                .expect(400)
                .expect('content-type', 'application/json')
                .end(function (err, res) {
                    if (err) return done(err);

                    res.body.should.be.json;
                    res.body.success.should.be.false;
                    res.body.errors[0].field.should.equal('field_limit');
                    res.body.errors[0].message.should.equal('is too long');

                    done();
                });
            });
        });
    });
});
