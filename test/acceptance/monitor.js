var should = require('should');
var request = require('supertest');
var config = require(__dirname + '/../../config');
var fs = require('fs');
var app = require(__dirname + '/../../bantam/lib/');
var help = require(__dirname + '/help');

var originalSchemaPath = __dirname + '/workspace/monitor-collection/collection.monitor-test-schema.json';
var testSchemaPath = __dirname + '/workspace/collections/vtest/testdb/collection.monitor-test-schema.json';

var originalEndpointPath = __dirname + '/workspace/monitor-collection/endpoint.monitor-test-endpoint.js';
var testEndpointPath = __dirname + '/workspace/endpoints/endpoint.monitor-test-endpoint.js';

var bearerToken; // used through out tests

describe('File system watching', function () {
    
    before(function (done) {
        // start the app
        app.start({
            collectionPath: __dirname + '/workspace/collections',
            endpointPath: __dirname + '/workspace/endpoints'
        }, function (err) {
            if (err) return done(err);
            
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
    });

    after(function (done) {

        if (fs.existsSync(testSchemaPath)) fs.unlinkSync(testSchemaPath);
        if (fs.existsSync(testEndpointPath)) fs.unlinkSync(testEndpointPath);

        help.removeTestClients(function() {
            app.stop(done);
        });
    });

    beforeEach(function (done) {
        var testSchema = fs.readFileSync(originalSchemaPath);
        fs.writeFileSync(testSchemaPath, testSchema);

        var testEndpoint = fs.readFileSync(originalEndpointPath);
        fs.writeFileSync(testEndpointPath, testEndpoint);

        done();
    })

    describe('changing files', function () {

        it('should update collections component when file changes', function (done) {

            var client = request('http://' + config.server.host + ':' + config.server.port);

            setTimeout(function () {
                
                client
                .post('/vtest/testdb/monitor-test-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({field1: 'string value'})
                .expect(200)
                .expect('content-type', 'application/json')
                .end(function (err, res) {
                    if (err) return done(err);

                    // Change the schema file's content
                    var schemaPath = __dirname + '/workspace/collections/vtest/testdb/collection.monitor-test-schema.json'
                    // clone so that `require.cache` is unaffected
                    var schema = JSON.parse(JSON.stringify(require(schemaPath)));
                    schema.fields.field1.type = 'Number';
                    fs.writeFileSync(schemaPath, JSON.stringify(schema));

                    setTimeout(function () {
                        client
                        .post('/vtest/testdb/monitor-test-schema')
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .send({field1: 31337})
                        .expect(200)
                        .expect('content-type', 'application/json')
                        .end(done);
                    }, 300);
                });
            }, 300);

        });

        it('should update endpoint component when file changes', function (done) {

            var client = request('http://' + config.server.host + ':' + config.server.port);

            client
            .get('/endpoints/monitor-test-endpoint?cache=false')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            //.expect('content-type', 'application/json')
            .end(function (err, res) {
                if (err) return done(err);

                res.body.message.should.equal('version 1');

                // Change the endpoint file's content
                var endpoint = fs.readFileSync(testEndpointPath).toString();

                var lines = endpoint.split('\n');
                lines[0] = "var message = 'version 2';"
                fs.writeFileSync(testEndpointPath, lines.join('\n'));

                setTimeout(function () {
                    client
                    .get('/endpoints/monitor-test-endpoint?cache=false')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .expect('content-type', 'application/json')
                    .end(function (err, res) {
                        if (err) return done(err);

                        res.body.message.should.equal('version 2');
                        done();
                    });
                }, 300);
            });
        });

    });

    describe('adding new files', function () {

        var newSchemaPath = __dirname + '/workspace/collections/vtest2/testdb/collection.new-test-schema.json';
        var newEndpointPath = __dirname + '/workspace/endpoints/endpoint.new-test-endpoint.js';

        before(function (done) {
            // tests are going to try to create these directories and they shouldn't exist before hand
            if (fs.existsSync(__dirname + '/workspace/collections/vtest2/testdb')) {
                fs.rmdirSync(__dirname + '/workspace/collections/vtest2/testdb');
            }
            if (fs.existsSync(__dirname + '/workspace/collections/vtest2')) {
                fs.rmdirSync(__dirname + '/workspace/collections/vtest2');
            }

            done();
        })

        after(function (done) {
            fs.unlinkSync(newSchemaPath);
            fs.unlinkSync(newEndpointPath);
            fs.rmdirSync(__dirname + '/workspace/collections/vtest2/testdb');
            fs.rmdirSync(__dirname + '/workspace/collections/vtest2');
            done();
        });

        it('should add to collections api when file is added', function (done) {

            // make a copy of the test schema in a new collections dir
            var testSchema = fs.readFileSync(originalSchemaPath);

            fs.mkdirSync(__dirname + '/workspace/collections/vtest2');
            fs.mkdirSync(__dirname + '/workspace/collections/vtest2/testdb');
            fs.writeFileSync(newSchemaPath, testSchema);

            // allow time for app to respond
            setTimeout(function () {
                var client = request('http://' + config.server.host + ':' + config.server.port);

                client
                .get('/vtest2/testdb/new-test-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .expect('content-type', 'application/json')
                .end(done);
            }, 300);
        });

        it('should add to endpoints api when file is added', function (done) {

            // Change the endpoint file's content
            var endpoint = fs.readFileSync(testEndpointPath).toString();

            var lines = endpoint.split('\n');
            lines[0] = "var message = 'version 2';"
            fs.writeFileSync(newEndpointPath, lines.join('\n'));

            setTimeout(function () {
                var client = request('http://' + config.server.host + ':' + config.server.port);

                client
                .get('/endpoints/new-test-endpoint')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .expect('content-type', 'application/json')
                .end(function (err, res) {
                    if (err) return done(err);

                    res.body.message.should.equal('version 2');
                    done();
                });
            }, 300);
        });
    });

    describe('removing existing files', function () {
        it('should remove endpoint from api when file is removed', function (done) {
            fs.unlinkSync(testEndpointPath);

            var client = request('http://' + config.server.host + ':' + config.server.port);

            client
            .get('/endpoints/monitor-test-endpoint?cache=false')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(404)
            .end(done);
        });

        it('should remove collection from api when file is removed', function (done) {
            fs.unlinkSync(testSchemaPath);

            var client = request('http://' + config.server.host + ':' + config.server.port);

            client
            .get('/vtest/testdb/monitor-test-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(404)
            .end(done);
        });
    });
});
