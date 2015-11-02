var should = require('should');
var request = require('supertest');
var config = require(__dirname + '/../../config');
var help = require(__dirname + '/help');
var app = require(__dirname + '/../../bantam/lib/');
var tokens = require(__dirname + '/../../bantam/lib/auth/tokens');
var fs = require('fs');

var originalSchemaPath = __dirname + '/../new-schema.json';
var testSchemaPath = __dirname + '/workspace/collections/vtest/testdb/collection.test-schema.json';

describe('Authentication', function () {
    var tokenRoute = config.auth.tokenUrl;

    before(function (done) {

        help.createClient(null, function() {

        app.start({
            collectionPath: __dirname + '/workspace/collections',
            endpointPath: __dirname + '/workspace/endpoints'
        }, function (err) {
            if (err) return done(err);

            // give it a moment for http.Server to finish starting
            setTimeout(function () {
                done();
            }, 500);
        })
        });
    });

    after(function (done) {
        help.removeTestClients(function() {
            app.stop(done);
        });
    });

    afterEach(function (done) {
        var testSchema = fs.readFileSync(originalSchemaPath, {encoding: 'utf8'});
        testSchema = testSchema.replace('newField', 'field1');
        fs.writeFile(testSchemaPath, testSchema, function (err) {
          if (err) throw err;
          done();
        });
    })

    it('should issue a bearer token', function (done) {
        var client = request('http://' + config.server.host + ':' + config.server.port);

        client
        .post(tokenRoute)
        .send({
            clientId: 'test123',
            secret: 'superSecret'
        })
        .expect('content-type', 'application/json')
        .expect('pragma', 'no-cache')
        .expect('Cache-Control', 'no-store')
        .expect(200, done);
    });

    it('should not issue token if creds are invalid', function (done) {
        var client = request('http://' + config.server.host + ':' + config.server.port);

        client
        .post(tokenRoute)
        .send({
            clientId: 'test123',
            secret: 'badSecret',
            code: ' '
        })
        .expect(401, done);
    });

    it('should allow requests containing token', function (done) {
        help.getBearerToken(function (err, token) {

            var client = request('http://' + config.server.host + ':' + config.server.port);

            client
            .get('/vtest/testdb/test-schema')
            .set('Authorization', 'Bearer ' + token)
            .expect('content-type', 'application/json')
            .expect(200, done);
        });
    });

    it('should not allow requests containing invalid token', function (done) {

        help.getBearerToken(function (err, token) {
            var client = request('http://' + config.server.host + ':' + config.server.port);

            client
            .get('/vtest/testdb/test-schema')
            .set('Authorization', 'Bearer badtokenvalue')
            .expect(401, done);
        });
    });

    it('should not allow requests with expired tokens', function (done) {
        this.timeout(4000);

        var oldTtl = Number(config.auth.tokenTtl);
        config.auth.tokenTtl = 1;

        var _done = function (err) {
            config.auth.tokenTtl = oldTtl;
            done(err);
        };

        help.getBearerToken(function (err, token) {

            var client = request('http://' + config.server.host + ':' + config.server.port);

            client
            .get('/vtest/testdb/test-schema')
            .set('Authorization', 'Bearer ' + token)
            .expect(200, function (err) {
                if (err) return _done(err);

                setTimeout(function () {
                    client
                    .get('/vtest/testdb/test-schema')
                    .set('Authorization', 'Bearer ' + token)
                    .expect(401, _done);
                }, 2000);
            });
        });
    });

    it('should not allow POST requests for collection config by clients with accessType `user`', function (done) {

        help.getBearerTokenWithAccessType("user", function (err, token) {

            var client = request('http://' + config.server.host + ':' + config.server.port);

            var testSchema = fs.readFileSync(originalSchemaPath, {encoding: 'utf8'});

            client
            .post('/vtest/testdb/test-schema/config')
            .send(testSchema)
            .set('Authorization', 'Bearer ' + token)
            .expect(401)
            //.expect('content-type', 'application/json')
            .end(function(err,res) {
                if (err) return done(err);
                done();
            });
        });
    });

    it('should allow GET requests for collection config by clients with accessType `user`', function (done) {

        help.getBearerTokenWithAccessType("user", function (err, token) {

            var client = request('http://' + config.server.host + ':' + config.server.port);

            client
            .get('/vtest/testdb/test-schema/config')
            .set('Authorization', 'Bearer ' + token)
            .expect(200)
            //.expect('content-type', 'application/json')
            .end(function(err,res) {
                if (err) return done(err);
                done();
            });
        });
    });

    it('should not allow POST requests for collection config by clients with no accessType specified', function (done) {

        help.getBearerToken(function (err, token) {

            var client = request('http://' + config.server.host + ':' + config.server.port);

            var testSchema = fs.readFileSync(originalSchemaPath, {encoding: 'utf8'});

            client
            .post('/vtest/testdb/test-schema/config')
            .send(testSchema)
            .set('Authorization', 'Bearer ' + token)
            .expect(401)
            //.expect('content-type', 'application/json')
            .end(function(err,res) {
                if (err) return done(err);
                done();
            });
        });
    });

    it('should allow requests for collection config by clients with accessType `admin`', function (done) {

        help.getBearerTokenWithAccessType("admin", function (err, token) {

            var client = request('http://' + config.server.host + ':' + config.server.port);

            client
            .get('/vtest/testdb/test-schema/config')
            .set('Authorization', 'Bearer ' + token)
            .expect(200)
            //.expect('content-type', 'application/json')
            .end(function(err,res) {
                if (err) return done(err);
                done();
            });
        });
    });

    it('should allow unauthenticated request for collection specifying authenticate = false', function (done) {

        help.getBearerTokenWithAccessType("admin", function (err, token) {
            var client = request('http://' + config.server.host + ':' + config.server.port);

            var jsSchemaString = fs.readFileSync(testSchemaPath, {encoding: 'utf8'});
            var schema = JSON.parse(jsSchemaString);

            // update the schema
            schema.settings.authenticate = false;

            client
            .post('/vtest/testdb/test-schema/config')
            .send(JSON.stringify(schema))
            .set('content-type', 'text/plain')
            .set('Authorization', 'Bearer ' + token)
            .expect(200)
            //.expect('content-type', 'application/json')
            .end(function (err, res) {
                if (err) return done(err);

                // Wait, then test that we can make an unauthenticated request
                setTimeout(function () {
                    client
                    .get('/vtest/testdb/test-schema')
                    .expect(200)
                    .expect('content-type', 'application/json')
                    .end(function(err,res) {
                        if (err) return done(err);
                        done();
                    });
                }, 300);
            });
        });
    });

    it('should allow access to collection specified in client permissions list', function (done) {

        var permissions = { permissions: { collections: [ "test-schema" ] } }

        help.getBearerTokenWithPermissions(permissions, function (err, token) {

            var client = request('http://' + config.server.host + ':' + config.server.port);

            // Wait, then test that we can make an unauthenticated request
            setTimeout(function () {
                client
                .get('/vtest/testdb/test-schema?cache=false')
                .set('Authorization', 'Bearer ' + token)
                .expect(200)
                //.expect('content-type', 'application/json')
                .end(function(err,res) {
                    if (err) return done(err);
                    done();
                });
            }, 300);
        });
    });

    it('should not allow access to collection not specified in client permissions list', function (done) {

        var permissions = { permissions: { collections: [ "books" ] } }

        help.getBearerTokenWithPermissions(permissions, function (err, token) {

            var client = request('http://' + config.server.host + ':' + config.server.port);

            // Wait, then test that we can make an unauthenticated request
            setTimeout(function () {
                client
                .get('/vtest/testdb/test-schema?cache=false')
                .set('Authorization', 'Bearer ' + token)
                .expect(401)
                //.expect('content-type', 'application/json')
                .end(function(err,res) {
                    if (err) return done(err);
                    done();
                });
            }, 300);
        });
    });

    it('should allow access to endpoint specified in client permissions list', function (done) {

        var permissions = { permissions: { endpoints: [ "v1/test-endpoint" ] } }

        help.getBearerTokenWithPermissions(permissions, function (err, token) {

            var client = request('http://' + config.server.host + ':' + config.server.port);

            // Wait, then test that we can make an unauthenticated request
            setTimeout(function () {
                client
                .get('/endpoints/v1/test-endpoint')
                .set('Authorization', 'Bearer ' + token)
                .expect(200)
                //.expect('content-type', 'application/json')
                .end(function(err,res) {
                    if (err) return done(err);
                    done();
                });
            }, 300);
        });
    });

    it('should not allow access to endpoint not specified in client permissions list', function (done) {

        var permissions = { permissions: { endpoints: [ "v1/xxxx-endpoint" ] } }

        help.getBearerTokenWithPermissions(permissions, function (err, token) {

            var client = request('http://' + config.server.host + ':' + config.server.port);

            // Wait, then test that we can make an unauthenticated request
            setTimeout(function () {
                client
                .get('/endpoints/v1/test-endpoint')
                .set('Authorization', 'Bearer ' + token)
                .expect(401)
                //.expect('content-type', 'application/json')
                .end(function(err,res) {
                    if (err) return done(err);
                    done();
                });
            }, 300);
        });
    });

    it('should not allow access to serama config when client permissions specified', function (done) {

        var permissions = { permissions: { collections: [ "books" ] } }

        help.getBearerTokenWithPermissions(permissions, function (err, token) {

            var client = request('http://' + config.server.host + ':' + config.server.port);

            // Wait, then test that we can make an unauthenticated request
            setTimeout(function () {
                client
                .get('/serama/config')
                .set('Authorization', 'Bearer ' + token)
                .expect(401)
                //.expect('content-type', 'application/json')
                .end(function(err,res) {
                    if (err) return done(err);
                    done();
                });
            }, 300);
        });
    });

    it('should allow access to collection when no permissions specified', function (done) {

        help.getBearerToken(function (err, token) {

            var client = request('http://' + config.server.host + ':' + config.server.port);

            // Wait, then test that we can make an unauthenticated request
            setTimeout(function () {
                client
                .get('/vtest/testdb/test-schema')
                .set('Authorization', 'Bearer ' + token)
                .expect(200)
                //.expect('content-type', 'application/json')
                .end(function(err,res) {
                    if (err) return done(err);
                    done();
                });
            }, 300);
        });
    });

    it('should allow access to endpoint when no permissions specified', function (done) {

        help.getBearerToken(function (err, token) {

            var client = request('http://' + config.server.host + ':' + config.server.port);

            // Wait, then test that we can make an unauthenticated request
            setTimeout(function () {
                client
                .get('/endpoints/v1/test-endpoint')
                .set('Authorization', 'Bearer ' + token)
                .expect(200)
                //.expect('content-type', 'application/json')
                .end(function(err,res) {
                    if (err) return done(err);
                    done();
                });
            }, 300);
        });
    });

});
