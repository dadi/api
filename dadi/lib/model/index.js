var connection = require(__dirname + '/connection');
var config = require(__dirname + '/../../../config');
var help = require(__dirname + '/../help');
var Validator = require(__dirname + '/validator');
var History = require(__dirname + '/history');
var Composer = require(__dirname + '/../composer').Composer;
var ObjectID = require('mongodb').ObjectID;
var Hook = require(__dirname + '/hook');
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
    this.connection.on('error', function (err) {
        console.log('Connection error for collection "' + self.name + '" (' + err + '). Using connection string "' + self.connection.connectionString + '"');
    });

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

    // apply any existing `create` hooks
    if (typeof this.settings.hooks.create === 'object') {
        obj = this.settings.hooks.create.reduce((function (previous, current, index) {
            var hook = new Hook(this.settings.hooks.create[index], 0);

            return hook.apply(previous);
        }).bind(this), obj);
    }

    // internals will not be validated, i.e. should not be user input
    if (typeof internals === 'function') {
        done = internals;
    }

    // handle both an Array of documents and a single document
    var validation;
    if (obj instanceof Array) {
        var self = this;
        // validate each doc
        obj.forEach(function (doc) {
            if (validation === undefined || validation.success) {
                validation = self.validate.schema(doc);
            }
        });
    } else {
        validation = this.validate.schema(obj);
    }

    if (!validation.success) {
        var err = validationError('Validation Failed');
        err.json = validation;
        return done(err);
    }

    if (typeof internals === 'object' && internals != null) { // not null and not undefined
        _.extend(obj, internals);
    }


    var self = this;

    // ObjectIDs
    if (obj instanceof Array) {
        // convert ids in each doc
        obj.forEach(function (doc) {
            doc = self.convertObjectIdsForSave(self.schema, doc);
        });
    }
    else {
        obj = self.convertObjectIdsForSave(self.schema, obj);
    }

    var _done = function (database) {
        database.collection(self.name).insert(obj, function(err, doc) {
            if (err) return done(err);

            var results = {
                results: doc
            };

            if (self.history) {
                self.history.create(obj, self, function(err, res) {
                    if (err) return done(err);

                    return done(null, results);
                });
            }
            else {
                return done(null, results);
            }
        });
    };

    if (this.connection.db) return _done(this.connection.db);

    // if the db is not connected queue the insert
    this.connection.once('connect', _done);
};

Model.prototype.makeCaseInsensitive = function (obj) {
    var newObj = _.clone(obj);
    var self = this;
    _.each(Object.keys(obj), function(key) {
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

var convertApparentObjectIds = function (query) {
    _.each(Object.keys(query), function(key) {
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
            query[key] = convertApparentObjectIds(query[key]);
        }
        else if (typeof query[key] === 'string' && ObjectID.isValid(query[key]) && query[key].match(/^[a-fA-F0-9]{24}$/)) {
            query[key] = new ObjectID.createFromHexString(query[key]);
        }
        else {
            // nothing
            //console.log(query[key]);
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

    var self = this;

    var apiVersion = query.apiVersion;
    delete query.apiVersion;

    query = this.makeCaseInsensitive(query);
    query = convertApparentObjectIds(query);
    if (typeof apiVersion !== 'undefined') query.apiVersion = apiVersion;

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

                database.collection(self.revisionCollection).find( { _id : { "$in" : doc.history } }, {}, function (err, cursor) {
                    if (err) return done(err);

                    // pass back the full results array
                    cursor.toArray(done);
                });
            }

            done(null, []);

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
        done = internals;
    }

    var validation, err;

    validation = this.validate.query(query);
    if (!validation.success) {
        err = validationError('Bad Query');
        err.json = validation;
        return done(err);
    }

    validation = this.validate.schema(update, true);
    if (!validation.success) {
        err = validationError();
        err.json = validation;
        return done(err);
    }

    // ObjectIDs
    update = this.convertObjectIdsForSave(this.schema, update);

    if (typeof internals === 'object' && internals != null) { // not null and not undefined
        _.extend(update, internals);
    }

    var setUpdate = {$set: update};

    var self = this;
    var _update = function (database) {

        // get a reference to the documents that will be updated
        var updatedDocs = [];

        self.find(query, {}, function(err, docs) {
            if (err) return done(err);

            updatedDocs = docs['results'];

            // apply any existing `update` hooks
            if (typeof self.settings.hooks.update === 'object') {
                update = self.settings.hooks.update.reduce(function (previous, current, index) {
                    var hook = new Hook(self.settings.hooks.update[index], 1);

                    return hook.apply(previous, updatedDocs);
                }, update);
            }

            self.castToBSON(query);

            database.collection(self.name).update(query, setUpdate, function (err, numAffected) {
                if (err) return done(err);
                if (!numAffected) {
                    err = new Error('Not Found');
                    err.statusCode = 404;
                    return done(err);
                }

                // query and doc `_id` should be equal
                query._id && (update._id = query._id);

                var results = {};

                // for each of the updated documents, create
                // a history revision for it
                if (self.history && updatedDocs.length > 0) {
                    self.history.createEach(updatedDocs, self, function(err, docs) {
                        if (err) return done(err);

                        results.results = docs;

                        done(null, results);
                    });
                }
                else {
                    self.find({ _id: update._id.toString() }, {}, function(err, doc) {
                        if (err) return done(err);

                        results = doc;

                        done(null, results);
                    });
                }
            });
        });
    };

    if (this.connection.db) return _update(this.connection.db);

    // if the db is not connected queue the update
    this.connection.once('connect', _update);
};

/**
 * Delete a document from the database
 *
 * @param {Object} query
 * @param {Function} done
 * @return undefined
 * @api public
 */
Model.prototype.delete = function (query, done) {
    // apply any existing `delete` hooks
    if (typeof this.settings.hooks.delete === 'object') {
        query = this.settings.hooks.delete.reduce((function (previous, current, index) {
            var hook = new Hook(this.settings.hooks.update[index], 2);

            return hook.apply(previous);
        }).bind(this), query);
    }

    var validation = this.validate.query(query);
    if (!validation.success) {
        err = validationError('Bad Query');
        err.json = validation;
        return done(err);
    }

    this.castToBSON(query);

    var self = this;
    var _done = function (database) {
        database.collection(self.name).remove(query, done);
    };

    if (this.connection.db) return _done(this.connection.db);

    // if the db is not connected queue the delete
    this.connection.once('connect', _done);
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
