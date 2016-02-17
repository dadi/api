var should = require('should');
var fs = require('fs');
var path = require('path');
var request = require('supertest');
var _ = require('underscore');
var EventEmitter = require('events').EventEmitter;
var connection = require(__dirname + '/../../dadi/lib/model/connection');
var config = require(__dirname + '/../../config');
var help = require(__dirname + '/help');
var app = require(__dirname + '/../../dadi/lib/');

// variables scoped for use throughout tests
var bearerToken;
var connectionString = 'http://' + config.get('server.host') + ':' + config.get('server.port');

describe('Application', function () {

    after(function (done) {
        help.removeTestClients(done);
    });

    it('should start from specific directory', function (done) {
        app.start(function (err) {
            if (err) return done(err);

            // give it a moment for http.Server to finish starting
            setTimeout(function () {
                app.stop(done);
            }, 200);
        });
    });

    it('should start a server', function (done) {
        app.start(function (err) {
            if (err) return done(err);

            setTimeout(function () {
                var client = request(connectionString);
                client
                .get('/serama/config')

                // just need to test that we get some kind of response
                .expect(401)
                .end(function (err) {
                    if (err) done = done.bind(this, err);
                    app.stop(done);
                });
            }, 500);
        });
    });

    describe('collection initialisation', function () {

        var dirs = config.get('paths');
        var newSchemaPath = dirs.collections + '/vtest/testdb/collection.new-test-schema.json';

        before(function (done) {

            // Add a schema file to the collection path
            var newSchema = JSON.parse(JSON.stringify(require(path.resolve(dirs.collections + '/../schemas/collection.new-test-schema.json'))));
            fs.writeFileSync(newSchemaPath, JSON.stringify(newSchema));

            app.start(done);
        });

        after(function (done) {

            if (fs.existsSync(newSchemaPath)) fs.unlinkSync(newSchemaPath);

            app.stop(done);
        });

        describe('on app start', function () {
            before(function (done) {
                help.dropDatabase('testdb', function (err) {
                    if (err) return done(err);

                    help.getBearerToken(function (err, token) {
                        if (err) return done(err);

                        bearerToken = token;

                        done();
                    });
                });
            });

            it('should initialise model using collection schema filename as model name', function (done) {

                var loadedModels = _.compact(_.pluck(app.components, 'model'));
                var model = _.where(loadedModels, { name: "test-schema" });

                model.length.should.equal(1);

                done();
            });

            it('should initialise model using property from schema file as model name', function (done) {

                var loadedModels = _.compact(_.pluck(app.components, 'model'));
                var model = _.where(loadedModels, { name: "modelNameFromSchema" });

                model.length.should.equal(1);

                done();
            });
        })
    })

    describe('collections api', function () {
        before(function (done) {
            app.start(done);
        });

        after(function (done) {
            app.stop(done);
        });

        describe('POST', function () {
            before(function (done) {
                help.dropDatabase('testdb', function (err) {
                    if (err) return done(err);

                    help.getBearerTokenWithAccessType("admin", function (err, token) {
                        if (err) return done(err);

                        bearerToken = token;

                        // add a new field to the schema
                        var jsSchemaString = fs.readFileSync(__dirname + '/../new-schema.json', {encoding: 'utf8'});
                        jsSchemaString = jsSchemaString.replace('newField', 'field1');
                        var schema = JSON.parse(jsSchemaString);

                        schema.fields.field2 = _.extend({}, schema.fields.newField, {
                            type: 'Number',
                            required: false
                        });

                        schema.fields.field3 = _.extend({}, schema.fields.newField, {
                            type: 'ObjectID',
                            required: false
                        });

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

                    done();
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

                    should.exist(res.body.results);
                    res.body.results.should.be.Array;
                    res.body.results.length.should.equal(1);
                    should.exist(res.body.results[0]._id);
                    res.body.results[0].field1.should.equal('foo!');
                    done();
                });
            });

            it('should create new documents when body is urlencoded', function (done) {

                var body = "field1=foo!";
                var client = request(connectionString);

                client
                .post('/vtest/testdb/test-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send(body)
                .expect(200)
                .end(function (err, res) {
                    if (err) return done(err);


                    should.exist(res.body.results);

                    res.body.results.should.be.Array;
                    res.body.results.length.should.equal(1);
                    should.exist(res.body.results[0]._id);
                    should.exist(res.body.results[0].field1);
                    res.body.results[0].field1.should.equal('foo!');
                    done();
                });
            });

            it('should create new documents with ObjectIDs from single value', function (done) {

                var body = { field1: 'foo!', field2: 1278, field3: '55cb1658341a0a804d4dadcc' };
                var client = request(connectionString);
                client
                .post('/vtest/testdb/test-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send(body)
                .expect(200)
                .end(function (err, res) {
                    if (err) return done(err);

                    should.exist(res.body.results);

                    res.body.results.should.be.Array;
                    res.body.results.length.should.equal(1);
                    should.exist(res.body.results[0]._id);
                    should.exist(res.body.results[0].field3);
                    //(typeof res.body.results[0].field3).should.equal('object');

                    done();
                });
            });

            it('should create new documents with ObjectIDs from array', function (done) {

                var body = { field1: 'foo!', field2: 1278, field3: ['55cb1658341a0a804d4dadcc', '55cb1658341a0a804d4dadff'] };
                var client = request(connectionString);
                client
                .post('/vtest/testdb/test-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send(body)
                .expect(200)
                .end(function (err, res) {
                    if (err) return done(err);

                    should.exist(res.body.results);

                    res.body.results.should.be.Array;
                    res.body.results.length.should.equal(1);
                    should.exist(res.body.results[0]._id);
                    should.exist(res.body.results[0].field3);
                    //(typeof res.body.results[0].field3).should.equal('object');

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

                    should.exist(res.body.results);

                    res.body.results.should.be.Array;
                    res.body.results.length.should.equal(1);
                    res.body.results[0].createdBy.should.equal('test123');
                    res.body.results[0].createdAt.should.be.Number;
                    res.body.results[0].createdAt.should.not.be.above(Date.now());
                    res.body.results[0].apiVersion.should.equal('vtest');
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

                    var doc = res.body.results[0];
                    should.exist(doc);
                    doc.field1.should.equal('doc to update');

                    client
                    .post('/vtest/testdb/test-schema/' + doc._id)
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .send({field1: 'updated doc'})
                    .expect(200)
                    .end(function (err, res) {
                        if (err) return done(err);

                        res.body.results[0]._id.should.equal(doc._id);
                        res.body.results[0].field1.should.equal('updated doc');

                        client
                        .get('/vtest/testdb/test-schema?filter={"_id": "' + doc._id + '"}')
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .expect(200)
                        .expect('content-type', 'application/json')
                        .end(function (err, res) {
                            if (err) return done(err);

                            res.body['results'].should.exist;
                            res.body['results'].should.be.Array;
                            res.body['results'].length.should.equal(1);
                            res.body['results'][0].field1.should.equal('updated doc');

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

                    var doc = res.body.results[0];
                    should.exist(doc);
                    doc.field1.should.equal('doc to update');

                    client
                    .post('/vtest/testdb/test-schema/' + doc._id)
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .send({field1: 'updated doc'})
                    .expect(200)
                    .end(function (err, res) {
                        if (err) return done(err);

                        res.body.results[0]._id.should.equal(doc._id);
                        res.body.results[0].field1.should.equal('updated doc');

                        client
                        .get('/vtest/testdb/test-schema?filter={"_id": "' + doc._id + '"}')
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .expect(200)
                        .expect('content-type', 'application/json')
                        .end(function (err, res) {
                            if (err) return done(err);

                            res.body['results'].should.exist;
                            res.body['results'].should.be.Array;
                            res.body['results'].length.should.equal(1);
                            res.body['results'][0].lastModifiedBy.should.equal('test123');
                            res.body['results'][0].lastModifiedAt.should.be.Number;
                            res.body['results'][0].lastModifiedAt.should.not.be.above(Date.now());
                            res.body['results'][0].apiVersion.should.equal('vtest');

                            done();
                        })
                    });
                });
            });
        });

        describe('GET', function () {

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

                help.dropDatabase('testdb', function (err) {
                    if (err) return done(err);

                    help.getBearerTokenWithAccessType("admin", function (err, token) {
                        if (err) return done(err);

                        bearerToken = token;

                        // add a new field to the schema
                        var jsSchemaString = fs.readFileSync(__dirname + '/../new-schema.json', {encoding: 'utf8'});
                        jsSchemaString = jsSchemaString.replace('newField', 'field1');
                        var schema = JSON.parse(jsSchemaString);

                        schema.fields.field2 = _.extend({}, schema.fields.newField, {
                            type: 'Number',
                            required: false
                        });

                        schema.fields.field3 = _.extend({}, schema.fields.newField, {
                            type: 'ObjectID',
                            required: false
                        });

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

                    cleanup(done);
                });
            })

            it('should get documents', function (done) {
               help.createDoc(bearerToken, function (err, doc) {
                    if (err) return done(err);

                    var client = request(connectionString);

                    client
                    .get('/vtest/testdb/test-schema?cache=false')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .expect('content-type', 'application/json')
                    .end(function (err, res) {
                        if (err) return done(err);

                        res.body['results'].should.exist;
                        res.body['results'].should.be.Array;
                        res.body['results'].length.should.be.above(0)
                        done();
                    });
                });
            });

            it('should get documents from correct API version', function (done) {

                var jsSchemaString = fs.readFileSync(__dirname + '/../new-schema.json', {encoding: 'utf8'});

                help.createDoc(bearerToken, function (err, doc) {
                    if (err) return done(err);

                    doc.apiVersion.should.equal('vtest');

                    // create new API endpoint
                    var client = request(connectionString);

                    client
                    .post('/v1/testdb/test-schema/config')
                    .send(jsSchemaString)
                    .set('content-type', 'text/plain')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .expect('content-type', 'application/json')
                    .end(function (err, res) {
                        if (err) return done(err);

                        // Wait for a few seconds then make request to test that the new endpoint is working
                        setTimeout(function () {

                            var testdoc = { newField: "test string" };
                            help.createDocWithSpecificVersion(bearerToken, 'v1', testdoc, function (err, doc) {
                                if (err) return done(err);

                                setTimeout(function () {
                                    client
                                    .get('/v1/testdb/test-schema')
                                    .set('Authorization', 'Bearer ' + bearerToken)
                                    .expect(200)
                                    .expect('content-type', 'application/json')
                                    .end(function (err, res) {
                                        if (err) return done(err);

                                        res.body['results'].should.exist;
                                        res.body['results'].should.be.Array;
                                        res.body['results'][0].apiVersion.should.equal('v1');
                                        done();
                                    });
                                }, 300);
                            });
                        }, 300);
                    });
                });
            });

            it('should allow case insensitive query', function (done) {

                var doc = { field1: "Test", field2: null };

                help.createDocWithParams(bearerToken, doc, function (err) {

                   if (err) return done(err);

                    var client = request(connectionString);
                    var query = {
                        field1: "test"
                    };

                    query = encodeURIComponent(JSON.stringify(query));

                    client
                    .get('/vtest/testdb/test-schema?cache=false&filter=' + query)
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .expect('content-type', 'application/json')
                    .end(function (err, res) {
                        if (err) return done(err);

                        res.body['results'].should.exist;
                        res.body['results'].should.be.Array;
                        res.body['results'].length.should.equal(1);
                        res.body['results'][0].field1.should.equal("Test");
                        done();
                    });
                });
            });

            it('should allow case insensitive regex query', function (done) {

                var doc = { field1: "Test", field2: null };

                help.createDocWithParams(bearerToken, doc, function (err) {

                   if (err) return done(err);

                    var client = request(connectionString);
                    var query = {
                        field1: { "$regex" : "tes" }
                    };

                    query = encodeURIComponent(JSON.stringify(query));

                    client
                    .get('/vtest/testdb/test-schema?cache=false&filter=' + query)
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .expect('content-type', 'application/json')
                    .end(function (err, res) {
                        if (err) return done(err);

                        var found = false;

                        res.body['results'].should.exist;
                        res.body['results'].should.be.Array;

                        _.each(res.body['results'], function (value, key) {
                            if (value.field1 === "Test") found = true;
                        });

                        found.should.be.true;

                        done();
                    });
                });
            });

            it('should allow null values in query when converting to case insensitive', function (done) {

                var doc = { field1: "Test", field2: null };

                help.createDocWithParams(bearerToken, doc, function (err) {

                   if (err) return done(err);

                    var client = request(connectionString);
                    var query = {
                        field2: null
                    };

                    query = encodeURIComponent(JSON.stringify(query));

                    client
                    .get('/vtest/testdb/test-schema?cache=false&filter=' + query)
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .expect('content-type', 'application/json')
                    .end(function (err, res) {
                        if (err) return done(err);

                        var found = false;

                        res.body['results'].should.exist;
                        res.body['results'].should.be.Array;

                        _.each(res.body['results'], function (value, key) {
                            if (value.field1 === "Test") found = true;
                        });

                        found.should.be.true;

                        done();
                    });
                });
            });

            it('should return specified fields only when supplying `fields` param', function (done) {

               var doc = { field1: "Test", field2: null };

                help.createDocWithParams(bearerToken, doc, function (err) {
                    if (err) return done(err);

                    var client = request(connectionString);

                    var fields = {
                        "field1" : 1, "_id": 0
                    };

                    query = encodeURIComponent(JSON.stringify(fields));
                    client
                    .get('/vtest/testdb/test-schema?cache=false&fields=' + query)
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .expect('content-type', 'application/json')
                    .end(function (err, res) {
                        if (err) return done(err);

                        res.body['results'].should.exist;
                        res.body['results'].should.be.Array;

                        var obj = _.sample(res.body['results']);
                        Object.keys(obj).length.should.equal(1);
                        Object.keys(obj)[0].should.equal("field1");

                        done();
                    });
                });
            });

            it('should find specific document using filter param', function (done) {
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

                            res.body['results'].should.exist;
                            res.body['results'].should.be.Array;
                            res.body['results'].length.should.equal(1);
                            res.body['results'][0]._id.should.equal(docId);
                            done();
                        });
                    });
                });
            });

            it('should find specific document using request param', function (done) {
               help.createDoc(bearerToken, function (err, doc1) {
                    if (err) return done(err);
                   help.createDoc(bearerToken, function (err, doc2) {
                        if (err) return done(err);

                        var client = request(connectionString);
                        var docId = doc2._id

                        client
                        .get('/vtest/testdb/test-schema/' + doc2._id)
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .expect(200)
                        .expect('content-type', 'application/json')
                        .end(function (err, res) {
                            if (err) return done(err);

                            res.body['results'].should.exist;
                            res.body['results'].should.be.Array;
                            res.body['results'].length.should.equal(1);
                            res.body['results'][0]._id.should.equal(docId);
                            done();
                        });
                    });
                });
            });

            it('should find documents when using request param and filter', function (done) {
               help.createDoc(bearerToken, function (err, doc1) {
                    if (err) return done(err);
                   help.createDoc(bearerToken, function (err, doc2) {
                        if (err) return done(err);

                        var client = request(connectionString);
                        var docId = doc2._id
                        var query = {
                            field1: { '$gt' : '0' }
                        };

                        query = encodeURIComponent(JSON.stringify(query));

                        client
                        .get('/vtest/testdb/test-schema/' + doc2._id + '?filter=' + query)
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .expect(200)
                        .expect('content-type', 'application/json')
                        .end(function (err, res) {
                            if (err) return done(err);

                            res.body['results'].should.exist;
                            res.body['results'].should.be.Array;
                            res.body['results'].length.should.equal(1);
                            res.body['results'][0]._id.should.equal(docId);
                            done();
                        });
                    });
                });
            });

            it('should find specific documents using a standard query', function (done) {
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

                            res.body['results'].should.exist;
                            res.body['results'].should.be.Array;
                            res.body['results'].length.should.equal(1);
                            res.body['results'][0]._id.should.equal(docId);
                            done();
                        });
                    });
                });
            });

            it('should find all documents using a standard query', function (done) {
               help.createDoc(bearerToken, function (err, doc1) {
                    if (err) return done(err);
                   help.createDoc(bearerToken, function (err, doc2) {
                        if (err) return done(err);

                        var client = request(connectionString);
                        var docId = doc2._id
                        var query = {

                        };

                        query = encodeURIComponent(JSON.stringify(query));
                        client
                        .get('/vtest/testdb/test-schema?filter=' + query)
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .expect(200)
                        .expect('content-type', 'application/json')
                        .end(function (err, res) {
                            if (err) return done(err);

                            res.body['results'].should.exist;
                            res.body['results'].should.be.Array;
                            res.body['results'].length.should.be.above(1);
                            done();
                        });
                    });
                });
            });

            it('should find one document using a standard query with count=1', function (done) {
               help.createDoc(bearerToken, function (err, doc1) {
                    if (err) return done(err);
                   help.createDoc(bearerToken, function (err, doc2) {
                        if (err) return done(err);

                        var client = request(connectionString);
                        var docId = doc2._id

                        client
                        .get('/vtest/testdb/test-schema?count=1&cache=false')
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .expect(200)
                        .expect('content-type', 'application/json')
                        .end(function (err, res) {
                            if (err) return done(err);

                            res.body['results'].should.exist;
                            res.body['results'].should.be.Array;
                            res.body['results'].length.should.equal(1);
                            done();
                        });
                    });
                });
            });

            it('should return grouped result set when using $group in an aggregation query', function (done) {

                // create a bunch of docs
                var asyncControl = new EventEmitter();
                var count = 0;

                for (var i = 0; i < 10; ++i) {
                   var doc = {field1: ((Math.random() * 10) | 0).toString(), field2: (Math.random() * 10) | 0};
                   help.createDocWithParams(bearerToken, doc, function (err) {
                        if (err) return asyncControl.emit('error', err);
                        count += 1;
                        if (count > 9) asyncControl.emit('ready');
                    });
                }

                asyncControl.on('ready', function () {

                    // documents are loaded and test can start

                    var client = request(connectionString);

                    var query = [
                        {
                            $group : {
                               _id : null,
                               averageNumber: { $avg: "$field2" },
                               count: { $sum: 1 }
                            }
                        }
                    ];

                    query = encodeURIComponent(JSON.stringify(query));
                    client
                        .get('/vtest/testdb/test-schema?filter=' + query)
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .expect(200)
                        .expect('content-type', 'application/json')
                        .end(function (err, res) {
                            if (err) {
                                return done(err);
                            }

                            res.body.should.be.Array;
                            res.body.length.should.equal(1);
                            res.body[0].averageNumber.should.be.above(0);
                            done();
                        });
                });

            });

            it('should return normal result set when only using $match in an aggregation query', function (done) {

                // create a bunch of docs
                var asyncControl = new EventEmitter();
                var count = 0;

                for (var i = 0; i < 10; ++i) {
                   var doc = {field1: ((Math.random() * 10) | 0).toString(), field2: (Math.random() * 10) | 0};
                   help.createDocWithParams(bearerToken, doc, function (err) {
                        if (err) return asyncControl.emit('error', err);
                        count += 1;
                        if (count > 9) asyncControl.emit('ready');
                    });
                }

                asyncControl.on('ready', function () {

                    // documents are loaded and test can start

                    var client = request(connectionString);

                    var query = [
                        { $match : { "field2" : { "$gte" : 1 } } },
                        { $limit : 2 }
                    ];

                    query = encodeURIComponent(JSON.stringify(query));
                    client
                        .get('/vtest/testdb/test-schema?filter=' + query)
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .expect(200)
                        .expect('content-type', 'application/json')
                        .end(function (err, res) {
                            if (err) {
                                return done(err);
                            }

                            res.body.should.be.Array;
                            res.body.length.should.equal(2);
                            res.body[0].field1.should.not.be.null;
                            done();
                        });
                });

            });

            it('should return single document when querystring param count=1', function (done) {

                // create a bunch of docs
                var ac = new EventEmitter();
                var count = 0;

                for (var i = 0; i < 10; ++i) {
                   var doc = {field1: ((Math.random() * 10) | 0).toString(), field2: (Math.random() * 10) | 0}
                   help.createDocWithParams(bearerToken, doc, function (err) {
                        if (err) return ac.emit('error', err);
                        count += 1;
                        if (count > 9) ac.emit('ready');
                    });
                }

                ac.on('ready', function () {

                    // documents are loaded and test can start
                    var client = request(connectionString);

                    var query = {};
                    query = encodeURIComponent(JSON.stringify(query));

                    client
                        .get('/vtest/testdb/test-schema?count=1')
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .expect(200)
                        .expect('content-type', 'application/json')
                        .end(function (err, res) {
                            if (err) return done(err);

                            res.body['results'].should.exist;
                            res.body['results'].should.be.Array;
                            res.body['results'].length.should.equal(1);
                            done();
                        });
                });

            });

            describe('query string params', function () {
                before(function (done) {
                    // create a bunch of docs
                    var asyncControl = new EventEmitter();
                    var count = 0;

                    for (var i = 0; i < 45; ++i) {
                       help.createDoc(bearerToken, function (err) {
                            if (err) return asyncControl.emit('error', err);
                            count += 1;

                            if (count >= 45) asyncControl.emit('ready');
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

                        res.body['results'].should.exist;
                        res.body['results'].should.be.Array;
                        res.body['results'].length.should.equal(docCount);

                        done();
                    });
                });

                it('should return pagination metadata', function (done) {
                    var client = request(connectionString);
                    var docCount = 20;

                    client
                    .get('/vtest/testdb/test-schema?page=1&count=' + docCount)
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .expect('content-type', 'application/json')
                    .end(function (err, res) {
                        if (err) return done(err);

                        res.body['metadata'].should.exist;
                        res.body['metadata'].page.should.equal(1);
                        res.body['metadata'].limit.should.equal(docCount);
                        res.body['metadata'].totalPages.should.be.above(1); // Math.ceil(# documents/20 per page)
                        res.body['metadata'].nextPage.should.equal(2);

                        done();
                    });
                });

                it('should return correct pagination nextPage value', function (done) {
                    var client = request(connectionString);
                    var docCount = 20;

                    client
                    .get('/vtest/testdb/test-schema?page=2&count=' + docCount)
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .expect('content-type', 'application/json')
                    .end(function (err, res) {
                        if (err) return done(err);

                        res.body['metadata'].should.exist;
                        res.body['metadata'].page.should.equal(2);
                        res.body['metadata'].nextPage.should.equal(3);
                        res.body['metadata'].prevPage.should.equal(1);

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

                        res.body['results'].should.exist;
                        res.body['results'].should.be.Array;
                        res.body['results'].length.should.equal(40);
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

                        res.body['results'].should.exist;
                        res.body['results'].should.be.Array;
                        res.body['results'].length.should.equal(20);

                        var eleventhDoc = res.body['results'][10];

                        client
                        .get('/vtest/testdb/test-schema?count=10&page=2')
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .expect(200)
                        .expect('content-type', 'application/json')
                        .end(function (err, res) {
                            if (err) return done(err);

                            res.body['results'].should.exist;
                            res.body['results'].should.be.Array;
                            res.body['results'].length.should.equal(10);

                            // make sure second page starts in correct position
                            res.body['results'][0]._id.should.equal(eleventhDoc._id);

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

                        res.body['results'].should.exist;
                        res.body['results'].should.be.Array;
                        res.body['results'].length.should.equal(40);

                        var max = '';
                        res.body['results'].forEach(function (doc) {
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

                        res.body['results'].should.exist;
                        res.body['results'].should.be.Array;
                        res.body['results'].length.should.equal(40);

                        var last = '';
                        res.body['results'].forEach(function (doc) {
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

                        res.body['results'].should.exist;
                        res.body['results'].should.be.Array;
                        res.body['results'].length.should.equal(40);

                        var last = '';
                        res.body['results'].forEach(function (doc) {
                            if (last) doc.field1.should.not.be.below(last);
                            last = doc.field1;
                        });

                        done();
                    });
                });

                it('should return 400 if invalid skip option is provided', function (done) {
                    var client = request(connectionString);

                    client
                    .get('/vtest/testdb/test-schema?skip=-1')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(400)
                    .expect('content-type', 'application/json')
                    .end(function (err, res) {
                        if (err) return done(err);

                        res.body['errors'].should.exist;
                        res.body['errors'][0].title.should.eql("Invalid Skip Parameter Provided");

                        done();
                    });
                });

                it('should return 400 if skip option is alphabetical', function (done) {
                    var client = request(connectionString);

                    client
                    .get('/vtest/testdb/test-schema?skip=a')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(400)
                    .expect('content-type', 'application/json')
                    .end(function (err, res) {
                        if (err) return done(err);

                        res.body['errors'].should.exist;
                        res.body['errors'][0].title.should.eql("Invalid Skip Parameter Provided");

                        done();
                    });
                });

                it('should return 400 if invalid page option is provided', function (done) {
                    var client = request(connectionString);

                    client
                    .get('/vtest/testdb/test-schema?page=-1')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(400)
                    .expect('content-type', 'application/json')
                    .end(function (err, res) {
                        if (err) return done(err);

                        res.body['errors'].should.exist;
                        res.body['errors'][0].title.should.eql("Invalid Page Parameter Provided");

                        done();
                    });
                });

                it('should return multiple errors if invalid page and skip options are provided', function (done) {
                    var client = request(connectionString);

                    client
                    .get('/vtest/testdb/test-schema?page=-1&skip=-8')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(400)
                    .expect('content-type', 'application/json')
                    .end(function (err, res) {
                        if (err) return done(err);

                        res.body['errors'].should.exist;
                        res.body['errors'].length.should.eql(2);

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
                help.dropDatabase('testdb', function (err) {
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

                    var doc = res.body.results[0];
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

                                res.body['results'].should.exist;
                                res.body['results'].should.be.Array;
                                res.body['results'].length.should.equal(1);
                                res.body['results'][0]._id.should.equal(doc2._id);

                                done();
                            });
                        });
                    });
                });
            });

            it('should return a message if config.feedback is true', function (done) {
                var originalFeedback = config.get('feedback');
                config.set('feedback', true);

                var client = request(connectionString);

                client
                .post('/vtest/testdb/test-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({field1: 'doc to remove 2'})
                .expect(200)
                .end(function (err, res) {
                    if (err) return done(err);

                    var doc = res.body.results[0];
                    should.exist(doc);
                    doc.field1.should.equal('doc to remove 2');

                    client
                    .delete('/vtest/testdb/test-schema/' + doc._id)
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    //.expect('content-type', 'application/json')
                    .end(function (err, res) {
                        config.set('feedback', originalFeedback);
                        if (err) return done(err);

                        res.body.status.should.equal('success');
                        done();
                    });
                });
            });
        });

        describe('Collection stats', function () {

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
            help.dropDatabase('testdb', function (err) {
              if (err) return done(err);

              help.getBearerTokenWithAccessType('admin', function (err, token) {

                if (err) return done(err);

                bearerToken = token;

                // add a new field to the schema
                var jsSchemaString = fs.readFileSync(__dirname + '/../new-schema.json', {encoding: 'utf8'});
                jsSchemaString = jsSchemaString.replace('newField', 'field1');
                var schema = JSON.parse(jsSchemaString);

                schema.fields.field2 = _.extend({}, schema.fields.newField, { type: 'Number', required: false });

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
              cleanup(done);
            });
          });

          it('should respond to a stats method', function (done) {
            help.createDoc(bearerToken, function (err, doc) {
              if (err) return done(err);

              var client = request(connectionString);

              client
              .get('/vtest/testdb/test-schema/stats')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              //.expect('content-type', 'application/json')
              .end(function (err, res) {
                if (err) return done(err);
                done();
              });
            });
          });

          it('should return correct count from stats method', function (done) {
            help.createDoc(bearerToken, function (err, doc) {
              if (err) return done(err);

              var client = request(connectionString);

              client
              .get('/vtest/testdb/test-schema/stats')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .expect('content-type', 'application/json')
              .end(function (err, res) {
                if (err) return done(err);

                res.body.should.exist;
                res.body.count.should.exist;

                done();
              });
            });
          });

          it('should return 404 if not a GET request', function (done) {
            help.createDoc(bearerToken, function (err, doc) {
              if (err) return done(err);

              var client = request(connectionString);

              client
              .post('/vtest/testdb/test-schema/stats')
              .set('Authorization', 'Bearer ' + bearerToken)
              .send({})
              .expect(404)
              .end(function (err, res) {
                if (err) return done(err);

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
            // try to cleanup these tests directory tree
            // don't catch errors here, since the paths may not exist

            var dirs = config.get('paths');

            try {
                fs.unlinkSync(dirs.collections + '/vapicreate/testdb/collection.api-create.json');
            } catch (e) {
            }

            try {
                fs.unlinkSync(dirs.collections + '/vapicreate/testdb/collection.api-create-model-name.json');
            } catch (e) {
            }

            try {
                fs.unlinkSync(dirs.collections + '/vapicreate/testdb/collection.modelNameFromSchema.json');
            } catch (e) {
            }

            try {
                fs.rmdirSync(dirs.collections + '/vapicreate/testdb');
            } catch (e) {
            }

            try {
                fs.rmdirSync(dirs.collections + '/vapicreate');
            } catch (e) {
            }

            done();
        };

        before(function (done) {
            cleanup(function (err) {
                if (err) return done(err);

                app.start(done);
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

            before(function (done) {
                help.getBearerTokenWithAccessType("admin", function (err, token) {
                    if (err) return done(err);

                    bearerToken = token;

                    done();
                });
            });

            after(function (done) {
                help.removeTestClients(function (err) {
                    if (err) return done(err);
                    done();
                });
            });

            it('should validate schema', function (done) {
                var client = request(connectionString);
                var schema = JSON.parse(jsSchemaString);
                delete schema.settings;
                var newString = JSON.stringify(schema);

                client
                .post('/vapicreate/testdb/api-create/config')
                .send(newString)
                .set('content-type', 'text/plain')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(400)
                .expect('content-type', 'application/json')
                .end(function (err, res) {
                    if (err) return done(err);

                    res.body.should.be.Object;
                    res.body.should.not.be.Array;
                    should.exist(res.body.errors);

                    done();
                });
            });

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

            it('should use collection schema filename as model name', function (done) {

                var client = request(connectionString);

                client
                .post('/vapicreate/testdb/api-create-model-name/config')
                .send(jsSchemaString)
                .set('content-type', 'text/plain')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .expect('content-type', 'application/json')
                .end(function (err, res) {
                    if (err) return done(err);


                    var body = JSON.stringify(res.body);
                    var index = body.indexOf('api-create-model-name collection created');
                    index.should.be.above(0);

                    done();
                });
            });

            it('should use property from schema file as model name', function (done) {

                var client = request(connectionString);

                var schema = JSON.parse(jsSchemaString);
                schema["model"] = "modelNameFromSchema";
                jsSchemaString = JSON.stringify(schema);

                client
                .post('/vapicreate/testdb/api-create-model-name/config')
                .send(jsSchemaString)
                .set('content-type', 'text/plain')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .expect('content-type', 'application/json')
                .end(function (err, res) {
                    if (err) return done(err);

                    var body = JSON.stringify(res.body);

                    var index = body.indexOf('modelNameFromSchema collection created');
                    index.should.be.above(0);

                    done();
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
                            .end(function (err, res) {
                                //
                                done();
                            });
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
            app.start(done);
        });

        after(function (done) {
            app.stop(done);
        });

        it('should return hello world', function (done) {
            var client = request(connectionString);

            client
            .get('/v1/test-endpoint')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .expect('content-type', 'application/json')
            .end(function (err, res) {
                if (err) return done(err);
                res.body.message.should.equal('Hello World');
                done();
            });
        });

        it('should allow custom routing via config() function', function (done) {

            var client = request(connectionString);

            client
            .get('/v1/new-endpoint-routing/55bb8f0a8d76f74b1303a135')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .expect('content-type', 'application/json')
            .end(function (err, res) {
                if (err) return done(err);

                res.body.message.should.equal('Endpoint with custom route provided through config() function...ID passed = 55bb8f0a8d76f74b1303a135');

                done();
            });

        });
    });

    describe('endpoint config api', function () {

        // mimic a file that could be sent to the server
        var jsSchemaString = fs.readFileSync(__dirname + '/../new-endpoint.js', {encoding: 'utf8'});

        var cleanup = function (done) {

            var dirs = config.get('paths');

            // try to cleanup these tests directory tree
            try {
                fs.unlinkSync(dirs.endpoints + '/v1/endpoint.new-endpoint.js');
            } catch (err) {
            }
            try {
                fs.unlinkSync(dirs.endpoints + '/v2/endpoint.new-endpoint.js');
            } catch (err) {
            }
            try {
                fs.rmdirSync(dirs.endpoints + '/v2');
            } catch (err) {
            }
            done();
        };

        before(function (done) {

            app.start(function () {

                help.getBearerTokenWithAccessType("admin", function (err, token) {
                    if (err) return done(err);

                    bearerToken = token;
                    done();
                });
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
                .get('/v1/new-endpoint?cache=false')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(404)
                .end(function (err) {
                    if (err) return done(err);

                    // create endpoint
                    client
                    .post('/v1/new-endpoint/config')
                    .send(jsSchemaString)
                    .set('content-type', 'text/plain')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .end(function (err, res) {
                        if (err) return done(err);

                        res.body.message.should.equal('Endpoint "v1:new-endpoint" created');

                        // wait, then test that endpoint was created
                        setTimeout(function () {
                            client
                            .get('/v1/new-endpoint?cache=false')
                            .set('Authorization', 'Bearer ' + bearerToken)
                            .expect(200)
                            //.expect('content-type', 'application/json')
                            .end(function (err, res) {
                                if (err) return done(err);

                                res.body.message.should.equal('endpoint created through the API');
                                done();
                            });
                        }, 1500);
                    });
                });
            });

            it('should allow updating an endpoint', function (done) {
                var client = request(connectionString);

                // make sure the endpoint exists from last test
                client
                .get('/v1/new-endpoint?cache=false')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .end(function (err, res) {
                    if (err) return done(err);

                    // get an updated version of the file
                    var fileArr = jsSchemaString.split('\n');
                    fileArr[0] = "var message = {message: 'endpoint updated through the API'};";
                    jsSchemaString = fileArr.join('\n');

                    // update endpoint
                    client
                    .post('/v1/new-endpoint/config')
                    .send(jsSchemaString)
                    .set('content-type', 'text/plain')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .end(function (err, res) {
                        if (err) return done(err);

                        // wait, then test that endpoint was created
                        setTimeout(function () {
                            client
                            .get('/v1/new-endpoint?cache=false')
                            .set('Authorization', 'Bearer ' + bearerToken)
                            .expect(200)
                            .expect('content-type', 'application/json')
                            .end(function (err, res) {
                                if (err) return done(err);

                                res.body.message.should.equal('endpoint updated through the API');
                                done();
                            });
                        }, 500);
                    });
                });
            });

            it('should allow creating a new endpoint for a new version number', function (done) {
                var client = request(connectionString);

                // make sure the endpoint is not already there
                client
                .get('/v2/new-endpoint?cache=false')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(404)
                .end(function (err) {
                    if (err) return done(err);

                    // create endpoint
                    client
                    .post('/v2/new-endpoint/config')
                    .send(jsSchemaString)
                    .set('content-type', 'text/plain')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .end(function (err, res) {
                        if (err) return done(err);

                        res.body.message.should.equal('Endpoint "v2:new-endpoint" created');

                        // wait, then test that endpoint was created
                        setTimeout(function () {
                            client
                            .get('/v2/new-endpoint?cache=false')
                            .set('Authorization', 'Bearer ' + bearerToken)
                            .expect(200)
                            .expect('content-type', 'application/json')
                            .end(function (err, res) {
                                if (err) return done(err);

                                res.body.message.should.equal('endpoint updated through the API');
                                done();
                            });
                        }, 1500);
                    });
                });
            });
        });

        describe('GET', function () {
            it('should NOT return the Javascript file backing the endpoint', function (done) {
                request(connectionString)
                .get('/v1/test-endpoint/config?cache=false')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(404)
                .end(done);
            });
        });

        describe('DELETE', function () {
            it('should NOT remove the custom endpoint', function (done) {
                request(connectionString)
                .delete('/v1/test-endpoint/config')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(404)
                .end(done);
            });
        });
    });

    describe('config api', function () {
        var config = require(__dirname + '/../../config.js');
        var configPath = path.resolve(config.configPath());
        var originalConfig = fs.readFileSync(configPath).toString();

        beforeEach(function (done) {
            app.start(done);
        });

        afterEach(function (done) {

            // restore the config file to its original state
            fs.writeFileSync(configPath, originalConfig);
            app.stop(done);
        });

        describe('GET', function () {
            it('should return the current config', function (done) {

                help.getBearerTokenWithAccessType("admin", function (err, token) {
                    if (err) return done(err);

                    bearerToken = token;

                    request(connectionString)
                    .get('/api/config')
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
                        //should.deepEqual(res.body, config);

                        done();
                    });
                });
            });

            it('should load a domain-specific config', function (done) {

                var testConfigPath = './config/config.test.json';
                var domainConfigPath;

                function loadConfig(server) {
                  domainConfigPath = './config/' + server.host + ':' + server.port + '.json';

                  try {
                    var testConfig = JSON.parse(fs.readFileSync(testConfigPath, { encoding: 'utf-8'}));
                    testConfig.app.name = 'Domain Loaded Config';
                    fs.writeFileSync(domainConfigPath, JSON.stringify(testConfig, null, 2));
                  }
                  catch (err) {
                    console.log(err);
                  }
                }

                loadConfig(config.get('server'));

                help.getBearerTokenWithAccessType("admin", function (err, token) {
                    if (err) return done(err);

                    bearerToken = token;

                    delete require.cache[__dirname + '/../../config'];

                    setTimeout(function() {
                      request(connectionString)
                      .get('/api/config')
                      .set('Authorization', 'Bearer ' + bearerToken)
                      .expect(200)
                      .expect('content-type', 'application/json')
                      .end(function (err, res) {
                          if (err) return done(err);

                          try {
                            fs.unlinkSync(domainConfigPath);
                          }
                          catch (err) {
                            console.log(err);
                          }

                          res.body.should.be.Object;
                          should.exist(res.body.app);
                          res.body.app.name.should.eql('Domain Loaded Config');

                          done();
                      });
                    }, 200);
                });
            });

            it('should only allow authenticated users access', function (done) {
                request(connectionString)
                .get('/api/config')
                .set('Authorization', 'Bearer e91e69b4-6563-43bd-a793-cb2af4ba62f4') // invalid token
                .expect(401)
                .end(function (err, res) {
                    if (err) return done(err);
                    done();
                })
            });
        });

        describe('POST', function () {
            it('should allow updating the main config file', function (done) {
                var client = request(connectionString);

                client
                .get('/api/config')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .expect('content-type', 'application/json')
                .end(function (err, res) {
                    if (err) return done(err);

                    should.exist(res.body);
                    res.body.auth.tokenTtl = 100;

                    client
                    .post('/api/config')
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
                        config.loadFile(configPath);

                        config.get('auth.tokenTtl').should.equal(100);
                        done();
                    });
                });
            });
        });
    });
});
