var ObjectID = require('mongodb').ObjectID;
var _ = require('underscore');

var util = require('util');

var Composer = function (model) {
    this.model = model;
};

Composer.prototype.compose = function (obj) {

    var self = this;
    var schema = self.model.schema;

    if (util.isArray(obj)) {
        _.each(obj, function (doc) {
            Object.keys(schema)
            .filter(function (key) { return schema[key].type === 'Reference'; })
            .forEach(function (key) {

                if (typeof doc[key] != 'undefined') {

                    var Model = require(__dirname + '/../model/index.js');

                    console.log("doc" + JSON.stringify(doc));

                    var mod = Model(self.model.name, schema, null, null);
                    console.log(mod);
                    var query = { "_id": doc[key] };

                    console.log(query);
                    mod.find(query, function (err, result) {
                        console.log(err);
                        console.log("result: " + JSON.stringify(result));
                    });
                }

            });
        });
    }

    //obj.composed = "bar";
};

// exports
module.exports = function (model) {
    if (model) return new Composer(model);
};

module.exports.Composer = Composer;
