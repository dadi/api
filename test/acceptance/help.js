var fs = require('fs')
var path = require('path')
var should = require('should')
var connection = require(__dirname + '/../../dadi/lib/model/connection')
var config = require(__dirname + '/../../config')
var request = require('supertest')
var _ = require('underscore')

var clientCollectionName = config.get('auth.clientCollection')

// create a document with random string via the api
module.exports.createDoc = function (token, done) {
  request('http://' + config.get('server.host') + ':' + config.get('server.port'))
    .post('/vtest/testdb/test-schema')
    .set('Authorization', 'Bearer ' + token)
    .send({field1: ((Math.random() * 10) | 1).toString()})
    .expect(200)
    .end(function (err, res) {
      if (err) return done(err)
      res.body.results.length.should.equal(1)
      done(null, res.body.results[0])
    })
}

// create a document with supplied data
module.exports.createDocWithParams = function (token, doc, done) {
  request('http://' + config.get('server.host') + ':' + config.get('server.port'))
    .post('/vtest/testdb/test-schema')
    .set('Authorization', 'Bearer ' + token)
    .send(doc)
    .expect(200)
    .end(function (err, res) {
      if (err) return done(err)
      res.body.results.length.should.equal(1)
      done(null, res.body.results[0])
    })
}

// create a document with random string via the api
module.exports.createDocWithSpecificVersion = function (token, apiVersion, doc, done) {
  request('http://' + config.get('server.host') + ':' + config.get('server.port'))
    .post('/' + apiVersion + '/testdb/test-schema')
    .set('Authorization', 'Bearer ' + token)
    .send(doc)
    .expect(200)
    .end(function (err, res) {
      if (err) return done(err)
      res.body.results.length.should.equal(1)
      done(null, res.body.results[0])
    })
}

// helper function to cleanup the dbs
module.exports.dropDatabase = function (database, done) {
  var collectionName = 'test-schema'
  var conn = connection({ database: 'testdb', collection: collectionName })

  conn.datastore.dropDatabase(collectionName).then(() => {
    return done()
  }).catch((err) => {
    done(err)
  })
}

module.exports.createClient = function (client, done) {
  if (!client) {
    client = {
      clientId: 'test123',
      secret: 'superSecret'
    }
  }

  var collectionName = config.get('auth.clientCollection')
  var conn = connection({ auth: true, database: config.get('auth.database'), collection: collectionName })

  setTimeout(function() {
    conn.datastore.insert(client, collectionName).then(() => {
      return done()
    }).catch((err) => {
      done(err)
    })
  }, 500)
}

module.exports.removeTestClients = function (done) {
  var collectionName = config.get('auth.clientCollection')
  var conn = connection({ auth: true, database: config.get('auth.database'), collection: collectionName })

  conn.datastore.dropDatabase(collectionName).then(() => {
    return done()
  }).catch((err) => {
    done(err)
  })
}

module.exports.clearCache = function () {
  var deleteFolderRecursive = function (filepath) {
    try {
      if (fs.existsSync(filepath) && fs.lstatSync(filepath).isDirectory()) {
        fs.readdirSync(filepath).forEach(function (file, index) {
          var curPath = filepath + '/' + file
          if (fs.lstatSync(curPath).isDirectory()) { // recurse
            deleteFolderRecursive(curPath)
          } else { // delete file
            fs.unlinkSync(path.resolve(curPath))
          }
        })
        fs.rmdirSync(filepath)
      }
    } catch (err) {
      console.log(err)
    }
  }

    // for each directory in the cache folder, remove all files then
    // delete the folder
  fs.readdirSync(config.get('caching.directory.path')).forEach(function (dirname) {
    deleteFolderRecursive(path.join(config.get('caching.directory.path'), dirname))
  })
}

module.exports.getBearerToken = function (done) {
  module.exports.removeTestClients(function (err) {
    if (err) return done(err)

    module.exports.createClient(null, function (err) {
      if (err) return done(err)

      request('http://' + config.get('server.host') + ':' + config.get('server.port'))
            .post(config.get('auth.tokenUrl'))
            .send({
              clientId: 'test123',
              secret: 'superSecret'
            })
            .expect(200)
            // .expect('content-type', 'application/json')
            .end(function (err, res) {
              if (err) return done(err)

              var bearerToken = res.body.accessToken
              should.exist(bearerToken)
              done(null, bearerToken)
            })
    })
  })
}

module.exports.getBearerTokenWithPermissions = function (permissions, done) {
  var client = {
    clientId: 'test123',
    secret: 'superSecret'
  }

  var clientWithPermissions = _.extend(client, permissions)

  module.exports.removeTestClients(function (err) {
    if (err) return done(err)

    module.exports.createClient(clientWithPermissions, function (err) {
      if (err) return done(err)

      request('http://' + config.get('server.host') + ':' + config.get('server.port'))
            .post(config.get('auth.tokenUrl'))
            .send(client)
            .expect(200)
            // .expect('content-type', 'application/json')
            .end(function (err, res) {
              if (err) return done(err)

              var bearerToken = res.body.accessToken

              should.exist(bearerToken)
              done(null, bearerToken)
            })
    })
  })
}

module.exports.getBearerTokenWithAccessType = function (accessType, done) {
  var client = {
    clientId: 'test123',
    secret: 'superSecret',
    accessType: accessType
  }

  module.exports.removeTestClients(function (err) {
    if (err) return done(err)

    module.exports.createClient(client, function (err) {
      if (err) return done(err)

      request('http://' + config.get('server.host') + ':' + config.get('server.port'))
            .post(config.get('auth.tokenUrl'))
            .send(client)
            .expect(200)
            // .expect('content-type', 'application/json')
            .end(function (err, res) {
              if (err) return done(err)

              var bearerToken = res.body.accessToken

              should.exist(bearerToken)
              done(null, bearerToken)
            })
    })
  })
}
