var ObjectID = require('mongodb').ObjectID;
var _ = require('underscore');
var util = require('util');

var help = require(__dirname + '/../help');

var Composer = function (model) {
  this.model = model;
};

Composer.prototype.setApiVersion = function(apiVersion) {
  this.apiVersion = apiVersion;
}

Composer.prototype.compose = function (obj, callback) {

  var self = this;

  if (_.isEmpty(obj)) return callback(obj);

  var docIdx = 0;

  _.each(obj, function (doc) {
    self.composeOne(doc, function (result) {
      doc = result;
      docIdx++;

      if (docIdx === obj.length) {
        return callback(obj);
      }
    });
  });
};

Composer.prototype.composeOne = function (doc, callback) {

  var self = this;
  var schema = self.model.schema;

  var composable = Object.keys(schema).filter(function (key) { 
                      return schema[key].type === 'Reference' && typeof doc[key] !== 'undefined';
                   });

  if (_.isEmpty(composable)) return callback(doc);

  var keyIdx = 0;

  _.each(composable, function (key) {
    
    var Model = require(__dirname + '/../model/index.js');
    var mod;

    var query = {};
    var value = doc[key];
    var returnArray = false;

    if (value.constructor.name === 'Array') {
      query = { "_id": { "$in": _.map(value, function (val) { return val + '' } ) } };
      returnArray = true;
    }
    else {
      query = { "_id": value + '' };
    }

    // add the apiVersion param
    _.extend(query, { apiVersion : self.apiVersion });

    // are specific fields required?
    var fields = {};
    var schemaFields = help.getFromObj(schema, key + '.settings.fields', []);

    _.each(schemaFields, function (field) {
      fields[field] = 1;
    })

    // load correct model
    var collection = help.getFromObj(schema, key + '.settings', null);

    if (collection && collection.collection && collection.collection !== self.model.name) {
      mod = Model(collection.collection);
    }
    else {
      mod = Model(self.model.name);
    }

    // does the collection allow us to compose references beyond the first one
    // (i.e. the one that got us here) ?
    var compose = help.getFromObj(mod.settings, 'compose', false);

    if (mod) {

      mod.find(query, { "compose": compose, "fields": fields }, function (err, result) {

        if (result) {
          if (result.results.length === 1 && returnArray === false) {
            doc[key] = result.results[0];
          }
          else { 
            doc[key] = result.results;
          }
        }

        if (!doc.composed) doc.composed = {};
        doc.composed[key] = value;

        keyIdx++;

        if (keyIdx === composable.length) {
          callback(doc);
        }
      });
    }

  });
}

// exports
module.exports = function (model) {
  if (model) return new Composer(model);
};

module.exports.Composer = Composer;
