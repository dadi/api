var should = require('should');
var request = require('supertest');
var fs = require('fs');
var path = require('path');
var needle = require('needle');
var url = require('url');
var config = require(__dirname + '/../../config');
var help = require(__dirname + '/help');
var app = require(__dirname + '/../../dadi/lib/');
var tokens = require(__dirname + '/../../dadi/lib/auth/tokens');


var originalSchemaPath = __dirname + '/../new-schema.json';
var testSchemaPath = __dirname + '/workspace/collections/vtest/testdb/collection.test-schema.json';

describe('Authentication', function () {
    var tokenRoute = config.get('auth.tokenUrl');
    describe('General Request', function () {
        before(function (done) {
            config.set('server.http2.enabled', false);
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
            .expect(401, done);
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
                .expect(401, done);
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
                        .expect(401, _done);
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
    
    describe('HTTP2 Request', function () {
        before(function (done) {
            config.set('server.http2.enabled', true);
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
            var doc_link = 'https://localhost:'+config.get('server.port') + tokenRoute;
            var options = url.parse(doc_link);
            options.key = fs.readFileSync(config.get('server.http2.key_path'));
            options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
            needle.post(doc_link, {clientId: 'test123', secret: 'superSecret'}, options, function(err, res) {
                if (err) return done(err);
                should(res.headers['content-type']).be.match(/json/);
                should(res.headers['pragma']).be.equal('no-cache');
                should(res.statusCode).be.equal(200);
                done();
            });
        });

        it('should not issue token if creds are invalid', function (done) {
            var doc_link = 'https://localhost:'+config.get('server.port') + tokenRoute;
            var options = url.parse(doc_link);
            options.key = fs.readFileSync(config.get('server.http2.key_path'));
            options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
            needle.post(doc_link, {clientId: 'test123', secret: 'badSecret', code: ' '}, options, function(err, res) {
                if (err) return done(err);
                should(res.statusCode).be.equal(401);
                done();
            });
        });

        it('should allow requests containing token', function (done) {
            help.getBearerTokenHttps(function (err, token) {
                var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-schema';
                var options = url.parse(doc_link);
                options.key = fs.readFileSync(config.get('server.http2.key_path'));
                options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                options.headers = {
                  'Authorization': 'Bearer ' + token
                };
                needle.get(doc_link, options, function(err, res) {
                    if (err) return done(err);
                    should(res.headers['content-type']).be.match(/json/);
                    should(res.statusCode).be.equal(200);
                    done();
                });
            });
        });

        it('should not allow requests containing invalid token', function (done) {

            help.getBearerTokenHttps(function (err, token) {
                var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-schema';
                var options = url.parse(doc_link);
                options.key = fs.readFileSync(config.get('server.http2.key_path'));
                options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                
                needle.get(doc_link, options, function(err, res) {
                    if (err) return done(err);
                    should(res.statusCode).be.equal(401);
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

            help.getBearerTokenHttps(function (err, token) {
                var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-schema';
                var options = url.parse(doc_link);
                options.key = fs.readFileSync(config.get('server.http2.key_path'));
                options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                options.headers = {
                  'Authorization': 'Bearer ' + token
                };
                needle.get(doc_link, options, function(err, res) {
                    if (err) return _done(err);
                    setTimeout(function () {
                        needle.get(doc_link, options, function(err, res) {
                            should(res.statusCode).be.equal(401);
                            _done();
                        });
                    }, 2000);
                });
            });
        });

        it('should not allow POST requests for collection config by clients with accessType `user`', function (done) {

            help.getBearerTokenWithAccessTypeHttps("user", function (err, token) {
                var testSchema = fs.readFileSync(originalSchemaPath, {encoding: 'utf8'});
                var schema = JSON.parse(testSchema);
                var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-schema/config';
                var options = url.parse(doc_link);
                options.key = fs.readFileSync(config.get('server.http2.key_path'));
                options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                options.headers = {
                  'Authorization': 'Bearer ' + token
                };
                options.json = true;
                needle.post(doc_link, schema, options, function(err, res) {
                    if (err) return done(err);
                    done();
                });
            });
        });

        it('should allow GET requests for collection config by clients with accessType `user`', function (done) {

            help.getBearerTokenWithAccessTypeHttps("user", function (err, token) {
                var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-schema/config';
                var options = url.parse(doc_link);
                options.key = fs.readFileSync(config.get('server.http2.key_path'));
                options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                options.headers = {
                  'Authorization': 'Bearer ' + token
                };
                needle.get(doc_link, options, function(err, res) {
                    if (err) return done(err);
                    done();
                });
            });
        });

        it('should not allow POST requests for collection config by clients with no accessType specified', function (done) {

            help.getBearerTokenHttps(function (err, token) {
                var testSchema = fs.readFileSync(originalSchemaPath, {encoding: 'utf8'});
                var schema = JSON.parse(testSchema);
                var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-schema/config';
                var options = url.parse(doc_link);
                options.key = fs.readFileSync(config.get('server.http2.key_path'));
                options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                options.headers = {
                  'Authorization': 'Bearer ' + token
                };
                options.json = true;
                needle.post(doc_link, schema, options, function(err, res) {
                    if (err) return done(err);
                    should(res.statusCode).be.equal(401);
                    done();
                });
            });
        });

        it('should allow requests for collection config by clients with accessType `admin`', function (done) {

            help.getBearerTokenWithAccessTypeHttps("admin", function (err, token) {
                var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-schema/config';
                var options = url.parse(doc_link);
                options.key = fs.readFileSync(config.get('server.http2.key_path'));
                options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                options.headers = {
                  'Authorization': 'Bearer ' + token
                };
                needle.get(doc_link, options, function(err, res) {
                    if (err) return done(err);
                    should(res.statusCode).be.equal(200);
                    done();
                });
            });
        });

        it('should allow unauthenticated request for collection specifying authenticate = false', function (done) {

            help.getBearerTokenWithAccessTypeHttps("admin", function (err, token) {
                var jsSchemaString = fs.readFileSync(testSchemaPath, {encoding: 'utf8'});
                var schema = JSON.parse(jsSchemaString);

                // update the schema
                schema.settings.authenticate = false;

                var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-schema/config';
                var options = url.parse(doc_link);
                options.key = fs.readFileSync(config.get('server.http2.key_path'));
                options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                options.headers = {
                  'Authorization': 'Bearer ' + token
                };
                options.json = true;
                needle.post(doc_link, schema, options, function(err, res) {
                    if (err) return done(err);
                    should(res.statusCode).be.equal(200);
                    setTimeout(function () {
                        var second_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-schema';
                        needle.get(second_link, options, function(err, res) {
                            if (err) return done(err);
                            should(res.statusCode).be.equal(200);
                            should(res.headers['content-type']).be.match(/json/);
                            done();
                        });
                    }, 300);
                });
            });
        });

        it('should allow access to collection specified in client permissions list without apiVersion restriction', function (done) {

            var permissions = { permissions: { collections: [ { path: "test-schema" } ] } }

            help.getBearerTokenWithPermissionsHttps(permissions, function (err, token) {

                // Wait, then test that we can make an unauthenticated request
                setTimeout(function () {
                    var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-schema?cache=false';
                    var options = url.parse(doc_link);
                    options.key = fs.readFileSync(config.get('server.http2.key_path'));
                    options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                    options.headers = {
                      'Authorization': 'Bearer ' + token
                    };
                    needle.get(doc_link, options, function(err, res) {
                        if (err) return done(err);
                        should(res.statusCode).be.equal(200);
                        done();
                    });
                }, 300);
            });
        });

        it('should allow access to collection specified in client permissions list with apiVersion restriction', function (done) {

            var permissions = { permissions: { collections: [ { apiVersion: 'vtest', path: "test-schema" } ] } }

            help.getBearerTokenWithPermissionsHttps(permissions, function (err, token) {

                // Wait, then test that we can make an unauthenticated request
                setTimeout(function () {
                    var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-schema?cache=false';
                    var options = url.parse(doc_link);
                    options.key = fs.readFileSync(config.get('server.http2.key_path'));
                    options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                    options.headers = {
                      'Authorization': 'Bearer ' + token
                    };
                    needle.get(doc_link, options, function(err, res) {
                        if (err) return done(err);
                        should(res.statusCode).be.equal(200);
                        done();
                    });
                }, 300);
            });
        });

        it('should not allow access to collection specified in client permissions list with apiVersion restriction', function (done) {

            var permissions = { permissions: { collections: [ { apiVersion: '1.0', path: "test-schema" } ] } }

            help.getBearerTokenWithPermissionsHttps(permissions, function (err, token) {

                // Wait, then test that we can make an unauthenticated request
                setTimeout(function () {
                    var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-schema?cache=false';
                    var options = url.parse(doc_link);
                    options.key = fs.readFileSync(config.get('server.http2.key_path'));
                    options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                    options.headers = {
                      'Authorization': 'Bearer ' + token
                    };
                    needle.get(doc_link, options, function(err, res) {
                        if (err) return done(err);
                        should(res.statusCode).be.equal(401);
                        done();
                    });
                }, 300);
            });
        });

        it('should not allow access to collection not specified in client permissions list', function (done) {

            var permissions = { permissions: { collections: [ { apiVersion: 'vtest', path: "books" } ] } }

            help.getBearerTokenWithPermissionsHttps(permissions, function (err, token) {

                // Wait, then test that we can make an unauthenticated request
                setTimeout(function () {
                    var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-schema?cache=false';
                    var options = url.parse(doc_link);
                    options.key = fs.readFileSync(config.get('server.http2.key_path'));
                    options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                    options.headers = {
                      'Authorization': 'Bearer ' + token
                    };
                    needle.get(doc_link, options, function(err, res) {
                        if (err) return done(err);
                        should(res.statusCode).be.equal(401);
                        done();
                    });
                }, 300);
            });
        });

        it('should allow access to endpoint specified in client permissions list without apiVersion restriction', function (done) {

            var permissions = { permissions: { endpoints: [ { path: "test-endpoint" } ] } }

            help.getBearerTokenWithPermissionsHttps(permissions, function (err, token) {

                // Wait, then test that we can make an unauthenticated request
                setTimeout(function () {
                    var doc_link = 'https://localhost:'+config.get('server.port') + '/v1/test-endpoint';
                    var options = url.parse(doc_link);
                    options.key = fs.readFileSync(config.get('server.http2.key_path'));
                    options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                    options.headers = {
                      'Authorization': 'Bearer ' + token
                    };
                    needle.get(doc_link, options, function(err, res) {
                        if (err) return done(err);
                        should(res.statusCode).be.equal(200);
                        done();
                    });
                }, 300);
            });
        });

        it('should allow access to endpoint specified in client permissions list with apiVersion restriction', function (done) {

            var permissions = { permissions: { endpoints: [ { apiVersion: 'v1', path: "test-endpoint" } ] } }

            help.getBearerTokenWithPermissionsHttps(permissions, function (err, token) {

                // Wait, then test that we can make an unauthenticated request
                setTimeout(function () {
                    var doc_link = 'https://localhost:'+config.get('server.port') + '/v1/test-endpoint';
                    var options = url.parse(doc_link);
                    options.key = fs.readFileSync(config.get('server.http2.key_path'));
                    options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                    options.headers = {
                      'Authorization': 'Bearer ' + token
                    };
                    needle.get(doc_link, options, function(err, res) {
                        if (err) return done(err);
                        should(res.statusCode).be.equal(200);
                        done();
                    });
                }, 300);
            });
        });

        it('should not allow access to endpoint not specified in client permissions list', function (done) {

            var permissions = { permissions: { endpoints: [ { apiVersion: 'v1', path: "xxxx-endpoint" } ] } }

            help.getBearerTokenWithPermissionsHttps(permissions, function (err, token) {

                // Wait, then test that we can make an unauthenticated request
                setTimeout(function () {
                    var doc_link = 'https://localhost:'+config.get('server.port') + '/v1/test-endpoint';
                    var options = url.parse(doc_link);
                    options.key = fs.readFileSync(config.get('server.http2.key_path'));
                    options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                    options.headers = {
                      'Authorization': 'Bearer ' + token
                    };
                    needle.get(doc_link, options, function(err, res) {
                        if (err) return done(err);
                        should(res.statusCode).be.equal(401);
                        done();
                    });
                }, 300);
            });
        });

        it('should not allow access to endpoint specified in client permissions list with apiVersion restriction', function (done) {

            var permissions = { permissions: { endpoints: [ { apiVersion: 'v2', path: "test-endpoint" } ] } }

            help.getBearerTokenWithPermissionsHttps(permissions, function (err, token) {

                // Wait, then test that we can make an unauthenticated request
                setTimeout(function () {
                    var doc_link = 'https://localhost:'+config.get('server.port') + '/v1/test-endpoint';
                    var options = url.parse(doc_link);
                    options.key = fs.readFileSync(config.get('server.http2.key_path'));
                    options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                    options.headers = {
                      'Authorization': 'Bearer ' + token
                    };
                    needle.get(doc_link, options, function(err, res) {
                        if (err) return done(err);
                        should(res.statusCode).be.equal(401);
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

            help.getBearerTokenHttps(function (err, token) {

                // Wait, then test that we can make an unauthenticated request
                setTimeout(function () {
                    var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-schema';
                    var options = url.parse(doc_link);
                    options.key = fs.readFileSync(config.get('server.http2.key_path'));
                    options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                    options.headers = {
                      'Authorization': 'Bearer ' + token
                    };
                    needle.get(doc_link, options, function(err, res) {
                        if (err) return done(err);
                        should(res.statusCode).be.equal(200);
                        done();
                    });
                }, 300);
            });
        });

        it('should allow access to endpoint when no permissions specified', function (done) {

            help.getBearerTokenHttps(function (err, token) {

                // Wait, then test that we can make an unauthenticated request
                setTimeout(function () {
                    var doc_link = 'https://localhost:'+config.get('server.port') + '/v1/test-endpoint';
                    var options = url.parse(doc_link);
                    options.key = fs.readFileSync(config.get('server.http2.key_path'));
                    options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                    options.headers = {
                      'Authorization': 'Bearer ' + token
                    };
                    needle.get(doc_link, options, function(err, res) {
                        if (err) return done(err);
                        should(res.statusCode).be.equal(200);
                        done();
                    });
                }, 300);
            });
        });
    });
});
