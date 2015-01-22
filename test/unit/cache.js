var should = require('should');
var fs = require('fs');
var path = require('path');
var sinon = require('sinon');
var config = require(__dirname + '/../../config');
var cache = require(__dirname + '/../../bantam/lib/cache');
var api = require(__dirname + '/../../bantam/lib/api');
var controller = require(__dirname + '/../../bantam/lib/controller');
var model = require(__dirname + '/../../bantam/lib/model');
var help = require(__dirname + '/help');

var main = require(__dirname + '/../../bantam/lib');

describe('Cache', function (done) {

    var app, server;
    before(function (done) {
        app = api();
        server = app.listen(config.server.port, config.server.host, null, done);
    });

    after(function (done) {
        server.close(done);
    });

    it('should export middleware', function (done) {
        cache.should.be.Function;
        cache.length.should.equal(1);

        done();
    });

    // it('should call file system stat', function (done) {
    //     var stub = sinon.stub(fs, 'stat');

    //     var req = {
    //         method: 'GET',
    //         url: '/vtest/testdb/test-schema?filter={}'
    //     };

    //     var res = {};

    //     main.start();
    //     cache(main);

    //     var mod = model('test-schema', help.getModelSchema());
    //     controller(mod).get(req);

    //     stub.called.should.be.true;
        
    //     var args = stub.getCall(0).args;
    //     console.log(args);
    //     var pathName = args[0];

    //     // pathName should be hex string json file
    //     pathName.should.match(/[a-g1-9]+\.json$/);
    //     args[1].should.be.Function;

    //     stub.restore();

    //     done();
    // });
});
