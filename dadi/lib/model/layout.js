var util = require('util');

var Layout = function (schema) {
  this.schema = schema;
};

Layout.prototype.resolve = function (document) {
  var result = document._layout.map(function (block) {
    return {
      source: block.source,
      content: document[block.source][block.index]
    };
  });

  document._layout = result;

  return document;
};

Layout.prototype.validate = function (document) {
  var errors = [];

  document._layout.forEach((function (block) {
    // Check if `source` corresponds to a field
    if (!this.schema.fields.hasOwnProperty(block.source)) {
      errors.push({field: '_layout', message: block.source + ' isn\'t a valid source'});
    }

    // Check if `index` is within bounds
    if (!util.isArray(document[block.source]) || (document[block.source].length <= block.index)) {
      errors.push({field: '_layout', message: block.index + ' isn\'t a valid index for source ' + block.source});
    }
  }).bind(this));

  if (errors.length) return errors;
};

module.exports = Layout;
