var async = require('async')
var connection = require(__dirname + '/connection');
var config = require(__dirname + '/../../../config');
var help = require(__dirname + '/../help');
var Validator = require(__dirname + '/validator');
var History = require(__dirname + '/history');
var Composer = require(__dirname + '/../composer').Composer;
var moment = require('moment');
var ObjectID = require('mongodb').ObjectID;
var Hook = require(__dirname + '/hook');
var Layout = require(__dirname + '/layout');
var _ = require('underscore');
var util = require('util');

// track all models that have been instantiated by this process
var _models = {};

var Model = function (name, schema, conn, settings, database) {

    // attach collection name
    this.name = name;

    // attach original schema
    this.schema = schema;

    // attach default settings
    this.settings = settings || {};

    // create Layout if applicable
    this.layout = this.settings.layout ? new Layout(settings.layout) : undefined;

    // attach display name if supplied
    if (this.settings.hasOwnProperty("displayName")) {
        this.displayName = this.settings.displayName;
    }

    // composable reference fields?
    if (this.settings.hasOwnProperty("compose")) {
        this.compose = this.settings.compose;
    }

    // create connection for this model
    if (conn) {
        this.connection = conn;
    }
    else if (database) {
        this.connection = connection({ database: database });
    }
    else {
        this.connection = connection();
    }

    // add default handler to ensure there's no uncaught errors
    var self = this;
    // this.connection.on('error', function (err) {
    //   console.log('Connection error for collection "' + self.name + '" (' + err + '). Using connection string "' + self.connection.connectionString + '"');
    // });

    _models[name] = this;

    // setup validation context
    this.validate = new Validator(this);

    this.composer = new Composer(this);

    // setup history context unless requested not to
    this.storeRevisions = (this.settings.storeRevisions != false);

    if (this.storeRevisions) {
        this.history = new History(this);
        // attach revision collection for this model.
        // if no value is specified, use 'History' suffix by default
        this.revisionCollection = (this.settings.revisionCollection ? this.settings.revisionCollection : this.name + 'History');
    }

    // add any configured indexes
    if (this.settings.hasOwnProperty('index')
        && this.settings.index.hasOwnProperty('enabled')
        && this.settings.index.enabled == true
        && this.settings.index.hasOwnProperty('keys') ) {
        this.createIndex(function(err, indexName) {
            if (err) console.log(err);
        });
    }

};

Model.prototype.createIndex = function(done) {

    var self = this;
    _done = function (database) {
        // Create an index on the specified field(s)
        database.createIndex(self.name,
            self.settings.index.keys,
            self.settings.index.options || {},
            function (err, indexName) {
                if (err) return done(err);
                return done(null, indexName);
            });
    }

    if (this.connection.db) return _done(this.connection.db);

    // if the db is not connected queue the index creation
    this.connection.once('connect', _done);
}

/**
 * Create a document in the database
 *
 * @param {Object} obj
 * @param {Object} internals
 * @param {Function} done
 * @return undefined
 * @api public
 */
Model.prototype.create = function (obj, internals, done) {
    var self = this;

    if (!(obj instanceof Array)) {
        obj = [obj];
    }

    // internals will not be validated, i.e. should not be user input
    if (typeof internals === 'function') {
        done = internals;
    }

    if (this.layout) {
        var doneFn = done;

        done = (function (err, data) {
            if (!err) {
                data.results = data.results.map(this.layout.resolve.bind(this.layout));
            }

            return doneFn.apply(this, arguments);
        }).bind(this);
    }

    // validate each doc
    var validation;

    obj.forEach(function (doc) {
        if (validation === undefined || validation.success) {
            validation = self.validate.schema(doc);
        }
    });

    if (!validation.success) {
        var err = validationError('Validation Failed');
        err.json = validation;
        return done(err);
    }

    if (typeof internals === 'object' && internals != null) { // not null and not undefined
        obj.forEach(function (doc) {
          doc = _.extend(doc, internals);
        });
    }

    //
    if (self.history) {
      obj.forEach((doc) => {
        doc.history = []
      })
    }

    // add initial document revision number
    obj.forEach((doc) => {
      doc.v = 1
    })

    // ObjectIDs
    obj.forEach(function (doc) {
      doc = self.convertObjectIdsForSave(self.schema, doc);
    })

    // DateTime
    obj.forEach(function (doc) {
      doc = self.convertDateTimeForSave(self.schema, doc);
    })

    var startInsert = (database) => {
      var abortedInserts = []

      // Running `beforeCreate` hooks
      if (this.settings.hooks && this.settings.hooks.beforeCreate) {
        var processedDocs = 0

        obj.forEach((doc, docIndex) => {
          async.reduce(this.settings.hooks.beforeCreate, doc, (current, hookConfig, callback) => {
            var hook = new Hook(hookConfig, 'beforeCreate')

            Promise.resolve(hook.apply(current)).then((newDoc) => {
              callback((newDoc === null) ? {} : null, newDoc)
            }).catch((err) => {
              callback(err)
            })
          }, (err, result) => {
            if (err) {
              abortedInserts.push(docIndex)
            }

            doc = err ? undefined : result

            processedDocs++

            if (processedDocs === obj.length) {
              // Remove aborted inserts from the list
              obj = obj.filter((item, index) => {
                return (abortedInserts.indexOf(index) === -1)
              })

              saveDocuments(database)
            }
          })
        })
      } else {
        saveDocuments(database)
      }
    }

    var saveDocuments = (database) => {
        database.collection(this.name).insert(obj, (err, doc) => {
          if (err) return done(err);

          var results = {
            results: doc
          }

          // apply any existing `afterCreate` hooks
          if (this.settings.hasOwnProperty('hooks') && (typeof this.settings.hooks.afterCreate === 'object')) {
            obj.forEach((doc) => {
              this.settings.hooks.afterCreate.forEach((hookConfig, index) => {
                var hook = new Hook(this.settings.hooks.afterCreate[index], 'afterCreate')

                return hook.apply(doc)
              })
            })
          }

          // if (self.history) {
          //     self.history.createEach(obj, self, function (err, res) {
          //         if (err) return done(err);
          //
          //         return done(null, results);
          //     });
          // }
          // else {
          return done(null, results)
          //}
        });
    };

    if (this.connection.db) {
      return startInsert(this.connection.db);
    }
    else {
      // if the db is not connected queue the insert
      this.connection.once('connect', startInsert);
    }
};

/**
 * Attaches the full history of each document
 * before returning the results
 */
Model.prototype.injectHistory = function (data) {
  return new Promise((resolve, reject) => {
    var idx = 0
    _.each(data.results, (doc) => {
      this.revisions(doc._id, (err, history) => {
        doc.history = history

        idx++
        if (idx === data.results.length) {
          return resolve(data)
        }
      })
    })
  })
}

Model.prototype.makeCaseInsensitive = function (obj) {
    var newObj = _.clone(obj);
    var self = this;
    _.each(Object.keys(obj), function(key) {
        if (key === 'apiVersion') {
            return;
        }

        if (typeof obj[key] === 'string') {
            if (ObjectID.isValid(obj[key]) && obj[key].match(/^[a-fA-F0-9]{24}$/)) {
                newObj[key] = obj[key];
            }
            else if (key[0] === '$' && key === '$regex') {
                newObj[key] = new RegExp(obj[key], "i");
            }
            else if (key[0] === '$' && key !== '$regex') {
                newObj[key] = obj[key];
            }
            else {
                newObj[key] = new RegExp(["^", help.regExpEscape(obj[key]), "$"].join(""), "i");
            }
        }
        else if (typeof obj[key] === 'object' && obj[key] !== null) {
            if (key[0] === '$' && key !== '$regex') {
                newObj[key] = obj[key];
            }
            else {
                newObj[key] = self.makeCaseInsensitive(obj[key]);
            }
        }
        else {
            return obj;
        }
    });

    return newObj;
}

Model.prototype.convertApparentObjectIds = function (query) {
  var self = this;

  _.each(Object.keys(query), function(key) {
    if (key === 'apiVersion') {
      return;
    }

    var type;
    var keyOrParent = (key.split('.').length > 1) ? key.split('.')[0] : key

    if (self.schema[keyOrParent]) {
      type = self.schema[keyOrParent].type
    }

    if (key === '$in') {
      if (typeof query[key] === 'object' && _.isArray(query[key])) {
        var arr = query[key];
        _.each(arr, function (value, key) {
          if (typeof value === 'string' && ObjectID.isValid(value) && value.match(/^[a-fA-F0-9]{24}$/)) {
            arr[key] = new ObjectID.createFromHexString(value);
          }
        });
        query[key] = arr;
      }
    }
    else if (typeof query[key] === 'object' && query[key] !== null) {
      if (typeof type !== 'undefined' && type === 'Object') {
        // ignore
      }
      else if (type !== 'Reference') {
        query[key] = self.convertApparentObjectIds(query[key]);
      }
    }
    else if (typeof query[key] === 'string' && type !== 'Object' && ObjectID.isValid(query[key]) && query[key].match(/^[a-fA-F0-9]{24}$/)) {
      query[key] = new ObjectID.createFromHexString(query[key]);
    }
  });
  return query;
}

Model.prototype.convertObjectIdsForSave = function (schema, obj) {
    Object.keys(schema)
    .filter(function (key) { return schema[key].type === 'ObjectID'; })
    .forEach(function (key) {
        if (typeof obj[key] === 'object' && _.isArray(obj[key])) {
            var arr = obj[key];
            _.each(arr, function (value, key) {
                if (typeof value === 'string' && ObjectID.isValid(value) && value.match(/^[a-fA-F0-9]{24}$/)) {
                    arr[key] = new ObjectID.createFromHexString(value);
                }
            });
            obj[key] = arr;
        }
        else if (typeof obj[key] === 'string') {
            obj[key] = new ObjectID.createFromHexString(obj[key]);
        }
    });

    return obj;
}

Model.prototype.convertDateTimeForSave = function (schema, obj) {
  Object.keys(schema)
  .filter(function (key) { return ((schema[key].type === 'DateTime') && (obj[key] !== null)) })
  .forEach(function (key) {
    obj[key] = new Date(moment(obj[key]).toISOString())
  })

  return obj;
}

/**
 * Lookup documents in the database, then give back a count
 *
 * @param {Object} query
 * @param {Function} done
 * @return undefined
 * @api public
 */
Model.prototype.count = function (query, options, done) {
  var self = this;
  if (typeof options === 'function') {
    done = options;
    options = {};
  }

  if (this.layout) {
    var doneFn = done;

    done = (function (err, data) {
     if (!err) {
       data.results = data.results.map(this.layout.resolve.bind(this.layout));
     }

     return doneFn.apply(this, arguments);
    }).bind(this);
  }

  query = this.makeCaseInsensitive(query);
  query = this.convertApparentObjectIds(query);

  var validation = this.validate.query(query);
  if (!validation.success) {
    var err = validationError('Bad Query');
    err.json = validation;
    return done(err);
  }

  if (_.isObject(query)) {

    this.castToBSON(query);

    _done = function (database) {
      database.collection(self.name).count(query, options, function(err, result){
        if (err) return done(err);
        var meta = getMetadata(options, result);
        var results = {
          metadata: {
            limit: meta.limit,
            totalCount: meta.totalCount,
            totalPages: meta.totalPages
          }
        };
        return done(null, results);
      });
    };

  }
  else {
    return done(validationError('Bad Query'));
  }

  if (this.connection.db) return _done(this.connection.db);

  // if the db is not connected queue the find
  this.connection.once('connect', function (database) {
    _done(database);
  });
};

/**
 * Lookup documents in the database
 *
 * @param {Object} query
 * @param {Function} done
 * @return undefined
 * @api public
 */
Model.prototype.find = function (query, options, done) {
    if (typeof options === 'function') {
        done = options
        options = {};
    }

    if (this.layout) {
        var doneFn = done;

        done = (function (err, data) {
            if (!err) {
                data.results = data.results.map(this.layout.resolve.bind(this.layout));
            }

            return doneFn.apply(this, arguments);
        }).bind(this);
    }

    if (options.includeHistory) {
      var doneFn = done

      done = (function (err, data) {
        if (err) {
          return doneFn(err, data)
        }
        else {
          this.injectHistory(data).then(function (data) {
            return doneFn(null, data)
          })
        }
      }).bind(this)

      delete options.includeHistory
    }

    var self = this;

    query = this.makeCaseInsensitive(query);
    query = this.convertApparentObjectIds(query);

    var compose = self.compose;

    // override the model's settings with a
    // value from the options object?
    if (options.hasOwnProperty('compose')) {
        compose = options.compose;
        delete options.compose;
    }

    var validation = this.validate.query(query);
    if (!validation.success) {
        var err = validationError('Bad Query');
        err.json = validation;
        return done(err);
    }

    if (_.isArray(query)) {
        // have we been passed an aggregation pipeline query?
        _done = function (database) {
            database.collection(self.name).aggregate(query, options, function (err, result) {
                if (err) return done(err);
                done(null, result);
            });
        }
    }
    else if (_.isObject(query)) {

        this.castToBSON(query);

        _done = function (database) {

            database.collection(self.name).find(query, options, function (err, cursor) {
                if (err) return done(err);

                var results = {};

                cursor.count(function (err, count) {
                    if (err) return done(err);

                    var resultArray = cursor.toArray(function (err, result) {
                        if (err) return done(err);

                        if (compose) {
                            self.composer.setApiVersion(query.apiVersion);
                            self.composer.compose(result, function(obj) {
                                results.results = obj;
                                results.metadata = getMetadata(options, count);
                                done(null, results);
                            });
                        }
                        else {
                            results.results = result;
                            results.metadata = getMetadata(options, count);
                            done(null, results);
                        }
                    });
                });

            });
        }

    }
    else {
        var err = validationError('Bad Query');
        // err.json = {success: false, errors: [{message: 'Query must be either a JSON array or a JSON object.'}]};
        // console.log(err);
        return done(err);
    }

    if (this.connection.db) return _done(this.connection.db);

    // if the db is not connected queue the find
    this.connection.once('connect', function (database) {
        _done(database);
    });

};

Model.prototype.revisions = function (id, done) {
    var self = this;

    var _done = function (database) {
      database.collection(self.name).findOne({"_id":id}, {}, function (err, doc) {
        if (err) return done(err);

        if (self.history) {
          var query = { "_id" : { "$in" : _.map(doc.history, function (id) { return id.toString() }) } }

          database.collection(self.revisionCollection).find({}).toArray(function (err, items) {
            if (err) return done(err);
            return done(null, items)
          });
        }
        else {
          done(null, []);
        }
      });
    }

    if (this.connection.db) return _done(this.connection.db);

    // if the db is not connected queue the find
    this.connection.once('connect', function (database) {
      _done(database);
    });
};

/**
 * Get collection statistics
 *
 * @param {Object} options
 * @return An object representing the database collection stats
 * @api public
 */
Model.prototype.stats = function (options, done) {

    options = options || {};
    var self = this;

    var _done = function (database) {
      database.collection(self.name).stats(options, function (err, stats) {
        if (err) return done(err);

        var result = {};

        result.count = stats.count;
        result.size = stats.size;
        result.averageObjectSize = stats.avgObjSize;
        result.storageSize = stats.storageSize;
        result.indexes = stats.nindexes;
        result.totalIndexSize = stats.totalIndexSize;
        result.indexSizes = stats.indexSizes;

        done(null, result);
      });
    };

    if (this.connection.db) return _done(this.connection.db);

    // if the db is not connected queue the find
    this.connection.once('connect', function (database) {
      _done(database);
    });
};

/**
 * Update a document in the database
 *
 * @param {Object} query
 * @param {Object} update
 * @param {Function} done
 * @return undefined
 * @api public
 */
Model.prototype.update = function (query, update, internals, done) {

  // internals will not be validated, i.e. should not be user input
  if (typeof internals === 'function') {
    done = internals
  }

  var validation
  var err

  validation = this.validate.query(query)
  if (!validation.success) {
    err = validationError('Bad Query')
    err.json = validation
    return done(err)
  }

  validation = this.validate.schema(update, true)
  if (!validation.success) {
    err = validationError()
    err.json = validation
    return done(err)
  }

  if (this.layout) {
    var doneFn = done

    done = ((err, data) => {
      if (!err) {
        data.results = data.results.map(this.layout.resolve.bind(this.layout))
      }

      return doneFn.apply(this, arguments)
    })
  }

  // ObjectIDs
  update = this.convertObjectIdsForSave(this.schema, update)
  // DateTimes
  update = this.convertDateTimeForSave(this.schema, update)

  if (typeof internals === 'object' && internals != null) { // not null and not undefined
    _.extend(update, internals)
  }

  var setUpdate = {$set: update}
  var updateOptions = {
      multi: true
  }

  var startUpdate = (database) => {

    // get a reference to the documents that will be updated
    var updatedDocs = []

    this.find(query, {}, (err, docs) => {
      if (err) return done(err)

      updatedDocs = docs['results']

      this.castToBSON(query)

      var saveDocuments = () => {
        database.collection(this.name).update(query, setUpdate, updateOptions, (err, numAffected) => {
          if (err) return done(err)
          if (!numAffected) {
              err = new Error('Not Found')
              err.statusCode = 404
              return done(err)
          }

          var results = {}

          var incrementRevisionNumber = (docs) => {
            _.each(docs, (doc) => {
              database.collection(this.name).findAndModify(
                { _id: new ObjectID(doc._id.toString()) },
                [['_id','asc']],
                { $inc: { v: 1 } },
                { new: true },
                function(err, doc) {})
            })
          }

          var triggerAfterUpdateHook = (docs) => {
            if (this.settings.hasOwnProperty('hooks') && (typeof this.settings.hooks.afterUpdate === 'object')) {
              this.settings.hooks.afterUpdate.forEach((hookConfig, index) => {
                var hook = new Hook(this.settings.hooks.afterUpdate[index], 'afterUpdate')

                return hook.apply(docs)
              });
            }
          }

          // increment document revision number
          incrementRevisionNumber(updatedDocs)

          // for each of the updated documents, create
          // a history revision for it
          if (this.history && updatedDocs.length > 0) {
            this.history.createEach(updatedDocs, this, (err, docs) => {
              if (err) return done(err)

              results.results = docs

              // apply any existing `afterUpdate` hooks
              triggerAfterUpdateHook(docs)

              done(null, results)
            });
          }
          else {
            this.find({ _id: { "$in": _.map(updatedDocs, (doc) => { return doc._id.toString() } ) } }, {}, (err, doc) => {
              if (err) return done(err)

              results = doc

              // apply any existing `afterUpdate` hooks
              triggerAfterUpdateHook(doc)

              done(null, results)
            })
          }
        })
      }

      // apply any existing `beforeUpdate` hooks, otherwise save the documents straight away
      if (this.settings.hooks && this.settings.hooks.beforeUpdate) {
        async.reduce(this.settings.hooks.beforeUpdate, update, (current, hookConfig, callback) => {
          var hook = new Hook(hookConfig, 'beforeUpdate')

          Promise.resolve(hook.apply(current, updatedDocs)).then((newUpdate) => {
            callback((newUpdate === null) ? {} : null, newUpdate)
          }).catch((err) => {
            callback(err)
          })
        }, (err, result) => {
          if (err) {
            done(err)
          } else {
            update = result

            saveDocuments()
          }
        })
      } else {
        saveDocuments()
      }
    })
  }

  if (this.connection.db) return startUpdate(this.connection.db)

  // if the db is not connected queue the update
  this.connection.once('connect', startUpdate)
}

/**
 * Delete a document from the database
 *
 * @param {Object} query
 * @param {Function} done
 * @return undefined
 * @api public
 */
Model.prototype.delete = function (query, done) {
  var validation = this.validate.query(query)
  if (!validation.success) {
    err = validationError('Bad Query')
    err.json = validation
    return done(err)
  }

  this.castToBSON(query)

  var startDelete = (database) => {
    // apply any existing `beforeDelete` hooks, otherwise delete the documents straight away
    if (this.settings.hooks && this.settings.hooks.beforeDelete) {
      async.reduce(this.settings.hooks.beforeDelete, query, (current, hookConfig, callback) => {
        var hook = new Hook(hookConfig, 'beforeDelete')
        var hookError = {}

        Promise.resolve(hook.apply(current, hookError)).then((newQuery) => {
          callback((newQuery === null) ? {} : null, newQuery)
        }).catch((err) => {
          callback(err)
        })
      }, (err, result) => {
        if (err) {
          done(err)
        } else {
          deleteDocuments(database)
        }
      })
    } else {
      deleteDocuments(database)
    }
  }

  var deleteDocuments = (database) => {
    database.collection(this.name).remove(query, (err, docs) => {
      if (!err && (docs > 0)) {
        // apply any existing `afterDelete` hooks
        if (this.settings.hasOwnProperty('hooks') && (typeof this.settings.hooks.afterDelete === 'object')) {
          this.settings.hooks.afterDelete.forEach((hookConfig, index) => {
            var hook = new Hook(this.settings.hooks.afterDelete[index], 'afterDelete')

            return hook.apply(query)
          });
        }
      }

      done(err, docs)
    })
  }

  if (this.connection.db) return startDelete(this.connection.db)

  // if the db is not connected queue the delete
  this.connection.once('connect', startDelete)
};

/**
 * Takes object and casts fields to BSON types as per this model's schema
 *
 * @param {Object} obj
 * @return undefined
 * @api private
 */
Model.prototype.castToBSON = function (obj) {

    // TODO: Do we need to handle casting for all fields, or will `_id` be the only BSON specific type?
    //      this is starting to enter ODM land...
    if (typeof obj._id === 'string' && ObjectID.isValid(obj._id) && obj._id.match(/^[a-fA-F0-9]{24}$/)) {
        obj._id = new ObjectID.createFromHexString(obj._id);
    }
}

function validationError(message) {
    var err = new Error(message || 'Model Validation Failed');
    err.statusCode = 400
    return err;
}

function getMetadata(options, count) {
    var meta = _.extend({}, options);
    delete meta.skip;

    meta.page = options.page || 1;
    meta.offset = options.skip || 0;
    meta.totalCount = count;
    meta.totalPages = Math.ceil(count / (options.limit || 1));

    if (meta.page < meta.totalPages) {
        meta.nextPage = (meta.page + 1);
    }

    if (meta.page > 1 && meta.page <= meta.totalPages) {
        meta.prevPage = meta.page - 1;
    }

    return meta;
}

// exports
module.exports = function (name, schema, conn, settings, database) {
    if (schema) return new Model(name, schema, conn, settings, database);
    return _models[name];
};

module.exports.Model = Model;
