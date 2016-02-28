var should = require('should');
var request = require('supertest');
var help = require(__dirname + '/help');
var config = require(__dirname + '/../../config');
var app = require(__dirname + '/../../dadi/lib/');

describe('CacheInvalidationAPI', function () {
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

    it('should flush of cached element', function (done) {
        help.getBearerToken(function (err, token) {
            var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

            client
            .post('/api/flush')
            .set('Authorization', 'Bearer ' + token)
            .send({path: '/foo'})
            .expect(200)
            .end(function (err, res) {
                if (err) return done(err);

                res.body.result.should.equal('success');
                done();
            });
        });
    });
});