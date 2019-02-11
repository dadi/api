const acl = require('./../../dadi/lib/model/acl')
const bcrypt = require('bcrypt')
const fs = require('fs-extra')
const path = require('path')
const should = require('should')
const connection = require(__dirname + '/../../dadi/lib/model/connection')
const config = require(__dirname + '/../../config')
const request = require('supertest')

function hashClientSecret(client) {
  switch (client._hashVersion) {
    case undefined:
    case 1:
      return Object.assign({}, client, {
        _hashVersion: 1,
        secret: bcrypt.hashSync(client.secret, config.get('auth.saltRounds'))
      })

    case null:
      delete client._hashVersion

      return client
  }
}

module.exports.bulkRequest = function ({method = 'get', requests, token}) {
  const client = request(`http://${config.get('server.host')}:${config.get('server.port')}`)
  let results = []

  return requests.reduce((result, request, index) => {
    return result.then(() => {
      return new Promise((resolve, reject) => {
        let endpoint = typeof request === 'string'
          ? request
          : request.endpoint

        client[method](endpoint)
        .set('Authorization', `Bearer ${token}`)
        .send(request.body)
        .end((err, res) => {
          if (err) return reject(err)

          results[index] = res.body

          resolve(results)
        })
      })
    })
  }, Promise.resolve())
}

// create a document with random string via the api
module.exports.createDoc = function (token, done) {
  request('http://' + config.get('server.host') + ':' + config.get('server.port'))
    .post('/vtest/testdb/test-schema')
    .set('Authorization', 'Bearer ' + token)
    .send({field1: ((Math.random() * 10) | 1).toString()})
    // .expect(200)
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
    .end((err, res) => {
      if (err) return done(err)
      res.body.results.length.should.equal(1)
      done(null, res.body.results[0])
    })
}

module.exports.createDocument = function ({
  version,
  database,
  collection,
  document,
  token
}) {
  return new Promise((resolve, reject) => {
    request(`http://${config.get('server.host')}:${config.get('server.port')}`)
    .post(`/${version}/${database}/${collection}`)
    .set('Authorization', `Bearer ${token}`)
    .send(document)
    .end((err, res) => {
      if (err) return reject(err)

      resolve(res.body)
    })
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
module.exports.dropDatabase = function (database, collectionName, done) {
  if (typeof collectionName === 'function') {
    done = collectionName
    collectionName = 'test-schema'
  }

  var options = {
    database: 'testdb'
  }

  if (database) {
    options.database = database
  }

  if (collectionName) {
    options.collection = collectionName
  }

  var conn = connection(options, null, config.get('datastore'))

  const dropDatabase = () => {
    conn.datastore.dropDatabase(collectionName).then(() => {
      return done()
    }).catch((err) => {
      return done(err)
    })
  }

  if (conn.datastore.readyState === 1) {
    dropDatabase()
  } else {
    conn.once('connect', dropDatabase)
  }
}

module.exports.createClient = function (client, done, {
  hashVersion = 1
} = {}) {
  if (!client) {
    client = {
      accessType: 'admin',
      clientId: 'test123',
      secret: 'superSecret'
    }
  }

  client = hashClientSecret(client)

  var collectionName = config.get('auth.clientCollection')
  var conn = connection({
    override: true,
    database: config.get('auth.database'),
    collection: collectionName
  }, null, config.get('datastore'))

  const createClient = () => {
    conn.datastore.insert({
      data: client,
      collection: collectionName,
      schema: {}
    }).then(result => {
      return conn.datastore.find({
        query: {
          clientId: client.clientId,
          secret: client.secret
        },
        collection: collectionName,
        schema: {}
      }).then(res => {
        res.results.length.should.eql(1)

        done(null, res.results[0])
      })
    }).catch((err) => {
      done(err)
    })
  }

  if (conn.datastore.readyState === 1) {
    createClient()
  } else {
    conn.on('connect', createClient)
  }
}

module.exports.createACLClient = function (client, callback) {
  let clientsConnection = connection(
    {
      override: true,
      database: config.get('auth.database'),
      collection: config.get('auth.clientCollection')
    },
    null,
    config.get('datastore')
  )

  client = hashClientSecret(client)

  return clientsConnection.datastore.insert({
    data: client,
    collection: config.get('auth.clientCollection'),
    schema: {}
  }).then(result => {
    return acl.access.write().then(w => {
      if (typeof callback === 'function') {
        done(null, result)
      }

      return result
    })
  }).catch(err => {
    if (typeof callback === 'function') {
      done(err)
    }

    return Promise.reject(err)
  })
}

module.exports.createACLRole = function (role, callback) {
  let rolesConnection = connection(
    {
      override: true,
      database: config.get('auth.database'),
      collection: config.get('auth.roleCollection')
    },
    null,
    config.get('datastore')
  )

  return rolesConnection.datastore.insert({
    data: role,
    collection: config.get('auth.roleCollection'),
    schema: {}
  }).then(result => {
    return acl.access.write().then(() => {
      if (typeof callback === 'function') {
        done(null, result)
      }

      return result
    })
  }).catch(err => {
    if (typeof callback === 'function') {
      done(err)
    }

    return Promise.reject(err)
  })
}

module.exports.removeSchemaData = function (done) {
  let schemaConnection = connection(
    {
      override: true,
      database: config.get('schemas.database'),
      collection: config.get('schemas.schemaCollection')
    },
    null,
    config.get('datastore')
  )

  return schemaConnection.datastore.dropDatabase(
    config.get('schemas.schemaCollection')
  ).then(() => {
    if (typeof done === 'function') {
      done()
    }
  }).catch(err => {
    if (typeof done === 'function') {
      done(err)
    }
  })
}

module.exports.removeACLData = function (done) {
  let accessConnection = connection(
    {
      override: true,
      database: config.get('auth.database'),
      collection: config.get('auth.accessCollection')
    },
    null,
    config.get('datastore')
  )

  let clientsConnection = connection(
    {
      override: true,
      database: config.get('auth.database'),
      collection: config.get('auth.clientCollection')
    },
    null,
    config.get('datastore')
  )

  let rolesConnection = connection(
    {
      override: true,
      database: config.get('auth.database'),
      collection: config.get('auth.roleCollection')
    },
    null,
    config.get('datastore')
  )

  return accessConnection.datastore.dropDatabase(
    config.get('auth.accessCollection')
  ).then(() => {
    return clientsConnection.datastore.dropDatabase(
      config.get('auth.clientCollection')
    )
  }).then(() => {
    return rolesConnection.datastore.dropDatabase(
      config.get('auth.roleCollection')
    )
  }).then(() => {
    if (typeof done === 'function') {
      done()
    }
  }).catch(err => {
    if (typeof done === 'function') {
      done(err)
    }
  })
}

module.exports.removeTestClients = function (done) {
  var collectionName = config.get('auth.clientCollection')
  var conn = connection({ override: true, database: config.get('auth.database'), collection: collectionName }, null, config.get('datastore'))

  const dropDatabase = () => {
    conn.datastore.dropDatabase(collectionName).then(() => {
      return done()
    }).catch((err) => {
      done(err)
    })
  }

  if (conn.datastore.readyState === 1) {
    dropDatabase()
  } else {
    conn.once('connect', dropDatabase)
  }
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
      .set('content-type', 'application/json')
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

module.exports.getBearerTokenWithPermissions = function (permissions, done = (() => {})) {
  let client = Object.assign({}, {
    clientId: 'test123',
    secret: 'superSecret'
  }, permissions)

  return new Promise((resolve, reject) => {
    module.exports.removeTestClients(err => {
      if (err) {
        reject(err)

        return done(err)
      }

      module.exports.createClient(client, err => {
        if (err) {
          reject(err)

          return done(err)
        }

        request(`http://${config.get('server.host')}:${config.get('server.port')}`)
        .post(config.get('auth.tokenUrl'))
        .send(client)
        .expect(200)
        .expect('content-type', 'application/json')
        .end((err, res) => {
          if (err) {
            reject(err)

            return done(err)
          }

          let bearerToken = res.body.accessToken

          should.exist(bearerToken)

          return acl.access.write().then(() => {
            done(null, bearerToken)

            resolve(bearerToken)
          })
        })
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

module.exports.getCollectionMap = function () {
  let collectionsPath = path.resolve(
    config.get('paths.collections')
  )
  let versions = fs.readdirSync(collectionsPath)
  let map = {}

  versions.forEach(version => {
    let versionPath = path.join(collectionsPath, version)
    let databases = fs.readdirSync(versionPath)

    databases.forEach(database => {
      let databasePath = path.join(versionPath, database)
      let stats = fs.statSync(databasePath)

      if (stats.isDirectory()) {
        let collections = fs.readdirSync(databasePath)

        collections.forEach(collection => {
          let match = collection.match(/^collection.(.*).json$/)

          if (!match) {
            return
          }

          let collectionName = match[1]
          let collectionPath = path.join(databasePath, collection)

          map[`/${version}/${database}/${collectionName}`] = require(collectionPath)
        })
      }
    })
  })

  return map
}

module.exports.writeTempFile = function (filePath, data, callback) {
  let existingContent
  let fullPath = path.resolve(__dirname, filePath)

  try {
    existingContent = fs.readFileSync(fullPath, 'utf8')
  } catch (err) {}

  let revertFn = () => {
    if (existingContent) {
      fs.writeFileSync(fullPath, existingContent)
    } else {
      fs.unlinkSync(fullPath)
    }
  }

  let parsedData = typeof data === 'string'
    ? data
    : JSON.stringify(data, null, 2)

  fs.ensureDir(
    path.dirname(fullPath),
    err => {
      fs.writeFileSync(fullPath, parsedData)
    }
  )

  setTimeout(() => {
    callback(revertFn)
  }, 200)
}
