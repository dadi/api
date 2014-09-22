var should = require('should');
var fs = require('fs');
var path = require('path');
var request = require('supertest');
var _ = require('underscore');
var EventEmitter = require('events').EventEmitter;
var connection = require(__dirname + '/../../bantam/lib/model/connection');
var config = require(__dirname + '/../../config');
var help = require(__dirname + '/help');
var app = require(__dirname + '/../../bantam/lib/');

// variables scoped for use throughout tests
var bearerToken;
var connectionString = 'http://' + config.server.host + ':' + config.server.port;

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

            var client = request(connectionString);
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
                var client = request(connectionString);
                client
                .post('/vtest/testdb/test-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({field1: 'foo!'})
                .expect(200)
                .end(function (err, res) {
                    if (err) return done(err);

                    should.exist(res.body);

                    res.body.should.be.Array;
                    res.body.length.should.equal(1);
                    should.exist(res.body[0]._id);
                    res.body[0].field1.should.equal('foo!');
                    done();
                });
            });

            it('should add internal fields to new documents', function (done) {
                var client = request(connectionString);
                client
                .post('/vtest/testdb/test-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({field1: 'foo!'})
                .expect(200)
                .end(function (err, res) {
                    if (err) return done(err);

                    should.exist(res.body);

                    res.body.should.be.Array;
                    res.body.length.should.equal(1);
                    res.body[0].createdBy.should.equal('test123');
                    res.body[0].createdAt.should.be.Number;
                    res.body[0].createdAt.should.not.be.above(Date.now());
                    res.body[0].apiVersion.should.equal('vtest');
                    done();
                });
            });

            it('should update existing documents', function (done) {
                var client = request(connectionString);

                client
                .post('/vtest/testdb/test-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({field1: 'doc to update'})
                .expect(200)
                .end(function (err, res) {
                    if (err) return done(err);

                    var doc = res.body[0];
                    should.exist(doc);
                    doc.field1.should.equal('doc to update');

                    client
                    .post('/vtest/testdb/test-schema/' + doc._id)
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .send({field1: 'updated doc'})
                    .expect(200)
                    .end(function (err, res) {
                        if (err) return done(err);

                        res.body._id.should.equal(doc._id);
                        res.body.field1.should.equal('updated doc');

                        client
                        .get('/vtest/testdb/test-schema?filter={"_id": "' + doc._id + '"}')
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .expect(200)
                        .expect('content-type', 'application/json')
                        .end(function (err, res) {
                            if (err) return done(err);

                            res.body.should.be.Array;
                            res.body.length.should.equal(1);
                            res.body[0].field1.should.equal('updated doc');

                            done();
                        })
                    });
                });
            });

            it('should add internal fields to updated documents', function (done) {
                var client = request(connectionString);

                client
                .post('/vtest/testdb/test-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({field1: 'doc to update'})
                .expect(200)
                .end(function (err, res) {
                    if (err) return done(err);

                    var doc = res.body[0];
                    should.exist(doc);
                    doc.field1.should.equal('doc to update');

                    client
                    .post('/vtest/testdb/test-schema/' + doc._id)
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .send({field1: 'updated doc'})
                    .expect(200)
                    .end(function (err, res) {
                        if (err) return done(err);

                        res.body._id.should.equal(doc._id);
                        res.body.field1.should.equal('updated doc');

                        client
                        .get('/vtest/testdb/test-schema?filter={"_id": "' + doc._id + '"}')
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .expect(200)
                        .expect('content-type', 'application/json')
                        .end(function (err, res) {
                            if (err) return done(err);

                            res.body.should.be.Array;
                            res.body.length.should.equal(1);
                            res.body[0].lastModifiedBy.should.equal('test123');
                            res.body[0].lastModifiedAt.should.be.Number;
                            res.body[0].lastModifiedAt.should.not.be.above(Date.now());
                            res.body[0].apiVersion.should.equal('vtest');

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

                    var client = request(connectionString);

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

                        var client = request(connectionString);
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
                    var client = request(connectionString);
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
                    var client = request(connectionString);

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
                    var client = request(connectionString);

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
                    var client = request(connectionString);

                    client
                    .get('/vtest/testdb/test-schema?sort=field1')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .expect('content-type', 'application/json')
                    .end(function (err, res) {
                        if (err) return done(err);

                        res.body.should.be.Array;
                        res.body.length.should.equal(40);

                        var max = '';
                        res.body.forEach(function (doc) {
                            doc.field1.should.not.be.below(max);
                            max = doc.field1;
                        });

                        done();
                    });
                });

                it('should allow specifying descending sort order', function (done) {
                    var client = request(connectionString);

                    client
                    .get('/vtest/testdb/test-schema?sort=field1&sortOrder=desc')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .expect('content-type', 'application/json')
                    .end(function (err, res) {
                        if (err) return done(err);

                        res.body.should.be.Array;
                        res.body.length.should.equal(40);

                        var last = '';
                        res.body.forEach(function (doc) {
                            if (last) doc.field1.should.not.be.above(last);
                            last = doc.field1;
                        });

                        done();
                    });
                });

                it('should allow specifying ascending sort order', function (done) {
                    var client = request(connectionString);

                    client
                    .get('/vtest/testdb/test-schema?sort=field1&sortOrder=asc')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .expect('content-type', 'application/json')
                    .end(function (err, res) {
                        if (err) return done(err);

                        res.body.should.be.Array;
                        res.body.length.should.equal(40);

                        var last = '';
                        res.body.forEach(function (doc) {
                            if (last) doc.field1.should.not.be.below(last);
                            last = doc.field1;
                        });

                        done();
                    });
                });

                it('should return javascript if `callback` is provided', function (done) {
                    var client = request(connectionString);
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
                var client = request(connectionString);

                client
                .post('/vtest/testdb/test-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({field1: 'doc to remove'})
                .expect(200)
                .end(function (err, res) {
                    if (err) return done(err);

                    var doc = res.body[0];
                    should.exist(doc);
                    doc.field1.should.equal('doc to remove');

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

                        var client = request(connectionString);

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

            it('should return a message if config.feedback is true', function (done) {
                var originalFeedback = config.feedback;
                config.feedback = true;

                var client = request(connectionString);

                client
                .post('/vtest/testdb/test-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({field1: 'doc to remove 2'})
                .expect(200)
                .end(function (err, res) {
                    if (err) return done(err);

                    var doc = res.body[0];
                    should.exist(doc);
                    doc.field1.should.equal('doc to remove 2');

                    client
                    .delete('/vtest/testdb/test-schema/' + doc._id)
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    //.expect('content-type', 'application/json')
                    .end(function (err, res) {
                        config.feedback = originalFeedback;
                        if (err) return done(err);

                        res.body.status.should.equal('success');
                        done();
                    });
                });
            });
        });
    });

    describe('collections config api', function () {

        // mimic a file that could be sent to the server
        var jsSchemaString = fs.readFileSync(__dirname + '/../new-schema.json', {encoding: 'utf8'});

        var cleanup = function (done) {
            try {

                // try to cleanup these tests directory tree
                fs.unlinkSync(__dirname + '/workspace/collections/vapicreate/testdb/collection.api-create.json');
                fs.rmdirSync(__dirname + '/workspace/collections/vapicreate/testdb');
                fs.rmdirSync(__dirname + '/workspace/collections/vapicreate');
            } catch (err) {
                //console.log(err);
            }
            done();
        };

        before(function (done) {
            cleanup(function (err) {
                if (err) return done(err);

                app.start({
                    collectionPath: __dirname + '/workspace/collections'
                }, done);
            });
        });

        after(function (done) {
            app.stop(function (err) {
                if (err) return done(err);

                cleanup(done);
            });
        });

        describe('GET', function () {
            it('should return the schema file', function (done) {
                request(connectionString)
                .get('/vtest/testdb/test-schema/config')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .expect('content-type', 'application/json')
                .end(function (err, res) {
                    if (err) return done(err);

                    res.body.should.be.Object;
                    res.body.should.not.be.Array;
                    should.exist(res.body.fields);
                    should.exist(res.body.settings);

                    done();
                });
            });

            it('should only allow authenticated users access', function (done) {
                request(connectionString)
                .get('/vtest/testdb/test-schema/config')
                .set('Authorization', 'Bearer e91e69b4-6563-43bd-a793-cb2af4ba62f4') // invalid token
                .expect(401, done);
            });
        });

        describe('POST', function () {
            it('should allow creating a new collection endpoint', function (done) {
                var client = request(connectionString);

                client
                .post('/vapicreate/testdb/api-create/config')
                .send(jsSchemaString)
                .set('content-type', 'text/plain')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .expect('content-type', 'application/json')
                .end(function (err, res) {
                    if (err) return done(err);

                    // Wait for a few seconds then make request to test that the new endpoint is working
                    setTimeout(function () {
                        client
                        .get('/vapicreate/testdb/api-create')
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .expect(200)
                        .expect('content-type', 'application/json')
                        .end(done);
                    }, 300);
                });
            });

            it('should allow updating a new collection endpoint', function (done) {
                var client = request(connectionString);

                // first make sure the current schema is working
                client
                .post('/vapicreate/testdb/api-create')
                .send({
                    updatedField: 'foo'
                })
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(400)
                .end(function (err, res) {
                    if (err) return done(err);

                    // add a new field to the schema
                    var schema = JSON.parse(jsSchemaString);
                    schema.fields.updatedField = _.extend({}, schema.fields.newField, {
                        type: 'Number',
                        required: true
                    });

                    client
                    .post('/vapicreate/testdb/api-create/config')
                    .send(JSON.stringify(schema))
                    .set('content-type', 'text/plain')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .expect('content-type', 'application/json')
                    .end(function (err, res) {
                        if (err) return done(err);

                        // Wait, then test that the schema was updated
                        setTimeout(function () {
                            client
                            .post('/vapicreate/testdb/api-create')
                            .send({
                                updatedField: 123
                            })
                            .set('Authorization', 'Bearer ' + bearerToken)
                            .expect(200)
                            .expect('content-type', 'application/json')
                            .end(done);
                        }, 300);
                    });
                });

            });
        });

        describe('DELETE', function () {
            it('should allow removing endpoints', function (done) {
                var client = request(connectionString);

                // make sure the api is working as expected
                client
                .post('/vapicreate/testdb/api-create')
                .send({
                    updatedField: 123
                })
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .expect('content-type', 'application/json')
                .end(function (err) {
                    if (err) return done(err);

                    // send request to remove the endpoint
                    client
                    .delete('/vapicreate/testdb/api-create/config')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .expect('content-type', 'application/json')
                    .end(function (err, res) {
                        if (err) return done(err);

                        // TODO: Wait, then make sure the api was updated correctly
                        setTimeout(function () {
                            client

                            // NOTE: cache invalidation is done via ttl, so this endpoint will be removed after ttl has elapsed
                            .get('/vapicreate/testdb/api-create?cache=false')
                            .set('Authorization', 'Bearer ' + bearerToken)
                            .expect(404)
                            .end(done);
                        }, 300);
                    })
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
            var client = request(connectionString);

            client
            .get('/endpoints/test-endpoint')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            //.expect('content-type', 'application/json')
            .end(function (err, res) {
                if (err) return done(err);

                res.body.message.should.equal('Hello World');
                done();
            });
        });
    });

    describe('endpoint config api', function () {
        // mimic a file that could be sent to the server
        var jsSchemaString = fs.readFileSync(__dirname + '/../new-endpoint.js', {encoding: 'utf8'});

        var cleanup = function (done) {
            try {

                // try to cleanup these tests directory tree
                fs.unlinkSync(__dirname + '/workspace/endpoints/endpoint.new-endpoint.js');
            } catch (err) {
                //console.log(err);
            }
            done();
        };

        before(function (done) {
            cleanup(function (err) {
                if (err) return done(err);

                app.start({
                    endpointPath: __dirname + '/workspace/endpoints'
                }, done);
            });
        });

        after(function (done) {
            app.stop(function (err) {
                if (err) return done(err);

                cleanup(done);
            });
        });

        describe('POST', function () {
            it('should allow creating a new custom endpoint', function (done) {
                var client = request(connectionString);

                // make sure the endpoint is not already there
                client
                .get('/endpoints/new-endpoint?cache=false')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(404)
                .end(function (err) {
                    if (err) return done(err);

                    // create endpoint
                    client
                    .post('/endpoints/new-endpoint/config')
                    .send(jsSchemaString)
                    .set('content-type', 'text/plain')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .end(function (err, res) {
                        if (err) return done(err);

                        // wait, then test that endpoint was created
                        setTimeout(function () {
                            client
                            .get('/endpoints/new-endpoint?cache=false')
                            .set('Authorization', 'Bearer ' + bearerToken)
                            .expect(200)
                            .expect('content-type', 'application/json')
                            .end(function (err, res) {
                                if (err) return done(err);

                                res.body.message.should.equal('endpoint created through the API');
                                done();
                            });
                        }, 1000);
                    });
                });
            });

            it('should allow updating an endpoint', function (done) {
                var client = request(connectionString);

                // make sure the endpoint exists from last test
                client
                .get('/endpoints/new-endpoint?cache=false')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .end(function (err) {
                    if (err) return done(err);

                    // get an updated version of the file
                    var fileArr = jsSchemaString.split('\n');
                    fileArr[0] = "var message = {message: 'endpoint updated through the API'};";
                    jsSchemaString = fileArr.join('\n');

                    // update endpoint
                    client
                    .post('/endpoints/new-endpoint/config')
                    .send(jsSchemaString)
                    .set('content-type', 'text/plain')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .end(function (err, res) {
                        if (err) return done(err);

                        // wait, then test that endpoint was created
                        setTimeout(function () {
                            client
                            .get('/endpoints/new-endpoint?cache=false')
                            .set('Authorization', 'Bearer ' + bearerToken)
                            .expect(200)
                            .expect('content-type', 'application/json')
                            .end(function (err, res) {
                                if (err) return done(err);

                                res.body.message.should.equal('endpoint updated through the API');
                                done();
                            });
                        }, 1000);
                    });
                });
            });
        });

        describe('GET', function () {
            it('should NOT return the Javascript file backing the endpoint', function (done) {
                request(connectionString)
                .get('/endpoints/test-endpoint/config?cache=false')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(404)
                .end(done);
            });
        });

        describe('DELETE', function () {
            it('should NOT remove the custom endpoint', function (done) {
                request(connectionString)
                .delete('/endpoints/test-endpoint/config')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(404)
                .end(done);
            });
        });
    });

    describe('config api', function () {
        var configPath = path.resolve(__dirname + '/../../config.json');
        var originalConfig = fs.readFileSync(configPath);

        before(function (done) {
            app.start({
                endpointPath: __dirname + '/workspace/endpoints',
                collectionPath: __dirname + '/workspace/collections'
            }, done);
        });

        after(function (done) {

            // restore the config file to its original state
            fs.writeFileSync(configPath, originalConfig);
            app.stop(done);
        });

        describe('GET', function () {
            it('should return the current config', function (done) {
                request(connectionString)
                .get('/serama/config')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .expect('content-type', 'application/json')
                .end(function (err, res) {
                    if (err) return done(err);

                    res.body.should.be.Object;
                    should.exist(res.body.database);
                    should.exist(res.body.logging);
                    should.exist(res.body.server);
                    should.exist(res.body.auth);
                    should.exist(res.body.caching);
                    should.deepEqual(res.body, config);

                    done();
                });
            });

            it('should only allow authenticated users access', function (done) {
                request(connectionString)
                .get('/serama/config')
                .set('Authorization', 'Bearer e91e69b4-6563-43bd-a793-cb2af4ba62f4') // invalid token
                .expect(401, done);
            });
        });

        describe('POST', function () {
            it('should allow updating the main config file', function (done) {
                var client = request(connectionString);

                client
                .get('/serama/config')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .expect('content-type', 'application/json')
                .end(function (err, res) {
                    if (err) return done(err);

                    should.exist(res.body);
                    res.body.auth.tokenTtl = 100;

                    client
                    .post('/serama/config')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .set('content-type', 'application/json')
                    .send(res.body)
                    .expect(200)
                    .expect('content-type', 'application/json')
                    .end(function (err, res) {
                        if (err) return done(err);

                        res.body.result.should.equal('success');

                        // reload the config file and see that it is updated
                        delete require.cache[configPath];
                        var config = require(configPath);

                        config.auth.tokenTtl.should.equal(100);
                        done();
                    });
                });
            });
        });
    });
});
