var util = require('util');
var _ = require('underscore');

var Layout = function (layout) {
  this.layout = layout;
};

Layout.prototype.resolve = function (document) {
  var result = [];
  var freeSections = [];

  if (!document._layout) return document;

  // Add fixed fields
  this.layout.forEach(function (block, index) {
    if (!block.source && !block.free) return;

    if (block.free) {
      freeSections.push({
        displayName: block.displayName,
        position: index,
        name: block.name
      });
    } else {
      result.push({
        content: document.hasOwnProperty(block.source) ? document[block.source] : null,
        type: block.source
      });
    }
  });

  // Add free fields
  if (freeSections.length) {
    var counter = 0;

    Object.keys(document._layout).forEach(function (section, sectionIndex) {
      document._layout[section].forEach(function (block, blockIndex) {
        result.splice(freeSections[sectionIndex].position + blockIndex + counter, 0, {
          content: document[block.source][block.index],
          displayName: freeSections[sectionIndex].displayName,
          free: true,
          name: freeSections[sectionIndex].name,
          type: block.source
        });
      });

      counter += section.length - 1;
    });
  }

  document._layout = result;

  return document;
}

Layout.prototype.validate = function (document) {
  var errors = [];
  var fieldCount = [];
  var freeFieldsSections = this.layout.filter(function (elem) {
    return elem.free;
  });

  Object.keys(document._layout).forEach((function (section, sectionIndex) {
    if (!freeFieldsSections[sectionIndex]) return;

    if (!fieldCount[sectionIndex]) {
      fieldCount[sectionIndex] = {};
    }

    var sectionName = freeFieldsSections[sectionIndex].name || sectionIndex;

    document._layout[section].forEach((function (block, blockIndex) {
      var freeField = freeFieldsSections[sectionIndex].fields.find(function (elem) {
        return elem.source === block.source;
      });

      // Check if field is part of `free`
      if (!freeField) {
        return errors.push({field: '_layout', message: 'Layout section \'' + sectionName + '\' does not accept \'' + block.source + '\' as a free field'});
      }

      // Check if `index` is within bounds
      if (!util.isArray(document[block.source]) || (document[block.source].length <= block.index)) {
        return errors.push({field: '_layout', message: block.index + ' is not a valid index for field ' + block.source});
      }

      // Increment the field count and check for limits
      if (fieldCount[sectionIndex].hasOwnProperty(block.source)) {
        fieldCount[sectionIndex][block.source]++;
      } else {
        fieldCount[sectionIndex][block.source] = 1;
      }
    }).bind(this));
  }).bind(this));

  var free = this.layout.filter(function (elem) {
    return elem.free;
  });

  free.forEach(function (section, sectionIndex) {
    section.name = section.name || sectionIndex;

    section.fields.forEach(function (field) {
      // Check for `min` limit
      if (field.min && (fieldCount[sectionIndex][field.source] < field.min)) {
        errors.push({field: '_layout', message: 'Layout section \'' + section.name + '\' must contain at least ' + field.min + ' instances of \'' + field.source + '\''});
      }

      // Check for `max` limit
      if (field.max && (fieldCount[sectionIndex][field.source] > field.max)) {
        errors.push({field: '_layout', message: 'Layout section \'' + section.name + '\' cannot contain more than ' + field.max + ' instances of \'' + field.source + '\''});
      }
    });
  });

  if (errors.length) return errors;
};

module.exports = Layout;
