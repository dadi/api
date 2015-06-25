var connection = require(__dirname + '/connection');
var config = require(__dirname + '/../../../config').database;
var Validator = require(__dirname + '/validator');
var History = require(__dirname + '/history');
var ObjectID = require('mongodb').ObjectID;
var _ = require('underscore');

// track all models that have been instantiated by this process
var _models = {};

var Model = function (name, schema, conn, settings) {

    // attach collection name
    this.name = name;

    // attach original schema
    this.schema = schema;

    // attach default settings
    this.settings = settings || {};

    // create connection for this model
    if (conn) {
        this.connection = conn;
    }
    else if (config[name]) {
        this.connection = connection({
            database: name,
            host: config[name].host,
            port: config[name].port,
            username: config[name].username,
            password: config[name].password
        });
    }
    else {
        this.connection = connection();
    }

    // add default handler to ensure there's no uncaught errors
    var self = this;
    this.connection.on('error', function (err) {
        console.log('Connection Error: Model name: ' + self.name);
        console.error(err);
    });

    _models[name] = this;

    // setup validation context
    this.validate = new Validator(this);

    // setup history context unless requested not to
    this.storeRevisions = (this.settings.storeRevisions != false);

    if (this.storeRevisions) {
        this.history = new History(this);
        // attach revision collection for this model.
        // if no value is specified, use 'History' suffix by default
        this.revisionCollection = (this.settings.revisionCollection ? this.settings.revisionCollection : this.name + 'History');
    }

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

    // internals will not be validated, i.e. should not be user input
    if (typeof internals === 'function') {
        done = internals;
    }

    var validation = this.validate.schema(obj);
    
    if (!validation.success) {
        var err = validationError('Validation Failed');
        err.json = validation;
        return done(err);
    }

    if (typeof internals === 'object' && internals != null) { // not null and not undefined
        _.extend(obj, internals);
    }

    var self = this;
    var _done = function (database) {
        database.collection(self.name).insert(obj, function(err, doc) {
            if (err) return done(err);

            if (self.history) {
                self.history.create(obj, self, function(err, res) {
                    if (err) return done(err);
                    done(null, doc);
                });
            }
            else {
                done(null, doc);
            }
        });
    };

    if (this.connection.db) return _done(this.connection.db);

    // if the db is not connected queue the insert
    this.connection.once('connect', _done);
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

    var self = this;

    // make the query case-insensitive
    _.each(Object.keys(query), function(key) {
        query[key] = new RegExp(["^", query[key], "$"].join(""), "i");
    });

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

                        results.results = result;
                        results.metadata = getMetadata(options, count);
                        
                        done(null, results);
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
 * Log string to file system
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
    
    validation = this.validate.schema(update);
    if (!validation.success) {
        err = validationError();
        err.json = validation;
        return done(err);
    }

    this.castToBSON(query);

    if (typeof internals === 'object' && internals != null) { // not null and not undefined
        _.extend(update, internals);
    }

    var setUpdate = {$set: update};

    var self = this;
    var _update = function (database) {

        // get a reference to the documents 
        // that will be updated
        var updatedDocs = [];
        self.find(query, {}, function(err, docs) {
            if (err) return done(err);
            updatedDocs = docs['results'];

            database.collection(self.name).update(query, setUpdate, function (err, numAffected) {
                if (err) return done(err);
                if (!numAffected) {
                    err = new Error('Not Found');
                    err.statusCode = 404;
                    return done(err);
                }

                // query and doc `_id` should be equal
                query._id && (update._id = query._id);

                // for each of the updated documents, create
                // a history revision for it
                if (self.history && updatedDocs.length > 0) {
                    self.history.createEach(updatedDocs, self, function(err, docs) {
                        if (err) return done(err);
                        done(null, update);
                    });
                }
                else {
                    done(null, update);
                }
            });
        });
    };

    if (this.connection.db) return _update(this.connection.db);

    // if the db is not connected queue the update
    this.connection.once('connect', _update);
};

/**
 * Log string to file system
 *
 * @param {Object} query
 * @param {Function} done
 * @return undefined
 * @api public
 */
Model.prototype.delete = function (query, done) {
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
    if (typeof obj._id === 'string' && ObjectID.isValid(obj._id)) {
        obj._id = new ObjectID.createFromHexString(obj._id);
    }
}

// exports
module.exports = function (name, schema, conn, settings) {
    if (schema) return new Model(name, schema, conn, settings);
    return _models[name];
};

module.exports.Model = Model;

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
