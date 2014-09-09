var should = require('should');
var request = require('supertest');
var config = require(__dirname + '/../../config');
var help = require(__dirname + '/help');
var app = require(__dirname + '/../../bantam/lib/');

describe('Authentication', function () {
    var tokenRoute = config.auth.token_url;

    before(function (done) {
        app.start({
            collectionPath: __dirname + '/workspace/collections',
            endpointPath: __dirname + '/workspace/endpoints'
        }, function (err) {
            if (err) return done(err);
            // give it a moment for http.Server to finish starting
            setTimeout(function () {
                done();
            }, 200);
        });
    });

    after(function (done) {
        app.stop(done);
    });

    it('should issue a bearer token', function (done) {
        var client = request('http://' + config.server.host + ':' + config.server.port);

        client
        .post(tokenRoute)
        .send({
            client_id: 'test123',
            secret: 'super_secret'
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
            client_id: 'test123',
            secret: 'bad_secret',
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
        var client = request('http://' + config.server.host + ':' + config.server.port);

        client
        .get('/vtest/testdb/test-schema')
        .set('Authorization', 'Bearer badtokenvalue')
        .expect(401, done);
    });

    it('should not allow requests with expired tokens', function (done) {
        this.timeout(4000);

        var oldTtl = Number(config.auth.token_ttl);
        config.auth.token_ttl = 1;

        var _done = function (err) {
            config.auth.token_ttl = oldTtl;
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
});
