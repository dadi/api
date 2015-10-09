var should = require('should');
var request = require('supertest');
var config = require(__dirname + '/../../config');
var tokens = require(__dirname + '/../../bantam/lib/auth/tokens');
var tokenStore = require(__dirname + '/../../bantam/lib/auth/tokenStore');
var connection = require(__dirname + '/../../bantam/lib/model/connection');
var acceptanceTestHelper = require(__dirname + '/../acceptance/help');

var clientCollectionName = config.get('auth.clientCollection');

describe('Tokens', function () {
    before(function (done) {
        var conn = connection(config.get('auth.database'));

        conn.on('connect', function (db) {
            db.dropDatabase(done);
        });
    });

    after(function (done) {
        acceptanceTestHelper.removeTestClients(done);
    });

    it('should export generate function', function (done) {
        tokens.generate.should.be.Function;
        done();
    });

    it('should export validate function', function (done) {
        tokens.validate.should.be.Function;
        done();
    });

    it('should export a tokenStore', function (done) {
        tokens.store.should.be.instanceOf(tokenStore.Store);
        done();
    });

    describe('validate', function () {
        before(function (done) {
            var clientStore = connection(config.get('auth.database'));

            clientStore.on('connect', function (db) {
                db.collection(clientCollectionName).insert({
                    clientId: 'test123',
                    secret: 'superSecret'
                }, done);
            });
        });

        it('should return object for valid token', function (done) {
            var req = {
                body: {
                    clientId: 'test123',
                    secret: 'superSecret'
                }
            };

            var res = {
                setHeader: function () {},
                end: function (data) {
                    data = JSON.parse(data);

                    should.exist(data.accessToken);
                    data.tokenType.should.equal('Bearer');
                    done();
                }
            }

            tokens.generate(req, res);
        })
    });
});
