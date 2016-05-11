var util = require('util');
var _ = require('underscore');

var Layout = function (layout) {
  this.layout = layout;
};

Layout.prototype.resolve = function (document) {
  if (!document._layout) return document;

  var result = {
    beforeFree: [],
    free: [],
    afterFree: []
  };

  Object.keys(this.layout.fixed).forEach((function (field) {
    if (document.hasOwnProperty(field)) {
      var position = this.layout.fixed[field].position;
      var destination = (position && (position < this.layout.free.position)) ? 'beforeFree' : 'afterFree';

      result[destination].push({
        type: field,
        content: document[field]
      });
    }
  }).bind(this));

  result.free = document._layout.map(function (block) {
    return {
      type: block.source,
      content: document[block.source][block.index]
    };
  });

  document._layout = result.beforeFree.concat(result.free).concat(result.afterFree);

  return document;
};

Layout.prototype.validate = function (document) {
  var errors = [];
  var fieldCount = {};

  document._layout.forEach((function (block, blockIndex) {
    var schemaField = this.layout.free.fields[block.source];

    // Check if field is part of `free`
    if (!schemaField) {
      return errors.push({field: '_layout', message: 'Layout does not accept \'' + block.source + '\' as a free field'});
    }

    // Check if `index` is within bounds
    if (!util.isArray(document[block.source]) || (document[block.source].length <= block.index)) {
      return errors.push({field: '_layout', message: block.index + ' is not a valid index for field ' + block.source});
    }

    // Increment the field count and check for limits
    if (fieldCount.hasOwnProperty(block.source)) {
      fieldCount[block.source]++;
    } else {
      fieldCount[block.source] = 1;
    }
  }).bind(this));

  Object.keys(this.layout.free.fields).forEach((function (fieldName) {
    var schemaField = this.layout.free.fields[fieldName];

    // Check for `min` limit
    if (schemaField.min && (fieldCount[fieldName] < schemaField.min)) {
      errors.push({field: '_layout', message: 'Layout cannot contain less than ' + schemaField.min + ' instances of \'' + fieldName + '\''});
    }

    // Check for `max` limit
    if (schemaField.max && (fieldCount[fieldName] > schemaField.max)) {
      errors.push({field: '_layout', message: 'Layout cannot contain more than ' + schemaField.max + ' instances of \'' + fieldName + '\''});
    }
  }).bind(this));

  if (errors.length) return errors;
};

module.exports = Layout;
