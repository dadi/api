var should = require('should');
var request = require('supertest');
var connection = require(__dirname + '/../../bantam/lib/model/connection');
var model = require(__dirname + '/../../bantam/lib/model');
var config = require(__dirname + '/../../config');

describe('Model', function () {
    it('should connect to database matching name', function (done) {
        var schema = require(__dirname + '/workspace/secondary-db/vtest/secondary/collection.secondary-schema.json');
        var mod = model('secondary', schema.fields);

        var conn = mod.connection;
        conn.database.should.equal('secondary');
        conn.host.should.equal('127.0.0.1');
        conn.port.should.equal(27018);

        done();
    });
});
