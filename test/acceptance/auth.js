var should = require('should');
var request = require('supertest');
var config = require(__dirname + '/../../config');
var help = require(__dirname + '/help');
var app = require(__dirname + '/../../dadi/lib/');
var tokens = require(__dirname + '/../../dadi/lib/auth/tokens');
var fs = require('fs');

var originalSchemaPath = __dirname + '/../new-schema.json';
var testSchemaPath = __dirname + '/workspace/collections/vtest/testdb/collection.test-schema.json';

describe('Authentication', function () {
    var tokenRoute = config.get('auth.tokenUrl');

    before(function (done) {

        help.createClient(null, function() {

        app.start(function (err) {
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
        var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

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
        var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

        client
        .post(tokenRoute)
        .send({
            clientId: 'test123',
            secret: 'badSecret',
            code: ' '
        })
        .expect(401, function(err, res) {
          res.headers['www-authenticate'].should.exist;
          res.headers['www-authenticate'].should.eql('Bearer, error="invalid_credentials", error_description="Invalid credentials supplied"');
          done();
        });
    });

    it('should allow requests containing token', function (done) {
        help.getBearerToken(function (err, token) {

            var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

            client
            .get('/vtest/testdb/test-schema')
            .set('Authorization', 'Bearer ' + token)
            .expect('content-type', 'application/json')
            .expect(200, done);
        });
    });

    it('should not allow requests containing invalid token', function (done) {

        help.getBearerToken(function (err, token) {
            var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

            client
            .get('/vtest/testdb/test-schema')
            .set('Authorization', 'Bearer badtokenvalue')
            .expect(401, function(err, res) {
              res.headers['www-authenticate'].should.exist;
              res.headers['www-authenticate'].should.eql('Bearer, error="invalid_token", error_description="Invalid or expired access token"');
              done();
            });
        });
    });

    it('should not allow requests with expired tokens', function (done) {
        this.timeout(4000);

        var oldTtl = Number(config.get('auth.tokenTtl'));
        config.set('auth.tokenTtl', 1);

        var _done = function (err) {
            config.set('auth.tokenTtl', oldTtl);
            done(err);
        };

        help.getBearerToken(function (err, token) {

            var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

            client
            .get('/vtest/testdb/test-schema')
            .set('Authorization', 'Bearer ' + token)
            .expect(200, function (err) {
                if (err) return _done(err);

                setTimeout(function () {
                    client
                    .get('/vtest/testdb/test-schema')
                    .set('Authorization', 'Bearer ' + token)
                    .expect(401, function(err, res) {
                      res.headers['www-authenticate'].should.exist;
                      res.headers['www-authenticate'].should.eql('Bearer, error="invalid_token", error_description="Invalid or expired access token"');
                      _done();
                    })
                }, 2000);
            });
        });
    });

    it('should not allow POST requests for collection config by clients with accessType `user`', function (done) {

        help.getBearerTokenWithAccessType("user", function (err, token) {

            var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

            var testSchema = fs.readFileSync(originalSchemaPath, {encoding: 'utf8'});

            client
            .post('/vtest/testdb/test-schema/config')
            .send(testSchema)
            .set('Authorization', 'Bearer ' + token)
            .expect(401)
            //.expect('content-type', 'application/json')
            .end(function(err,res) {
                if (err) return done(err);
                res.headers['www-authenticate'].should.exist;
                res.headers['www-authenticate'].should.eql('Bearer realm="/vtest/testdb/test-schema/config"');
                done();
            });
        });
    });

    it('should allow GET requests for collection config by clients with accessType `user`', function (done) {

        help.getBearerTokenWithAccessType("user", function (err, token) {

            var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

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

            var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

            var testSchema = fs.readFileSync(originalSchemaPath, {encoding: 'utf8'});

            client
            .post('/vtest/testdb/test-schema/config')
            .send(testSchema)
            .set('Authorization', 'Bearer ' + token)
            .expect(401)
            //.expect('content-type', 'application/json')
            .end(function(err,res) {
                if (err) return done(err);
                res.headers['www-authenticate'].should.exist;
                res.headers['www-authenticate'].should.eql('Bearer realm="/vtest/testdb/test-schema/config"');
                done();
            });
        });
    });

    it('should allow requests for collection config by clients with accessType `admin`', function (done) {

        help.getBearerTokenWithAccessType("admin", function (err, token) {

            var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

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
            var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

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

    it('should allow unauthenticated GET request for collection specifying read-only authentication settings', function (done) {

        help.getBearerTokenWithAccessType("admin", function (err, token) {
            var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

            var jsSchemaString = fs.readFileSync(testSchemaPath, {encoding: 'utf8'});
            var schema = JSON.parse(jsSchemaString);

            // update the schema
            schema.settings.authenticate = ['POST', 'PUT', 'DELETE'];

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

    it('should not allow unauthenticated POST request for collection specifying read-only authentication settings', function (done) {

        help.getBearerTokenWithAccessType("admin", function (err, token) {
            var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

            var jsSchemaString = fs.readFileSync(testSchemaPath, {encoding: 'utf8'});
            var schema = JSON.parse(jsSchemaString);

            // update the schema
            schema.settings.authenticate = ['POST', 'PUT', 'DELETE'];

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
                    .post('/vtest/testdb/test-schema')
                    .expect(401)
                    .expect('content-type', 'application/json')
                    .end(function(err,res) {
                        if (err) return done(err);
                        done();
                    });
                }, 300);
            });
        });
    });

    it('should allow access to collection specified in client permissions list without apiVersion restriction', function (done) {

        var permissions = { permissions: { collections: [ { path: "test-schema" } ] } }

        help.getBearerTokenWithPermissions(permissions, function (err, token) {

            var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

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

    it('should allow access to collection specified in client permissions list with apiVersion restriction', function (done) {

        var permissions = { permissions: { collections: [ { apiVersion: 'vtest', path: "test-schema" } ] } }

        help.getBearerTokenWithPermissions(permissions, function (err, token) {

            var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

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

    it('should not allow access to collection specified in client permissions list with apiVersion restriction', function (done) {

        var permissions = { permissions: { collections: [ { apiVersion: '1.0', path: "test-schema" } ] } }

        help.getBearerTokenWithPermissions(permissions, function (err, token) {

            var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

            // Wait, then test that we can make an unauthenticated request
            setTimeout(function () {
                client
                .get('/vtest/testdb/test-schema?cache=false')
                .set('Authorization', 'Bearer ' + token)
                .expect(401)
                //.expect('content-type', 'application/json')
                .end(function(err,res) {
                    if (err) return done(err);
                    res.headers['www-authenticate'].should.exist;
                    res.headers['www-authenticate'].should.eql('Bearer realm="/vtest/testdb/test-schema"');
                    done();
                });
            }, 300);
        });
    });

    it('should not allow access to collection not specified in client permissions list', function (done) {

        var permissions = { permissions: { collections: [ { apiVersion: 'vtest', path: "books" } ] } }

        help.getBearerTokenWithPermissions(permissions, function (err, token) {

            var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

            // Wait, then test that we can make an unauthenticated request
            setTimeout(function () {
                client
                .get('/vtest/testdb/test-schema?cache=false')
                .set('Authorization', 'Bearer ' + token)
                .expect(401)
                //.expect('content-type', 'application/json')
                .end(function(err,res) {
                    if (err) return done(err);
                    res.headers['www-authenticate'].should.exist;
                    res.headers['www-authenticate'].should.eql('Bearer realm="/vtest/testdb/test-schema"');
                    done();
                });
            }, 300);
        });
    });

    it('should allow access to endpoint specified in client permissions list without apiVersion restriction', function (done) {

        var permissions = { permissions: { endpoints: [ { path: "test-endpoint" } ] } }

        help.getBearerTokenWithPermissions(permissions, function (err, token) {

            var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

            // Wait, then test that we can make an unauthenticated request
            setTimeout(function () {
                client
                .get('/v1/test-endpoint')
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

    it('should allow access to endpoint specified in client permissions list with apiVersion restriction', function (done) {

        var permissions = { permissions: { endpoints: [ { apiVersion: 'v1', path: "test-endpoint" } ] } }

        help.getBearerTokenWithPermissions(permissions, function (err, token) {

            var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

            // Wait, then test that we can make an unauthenticated request
            setTimeout(function () {
                client
                .get('/v1/test-endpoint')
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

        var permissions = { permissions: { endpoints: [ { apiVersion: 'v1', path: "xxxx-endpoint" } ] } }

        help.getBearerTokenWithPermissions(permissions, function (err, token) {

            var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

            // Wait, then test that we can make an unauthenticated request
            setTimeout(function () {
                client
                .get('/v1/test-endpoint')
                .set('Authorization', 'Bearer ' + token)
                .expect(401)
                //.expect('content-type', 'application/json')
                .end(function(err,res) {
                    if (err) return done(err);
                    res.headers['www-authenticate'].should.exist;
                    res.headers['www-authenticate'].should.eql('Bearer realm="/v1/test-endpoint"');
                    done();
                });
            }, 300);
        });
    });

    it('should not allow access to endpoint specified in client permissions list with apiVersion restriction', function (done) {

        var permissions = { permissions: { endpoints: [ { apiVersion: 'v2', path: "test-endpoint" } ] } }

        help.getBearerTokenWithPermissions(permissions, function (err, token) {

            var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

            // Wait, then test that we can make an unauthenticated request
            setTimeout(function () {
                client
                .get('/v1/test-endpoint')
                .set('Authorization', 'Bearer ' + token)
                .expect(401)
                //.expect('content-type', 'application/json')
                .end(function(err,res) {
                    if (err) return done(err);
                    res.headers['www-authenticate'].should.exist;
                    res.headers['www-authenticate'].should.eql('Bearer realm="/v1/test-endpoint"');
                    done();
                });
            }, 300);
        });
    });

    // it('should not allow access to serama config when client permissions specified', function (done) {

    //     var permissions = { permissions: { collections: [ { apiVersion: "v1", path: "books" } ] } }

    //     help.getBearerTokenWithPermissions(permissions, function (err, token) {

    //         var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

    //         // Wait, then test that we can make an unauthenticated request
    //         setTimeout(function () {
    //             client
    //             .get('/serama/config')
    //             .set('Authorization', 'Bearer ' + token)
    //             .expect(401)
    //             //.expect('content-type', 'application/json')
    //             .end(function(err,res) {
    //                 if (err) return done(err);
    //                 done();
    //             });
    //         }, 300);
    //     });
    // });

    it('should allow access to collection when no permissions specified', function (done) {

        help.getBearerToken(function (err, token) {

            var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

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

            var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

            // Wait, then test that we can make an unauthenticated request
            setTimeout(function () {
                client
                .get('/v1/test-endpoint')
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
