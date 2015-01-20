var should = require('should');
var request = require('supertest');
var config = require(__dirname + '/../../config');
var help = require(__dirname + '/help');
var app = require(__dirname + '/../../bantam/lib/');
var fs = require('fs');

describe('Authentication', function () {
    var tokenRoute = config.auth.tokenUrl;

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
            clientId: 'test123',
            secret: 'superSecret'
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
            clientId: 'test123',
            secret: 'badSecret',
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
        
        help.getBearerToken(function (err, token) {
            var client = request('http://' + config.server.host + ':' + config.server.port);

            client
            .get('/vtest/testdb/test-schema')
            .set('Authorization', 'Bearer badtokenvalue')
            .expect(401, done);
        });
    });

    it('should not allow requests with expired tokens', function (done) {
        this.timeout(4000);

        var oldTtl = Number(config.auth.tokenTtl);
        config.auth.tokenTtl = 1;

        var _done = function (err) {
            config.auth.tokenTtl = oldTtl;
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

    it('should allow unauthenticated request for collection specifying authenticate = false', function (done) {

        var jsSchemaString = fs.readFileSync(__dirname + '/../new-schema.json', {encoding: 'utf8'});

        help.getBearerToken(function (err, token) {
            var client = request('http://' + config.server.host + ':' + config.server.port);

            // update the schema
            var schema = JSON.parse(jsSchemaString);
            schema.settings.authenticate = false;

            client
            .post('/vtest/testdb/test-schema/config')
            .send(JSON.stringify(schema))
            .set('content-type', 'text/plain')
            .set('Authorization', 'Bearer ' + token)
            .expect(200)
            .expect('content-type', 'application/json')
            .end(function (err, res) {
                if (err) return done(err);

                // Wait, then test that we can make an unauthenticated request
                setTimeout(function () {
                    client
                    .get('/vtest/testdb/test-schema')
                    .expect(200)
                    .expect('content-type', 'application/json')
                    .end(function(err,res) {
                        schema.settings.authenticate = true;
                        fs.writeFileSync(__dirname + '/workspace/collections/vtest/testdb/collection.test-schema.json', JSON.stringify(schema, null, 4));
                        done();
                    });
                }, 300);
            });
        });
    });

});
