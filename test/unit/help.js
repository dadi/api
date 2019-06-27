const config = require(__dirname + '/../../config.js')
const model = require(__dirname + '/../../dadi/lib/model')
const connection = require(__dirname + '/../../dadi/lib/model/connection')

// return valid model definition object
module.exports.getModelSchema = function() {
  return {
    fieldName: {
      type: 'String',
      label: 'Title',
      comments: 'The title of the entry',
      validation: {},
      required: false,
      message: ''
    }
  }
}

module.exports.getSearchModelSchema = function() {
  return {
    fieldName: {
      type: 'String',
      label: 'Title',
      comments: 'The title of the entry',
      validation: {},
      required: false
    },
    invalidSearchableFieldName: {
      type: 'String',
      label: 'Title',
      comments: 'The title of the entry',
      validation: {},
      required: false,
      search: true
    },
    searchableFieldName: {
      type: 'String',
      label: 'Title',
      comments: 'The title of the entry',
      validation: {},
      required: false,
      search: {
        weight: 2
      }
    }
  }
}

module.exports.getSampleSearchDocument = () => {
  return {
    fieldName: 'foo',
    invalidSearchableFieldName: 'bar',
    searchableFieldName: 'baz'
  }
}

module.exports.getModelSettings = function() {
  return {
    cache: true,
    cacheTTL: 300,
    authenticate: true,
    count: 40,
    sort: 'fieldName',
    sortOrder: 1,
    storeRevisions: true,
    revisionCollection: 'testSchemaHistory'
  }
}

module.exports.getModelSchemaWithMultipleFields = function() {
  return {
    field1: {
      type: 'String',
      label: 'Title',
      comments: 'The title of the entry',
      validation: {},
      required: false,
      message: ''
    },
    field2: {
      type: 'String',
      label: 'Title',
      comments: 'The title of the entry',
      validation: {},
      required: false,
      message: ''
    }
  }
}

// sync test that a property is correctly attached to a model
module.exports.testModelProperty = function(key, val) {
  const obj = {}

  obj[key] = val

  const schema = module.exports.getModelSchema()

  schema.fieldName = Object.assign({}, schema.fieldName, obj)

  const m = model('testModelName', schema, null, {database: 'testdb'})

  m.schema.fieldName[key].should.equal(val)
}

module.exports.cleanUpDB = function(done) {
  module.exports.clearCollection('testModelName', err => {
    module.exports.clearCollection('testModelNameHistory', err => {
      module.exports.clearCollection('articles', err => {
        module.exports.clearCollection('categories', err => {
          module.exports.clearCollection('book', err => {
            module.exports.clearCollection('person', err => {
              done()
            })
          })
        })
      })
    })
  })
  //
  // if (conn.datastore.dropDatabase) {
  //   conn.datastore.dropDatabase().then(() => {
  //     done()
  //   }).catch((err) => {
  //     console.log(err)
  //     done(err)
  //   })
  // } else {
  //   return done()
  // }
  // conn.connect({database: "testdb"}).then(() => {
  //   if (conn.db.dropDatabase) {
  //     conn.datastore.dropDatabase('testdb').then(done).catch((err) => { done(err) })
  //    //     if (err) return done(err)
  //    //
  //    //       // force close this connection
  //    //       // db.close(true, done);
  //    //     done()
  //    //   })
  //  } else {
  //    return done()
  //  }
  // })

  // setTimeout(function () {
  //   if (database.db.databaseName !== 'test') {
  //     var err = new Error('Database should be `test`, not `' + db.databaseName + '`.')
  //     return done(err)
  //   }
  // }, 100)
  //
  // // drop all data
  // setTimeout(function () {
  //   database.db.dropDatabase('testdb', function (err) {
  //     if (err) return done(err)
  //
  //       // force close this connection
  //       // db.close(true, done);
  //     done()
  //   })
  // }, 100)
}

module.exports.clearCollection = function(collectionName, done) {
  const conn = connection(
    {database: 'testdb', collection: collectionName},
    null,
    config.get('datastore')
  )

  if (conn.datastore.dropDatabase) {
    conn.datastore
      .dropDatabase(collectionName)
      .then(() => {
        return done()
      })
      .catch(err => {
        // console.log('clearCollection error:', err)
        done(err)
      })
  } else {
    return done()
  }
}

// module.exports.addUserToDb = function (userObj, dbObj, done) {
//   var Db = require('mongodb').Db
//   var Server = require('mongodb').Server
//
//   var db = new Db(dbObj.databaseName, new Server(dbObj.host, dbObj.port), {w: 'majority'})
//
//     // Establish connection to db
//   db.open(function (err, db) {
//     if (err) return done(err)
//
//         // Add a user to the database
//     db.addUser(userObj.username, userObj.password, { roles: [{ role: 'readWrite', db: dbObj.databaseName }] }, function (err) {
//             // notice no error handling!
//             // This is because we want this to be an idempotent func that ensures
//             // the user exists in the database.  Since `addUser` will error if
//             // the user already exists we just assume things are ok here
//
//       db.close(done)
//     })
//   })
// }

// Listens for the `connect` event on each of the models supplied
// and fires `callback` when all of them have fired.
module.exports.whenModelsConnect = function(models, callback) {
  return new Promise((resolve, reject) => {
    let modelsConnected = 0
    const processModel = () => {
      if (++modelsConnected === models.length) {
        if (typeof callback === 'function') {
          callback()
        }

        resolve()
      }
    }

    models.forEach(model => {
      if (model.connection.readyState === 1) {
        processModel()
      } else {
        model.connection.once('connect', processModel)
      }
    })
  })
}
