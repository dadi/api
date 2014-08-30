var should = require('should');
var request = require('supertest');
var EventEmitter = require('events').EventEmitter;
var connection = require(__dirname + '/../../bantam/lib/model/connection');
var config = require(__dirname + '/../../config');
var help = require(__dirname + '/help');
var app = require(__dirname + '/../../bantam/lib/');

var bearerToken; // used throughout tests

describe('Application', function () {
    it('should start from specific directory', function (done) {
        app.start({
            collectionPath: __dirname + '/workspace/collections'
        }, function (err) {
            if (err) return done(err);

            // give it a moment for http.Server to finish starting
            setTimeout(function () {
                app.stop(done);
            }, 200);
        });
    });

    it('should start a server', function (done) {
        app.start({
            collectionPath: __dirname + '/workspace/collections'
        }, function (err) {
            if (err) return done(err);

            var client = request('http://' + config.server.host + ':' + config.server.port);
            client
            .get('/')

            // just need to test that we get some kind of response
            .expect(401)
            .end(function (err) {
                if (err) done = done.bind(this, err);
                app.stop(done);
            });
        });
    });

    describe('collections api', function () {
        before(function (done) {
            app.start({
                collectionPath: __dirname + '/workspace/collections'
            }, done);
        });

        after(function (done) {
            app.stop(done);
        });

        describe('POST', function () {
            before(function (done) {
                help.dropDatabase(function (err) {
                    if (err) return done(err);

                    help.getBearerToken(function (err, token) {
                        if (err) return done(err);

                        bearerToken = token;

                        done();
                    });
                });
            });

            it('should create new documents', function (done) {
                var client = request('http://' + config.server.host + ':' + config.server.port);
                client
                .post('/vtest/testdb/test-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({field_1: 'foo!'})
                .expect(200)
                .end(function (err, res) {
                    if (err) return done(err);

                    should.exist(res.body);

                    res.body.should.be.Array;
                    res.body.length.should.equal(1);
                    should.exist(res.body[0]._id);
                    res.body[0].field_1.should.equal('foo!');
                    done();
                });
            });

            it('should add internal fields to new documents', function (done) {
                var client = request('http://' + config.server.host + ':' + config.server.port);
                client
                .post('/vtest/testdb/test-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({field_1: 'foo!'})
                .expect(200)
                .end(function (err, res) {
                    if (err) return done(err);

                    should.exist(res.body);

                    res.body.should.be.Array;
                    res.body.length.should.equal(1);
                    res.body[0].created_by.should.equal('test123');
                    res.body[0].created_at.should.be.Number;
                    res.body[0].created_at.should.not.be.above(Date.now());
                    res.body[0].api_version.should.equal('vtest');
                    done();
                });
            });

            it('should update existing documents', function (done) {
                var client = request('http://' + config.server.host + ':' + config.server.port);

                client
                .post('/vtest/testdb/test-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({field_1: 'doc to update'})
                .expect(200)
                .end(function (err, res) {
                    if (err) return done(err);

                    var doc = res.body[0];
                    should.exist(doc);
                    doc.field_1.should.equal('doc to update');

                    client
                    .post('/vtest/testdb/test-schema/' + doc._id)
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .send({field_1: 'updated doc'})
                    .expect(200)
                    .end(function (err, res) {
                        if (err) return done(err);

                        res.body._id.should.equal(doc._id);
                        res.body.field_1.should.equal('updated doc');

                        client
                        .get('/vtest/testdb/test-schema?filter={"_id": "' + doc._id + '"}')
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .expect(200)
                        .expect('content-type', 'application/json')
                        .end(function (err, res) {
                            if (err) return done(err);

                            res.body.should.be.Array;
                            res.body.length.should.equal(1);
                            res.body[0].field_1.should.equal('updated doc');

                            done();
                        })
                    });
                });
            });

            it('should add internal fields to updated documents', function (done) {
                var client = request('http://' + config.server.host + ':' + config.server.port);

                client
                .post('/vtest/testdb/test-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({field_1: 'doc to update'})
                .expect(200)
                .end(function (err, res) {
                    if (err) return done(err);

                    var doc = res.body[0];
                    should.exist(doc);
                    doc.field_1.should.equal('doc to update');

                    client
                    .post('/vtest/testdb/test-schema/' + doc._id)
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .send({field_1: 'updated doc'})
                    .expect(200)
                    .end(function (err, res) {
                        if (err) return done(err);

                        res.body._id.should.equal(doc._id);
                        res.body.field_1.should.equal('updated doc');

                        client
                        .get('/vtest/testdb/test-schema?filter={"_id": "' + doc._id + '"}')
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .expect(200)
                        .expect('content-type', 'application/json')
                        .end(function (err, res) {
                            if (err) return done(err);

                            res.body.should.be.Array;
                            res.body.length.should.equal(1);
                            res.body[0].last_modified_by.should.equal('test123');
                            res.body[0].last_modified_at.should.be.Number;
                            res.body[0].last_modified_at.should.not.be.above(Date.now());
                            res.body[0].api_version.should.equal('vtest');

                            done();
                        })
                    });
                });
            });
        });

        describe('GET', function () {
            before(function (done) {
                help.dropDatabase(function (err) {
                    if (err) return done(err);

                    help.getBearerToken(function (err, token) {
                        if (err) return done(err);

                        bearerToken = token;

                        done();
                    });
                });
            });

            it('should get documents', function (done) {
               help.createDoc(bearerToken, function (err) {
                    if (err) return done(err);

                    var client = request('http://' + config.server.host + ':' + config.server.port);

                    client
                    .get('/vtest/testdb/test-schema')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .expect('content-type', 'application/json')
                    .end(function (err, res) {
                        if (err) return done(err);

                        res.body.should.be.Array;
                        res.body.length.should.be.above(0)
                        done();
                    });
                });
            });

            it('should find specific documents', function (done) {
               help.createDoc(bearerToken, function (err, doc1) {
                    if (err) return done(err);
                   help.createDoc(bearerToken, function (err, doc2) {
                        if (err) return done(err);

                        var client = request('http://' + config.server.host + ':' + config.server.port);
                        var docId = doc2._id
                        var query = {
                            _id: doc2._id
                        };

                        query = encodeURIComponent(JSON.stringify(query));
                        client
                        .get('/vtest/testdb/test-schema?filter=' + query)
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .expect(200)
                        .expect('content-type', 'application/json')
                        .end(function (err, res) {
                            if (err) return done(err);

                            res.body.should.be.Array;
                            res.body.length.should.equal(1);
                            res.body[0]._id.should.equal(docId);
                            done();
                        });
                    });
                });
            });

            describe('query string params', function () {
                before(function (done) {
                    // create a bunch of docs
                    var asyncControl = new EventEmitter();
                    var count = 0;

                    for (var i = 0; i < 100; ++i) {
                       help.createDoc(bearerToken, function (err) {
                            if (err) return asyncControl.emit('error', err);
                            count += 1;
                            if (count > 99) asyncControl.emit('ready');
                        });
                    }

                    asyncControl.on('ready', function () {
                        // documents are loaded and tests can start
                        done();
                    });

                    asyncControl.on('error', function (err) { throw err; });
                });

                it('should paginate results', function (done) {
                    var client = request('http://' + config.server.host + ':' + config.server.port);
                    var docCount = 20;

                    client
                    .get('/vtest/testdb/test-schema?page=1&count=' + docCount)
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .expect('content-type', 'application/json')
                    .end(function (err, res) {
                        if (err) return done(err);

                        res.body.should.be.Array;
                        res.body.length.should.equal(docCount);
                        done();
                    });
                });

                it('should use schema defaults if not provided', function (done) {
                    var client = request('http://' + config.server.host + ':' + config.server.port);

                    client
                    .get('/vtest/testdb/test-schema?cache=false') // make sure not hitting cache
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .expect('content-type', 'application/json')
                    .end(function (err, res) {
                        if (err) return done(err);

                        res.body.should.be.Array;
                        res.body.length.should.equal(40);
                        done();
                    });
                });

                it('should show later pages', function (done) {
                    var client = request('http://' + config.server.host + ':' + config.server.port);

                    client
                    .get('/vtest/testdb/test-schema?count=20&page=1')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .expect('content-type', 'application/json')
                    .end(function (err, res) {
                        if (err) return done(err);

                        res.body.should.be.Array;
                        res.body.length.should.equal(20);

                        var eleventhDoc = res.body[10];

                        client
                        .get('/vtest/testdb/test-schema?count=10&page=2')
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .expect(200)
                        .expect('content-type', 'application/json')
                        .end(function (err, res) {
                            if (err) return done(err);

                            res.body.should.be.Array;
                            res.body.length.should.equal(10);

                            // make sure second page starts in correct position
                            res.body[0]._id.should.equal(eleventhDoc._id);

                            done();
                        });
                    });
                });

                it('should allow sorting results', function (done) {
                    var client = request('http://' + config.server.host + ':' + config.server.port);

                    client
                    .get('/vtest/testdb/test-schema?sort=field_1')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .expect('content-type', 'application/json')
                    .end(function (err, res) {
                        if (err) return done(err);

                        res.body.should.be.Array;
                        res.body.length.should.equal(40);

                        var max = '';
                        res.body.forEach(function (doc) {
                            doc.field_1.should.not.be.below(max);
                            max = doc.field_1;
                        });

                        done();
                    });
                });

                it('should allow specifying sort order', function (done) {
                    var client = request('http://' + config.server.host + ':' + config.server.port);

                    client
                    .get('/vtest/testdb/test-schema?sort=field_1&sort_order=-1')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .expect('content-type', 'application/json')
                    .end(function (err, res) {
                        if (err) return done(err);

                        res.body.should.be.Array;
                        res.body.length.should.equal(40);

                        var last = '';
                        res.body.forEach(function (doc) {
                            if (last) doc.field_1.should.not.be.above(last);
                            last = doc.field_1;
                        });

                        done();
                    });
                });

                it('should return javascript if `callback` is provided', function (done) {
                    var client = request('http://' + config.server.host + ':' + config.server.port);
                    var callbackName = 'testCallback';

                    client
                    .get('/vtest/testdb/test-schema?callback=' + callbackName)
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .expect('content-type', 'text/javascript')
                    .end(function (err, res) {
                        if (err) return done(err);

                        res.text.slice(0, callbackName.length).should.equal(callbackName);
                        res.text.slice(-2).should.equal(');');
                        done();
                    });
                });
            });
        });

        describe('DELETE', function () {
            before(function (done) {
                help.dropDatabase(function (err) {
                    if (err) return done(err);

                    help.getBearerToken(function (err, token) {
                        if (err) return done(err);

                        bearerToken = token;

                        done();
                    });
                });
            });

            it('should remove documents', function (done) {
                var client = request('http://' + config.server.host + ':' + config.server.port);

                client
                .post('/vtest/testdb/test-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({field_1: 'doc to remove'})
                .expect(200)
                .end(function (err, res) {
                    if (err) return done(err);

                    var doc = res.body[0];
                    should.exist(doc);
                    doc.field_1.should.equal('doc to remove');

                    client
                    .delete('/vtest/testdb/test-schema/' + doc._id)
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(204, done);
                });
            });

            it('should remove a specific document', function (done) {
               help.createDoc(bearerToken, function (err, doc1) {
                    if (err) return done(err);
                   help.createDoc(bearerToken, function (err, doc2) {
                        if (err) return done(err);

                        var client = request('http://' + config.server.host + ':' + config.server.port);

                        client
                        .delete('/vtest/testdb/test-schema/' + doc1._id)
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .expect(204)
                        .end(function (err) {
                            if (err) return done(err);

                            var filter = encodeURIComponent(JSON.stringify({
                                _id: doc2._id
                            }));

                            client
                            .get('/vtest/testdb/test-schema?filter=' + filter)
                            .set('Authorization', 'Bearer ' + bearerToken)
                            .expect(200)
                            .expect('content-type', 'application/json')
                            .end(function (err, res) {
                                if (err) return done(err);

                                res.body.should.be.Array;
                                res.body.length.should.equal(1);
                                res.body[0]._id.should.equal(doc2._id);

                                done();
                            });
                        });
                    });
                });
            });
        });
    });

    describe('endpoint api', function () {
        before(function (done) {
            app.start({
                endpointPath: __dirname + '/workspace/endpoints'
            }, done);
        });

        after(function (done) {
            app.stop(done);
        });

        it('should return hello world', function (done) {
            var client = request('http://' + config.server.host + ':' + config.server.port);

            client
            .get('/endpoints/test-endpoint')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .expect('content-type', 'application/json')
            .end(function (err, res) {
                if (err) return done(err);

                res.body.message.should.equal('Hello World');
                done();
            });
        });
    });
});
