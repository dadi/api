var should = require('should');
var http = require('http');
var api = require(__dirname + '/../../bantam/lib/api');
var controller = require(__dirname + '/../../bantam/lib/controller');
var model = require(__dirname + '/../../bantam/lib/model');
var help = require(__dirname + '/help');
var config = require(__dirname + '/../../config');

describe('API server', function () {
    it('should export function', function (done) {
        api.should.be.Function;
        done();
    });

    it('should export constructor', function (done) {
        api.Api.should.be.Function;
        done();
    });

    it('should return api Object when called', function (done) {
        var app = api();
        app.should.be.Object;
        app.should.be.instanceOf(api.Api);
        done();
    });

    describe('paths', function () {
        var app = api();

        it('should have instance of Controller attached as handler', function (done) {
            app.use('/foo/bar', controller(model('apiTest', help.getModelSchema())));
            app.paths['/foo/bar'].handler.should.be.an.instanceOf(controller.Controller);
            done();
        });

        it('should have regexp attached to test path matches', function (done) {
            app.use('/foo/bar/:baz', controller(model('apiTest')));
            app.paths['/foo/bar/:baz'].regex.should.be.an.instanceOf(RegExp);
            done();
        });

        it('should have keys for each path attached', function (done) {
            app.use('/foo/bar/baz/:qux', controller(model('apiTest')));
            app.paths['/foo/bar/baz/:qux'].regex.keys.should.be.an.instanceOf(Array);
            app.paths['/foo/bar/baz/:qux'].regex.keys[0].name.should.equal('qux');
            done();
        });
    });

    describe('errors', function () {
        var app = api();

        it('should be added to app', function (done) {
            app.errors.should.be.Array;
            done();
        });
    });

    describe('all', function () {
        var app = api();

        it('should be added to app', function (done) {
            app.all.should.be.Array;
            done();
        });
    });

    describe('use method', function () {
        var app = api();

        it('should be a function', function (done) {
            app.use.should.be.Function;
            done();
        });

        it('should add url to paths', function (done) {
            app.use('/foo/bar', controller(model('apiTest', help.getModelSchema())));
            app.paths['/foo/bar'].should.be.Object;
            done();
        });

        it('should add error handlers to errors', function (done) {
            var errHandle = function (err, req, res, next) {};

            app.errors.should.be.Array;
            app.use(errHandle);
            app.errors.length.should.equal(2);
            app.errors[1].should.equal(errHandle);
            done();
        });

        it('should add all requests handler to app', function (done) {
            var allRequests = function (req, res, next) {};

            app.use(allRequests);
            app.all.length.should.equal(1);
            app.all[0].should.equal(allRequests);
            done();
        });
    });

    describe('unuse method', function () {
        var app = api();

        it('should be a function', function (done) {
            app.unuse.should.be.Function;
            done();
        });

        it('should remove url from paths', function (done) {
            app.use('/foo/bar', controller(model('apiTest', help.getModelSchema())));
            app.paths['/foo/bar'].should.be.Object;

            app.unuse('/foo/bar');
            should.not.exist(app.paths['/foo/bar']);

            done();
        });

        it('should remove error handlers from errors', function (done) {
            var errHandle = function (err, req, res, next) {};

            app.errors.should.be.Array;
            app.use(errHandle);
            app.errors.length.should.equal(2);
            app.errors[1].should.equal(errHandle);

            app.unuse(errHandle);
            app.errors.length.should.equal(1);

            done();
        });

        it('should remove all requests handler from app', function (done) {
            var allRequests = function (req, res, next) {};

            app.use(allRequests);
            app.all.length.should.equal(1);
            app.all[0].should.equal(allRequests);

            app.unuse(allRequests);
            app.all.length.should.equal(0);

            done();
        });
    });

    describe('_match', function (done) {
        var app = api();

        it('should be a function', function (done) {
            app._match.should.be.Function;
            done();
        });

        it('should return controller(s) matching a request url', function (done) {
            app.use('/foo/:bar', function (req, res, next) {});

            var m = app._match('/foo/123', {});
            should.exist(m);
            m.length.should.equal(1);

            m[0].should.be.Function;

            done();
        });

        it('should add `req.params` object', function (done) {
            var req = {};
            var m = app._match('/foo/123', req);
            should.exist(m);
            m.length.should.equal(1);
            should.exist(req.params);

            should.exist(req.params.bar);
            done();
        });
    });

    describe('listen', function () {
        var app = api();

        it('should be a function', function (done) {
            app.listen.should.be.Function;
            done();
        });
    });

    describe('listener', function () {
        var app = api();

        it('should be a function', function (done) {
            app.listener.should.be.Function;
            done();
        });
    });

    describe('server', function () {
        var app, server;
        before(function (done) {
            app = api();
            server = app.listen(config.server.port, config.server.host, null, done);
        });

        after(function (done) {
            server.close(done);
        });

        it('should be an instance of http.Server', function (done) {
            server.should.be.an.instanceOf(http.Server);
            done();
        });
    });
});
