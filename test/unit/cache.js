var should = require('should');
var fs = require('fs');
var path = require('path');
var sinon = require('sinon');
var config = require(__dirname + '/../../config');
var cache = require(__dirname + '/../../bantam/lib/cache');
var help = require(__dirname + '/help');

describe('Cache', function (done) {
    it('should export middleware', function (done) {
        cache.should.be.Function;
        cache.length.should.equal(1);

        var c = cache();
        c.should.be.Function;
        c.length.should.equal(3);

        done();
    });

    it('should call file system stat', function (done) {
        var c = cache();
        var stub = sinon.stub(fs, 'stat');

        var req = {
            method: 'GET',
            url: '/vtest/testdb/test-schema?filter={}'
        };

        var res = {};

        c(req, res);

        stub.called.should.be.true;
        
        var args = stub.getCall(0).args;
        var pathName = args[0];

        // pathName should be hex string json file
        pathName.should.match(/[a-g1-9]+\.json$/);
        args[1].should.be.Function;

        stub.restore();

        done();
    });
});
