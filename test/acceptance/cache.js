var should = require('should');
var request = require('supertest');
var sinon = require('sinon');
var config = require(__dirname + '/../../config');
var fs = require('fs');
var path = require('path');
var app = require(__dirname + '/../../bantam/lib/');
var help = require(__dirname + '/help');

var bearerToken;
describe('Cache', function (done) {
    before(function (done) {
        app.start({
            collectionPath: __dirname + '/workspace/collections'
        }, done);
    });

    after(function (done) {
        help.clearCache();
        app.stop(done);
    });

    beforeEach(function (done) {
        help.dropDatabase(function (err) {
            if (err) return done(err);

            help.getBearerToken(function (err, token) {
                if (err) return done(err);

                bearerToken = token;

                help.clearCache();

                done();
            });
        });
    });

    it('should save responses to the file system', function (done) {
        var spy = sinon.spy(fs, 'writeFile');

        request('http://' + config.server.host + ':' + config.server.port)
        .get('/vtest/testdb/test-schema')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .end(function (err, res) {
            if (err) return done(err);

            spy.called.should.be.true;
            var args = spy.getCall(0).args;

            args[1].should.equal(res.text);

            spy.restore();
            done();
        });
    });

    it('should use cache if available', function (done) {
        var spy = sinon.spy(fs, 'readFile');

        var client = request('http://' + config.server.host + ':' + config.server.port);

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

                    res2.text.should.equal(res1.text);
                    spy.called.should.be.true;

                    spy.restore();
                    done();
                });
            });
        });
    });

    it('should allow bypassing cache with query string flag', function (done) {
        var spy = sinon.spy(fs, 'readFile');

        var client = request('http://' + config.server.host + ':' + config.server.port);

        client
        .get('/vtest/testdb/test-schema')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .end(function (err, res1) {
            if (err) return done(err);

            res1.body.length.should.equal(0);

            client
            .post('/vtest/testdb/test-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({field1: 'foo!'})
            .expect(200)
            .end(function (err, res) {
                if (err) return done(err);

                client
                .get('/vtest/testdb/test-schema?cache=false')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .end(function (err, res2) {
                    if (err) return done(err);


                    res2.body.length.should.equal(1);
                    spy.called.should.be.false;

                    spy.restore();
                    done();
                });
            });
        });
    });

    it('should allow disabling through config', function (done) {
        config.caching.enabled = false;

        var _done = done;
        done = function (err) {
            config.caching.enabled = true;
            _done(err);
        };

        var spy = sinon.spy(fs, 'readFile');

        var client = request('http://' + config.server.host + ':' + config.server.port);

        client
        .get('/vtest/testdb/test-schema')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .end(function (err, res1) {
            if (err) return done(err);

            res1.body.length.should.equal(0);

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


                    res2.body.length.should.equal(1);
                    spy.called.should.be.false;

                    spy.restore();
                    done();
                });
            });
        });
    });

    it('should invalidate based on TTL', function (done) {
        this.timeout(4000);

        var oldTTL = config.caching.ttl;
        config.caching.ttl = 1;

        var _done = done;
        done = function (err) {
            config.caching.ttl = oldTTL;
            _done(err);
        };

        var client = request('http://' + config.server.host + ':' + config.server.port);

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

                        res1.body.length.should.equal(0);
                        res2.body.length.should.equal(1);
                        res2.text.should.not.equal(res1.text);

                        done();
                    });
                }, 2000);
            });
        });
    });

    // it('should preserve content-type', function (done) {
    //     var client = request('http://' + config.server.host + ':' + config.server.port);

    //     client
    //     .get('/vtest/testdb/test-schema?callback=myCallback')
    //     .set('Authorization', 'Bearer ' + bearerToken)
    //     .expect(200)
    //     .expect('content-type', 'text/javascript')
    //     .end(function (err, res1) {
    //         if (err) return done(err);

    //         client
    //         .post('/vtest/testdb/test-schema')
    //         .set('Authorization', 'Bearer ' + bearerToken)
    //         .send({field1: 'foo!'})
    //         .expect(200)
    //         .end(function (err, res) {
    //             if (err) return done(err);

    //             client
    //             .get('/vtest/testdb/test-schema?callback=myCallback')
    //             .set('Authorization', 'Bearer ' + bearerToken)
    //             .expect(200)
    //             .expect('content-type', 'text/javascript')
    //             .end(function (err, res2) {
    //                 if (err) return done(err);

    //                 res2.text.should.equal(res1.text);
    //                 done();
    //             });
    //         });
    //     });
    // });
});
