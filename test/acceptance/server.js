var should = require('should');
var request = require('supertest');
var http2 = require('http2');
var fs = require('fs');
var path = require('path');
var url = require('url');

var api = require(__dirname + '/../../dadi/lib/api');
var config = require(__dirname + '/../../config');

describe('Server', function () {
    describe('Http Server', function () {
        beforeEach(function (done) {
            config.set('server.http2.enabled', false);
            done();
        });
        it('should respond to request', function (done) {
            var app = api();
            app.use(function (req, res, next) {
                var body = JSON.stringify({foo: 'bar'});
                res.writeHead(200, {
                    'content-length': body.length,
                    'content-type': 'application/json'
                });
                res.end(body);
            });

            var server = app.listen(config.get('server.port'), config.get('server.host'));

            request(server)
            .get('/')
            .expect('Content-Type', /json/)
            .expect(200, done);
        });

        describe('middleware', function () {
            it('should allow multiple', function (done) {
                var app = api();
                var body = JSON.stringify({foo: 'bar'});
                app.use(function (req, res, next) {
                    res.writeHead(200, {
                        'content-length': body.length,
                        'content-type': 'application/json'
                    });
                    res.write(body);
                    next();
                });

                app.use(function (req, res, next) {
                    res.end();
                });

                var server = app.listen(config.get('server.port'), config.get('server.host'));

                request(server)
                .get('/')
                .expect('Content-Type', /json/)
                .expect('content-length', body.length)
                .expect(200, done);
            });

            it('should be able to pass error to next', function (done) {
                var app = api();
                var body = JSON.stringify({foo: 'bar'});

                app.use(function (req, res, next) {
                    next(new Error('error handle test'));
                });

                var server = app.listen(config.get('server.port'), config.get('server.host'));

                request(server)
                .get('/')
                .expect(500, done);
            });
        });

        describe('routes', function () {
            it('should respond to requests', function (done) {
                var app = api();
                var body = JSON.stringify({foo: 'bar'});

                app.use(function (req, res, next) {
                    res.setHeader('x-is-test', 'true');
                    next();
                });

                app.use('/', function (req, res, next) {
                    res.writeHead(200, {
                        'content-type': 'application/json',
                        'content-length': body.length
                    });
                    res.end(body);
                });

                var server = app.listen(config.get('server.port'), config.get('server.host'));

                request(server)
                .get('/')
                .expect('Content-Type', /json/)
                .expect('content-length', body.length)
                .expect('x-is-test', 'true')
                .expect(200, function (err, res) {
                    if (err) return done(err);

                    res.body.foo.should.equal('bar');
                    done();
                });
            });

            it('should send 404', function (done) {
                var app = api();

                app.use(function (req, res, next) {
                    res.setHeader('x-is-test', 'true');
                    next();
                });

                app.use('/', function (req, res, next) {
                    res.writeHead(204);
                    res.end();
                });

                var server = app.listen(config.get('server.port'), config.get('server.host'));

                request(server)
                .get('/doesnotexist')
                .expect('x-is-test', 'true')
                .expect(404, done);
            });

            it('should send 500', function (done) {
                var app = api();

                app.use(function (req, res, next) {
                    res.setHeader('x-is-test', 'true');
                    next();
                });

                app.use('/', function (req, res, next) {
                    next(new Error('500 test'));
                });

                var server = app.listen(config.get('server.port'), config.get('server.host'));

                request(server)
                .get('/')
                .expect('x-is-test', 'true')
                .expect(500, done);
            });

            it('should parse `req.params` from path', function (done) {
                var app = api();
                var id = 'test123';

                app.use('/model/:id', function (req, res, next) {
                    req.params.id.should.equal(id);
                    res.statusCode = 200;
                    res.end();
                });

                var server = app.listen(config.get('server.port'), config.get('server.host'));

                request(server)
                .get('/model/' + id)
                .expect(200, done);
            });
        });
    });

    describe('Http2 Server', function () {
        var app = api();
        beforeEach(function (done) {
            config.set('server.http2.enabled', true);
            done();
        });
        afterEach(function(done) {
            app.all = [];
            done();
        })
        it('should respond to request', function (done) {
            app.use(function (req, res, next) {
                var body = JSON.stringify({foo: 'bar'});
                res.writeHead(200, {
                    'content-length': body.length,
                    'content-type': 'application/json'
                });
                res.end(body);
            });

            var server = app.listen(config.get('server.port'));
            var options = url.parse('https://localhost:'+config.get('server.port') + '/');
            options.key = fs.readFileSync(config.get('server.http2.key_path'));
            options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
            http2.request(options, function(response) {
                should(response.headers['content-type']).be.match(/json/);
                should(response.statusCode).be.equal(200);
                server.close();
                done();
            });
        });
        describe('middleware', function () {
            it('should allow multiple', function (done) {
                var body = JSON.stringify({foo: 'bar'});
                app.use(function (req, res, next) {
                    res.writeHead(200, {
                        'content-length': body.length,
                        'content-type': 'application/json'
                    });
                    res.write(body);
                    next();
                });

                app.use(function (req, res, next) {
                    res.end();
                });

                var server = app.listen(config.get('server.port'));
                
                var options = url.parse('https://localhost:'+config.get('server.port') + '/');
                options.key = fs.readFileSync(config.get('server.http2.key_path'));
                options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                http2.request(options, function(response) {
                    should(response.headers['content-type']).be.match(/json/);
                    should(response.headers['content-length']).be.equal(body.length.toString());
                    should(response.statusCode).be.equal(200);
                    server.close();
                    done();
                });
            
                
            });

            it('should be able to pass error to next', function (done) {
                var body = JSON.stringify({foo: 'bar'});

                app.use(function (req, res, next) {
                    next(new Error('error handle test'));
                });

                var server = app.listen(config.get('server.port'));

                var options = url.parse('https://localhost:'+config.get('server.port') + '/');
                options.key = fs.readFileSync(config.get('server.http2.key_path'));
                options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
                http2.request(options, function(response) {
                    should(response.statusCode).be.equal(500);
                    server.close();
                    done();
                });
            });
        });

        describe('routes', function () {
            it('should respond to requests', function (done) {
                var body = JSON.stringify({foo: 'bar'});
                
                app.use(function (req, res, next) {
                    res.setHeader('x-is-test', 'true');
                    next();
                });

                app.use('/', function (req, res, next) {
                    res.writeHead(200, {
                        'content-type': 'application/json',
                        'content-length': body.length
                    });
                    res.end(body);
                });

                var server = app.listen(config.get('server.port'), config.get('server.host'));
                var options = url.parse('https://localhost:'+config.get('server.port') + '/');
                options.key = fs.readFileSync(config.get('server.http2.key_path'));
                options.ca = fs.readFileSync(config.get('server.http2.crt_path'));

                http2.request(options, function(response) {
                    should(response.headers['content-type']).be.match(/json/);
                    should(response.headers['content-length']).be.equal(body.length.toString());
                    should(response.headers['x-is-test']).be.equal('true');
                    should(response.statusCode).be.equal(200);
                    response.on('data', function(data) {
                        JSON.parse(data).foo.should.equal('bar');
                        server.close();
                        done();
                    })
                    
                });
            });

            it('should send 404', function (done) {
                app.use(function (req, res, next) {
                    res.setHeader('x-is-test', 'true');
                    next();
                });

                app.use('/', function (req, res, next) {
                    res.writeHead(404);
                    res.end();
                });

                var server = app.listen(config.get('server.port'), config.get('server.host'));
                var options = url.parse('https://localhost:'+config.get('server.port') + '/');
                options.key = fs.readFileSync(config.get('server.http2.key_path'));
                options.ca = fs.readFileSync(config.get('server.http2.crt_path'));

                http2.request(options, function(response) {
                    should(response.headers['x-is-test']).be.equal('true');
                    should(response.statusCode).be.equal(404);
                    server.close();
                    done();                    
                });
            });

            it('should send 500', function (done) {
                app.use(function (req, res, next) {
                    res.setHeader('x-is-test', 'true');
                    next();
                });

                app.use('/', function (req, res, next) {
                    next(new Error('500 test'));
                });

                var server = app.listen(config.get('server.port'), config.get('server.host'));
                var options = url.parse('https://localhost:'+config.get('server.port') + '/');
                options.key = fs.readFileSync(config.get('server.http2.key_path'));
                options.ca = fs.readFileSync(config.get('server.http2.crt_path'));

                http2.request(options, function(response) {
                    should(response.headers['x-is-test']).be.equal('true');
                    should(response.statusCode).be.equal(500);
                    server.close();
                    done();                    
                });
            });

            it('should parse `req.params` from path', function (done) {
                var id = 'test123';

                app.use('/model/:id', function (req, res, next) {
                    req.params.id.should.equal(id);
                    res.statusCode = 200;
                    res.end();
                });

                var server = app.listen(config.get('server.port'), config.get('server.host'));
                var options = url.parse('https://localhost:'+config.get('server.port') + '/model/' + id);
                options.key = fs.readFileSync(config.get('server.http2.key_path'));
                options.ca = fs.readFileSync(config.get('server.http2.crt_path'));

                http2.request(options, function(response) {
                    should(response.statusCode).be.equal(200);
                    server.close();
                    done();                    
                });
            });
        });
    });
});
