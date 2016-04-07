var _ = require('underscore');
var model = require(__dirname + '/../../dadi/lib/model');
var connection = require(__dirname + '/../../dadi/lib/model/connection');

// return valid model definition object
module.exports.getModelSchema = function () {
    return {
        "fieldName": {
            "type": "String",
            "label": "Title",
            "comments": "The title of the entry",
            "placement": "Main content",
            "validation": {},
            "required": false,
            "message": "",
            "display": {
                "index": true,
                "edit": true
            }
        }
    };
};

module.exports.getModelSettings = function() {
  return {
    cache: true,
    cacheTTL: 300,
    authenticate: true,
    callback: null,
    defaultFilters: null,
    fieldLimiters: null,
    count: 40,
    sort: "fieldName",
    sortOrder: 1,
    storeRevisions: true,
    revisionCollection: "testSchemaHistory"
  }
};

module.exports.getModelSchemaWithMultipleFields = function () {
    return {
        "field1": {
            "type": "String",
            "label": "Title",
            "comments": "The title of the entry",
            "placement": "Main content",
            "validation": {},
            "required": false,
            "message": "",
            "display": {
                "index": true,
                "edit": true
            }
        },
        "field2": {
            "type": "String",
            "label": "Title",
            "comments": "The title of the entry",
            "placement": "Main content",
            "validation": {},
            "required": false,
            "message": "",
            "display": {
                "index": true,
                "edit": true
            }
        }
    };
};

// sync test that a property is correctly attached to a model
module.exports.testModelProperty = function (key, val) {
    var obj = {};
    obj[key] = val;

    var schema = module.exports.getModelSchema();
    _.extend(schema.fieldName, obj);

    model('testModelName', schema).schema.fieldName[key].should.equal(val);
};

module.exports.cleanUpDB = function (done) {
  var database = connection();

  setTimeout(function() {
    if (database.db.databaseName !== 'test') {
      var err = new Error('Database should be `test`, not `' + db.databaseName + '`.');
      return done(err);
    }
  }, 500)

  // drop all data
  setTimeout(function() {
    database.db.dropDatabase('test', function (err) {
        if (err) return done(err);

        // force close this connection
        //db.close(true, done);
        done()
    });
  }, 500)
}

module.exports.addUserToDb = function (userObj, dbObj, done) {
    var Db = require('mongodb').Db;
    var Server = require('mongodb').Server;

    var db = new Db(dbObj.databaseName, new Server(dbObj.host, dbObj.port), {w: 'majority'});

    // Establish connection to db
    db.open(function (err, db) {
        if (err) return done(err);

        // Add a user to the database
        db.addUser(userObj.username, userObj.password, { roles: [{ role: "readWrite", db: dbObj.databaseName }] }, function (err) {

            // notice no error handling!
            // This is because we want this to be an idempotent func that ensures
            // the user exists in the database.  Since `addUser` will error if
            // the user already exists we just assume things are ok here

            db.close(done);
        });
    });
};
