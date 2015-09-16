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

        var options = {
            "username": "",
            "password": "",
            "database": "serama",
            "replicaSet": false,
            "hosts": [
                {
                    "host": "localhost",
                    "port": 27017
                }
            ]
        };

        var conn = connection(options);

        conn.on('connect', function (db) {
            db.should.be.an.instanceOf(Db);
            conn.readyState.should.equal(1);
            conn.connectionString.should.eql("mongodb://localhost:27017/serama");
            done();
        });
    });

    it('should connect with credentials', function (done) {
        help.addUserToDb({
            username: 'seramatest',
            password: 'test123'
        }, {
            databaseName: 'serama',
            host: 'localhost',
            port: 27017
        }, function (err) {
            if (err) return done(err);

            var conn = connection({
                username: 'seramatest',
                password: 'test123',
                hosts: [{
                    database: 'serama',
                    host: 'localhost',
                    port: 27017
                }],
                replicaSet: false
            });

            conn.on('connect', function (db) {
                db.should.be.an.instanceOf(Db);
                conn.readyState.should.equal(1);
                done();
            });
        });
    });

    it('should raise error when replicaSet servers can\'t be found', function (done) {
        help.addUserToDb({
            username: 'seramatest',
            password: 'test123'
        }, {
            databaseName: 'serama',
            host: 'localhost',
            port: 27017
        }, function (err) {
            if (err) return done(err);

            var options = {
                "username": "seramatest",
                "password": "test123",
                "database": "serama",
                "replicaSet": "test",
                "maxPoolSize": 1,
                "hosts": [
                    {
                        "host": "localhost",
                        "port": 27016
                    }
                ]
            };

            var conn = connection(options);

            conn.on('error', function (err) {
                conn.readyState.should.equal(0);
                conn.connectionString.should.eql("mongodb://seramatest:test123@localhost:27016/serama?replicaSet=test&maxPoolSize=1");
                done();
            })

        });
    });
});
