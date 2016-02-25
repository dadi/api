var should = require('should');
var request = require('supertest');
var health = require(__dirname + '/../../dadi/lib/health');
var help = require(__dirname + '/help');
var config = require(__dirname + '/../../config');
var app = require(__dirname + '/../../dadi/lib/');

describe('Health', function () {
    before(function (done) {
        help.createClient(null, function() {
            app.start(function (err) {
                if (err) return done(err);

                // give it a moment for http.Server to finish starting
                setTimeout(function () {
                    done();
                }, 500);
            });
        });
    });

    after(function (done) {
        help.removeTestClients(function() {
            app.stop(done);
        });
    });

    it('should allow "/status" request containing token', function (done) {
        help.getBearerToken(function (err, token) {
            var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

            client
            .get('/status')
            .set('Authorization', 'Bearer ' + token)
            .expect('content-type', 'application/json')
            .expect(200, done);
        });
    });

    it('should not allow "/status" request containing invalid token', function (done) {
        help.getBearerToken(function (err, token) {
            var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

            client
            .get('/status')
            .set('Authorization', 'Bearer badtokenvalue')
            .expect(401, done);
        });
    });

    it('should allow "/health" request without token', function (done) {
        help.getBearerToken(function (err, token) {
            var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

            client
            .get('/health')
            .expect('content-type', 'application/json')
            .expect(200, done);
        });
    });
});