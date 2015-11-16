var should = require('should');
var request = require('supertest');
var sinon = require('sinon');
var config = require(__dirname + '/../../config');
var fs = require('fs');
var _ = require('underscore');
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
        help.removeTestClients(function() {
            help.clearCache();
            app.stop(done);
        });
    });

    beforeEach(function (done) {
        help.dropDatabase('testdb', function (err) {
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

        request('http://' + config.get('server.host') + ':' + config.get('server.port'))
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
                        done();
                    });
                });
            });
        });
    });

    it('should allow bypassing cache with query string flag', function (done) {
        var spy = sinon.spy(fs, 'readFile');

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
                .get('/vtest/testdb/test-schema?cache=false')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .end(function (err, res2) {
                    if (err) return done(err);


                    res2.body['results'].length.should.equal(1);
                    spy.called.should.be.false;

                    spy.restore();
                    done();
                });
            });
        });
    });

    it('should allow disabling through config', function (done) {

        config.set('caching.enabled', false);

        var _done = done;
        done = function (err) {
            config.set('caching.enabled', true);
            _done(err);
        };

        var spy = sinon.spy(fs, 'readFile');

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
                    spy.called.should.be.false;

                    spy.restore();
                    done();
                });
            });
        });
    });

    it('should invalidate based on TTL', function (done) {
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
                }, 2000);
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

    it('should flush on POST update request', function (done) {
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
                                .post('/vtest/testdb/test-schema/' + id)
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
                            }, 1000);
                        });
                    });
                });
            });
        });
    });

    // it('should flush on DELETE request', function (done) {
    // this.timeout(4000);
    //     help.createDoc(bearerToken, function (err, doc) {
    //         if (err) return done(err);
    //
    //         help.createDoc(bearerToken, function (err, doc) {
    //             if (err) return done(err);
    //
    //             var client = request('http://' + config.server.host + ':' + config.server.port);
    //
    //             // GET
    //             client
    //             .get('/vtest/testdb/test-schema')
    //             .set('Authorization', 'Bearer ' + bearerToken)
    //             .expect(200)
    //             .end(function (err, getRes1) {
    //                 if (err) return done(err);
    //
    //                 // CREATE
    //                 client
    //                 .post('/vtest/testdb/test-schema')
    //                 .set('Authorization', 'Bearer ' + bearerToken)
    //                 .send({field1: 'foo!'})
    //                 .expect(200)
    //                 .end(function (err, postRes1) {
    //                     if (err) return done(err);
    //
    //                     // save id for deleting
    //                     var id = postRes1.body[0]._id;
    //
    //                     // GET AGAIN - should cache new results
    //                     client
    //                     .get('/vtest/testdb/test-schema')
    //                     .set('Authorization', 'Bearer ' + bearerToken)
    //                     .expect(200)
    //                     .end(function (err, getRes2) {
    //                         if (err) return done(err);
    //
    //                         setTimeout(function () {
    //
    //                             // DELETE
    //                             client
    //                             .delete('/vtest/testdb/test-schema/' + id)
    //                             .set('Authorization', 'Bearer ' + bearerToken)
    //                             .expect(204)
    //                             .end(function (err, postRes2) {
    //                                 if (err) return done(err);
    //
    //                                 // WAIT, then GET again
    //                                 setTimeout(function () {
    //
    //                                     client
    //                                     .get('/vtest/testdb/test-schema')
    //                                     .set('Authorization', 'Bearer ' + bearerToken)
    //                                     .expect(200)
    //                                     .end(function (err, getRes3) {
    //                                         if (err) return done(err);
    //
    //                                         var result = _.findWhere(getRes3.body.results, { "_id": id });
    //
    //                                         should.not.exist(result);
    //
    //                                         done();
    //                                     });
    //                                 }, 300);
    //                             });
    //                         }, 1000);
    //                     });
    //                 });
    //             });
    //         });
    //     });
    // });

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
