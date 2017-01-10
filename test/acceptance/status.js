var should = require('should');
var request = require('supertest');
var help = require(__dirname + '/help');
var config = require(__dirname + '/../../config');
var app = require(__dirname + '/../../dadi/lib/');

describe('Status', function () {
  this.timeout(8000)
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

  beforeEach(function (done) {
    config.set('status.enabled', true);
    done();
  });

  after(function (done) {
    config.set('status.enabled', false);
    help.removeTestClients(function() {
      app.stop(done);
    });
  });

  it('should return 404 if config status.enabled = false', function (done) {
    help.getBearerToken(function (err, token) {
      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

      config.set('status.enabled', false);

      client
      .post('/api/status')
      .set('Authorization', 'Bearer ' + token)
      .expect(404, done);
    });
  });

  it('should return 200 if config status.enabled = true', function (done) {
    help.getBearerToken(function (err, token) {
      var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));
      client
      .post('/api/status')
      .set('Authorization', 'Bearer ' + token)
      .expect(200)
      .end(function(err, res) {
        done()
      })
    });
  });

  describe('Auth', function(done) {
    it('should allow "/api/status" request containing token', function (done) {
      help.getBearerToken(function (err, token) {
        var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

        client
        .post('/api/status')
        .set('Authorization', 'Bearer ' + token)
        .expect('content-type', 'application/json')
        .expect(200)
        .end((err, res) => {
          done()
        })
      });
    });

    it('should not allow "/api/status" request containing invalid token', function (done) {
      help.getBearerToken(function (err, token) {
        var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

        client
        .post('/api/status')
        .set('Authorization', 'Bearer badtokenvalue')
        .expect(401, done);
      });
    });
  })

  describe('Routes', function(done) {
    it('should contain data for specified routes', function (done) {
      help.getBearerToken(function (err, token) {

        // set some routes
        config.set('status.routes', [{route: '/vtest/testdb/test-schema', expectedResponseTime: 1}]);

        var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

        client
        .post('/api/status')
        .set('Authorization', 'Bearer ' + token)
        .expect('content-type', 'application/json')
        .expect(200, function(err, res) {
          var status = res.body;
          status.routes.should.exist;
          status.routes[0].should.exist;
          status.routes[0].route.should.eql('/vtest/testdb/test-schema');
          done();
        });
      });
    });

    it('should return Green for a route that is faster than expected', function (done) {
      help.getBearerToken(function (err, token) {

        // set some routes
        config.set('status.routes', [{route: '/vtest/testdb/test-schema', expectedResponseTime: 1}]);

        var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

        client
        .post('/api/status')
        .set('Authorization', 'Bearer ' + token)
        .expect('content-type', 'application/json')
        .expect(200, function(err, res) {
          var status = res.body;
          status.routes.should.exist;
          status.routes[0].should.exist;
          status.routes[0].healthStatus.should.eql('Green');
          done();
        });
      });
    });

    it('should return Amber for a route that takes longer than expected', function (done) {
      help.getBearerToken(function (err, token) {

        // set some routes
        config.set('status.routes', [{route: '/vtest/testdb/test-schema', expectedResponseTime: -1}]);

        var client = request('http://' + config.get('server.host') + ':' + config.get('server.port'));

        client
        .post('/api/status')
        .set('Authorization', 'Bearer ' + token)
        .expect('content-type', 'application/json')
        .expect(200, function(err, res) {
          var status = res.body;
          status.routes.should.exist;
          status.routes[0].should.exist;
          status.routes[0].healthStatus.should.eql('Amber');
          done();
        });
      });
    });
  });
});
