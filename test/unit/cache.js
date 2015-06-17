var should = require('should');
var request = require('supertest');
var fs = require('fs');
var path = require('path');
var sinon = require('sinon');
var config = require(__dirname + '/../../config');
var cache = require(__dirname + '/../../bantam/lib/cache');
var app = require(__dirname + '/../../bantam/lib/');
var acceptanceTestHelper = require(__dirname + '/../acceptance/help');

var main = require(__dirname + '/../../bantam/lib');

var bearerToken;

describe('Cache', function (done) {

    before(function (done) {
        app.start({
            collectionPath: __dirname + '/../acceptance/workspace/collections'
        }, done);
    });

    after(function (done) {
        app.stop(done);
    });

    beforeEach(function (done) {
        acceptanceTestHelper.getBearerToken(function (err, token) {
            if (err) return done(err);
            bearerToken = token;
            done();
        });
    });

    it('should export middleware', function (done) {
        cache.should.be.Function;
        cache.length.should.equal(1);

        done();
    });

    it('should call file system stat', function (done) {

        var stub = sinon.stub(fs, 'stat', function (path, done) {
            stub.called.should.be.true;

            var args = stub.getCall(0).args;
            var pathName = args[0];

            // pathName should be hex string json file
            pathName.should.match(/[a-g1-9]+\.json$/);
            args[1].should.be.Function;

            stub.restore();

            done();
        });

        request('http://' + config.server.host + ':' + config.server.port)
        .get('/vtest/testdb/test-schema')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .end(function (err, res) {
            if (err) return done(err);

            done();
        });

    });
});
