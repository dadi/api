var should = require('should');
var request = require('supertest');
var help = require(__dirname + '/help');
var config = require(__dirname + '/../../config');
var app = require(__dirname + '/../../dadi/lib/');

describe('CacheInvalidationAPI', function () {
    beforeEach(function (done) {
        app.start(function() {
            help.dropDatabase('test', function (err) {
                if (err) return done(err);

                help.getBearerToken(function (err, token) {
                    if (err) return done(err);

                    bearerToken = token;

                    help.clearCache();

                    help.createDoc(bearerToken, function (err, doc) {
                        if (err) return done(err);

                        help.createDoc(bearerToken, function (err, doc) {
                            if (err) return done(err);

                            var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

                            client
                            .get('/vtest/testdb/test-schema')
                            .set('Authorization', 'Bearer ' + bearerToken)
                            .expect(200)
                            .end(function (err, res1) {
                                if (err) return done(err);
                                done();
                            });
                        });
                    });
                });
            });
        });
    });

    afterEach(function (done) {
        help.removeTestClients(function() {
            app.stop(done);
        });
    });

    it('should flush of cached element', function (done) {
        this.timeout(4000);

        var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));
        client
        .post('/api/flush')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send({path: '/vtest/testdb/test-schema'})
        .expect(200)
        .end(function (err, res) {
            if (err) return done(err);

            res.body.result.should.equal('success');
            done();
        });
    });
});