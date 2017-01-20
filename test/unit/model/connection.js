var should = require('should');
var connection = require(__dirname + '/../../../dadi/lib/model/connection');
var help = require(__dirname + '/../help');
var EventEmitter = require('events').EventEmitter;
var Db = require('mongodb').Db;

var config = require(__dirname + '/../../../config');

describe('Model connection', function () {
    this.timeout(5000)

    beforeEach(function(done) {
      connection.resetConnections();
      done()
    })

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

        setTimeout(function() {
          conn.db.should.be.an.instanceOf(Db);
          conn.readyState.should.equal(1);
          conn.connectionString.should.eql("mongodb://127.0.0.1:27017/test?maxPoolSize=1");
          done();
        }, 500)
    });

    it.skip('should connect once to database', function (done) {

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
        setTimeout(function() {
          conn1.db.should.be.an.instanceOf(Db);
          conn1.readyState.should.equal(1);
          conn1.connectionString.should.eql("mongodb://127.0.0.1:27017/test?maxPoolSize=1");
          // dbTag = conn1.db.tag;
        }, 500)

        var conn2 = connection(options);
        setTimeout(function() {
          conn2.db.should.be.an.instanceOf(Db);
          conn2.readyState.should.equal(1);
          conn2.connectionString.should.eql("mongodb://127.0.0.1:27017/test?maxPoolSize=1");
          //conn2.db.tag.should.eql(dbTag);
          done()
        }, 500)
    });

    it('should connect with credentials', function (done) {
        help.addUserToDb({
            username: 'test',
            password: 'test123'
        }, {
            databaseName: 'test',
            host: '127.0.0.1',
            port: 27017
        }, function (err) {
            if (err) return done(err);

            var conn = connection({
                auth: true,
                username: 'test',
                password: 'test123',
                database: 'test',
                hosts: [{
                    host: '127.0.0.1',
                    port: 27017
                }],
                replicaSet: ""
            });

            setTimeout(function() {
              conn.db.should.be.an.instanceOf(Db);
              conn.readyState.should.equal(1);
              done()
            }, 500)
        });
    });

    it('should emit error if authentication fails when connecting with credentials', function (done) {
        help.addUserToDb({
            username: 'test',
            password: 'test123'
        }, {
            databaseName: 'test',
            host: '127.0.0.1',
            port: 27017
        }, function (err) {
            if (err) return done(err);

            var conn = connection({
                auth: true,
                username: 'test',
                password: 'test123x',
                database: 'test',
                hosts: [{
                    host: '127.0.0.1',
                    port: 27017
                }],
                replicaSet: ""
            });

            conn.on('error', (err) => {
              err.message.should.eql('Authentication failed.')
              conn.readyState.should.equal(0)
              done()
            })
        });
    });

    it('should construct a valid replica set connection string', function (done) {
        help.addUserToDb({
            username: 'test',
            password: 'test123'
        }, {
            databaseName: 'test',
            host: 'localhost',
            port: 27017
        }, function (err) {
            if (err) return done(err);

            var options = {
                "username": "test",
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
            conn.connectionString.should.eql("mongodb://test:test123@127.0.0.1:27016,127.0.0.1:27017,127.0.0.1:27018/test?replicaSet=repl-01&maxPoolSize=1");

            // restore config
            config.set('database', dbConfig);
            done();
        });
    });

    it('should raise error when replicaSet servers can\'t be found', function (done) {
        help.addUserToDb({
            username: 'test',
            password: 'test123'
        }, {
            databaseName: 'test',
            host: 'localhost',
            port: 27017
        }, function (err) {
            if (err) return done(err);

            var options = {
                "username": "test",
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
                conn.connectionString.should.eql("mongodb://test:test123@127.0.0.1:27016/test?replicaSet=test&maxPoolSize=1");
                err.toString().should.eql("MongoError: no primary found in replicaset");

                // restore config
                config.set('database', dbConfig);
                done();
            })

        });
    });
});
