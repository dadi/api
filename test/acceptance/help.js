var fs = require('fs');
var path = require('path');
var should = require('should');
var http2 = require('http2');
var needle = require('needle');
var connection = require(__dirname + '/../../dadi/lib/model/connection');
var config = require(__dirname + '/../../config');
var request = require('supertest');
var _ = require('underscore');
var url = require('url');

var clientCollectionName = config.get('auth.clientCollection');

// create a document with random string via the api
module.exports.createDoc = function (token, done) {
    request('http://' + config.get('server.host') + ':' + config.get('server.port'))
    .post('/vtest/testdb/test-schema')
    .set('Authorization', 'Bearer ' + token)
    .send({field1: ((Math.random() * 10) | 0).toString()})
    .expect(200)
    .end(function (err, res) {
        if (err) return done(err);
        res.body.results.length.should.equal(1);
        done(null, res.body.results[0]);
    });
};

// create a document with random string via the api
module.exports.createDocHttps = function (token, done) {
    var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-schema';
    var options = url.parse(doc_link);
    options.key = fs.readFileSync(config.get('server.http2.key_path'));
    options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
    options.headers = {
        'Authorization': 'Bearer ' + token
    };
    needle.post(doc_link, {field1: ((Math.random() * 10) | 0).toString()}, options, function(err, res) {
       if (err) return done(err);
        res.body.results.length.should.equal(1);
        done(null, res.body.results[0]); 
    });
};

// create a document with supplied data
module.exports.createDocWithParams = function (token, doc, done) {
    request('http://' + config.get('server.host') + ':' + config.get('server.port'))
    .post('/vtest/testdb/test-schema')
    .set('Authorization', 'Bearer ' + token)
    .send(doc)
    .expect(200)
    .end(function (err, res) {
        if (err) return done(err);
        res.body.results.length.should.equal(1);
        done(null, res.body.results[0]);
    });
};

module.exports.createDocWithParamsHttps = function (token, doc, done) {
    var doc_link = 'https://localhost:'+config.get('server.port') + '/vtest/testdb/test-schema';
    var options = url.parse(doc_link);
    options.key = fs.readFileSync(config.get('server.http2.key_path'));
    options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
    options.headers = {
        'Authorization': 'Bearer ' + token
    };
    options.json = true;
    needle.post(doc_link, doc, options, function(err, res) {
       if (err) return done(err);
        res.body.results.length.should.equal(1);
        done(null, res.body.results[0]); 
    });
};

// create a document with random string via the api
module.exports.createDocWithSpecificVersion = function (token, apiVersion, doc, done) {
    request('http://' + config.get('server.host') + ':' + config.get('server.port'))
    .post('/' + apiVersion + '/testdb/test-schema')
    .set('Authorization', 'Bearer ' + token)
    .send(doc)
    .expect(200)
    .end(function (err, res) {
        if (err) return done(err);
        res.body.results.length.should.equal(1);
        done(null, res.body.results[0]);
    });
};

module.exports.createDocWithSpecificVersionHttps = function (token, apiVersion, doc, done) {
    var doc_link = 'https://localhost:'+config.get('server.port') + '/' + apiVersion + '/testdb/test-schema';
    var options = url.parse(doc_link);
    options.key = fs.readFileSync(config.get('server.http2.key_path'));
    options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
    options.headers = {
        'Authorization': 'Bearer ' + token
    };
    options.json = true;
    needle.post(doc_link, doc, options, function(err, res) {
        if (err) return done(err);
        res.body.results.length.should.equal(1);
        done(null, res.body.results[0]); 
    });
};


// helper function to cleanup the dbs
module.exports.dropDatabase = function (database, done) {
    if (database.indexOf('test') > -1) {
      var database = connection({'database':database||'test'});
      database.on('connect', function (db) {
          db.dropDatabase(function (err) {
              if (err) return done(err);
              db.close(true, done);
          });
      });
    }
};

module.exports.createClient = function (client, done) {

    if (!client) {
        client = {
            clientId: 'test123',
            secret: 'superSecret'
        }
    }

    var clientStore = connection(config.get('auth.database'));

    clientStore.on('connect', function (db) {
        db.collection(clientCollectionName).insert(client, done);
    });
};

module.exports.removeTestClients = function (done) {
  var dbOptions = config.get('auth.database');
  dbOptions.auth = true;
  var clientStore = connection(dbOptions);

  clientStore.on('connect', function (db) {
    var query = { "clientId": { $regex: /^test/ } };
    db.collection(clientCollectionName).remove(query, done);
  });
};

module.exports.clearCache = function () {

    var deleteFolderRecursive = function(filepath) {
      if( fs.existsSync(filepath) && fs.lstatSync(filepath).isDirectory() ) {
        fs.readdirSync(filepath).forEach(function(file,index){
          var curPath = filepath + "/" + file;
          if(fs.lstatSync(curPath).isDirectory()) { // recurse
            deleteFolderRecursive(curPath);
          } else { // delete file
            fs.unlinkSync(path.resolve(curPath));
          }
        });
        fs.rmdirSync(filepath);
      }
    };

    // for each directory in the cache folder, remove all files then
    // delete the folder
    fs.readdirSync(config.get('caching.directory.path')).forEach(function (dirname) {
        deleteFolderRecursive(path.join(config.get('caching.directory.path'), dirname));
    });
}

module.exports.getBearerToken = function (done) {

    module.exports.removeTestClients(function (err) {
        if (err) return done(err);

        module.exports.createClient(null, function (err) {
            if (err) return done(err);

            request('http://' + config.get('server.host') + ':' + config.get('server.port'))
            .post(config.get('auth.tokenUrl'))
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
    });
};

module.exports.getBearerTokenHttps = function (done) {

    module.exports.removeTestClients(function (err) {
        if (err) return done(err);

        module.exports.createClient(null, function (err) {
            if (err) return done(err);
            var doc_link = 'https://localhost:'+config.get('server.port') + config.get('auth.tokenUrl');
            var options = url.parse(doc_link);
            options.key = fs.readFileSync(config.get('server.http2.key_path'));
            options.ca = fs.readFileSync(config.get('server.http2.crt_path'));
            needle.post(doc_link, {clientId: 'test123', secret: 'superSecret'}, options, function(err, res) {
                if (err) return done(err);

                var bearerToken = res.body.accessToken;
                should.exist(bearerToken);
                done(null, bearerToken);
            });
        });
    });
};

module.exports.getBearerTokenWithPermissions = function (permissions, done) {

    var client = {
        clientId: 'test123',
        secret: 'superSecret'
    }

    var clientWithPermissions = _.extend(client, permissions);

    module.exports.removeTestClients(function (err) {
        if (err) return done(err);

        module.exports.createClient(clientWithPermissions, function (err) {
            if (err) return done(err);

            request('http://' + config.get('server.host') + ':' + config.get('server.port'))
            .post(config.get('auth.tokenUrl'))
            .send(client)
            .expect(200)
            //.expect('content-type', 'application/json')
            .end(function (err, res) {
                if (err) return done(err);
                console.log(res);
                var bearerToken = res.body.accessToken;

                should.exist(bearerToken);
                done(null, bearerToken);
            });
        });
    });
};

module.exports.getBearerTokenWithPermissionsHttps = function (permissions, done) {

    var client = {
        clientId: 'test123',
        secret: 'superSecret'
    }

    var clientWithPermissions = _.extend(client, permissions);

    module.exports.removeTestClients(function (err) {
        if (err) return done(err);

        module.exports.createClient(clientWithPermissions, function (err) {
            if (err) return done(err);
            var doc_link = 'https://localhost:'+config.get('server.port') + config.get('auth.tokenUrl');
            var options = url.parse(doc_link);
            options.key = fs.readFileSync(config.get('server.http2.key_path'));
            options.ca = fs.readFileSync(config.get('server.http2.crt_path'));

            needle.post(doc_link, client, options, function(err, res) {
                if (err) return done(err);
                console.log(res);
                var bearerToken = res.body.accessToken;

                should.exist(bearerToken);
                done(null, bearerToken);
            });
        });
    });
};

module.exports.getBearerTokenWithAccessType = function (accessType, done) {

    var client = {
        clientId: 'test123',
        secret: 'superSecret',
        accessType: accessType
    }

    module.exports.removeTestClients(function (err) {
        if (err) return done(err);

        module.exports.createClient(client, function (err) {
            if (err) return done(err);

            request('http://' + config.get('server.host') + ':' + config.get('server.port'))
            .post(config.get('auth.tokenUrl'))
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
    });
};

module.exports.getBearerTokenWithAccessTypeHttps = function (accessType, done) {

    var client = {
        clientId: 'test123',
        secret: 'superSecret',
        accessType: accessType
    }

    module.exports.removeTestClients(function (err) {
        if (err) return done(err);

        module.exports.createClient(client, function (err) {
            if (err) return done(err);
            var doc_link = 'https://localhost:'+config.get('server.port') + config.get('auth.tokenUrl');
            var options = url.parse(doc_link);
            options.key = fs.readFileSync(config.get('server.http2.key_path'));
            options.ca = fs.readFileSync(config.get('server.http2.crt_path'));

            needle.post(doc_link, client, options, function(err, res) {
                if (err) return done(err);

                var bearerToken = res.body.accessToken;

                should.exist(bearerToken);
                done(null, bearerToken);
            });
        });
    });
};