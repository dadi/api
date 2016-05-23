var util = require('util');
var _ = require('underscore');

var Layout = function (layout) {
  this.layout = layout;
};

Layout.prototype.resolve = function (document) {
  var result = [];
  var freePosition;

  if (!document._layout) return document;

  // Add fixed fields
  this.layout.forEach(function (block, index) {
    if (!block.source && !block.free) return;

    if (block.free) {
      freePosition = index;
    } else {
      result.push({
        content: document.hasOwnProperty(block.source) ? document[block.source] : null,
        type: block.source
      });
    }
  });

  // Add free fields
  if (freePosition !== undefined) {
    document._layout.forEach(function (block, index) {
      result.splice(freePosition + index, 0, {
        content: document[block.source][block.index],
        free: true,
        type: block.source
      });
    });
  }

  document._layout = result;

  return document;
}

Layout.prototype.validate = function (document) {
  var errors = [];
  var fieldCount = {};
  var freeFields = this.layout.find(function (elem) {
    return elem.free;
  });

  freeFields = freeFields ? freeFields.fields : [];

  document._layout.forEach((function (block, blockIndex) {
    var freeField = freeFields.find(function (elem) {
      return elem.source === block.source;
    });

    // Check if field is part of `free`
    if (!freeField) {
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

  var free = this.layout.find(function (elem) {
    return elem.free;
  });

  free.fields.forEach(function (field) {
    // Check for `min` limit
    if (field.min && (fieldCount[field.source] < field.min)) {
      errors.push({field: '_layout', message: 'Layout cannot contain less than ' + field.min + ' instances of \'' + field.source + '\''});
    }

    // Check for `max` limit
    if (field.max && (fieldCount[field.source] > field.max)) {
      errors.push({field: '_layout', message: 'Layout cannot contain more than ' + field.max + ' instances of \'' + field.source + '\''});
    }
  });

  if (errors.length) return errors;
};

module.exports = Layout;
