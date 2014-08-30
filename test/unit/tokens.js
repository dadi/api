var should = require('should');
var request = require('supertest');
var config = require(__dirname + '/../../config');
var tokens = require(__dirname + '/../../bantam/lib/auth/tokens');
var tokenStore = require(__dirname + '/../../bantam/lib/auth/tokenStore');
var connection = require(__dirname + '/../../bantam/lib/model/connection');

var clientCollectionName = config.auth.client_collection || 'client-store';

describe('Tokens', function () {
    before(function (done) {
        var conn = connection(config.auth.database);

        conn.on('connect', function (db) {
            db.dropDatabase(done);
        });
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
            var clientStore = connection(config.auth.database);

            clientStore.on('connect', function (db) {
                db.collection(clientCollectionName).insert({
                    client_id: 'test123',
                    secret: 'super_secret'
                }, done);
            });
        });

        it('should return object for valid token', function (done) {
            var req = {
                body: {
                    client_id: 'test123',
                    secret: 'super_secret'
                }
            };

            var res = {
                setHeader: function () {},
                end: function (data) {
                    data = JSON.parse(data);

                    should.exist(data.access_token);
                    data.token_type.should.equal('Bearer');
                    done();
                }
            }

            tokens.generate(req, res);
        })
    });
});
