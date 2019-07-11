const acl = require('./../../dadi/lib/model/acl')
const bcrypt = require('bcrypt')
const exec = require('child_process').exec
const fs = require('fs-extra')
const path = require('path')
const should = require('should')
const connection = require(__dirname + '/../../dadi/lib/model/connection')
const config = require(__dirname + '/../../config')
const request = require('supertest')
const schemaStore = require('../../dadi/lib/model/schemaStore')

function hashClientSecret(client) {
  if (client._hashVersion === undefined && config.get('auth.hashSecrets')) {
    client._hashVersion = 1
  }

  switch (client._hashVersion) {
    case 1:
      return Object.assign({}, client, {
        _hashVersion: 1,
        secret: bcrypt.hashSync(client.secret, config.get('auth.saltRounds'))
      })

    default:
      delete client._hashVersion

      return client
  }
}

module.exports.bulkRequest = function({method = 'get', requests, token}) {
  const client = request(
    `http://${config.get('server.host')}:${config.get('server.port')}`
  )
  const results = []

  return requests.reduce((result, request, index) => {
    return result.then(() => {
      return new Promise((resolve, reject) => {
        const endpoint =
          typeof request === 'string' ? request : request.endpoint

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
module.exports.createDoc = function(token, done) {
  request(
    'http://' + config.get('server.host') + ':' + config.get('server.port')
  )
    .post('/testdb/test-schema')
    .set('Authorization', 'Bearer ' + token)
    .send({field1: ((Math.random() * 10) | 1).toString()})
    // .expect(200)
    .end(function(err, res) {
      if (err) return done(err)
      res.body.results.length.should.equal(1)
      done(null, res.body.results[0])
    })
}

// create a document with supplied data
module.exports.createDocWithParams = function(token, doc, done) {
  request(
    'http://' + config.get('server.host') + ':' + config.get('server.port')
  )
    .post('/testdb/test-schema')
    .set('Authorization', 'Bearer ' + token)
    .send(doc)
    .end((err, res) => {
      if (err) return done(err)
      res.body.results.length.should.equal(1)
      done(null, res.body.results[0])
    })
}

module.exports.createDocument = function({
  database,
  collection,
  document,
  token
}) {
  return new Promise((resolve, reject) => {
    request(`http://${config.get('server.host')}:${config.get('server.port')}`)
      .post(`/${database}/${collection}`)
      .set('Authorization', `Bearer ${token}`)
      .send(document)
      .end((err, res) => {
        if (err) return reject(err)

        resolve(res.body)
      })
  })
}

// create a document with random string via the api
module.exports.createDocWithSpecificVersion = function(
  token,
  apiVersion,
  doc,
  done
) {
  request(
    'http://' + config.get('server.host') + ':' + config.get('server.port')
  )
    .post('/testdb/test-schema')
    .set('Authorization', 'Bearer ' + token)
    .send(doc)
    .expect(200)
    .end(function(err, res) {
      if (err) return done(err)
      res.body.results.length.should.equal(1)
      done(null, res.body.results[0])
    })
}

// helper function to cleanup the dbs
module.exports.dropDatabase = function(database, collectionName, done) {
  if (typeof collectionName === 'function') {
    done = collectionName
    collectionName = 'test-schema'
  }

  const options = {
    database: 'testdb'
  }

  if (database) {
    options.database = database
  }

  if (collectionName) {
    options.collection = collectionName
  }

  const conn = connection(options, null, config.get('datastore'))

  const dropDatabase = () => {
    return conn.datastore
      .dropDatabase(collectionName)
      .then(() => {
        if (typeof done === 'function') {
          return done()
        }
      })
      .catch(err => {
        if (typeof done === 'function') {
          return done(err)
        }
      })
  }

  return new Promise((resolve, reject) => {
    if (conn.datastore.readyState === 1) {
      dropDatabase()
        .then(resolve)
        .catch(reject)
    } else {
      conn.once('connect', () =>
        dropDatabase()
          .then(resolve)
          .catch(reject)
      )
    }
  })
}

module.exports.createClient = function(client, done) {
  if (!client) {
    client = {
      accessType: 'admin',
      clientId: 'test123',
      secret: 'superSecret'
    }
  }

  client = hashClientSecret(client)

  const collectionName = config.get('auth.clientCollection')
  const conn = connection(
    {
      override: true,
      database: config.get('auth.database'),
      collection: collectionName
    },
    null,
    config.get('datastore')
  )

  const createClient = () => {
    conn.datastore
      .insert({
        data: client,
        collection: collectionName,
        schema: {}
      })
      .then(result => {
        return conn.datastore
          .find({
            query: {
              clientId: client.clientId,
              secret: client.secret
            },
            collection: collectionName,
            schema: {}
          })
          .then(res => {
            res.results.length.should.eql(1)

            done(null, res.results[0])
          })
      })
      .catch(err => {
        done(err)
      })
  }

  if (conn.datastore.readyState === 1) {
    createClient()
  } else {
    conn.on('connect', createClient)
  }
}

module.exports.createACLClient = function(client, callback) {
  const clientsConnection = connection(
    {
      override: true,
      database: config.get('auth.database'),
      collection: config.get('auth.clientCollection')
    },
    null,
    config.get('datastore')
  )

  client = hashClientSecret(client)

  return clientsConnection.datastore
    .insert({
      data: client,
      collection: config.get('auth.clientCollection'),
      schema: {}
    })
    .then(result => {
      return acl.access.write().then(w => {
        if (typeof callback === 'function') {
          callback(null, result)
        }

        return result
      })
    })
    .catch(err => {
      if (typeof callback === 'function') {
        callback(err)
      }

      return Promise.reject(err)
    })
}

module.exports.createACLRole = function(role, callback) {
  const rolesConnection = connection(
    {
      override: true,
      database: config.get('auth.database'),
      collection: config.get('auth.roleCollection')
    },
    null,
    config.get('datastore')
  )

  return rolesConnection.datastore
    .insert({
      data: role,
      collection: config.get('auth.roleCollection'),
      schema: {}
    })
    .then(result => {
      return acl.access.write().then(() => {
        if (typeof callback === 'function') {
          callback(null, result)
        }

        return result
      })
    })
    .catch(err => {
      if (typeof callback === 'function') {
        callback(err)
      }

      return Promise.reject(err)
    })
}

module.exports.createSchemas = async function(
  schemas,
  {keepExisting = false} = {}
) {
  if (!keepExisting) {
    await module.exports.dropSchemas()
  }

  const conn = connection(
    {
      collection: config.get('schemas.collection')
    },
    config.get('schemas.collection'),
    config.get('datastore')
  )

  await conn.whenConnected()

  const schemasArray = Array.isArray(schemas) ? schemas : [schemas]
  const queue = schemasArray.map(schema => {
    return schemaStore.create(schema)
  })

  return Promise.all(queue)
}

module.exports.dropSchemas = async function() {
  const conn = connection(
    {
      collection: config.get('schemas.collection')
    },
    config.get('schemas.collection'),
    config.get('datastore')
  )

  const database = await schemaStore.connection

  return database.dropDatabase(config.get('schemas.collection'))
}

module.exports.removeACLData = function(done) {
  const accessConnection = connection(
    {
      override: true,
      database: config.get('auth.database'),
      collection: config.get('auth.accessCollection')
    },
    null,
    config.get('datastore')
  )

  const clientsConnection = connection(
    {
      override: true,
      database: config.get('auth.database'),
      collection: config.get('auth.clientCollection')
    },
    null,
    config.get('datastore')
  )

  const rolesConnection = connection(
    {
      override: true,
      database: config.get('auth.database'),
      collection: config.get('auth.roleCollection')
    },
    null,
    config.get('datastore')
  )

  return accessConnection.datastore
    .dropDatabase(config.get('auth.accessCollection'))
    .then(() => {
      return clientsConnection.datastore.dropDatabase(
        config.get('auth.clientCollection')
      )
    })
    .then(() => {
      return rolesConnection.datastore.dropDatabase(
        config.get('auth.roleCollection')
      )
    })
    .then(() => {
      if (typeof done === 'function') {
        done()
      }
    })
    .catch(err => {
      if (typeof done === 'function') {
        done(err)
      }
    })
}

module.exports.removeTestClients = function(done) {
  const collectionName = config.get('auth.clientCollection')
  const conn = connection(
    {
      override: true,
      database: config.get('auth.database'),
      collection: collectionName
    },
    null,
    config.get('datastore')
  )

  const dropDatabase = () => {
    conn.datastore
      .dropDatabase(collectionName)
      .then(() => {
        return done()
      })
      .catch(err => {
        done(err)
      })
  }

  if (conn.datastore.readyState === 1) {
    dropDatabase()
  } else {
    conn.once('connect', dropDatabase)
  }
}

module.exports.clearCache = function() {
  const dir = path.resolve(config.get('caching.directory.path'))

  exec(`rm -rf ${dir}`, (err, result) => {
    if (err) {
      console.log(`Error removing directory ${dir}`, err)
    } else {
      console.log(`Removed directory ${dir}`)
    }
  })
}

module.exports.getBearerToken = function(done) {
  module.exports.removeTestClients(function(err) {
    if (err) return done(err)

    module.exports.createClient(null, function(err) {
      if (err) return done(err)

      request(
        'http://' + config.get('server.host') + ':' + config.get('server.port')
      )
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send({
          clientId: 'test123',
          secret: 'superSecret'
        })
        .expect(200)
        // .expect('content-type', 'application/json')
        .end(function(err, res) {
          if (err) return done(err)
          const bearerToken = res.body.accessToken

          should.exist(bearerToken)
          done(null, bearerToken)
        })
    })
  })
}

module.exports.getBearerTokenWithPermissions = function(
  permissions,
  done = () => {}
) {
  const client = Object.assign(
    {},
    {
      clientId: 'test123',
      secret: 'superSecret'
    },
    permissions
  )

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

        request(
          `http://${config.get('server.host')}:${config.get('server.port')}`
        )
          .post(config.get('auth.tokenUrl'))
          .send(client)
          .expect(200)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            if (err) {
              reject(err)

              return done(err)
            }

            const bearerToken = res.body.accessToken

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

module.exports.getBearerTokenWithAccessType = function(accessType, done) {
  const client = {
    clientId: 'test123',
    secret: 'superSecret',
    accessType
  }

  module.exports.removeTestClients(function(err) {
    if (err) return done(err)

    module.exports.createClient(client, function(err) {
      if (err) return done(err)

      request(
        'http://' + config.get('server.host') + ':' + config.get('server.port')
      )
        .post(config.get('auth.tokenUrl'))
        .send(client)
        .expect(200)
        // .expect('content-type', 'application/json')
        .end(function(err, res) {
          if (err) return done(err)

          const bearerToken = res.body.accessToken

          should.exist(bearerToken)
          done(null, bearerToken)
        })
    })
  })
}

module.exports.writeTempFile = function(filePath, data, callback) {
  let existingContent
  const fullPath = path.resolve(__dirname, filePath)

  try {
    existingContent = fs.readFileSync(fullPath, 'utf8')
  } catch (err) {
    // noop
  }

  const revertFn = () => {
    if (existingContent) {
      fs.writeFileSync(fullPath, existingContent)
    } else {
      fs.unlinkSync(fullPath)
    }
  }

  const parsedData =
    typeof data === 'string' ? data : JSON.stringify(data, null, 2)

  fs.ensureDir(path.dirname(fullPath), err => {
    fs.writeFileSync(fullPath, parsedData)
  })

  setTimeout(() => {
    callback(revertFn)
  }, 200)
}
