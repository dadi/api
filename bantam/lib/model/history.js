
var util = require('util');
var _ = require('underscore');
var ObjectID = require('mongodb').ObjectID;

var logger = require('../log');

var History = function (model) {
    this.model = model;
};

History.prototype.create = function (obj, model, done) {

    // create copy of original  
    var revisionObj = _.clone(obj);
    revisionObj._id = new ObjectID();

    logger.debug('creating history...');
    //JSON.stringify(revisionObj));
    
    var _done = function (database) {
        database.collection(model.revisionCollection).insert(revisionObj, function(err, doc) {
            
            if (err) return err;

            logger.debug(obj._id);
            logger.debug(revisionObj._id);

            database.collection(model.name).findAndModify(
                    { _id : obj._id }, 
                    [['_id', 'asc']],
                    { $push : { "history" : revisionObj._id } }, 
                    { new : true }, 
                    function(err, doc) {
                        if (err) {
                            return done(err, null);
                        }
                        else {
                            logger.debug('pushed id to array...' + JSON.stringify(doc));
                            logger.debug('created history');
                        }

                        return done(null, doc);
                    });

            //done();
        });
    };

    if (model.connection.db) return _done(model.connection.db);

    // if the db is not connected queue the insert
    model.connection.once('connect', _done);

};

History.prototype.createEach = function (objs, model, done) {
    var self = this;
    objs.forEach(function (obj, index, array) {

        self.create(obj, model, function(err, doc) {
            if (err) return done(err);

            if (index === array.length - 1) {
                done(null, objs);
            }
        }); 
    });
}

module.exports = History;
