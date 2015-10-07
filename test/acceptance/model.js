var should = require('should');
var request = require('supertest');
var connection = require(__dirname + '/../../bantam/lib/model/connection');
var model = require(__dirname + '/../../bantam/lib/model');
var help = require(__dirname + '/../../bantam/lib/help');
var config = require(__dirname + '/../../config');

describe('Model', function () {

  it('should connect to specified database', function (done) {
    var schema = require(__dirname + '/workspace/secondary-db/vtest/secondary/collection.secondary-schema.json');
    var mod = model('secondary-schema', help.getFieldsFromSchema(schema), null, schema.settings, 'secondary');

    var conn = mod.connection;
    conn.connectionOptions.database.should.equal('secondary');
    conn.connectionOptions.hosts.should.be.Array;
    conn.connectionOptions.hosts.length.should.equal(1);
    conn.connectionOptions.hosts[0].host.should.equal('127.0.0.1');
    conn.connectionOptions.hosts[0].port.should.equal(27018);

    done();
  });

});
