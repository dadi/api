var fs = require('fs');
var path = require('path');
var should = require('should');
var connection = require(__dirname + '/../../bantam/lib/model/connection');
var config = require(__dirname + '/../../config');
var request = require('supertest');
var _ = require('underscore');

var clientCollectionName = config.auth.database.clientCollection;

// create a document with random string via the api
module.exports.createDoc = function (token, done) {
    request('http://' + config.server.host + ':' + config.server.port)
    .post('/vtest/testdb/test-schema')
    .set('Authorization', 'Bearer ' + token)
    .send({field1: ((Math.random() * 10) | 0).toString()})
    .expect(200)
    .end(function (err, res) {
        if (err) return done(err);
        res.body.length.should.equal(1);
        done(null, res.body[0]);
    });
};

// create a document with supplied data
module.exports.createDocWithParams = function (token, doc, done) {
    request('http://' + config.server.host + ':' + config.server.port)
    .post('/vtest/testdb/test-schema')
    .set('Authorization', 'Bearer ' + token)
    .send(doc)
    .expect(200)
    .end(function (err, res) {
        if (err) return done(err);
        res.body.length.should.equal(1);
        done(null, res.body[0]);
    });
};

// helper function to cleanup the `serama` db
module.exports.dropDatabase = function (done) {
    connection().on('connect', function (db) {

        db.dropDatabase(function (err) {
            if (err) return done(err);
            
            db.close(true, done);
        });
    });
};

module.exports.createClient = function (client, done) {

    if (!client) {
        client = {
            clientId: 'test123',
            secret: 'superSecret'
        }
    }

    var clientStore = connection(config.auth.database);

    clientStore.on('connect', function (db) {
        db.collection(clientCollectionName).insert(client, done);
    });
};

module.exports.removeClients = function (done) {

    var clientStore = connection(config.auth.database);

    clientStore.on('connect', function (db) {
        db.collection(clientCollectionName).remove(done);
    });
};

module.exports.clearCache = function () {

    // all sync stuff
    fs.readdirSync(config.caching.directory).forEach(function (filename) {
        fs.unlinkSync(path.join(config.caching.directory, filename));
    });
}

module.exports.getBearerToken = function (done) {

    module.exports.removeClients(function() {
        //console.log('module.exports.getBearerToken: removed clients');
    });

    module.exports.createClient(null, function (err) {
        if (err) return done(err);

        request('http://' + config.server.host + ':' + config.server.port)
        .post(config.auth.tokenUrl)
        .send({
            clientId: 'test123',
            secret: 'superSecret'
        })
        .expect(200)
        //.expect('content-type', 'application/json')
        .end(function (err, res) {
            if (err) return done(err);

            var bearerToken = res.body.accessToken;
            should.exist(bearerToken);
            done(null, bearerToken);
        });
    });
};

module.exports.getBearerTokenWithPermissions = function (permissions, done) {

    var client = {
        clientId: 'test123',
        secret: 'superSecret'
    }

    var clientWithPermissions = _.extend(client, permissions);

    module.exports.removeClients(function() {
        //console.log('module.exports.getBearerTokenWithPermissions: removed clients');
    });

    module.exports.createClient(clientWithPermissions, function (err) {
        if (err) return done(err);

        request('http://' + config.server.host + ':' + config.server.port)
        .post(config.auth.tokenUrl)
        .send(client)
        .expect(200)
        //.expect('content-type', 'application/json')
        .end(function (err, res) {
            if (err) return done(err);

            var bearerToken = res.body.accessToken;

            should.exist(bearerToken);
            done(null, bearerToken);
        });
    });
};
