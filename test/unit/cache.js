var convict = require('convict');
var should = require('should');
var request = require('supertest');
var fs = require('fs');
var path = require('path');
var sinon = require('sinon');
var util = require('util');

var config = require(__dirname + '/../../config');
var cache = require(__dirname + '/../../dadi/lib/cache');
var app = require(__dirname + '/../../dadi/lib/');
var api = require(__dirname + '/../../dadi/lib/api');
var Server = require(__dirname + '/../../dadi/lib');
var acceptanceTestHelper = require(__dirname + '/../acceptance/help');

var bearerToken;

describe('Cache', function (done) {

  // before(function (done) {
  //   app.start(done);
  // });
  //
  // after(function (done) {
  //   //acceptanceTestHelper.clearCache();
  //   app.stop(done);
  // });

    // beforeEach(function (done) {
    //     acceptanceTestHelper.getBearerToken(function (err, token) {
    //         if (err) return done(err);
    //         bearerToken = token;
    //         done();
    //     });
    // });

  it('should export middleware', function (done) {
    cache.should.be.Function;
    cache.length.should.equal(1);

    done();
  });

  describe('Config', function(done) {
    it('should return default config settings for directory');//, function (done) {

    //   var testConfigString = fs.readFileSync(config.configPath());
    //   var dir = path.dirname(config.configPath());
    //   var testConfig = JSON.parse(testConfigString);
    //   testConfig.caching = {};
    //
    //   var newConfig = fs.writeFileSync(dir + '/newTestConfig.json', JSON.stringify(testConfig, null, 2));
    //
    //   var schema = config.getSchema();
    //   var conf = convict(schema);
    //   conf.loadFile(dir + '/newTestConfig.json');
    //
    //   console.log(conf.get('caching'))
    //
    //   conf.get('caching.directory.enabled').should.eql(true);
    //   conf.get('caching.directory.path').should.eql('./cache/api');
    //   conf.get('caching.directory.extension').should.eql('json');
    //
    //   done();
    // });
  })

  it('should take a server instance as an argument', function (done) {
    var server = sinon.mock(Server);
    server.object.app = api();

    var method = sinon.spy(server.object.app, 'use');
    cache(server.object).init();

    method.called.should.eql(true);

    server.object.app.use.restore();
    done();
  });

  it('should cache if the app\'s config settings allow', function (done) {

    var server = sinon.mock(Server);
    server.object.app = api();

    var originalCacheSettings = config.get('caching');

    var configStub = sinon.stub(config, 'get');
    configStub.withArgs('caching.directory.enabled').returns(true);
    configStub.withArgs('caching.directory.path').returns(originalCacheSettings.directory.path);
    configStub.withArgs('caching.directory.extension').returns(originalCacheSettings.directory.extension);

    cache(server.object).enabled.should.eql(true);

    configStub.restore();

    done();
  });

  it('should not cache if the app\'s config settings don\'t allow', function (done) {

    var server = sinon.mock(Server);
    server.object.app = api();

    var originalCacheSettings = config.get('caching');

    var configStub = sinon.stub(config, 'get');
    configStub.withArgs('caching.directory.enabled').returns(Boolean('false'));
    configStub.withArgs('caching.directory.path').returns(originalCacheSettings.directory.path);
    configStub.withArgs('caching.directory.extension').returns(originalCacheSettings.directory.extension);

    cache(server.object).enabled.should.eql(true);

    configStub.restore();

    done();
  });


    // it('should call file system stat', function (done) {
    //
    //     var stub = sinon.stub(fs, 'stat', function (path, done) {
    //         stub.called.should.be.true;
    //
    //         var args = stub.getCall(0).args;
    //         var pathName = args[0];
    //
    //         // pathName should be hex string json file
    //         pathName.should.match(/[a-g1-9]+\.json$/);
    //         args[1].should.be.Function;
    //
    //         stub.restore();
    //
    //         done();
    //     });
    //
    //     request('http://' + config.get('server.host') + ':' + config.get('server.port'))
    //     .get('/vtest/testdb/test-schema')
    //     .set('Authorization', 'Bearer ' + bearerToken)
    //     .expect(200)
    //     .end(function (err, res) {
    //         if (err) return done(err);
    //
    //         done();
    //     });
    //
    // });
});
