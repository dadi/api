var should = require('should');
var connection = require(__dirname + '/../../../dadi/lib/model/connection');
var help = require(__dirname + '/../help');
var EventEmitter = require('events').EventEmitter;
var Db = require('mongodb').Db;

var config = require(__dirname + '/../../../config');

describe('Model connection', function () {
    this.timeout(5000)

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
            "database": "test",
            "replicaSet": "",
            "hosts": [
                {
                    "host": "127.0.0.1",
                    "port": 27017
                }
            ]
        };

        var conn = connection(options);

        conn.on('connect', function (db) {
          console.log('emit callback')
          db.should.be.an.instanceOf(Db);
          conn.readyState.should.equal(1);
          conn.connectionString.should.eql("mongodb://127.0.0.1:27017/test?maxPoolSize=1");
          done();
        });
    });

    it('should connect once to database', function (done) {

        var options = {
            "username": "",
            "password": "",
            "database": "test",
            "replicaSet": "",
            "hosts": [
                {
                    "host": "127.0.0.1",
                    "port": 27017
                }
            ]
        };

        var dbTag;

        var conn1 = connection(options);
        conn1.on('connect', function (db) {
          dbTag = db.tag;
          db.should.be.an.instanceOf(Db);
          conn1.readyState.should.equal(1);
          conn1.connectionString.should.eql("mongodb://127.0.0.1:27017/test?maxPoolSize=1");
        });

        var conn2;

        setTimeout(function() {
          conn2 = connection(options);
          conn2.on('connect', function (db) {
            db.should.be.an.instanceOf(Db);
            conn2.readyState.should.equal(1);
            conn2.connectionString.should.eql("mongodb://127.0.0.1:27017/test?maxPoolSize=1");

            db.tag.should.eql(dbTag)
            done();
          });
        })
    });

    it('should connect with credentials', function (done) {
        help.addUserToDb({
            username: 'seramatest',
            password: 'test123'
        }, {
            databaseName: 'test',
            host: '127.0.0.1',
            port: 27017
        }, function (err) {
            if (err) return done(err);

            var conn = connection({
                username: 'seramatest',
                password: 'test123',
                database: 'test',
                hosts: [{
                    host: '127.0.0.1',
                    port: 27017
                }],
                replicaSet: ""
            });

            conn.on('connect', function (db) {
                db.should.be.an.instanceOf(Db);
                conn.readyState.should.equal(1);
                done();
            });
        });
    });

    it('should construct a valid replica set connection string', function (done) {
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
                "database": "test",
                "replicaSet": "repl-01",
                "maxPoolSize": 1,
                "hosts": [
                    {
                        "host": "127.0.0.1",
                        "port": 27016
                    },
                    {
                        "host": "127.0.0.1",
                        "port": 27017
                    },
                    {
                        "host": "127.0.0.1",
                        "port": 27018
                    }
                ]
            };

            var dbConfig = config.get('database');

            // update config
            config.set('database', options);

            var conn = connection();
            conn.connectionString.should.eql("mongodb://seramatest:test123@127.0.0.1:27016,127.0.0.1:27017,127.0.0.1:27018/test?replicaSet=repl-01&maxPoolSize=1");

            // restore config
            config.set('database', dbConfig);
            done();
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
                "database": "test",
                "replicaSet": "test",
                "maxPoolSize": 1,
                "hosts": [
                    {
                        "host": "127.0.0.1",
                        "port": 27016
                    }
                ]
            };

            var dbConfig = config.get('database');

            // update config
            config.set('database', options);

            var conn = connection(options);

            conn.on('error', function (err) {
                conn.connectionString.should.eql("mongodb://seramatest:test123@127.0.0.1:27016/test?replicaSet=test&maxPoolSize=1");
                err.toString().should.eql("Error: failed to connect to [127.0.0.1:27016]");

                // restore config
                config.set('database', dbConfig);
                done();
            })

        });
    });
});
