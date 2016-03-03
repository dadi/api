
var util = require('util');
var _ = require('underscore');
var ObjectID = require('mongodb').ObjectID;

var log = require('../log');

var History = function (model) {
    this.model = model;

    log.info({module: 'history'}, 'Model history logging started.');
};

History.prototype.create = function (obj, model, done) {

    // create copy of original
    var revisionObj = _.clone(obj);
    revisionObj._id = new ObjectID();

    var _done = function (database) {
        database.collection(model.revisionCollection).insert(revisionObj, function(err, doc) {

            if (err) return err;

            database.collection(model.name).findAndModify (

                { _id : obj._id },
                [ ['_id', 'asc']],
                { $push : { "history" : revisionObj._id } },
                { new : true },
                function(err, doc) {
                    if (err) return done(err, null);
                    return done(null, doc);
                });
            });
    };

    if (model.connection.db) return _done(model.connection.db);

    // if the db is not connected queue the insert
    model.connection.once('connect', _done);

};

History.prototype.createEach = function (objs, model, done) {

    var self = this;
    var updatedDocs = [];

    objs.forEach(function (obj, index, array) {

        self.create(obj, model, function(err, doc) {
            if (err) return done(err);

            updatedDocs.push(doc);

            if (index === array.length - 1) {
                done(null, updatedDocs);
            }
        });
    });
}

module.exports = History;
