var should = require('should');
var connection = require(__dirname + '/../../../bantam/lib/model/connection');
var help = require(__dirname + '/../help');
var EventEmitter = require('events').EventEmitter;
var Db = require('mongodb').Db;

describe('Model connection', function () {
    describe('constructor', function () {
        it('should be exposed', function (done) {
            connection.Connection.should.be.Function;
            done();
        });

        it('should inherit from EventEmitter', function (done) {
            var conn = new connection.Connection();
            conn.should.be.an.instanceOf(EventEmitter);
            conn.emit.should.be.Function;
            done();
        });
    });

    it('should expose a function that returns an instance of Connection', function (done) {
        connection().should.be.an.instanceOf(connection.Connection);
        done();
    });

    it('should connect to database', function (done) {
        var conn = connection();

        conn.on('connect', function (db) {
            db.should.be.an.instanceOf(Db);
            conn.readyState.should.equal(1);
            done();
        });
    });

    it('should connect with credentials', function (done) {
        help.addUserToDb({
            username: 'seramatest',
            password: 'test123'
        }, {
            databaseName: 'test',
            host: 'localhost',
            port: 27017
        }, function (err) {
            if (err) return done(err);

            var conn = connection({username: 'seramatest', password: 'test123'});

            conn.on('connect', function (db) {
                db.should.be.an.instanceOf(Db);
                conn.readyState.should.equal(1);
                done();
            });
        });
    });
});
