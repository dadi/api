var should = require('should');
var request = require('supertest');
var needle = require('needle');
var url = require('url');
var fs = require('fs');
var config = require(__dirname + '/../../config');
var help = require(__dirname + '/help');
var appHelp = require(__dirname + '/../../dadi/lib/help');
var app = require(__dirname + '/../../dadi/lib/');

// variables scoped for use throughout tests
var bearerToken;
var connectionString = 'http://' + config.get('server.host') + ':' + config.get('server.port');

describe('middleware extension', function (done) {
    describe('general request', function(done) {
        before(function (done) {
            config.set('server.http2.enabled', false);
            app.start(function (err) {
                if (err) return done(err);
                help.dropDatabase('test', function (err) {
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
            help.removeTestClients(function() {
                app.stop(done);
            });
        });

        it('should expose a .get method', function (done) {
            var client = request(connectionString);

            app.get('/test-route', function (req, res, next) {

                // make sure we can pass multiple middlewares
                next();
            }, function (req, res, next) {
                appHelp.sendBackJSON(200, res, next)(null, {
                    result: 'test passed'
                });
            });

            client
            .get('/test-route')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .expect('content-type', 'application/json')
            .end(function (err, res) {
                if (err) return done(err);

                res.body.result.should.equal('test passed');
                done();
            });
        });

        it('should expose a .post method', function (done) {
            var client = request(connectionString);

            app.post('/test-route', function (req, res, next) {

                // make sure we can pass multiple middlewares
                next();
            }, function (req, res, next) {

                // we are using the body parser internally
                req.body.name.should.equal('POST test request');
                appHelp.sendBackJSON(200, res, next)(null, {
                    result: 'test passed'
                });
            });

            client
            .post('/test-route')
            .send({name: 'POST test request'})
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .expect('content-type', 'application/json')
            .end(function (err, res) {
                if (err) return done(err);

                res.body.result.should.equal('test passed');
                done();
            });
        });

        it('should expose a .put method', function (done) {
            var client = request(connectionString);

            app.put('/test-route', function (req, res, next) {

                // make sure we can pass multiple middlewares
                next();
            }, function (req, res, next) {

                // we are using the body parser internally
                req.body.name.should.equal('PUT test request');
                appHelp.sendBackJSON(200, res, next)(null, {
                    result: 'test passed'
                });
            });

            client
            .put('/test-route')
            .send({name: 'PUT test request'})
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .expect('content-type', 'application/json')
            .end(function (err, res) {
                if (err) return done(err);

                res.body.result.should.equal('test passed');
                done();
            });
        });

        it('should expose a .delete method', function (done) {
            var client = request(connectionString);

            app.delete('/test-route', function (req, res, next) {

                // make sure we can pass multiple middlewares
                next();
            }, function (req, res, next) {

                // we are using the body parser internally
                req.body.name.should.equal('DELETE test request');
                appHelp.sendBackJSON(200, res, next)(null, {
                    result: 'test passed'
                });
            });

            client
            .delete('/test-route')
            .send({name: 'DELETE test request'})
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .expect('content-type', 'application/json')
            .end(function (err, res) {
                if (err) return done(err);

                res.body.result.should.equal('test passed');
                done();
            });
        });

        it('should expose a .head method', function (done) {
            var client = request(connectionString);

            app.head('/test-route', function (req, res, next) {

                // make sure we can pass multiple middlewares
                next();
            }, function (req, res, next) {
                res.statusCode = 204;
                res.end();
            });

            client
            .head('/test-route')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(204)
            .end(done);
        });

        it('should expose a .options method', function (done) {
            var client = request(connectionString);

            app.options('/test-route', function (req, res, next) {

                // make sure we can pass multiple middlewares
                next();
            }, function (req, res, next) {

                // we are using the body parser internally
                req.body.name.should.equal('OPTIONS test request');
                appHelp.sendBackJSON(200, res, next)(null, {
                    result: 'test passed'
                });
            });

            client
            .options('/test-route')
            .send({name: 'OPTIONS test request'})
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .expect('content-type', 'application/json')
            .end(function (err, res) {
                if (err) return done(err);

                res.body.result.should.equal('test passed');
                done();
            });
        });

        it('should expose a .trace method', function (done) {
            var client = request(connectionString);

            app.trace('/test-route', function (req, res, next) {

                // make sure we can pass multiple middlewares
                next();
            }, function (req, res, next) {

                // we are using the body parser internally
                req.body.name.should.equal('TRACE test request');

                // reflect the request as recieved
                appHelp.sendBackJSON(200, res, next)(null, req.body);
            });

            client
            .trace('/test-route')
            .send({name: 'TRACE test request'})
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .expect('content-type', 'application/json')
            .end(function (err, res) {
                if (err) return done(err);

                res.body.name.should.equal('TRACE test request');
                done();
            });
        });
    });

    describe('http2 request', function(done) {
        before(function (done) {
            config.set('server.http2.enabled', true);
            app.start(function (err) {
                if (err) return done(err);
                help.dropDatabase('test', function (err) {
                    if (err) return done(err);

                    help.getBearerTokenHttps(function (err, token) {
                        if (err) return done(err);

                        bearerToken = token;

                        done();
                    });
                });

            });
        });

        after(function (done) {
            help.removeTestClients(function() {
                app.stop(done);
            });
        });

        it('should expose a .get method', function (done) {
            var client = request(connectionString);

            app.get('/test-route', function (req, res, next) {

                // make sure we can pass multiple middlewares
                next();
            }, function (req, res, next) {
                appHelp.sendBackJSON(200, res, next)(null, {
                    result: 'test passed'
                });
            });
            var doc_link = 'https://localhost:'+config.get('server.port') + '/test-route';
            var options = url.parse(doc_link);
            options.key = fs.readFileSync(config.get('server.http2.key_path'));
            options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
            options.headers = {
                'Authorization': 'Bearer ' + bearerToken
            };
            needle.get(doc_link, options, function(err, res) {
                if (err) return done(err);
                should(res.headers['content-type']).be.match(/json/);
                should(res.statusCode).be.equal(200);
                res.body.result.should.equal('test passed');
                done();
            });
        });

        it('should expose a .post method', function (done) {
            var client = request(connectionString);

            app.post('/test-route', function (req, res, next) {

                // make sure we can pass multiple middlewares
                next();
            }, function (req, res, next) {

                // we are using the body parser internally
                req.body.name.should.equal('POST test request');
                appHelp.sendBackJSON(200, res, next)(null, {
                    result: 'test passed'
                });
            });
            var doc_link = 'https://localhost:'+config.get('server.port') + '/test-route';
            var options = url.parse(doc_link);
            options.key = fs.readFileSync(config.get('server.http2.key_path'));
            options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
            options.headers = {
                'Authorization': 'Bearer ' + bearerToken
            };
            needle.post(doc_link, {name: 'POST test request'}, options, function(err, res) {
                if (err) return done(err);
                should(res.headers['content-type']).be.match(/json/);
                should(res.statusCode).be.equal(200);
                res.body.result.should.equal('test passed');
                done();
            });
        });

        it('should expose a .put method', function (done) {
            var client = request(connectionString);

            app.put('/test-route', function (req, res, next) {

                // make sure we can pass multiple middlewares
                next();
            }, function (req, res, next) {

                // we are using the body parser internally
                req.body.name.should.equal('PUT test request');
                appHelp.sendBackJSON(200, res, next)(null, {
                    result: 'test passed'
                });
            });
            var doc_link = 'https://localhost:'+config.get('server.port') + '/test-route';
            var options = url.parse(doc_link);
            options.key = fs.readFileSync(config.get('server.http2.key_path'));
            options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
            options.headers = {
                'Authorization': 'Bearer ' + bearerToken
            };
            needle.put(doc_link, {name: 'PUT test request'}, options, function(err, res) {
                if (err) return done(err);
                should(res.headers['content-type']).be.match(/json/);
                should(res.statusCode).be.equal(200);
                res.body.result.should.equal('test passed');
                done();
            });
        });

        it('should expose a .delete method', function (done) {
            var client = request(connectionString);

            app.delete('/test-route', function (req, res, next) {

                // make sure we can pass multiple middlewares
                next();
            }, function (req, res, next) {

                // we are using the body parser internally
                req.body.name.should.equal('DELETE test request');
                appHelp.sendBackJSON(200, res, next)(null, {
                    result: 'test passed'
                });
            });
            var doc_link = 'https://localhost:'+config.get('server.port') + '/test-route';
            var options = url.parse(doc_link);
            options.key = fs.readFileSync(config.get('server.http2.key_path'));
            options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
            options.headers = {
                'Authorization': 'Bearer ' + bearerToken
            };
            needle.delete(doc_link, {name: 'DELETE test request'}, options, function(err, res) {
                if (err) return done(err);
                should(res.headers['content-type']).be.match(/json/);
                should(res.statusCode).be.equal(200);
                res.body.result.should.equal('test passed');
                done();
            });
        });

        it('should expose a .head method', function (done) {
            var client = request(connectionString);

            app.head('/test-route', function (req, res, next) {

                // make sure we can pass multiple middlewares
                next();
            }, function (req, res, next) {
                res.statusCode = 204;
                res.end();
            });
            var doc_link = 'https://localhost:'+config.get('server.port') + '/test-route';
            var options = url.parse(doc_link);
            options.key = fs.readFileSync(config.get('server.http2.key_path'));
            options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
            options.headers = {
                'Authorization': 'Bearer ' + bearerToken
            };
            needle.head(doc_link, options, function(err, res) {
                should(res.statusCode).be.equal(204);
                done();
            });
        });

        it('should expose a .options method', function (done) {
            var client = request(connectionString);

            app.options('/test-route', function (req, res, next) {

                // make sure we can pass multiple middlewares
                next();
            }, function (req, res, next) {

                // we are using the body parser internally
                req.body.name.should.equal('OPTIONS test request');
                appHelp.sendBackJSON(200, res, next)(null, {
                    result: 'test passed'
                });
            });
            var doc_link = 'https://localhost:'+config.get('server.port') + '/test-route';
            var options = url.parse(doc_link);
            options.key = fs.readFileSync(config.get('server.http2.key_path'));
            options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
            options.headers = {
                'Authorization': 'Bearer ' + bearerToken
            };
            needle.request('options', doc_link, {name: 'OPTIONS test request'}, options, function(err, res) {
                if (err) return done(err);
                should(res.headers['content-type']).be.match(/json/);
                should(res.statusCode).be.equal(200);
                res.body.result.should.equal('test passed');
                done();
            });
        });

        it('should expose a .trace method', function (done) {
            var client = request(connectionString);

            app.trace('/test-route', function (req, res, next) {

                // make sure we can pass multiple middlewares
                next();
            }, function (req, res, next) {

                // we are using the body parser internally
                req.body.name.should.equal('TRACE test request');

                // reflect the request as recieved
                appHelp.sendBackJSON(200, res, next)(null, req.body);
            });
            var doc_link = 'https://localhost:'+config.get('server.port') + '/test-route';
            var options = url.parse(doc_link);
            options.key = fs.readFileSync(config.get('server.http2.key_path'));
            options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
            options.headers = {
                'Authorization': 'Bearer ' + bearerToken
            };
            needle.request('trace', doc_link, {name: 'TRACE test request'}, options, function(err, res) {
                if (err) return done(err);
                should(res.headers['content-type']).be.match(/json/);
                should(res.statusCode).be.equal(200);
                res.body.name.should.equal('TRACE test request');
                done();
            });
        });
    });
});
