var connection = require(__dirname + '/connection');
var config = require(__dirname + '/../../../config').database;
var Validator = require(__dirname + '/validator');
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
    } else if (config[name]) {
        this.connection = connection({
            database: name,
            host: config[name].host,
            port: config[name].port,
            username: config[name].username,
            password: config[name].password
        });
    } else {
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
};

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
        database.collection(self.name).insert(obj, done);
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

    var validation = this.validate.query(query);
    if (!validation.success) {
        var err = validationError('Bad Query');
        err.json = validation;
        return done(err);
    }

    this.castToBSON(query);

    var self = this;
    var _done = function (database) {
        database.collection(self.name).find(query, options, function (err, cursor) {
            if (err) return done(err);

            // pass back the full results array
            cursor.toArray(done);
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
        console.log(self.name);
        database.collection(self.name).update(query, setUpdate, function (err, numAffected) {
            if (err) return done(err);
            if (!numAffected) {
                err = new Error('Not Found');
                err.statusCode = 404;
                return done(err);
            }

            // query and doc `_id` should be equal
            query._id && (update._id = query._id);
            done(null, update);
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
