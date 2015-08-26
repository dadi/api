// Validation should:
//   ensure that no queries use `$` operators at top level
//   ensure that all objects are JSON
//   ensure that field validation passes for inserts and updates

var moment = require('moment');
var util = require('util');

var Validator = function (model) {
    this.model = model;
};

Validator.prototype.query = function (query) {
    var valid = Object.keys(query).every(function (key) {
        return key[0] !== '$';
    });
    var response = valid
        ? {success: true}
        : {success: false, errors: [{message: 'Bad query'}]};

    return response;
};

Validator.prototype.schema = function (obj, update) {

    update = update || false;

    // `obj` must be a "hash type object", i.e. { ... }
    if (typeof obj !== 'object' || util.isArray(obj) || obj === null) return false;

    var response = {
        success: true,
        errors: []
    };

    var schema = this.model.schema;

    // check for default fields, assign them if the obj didn't 
    // provide a value    
    Object.keys(schema)
    .filter(function (key) { return schema[key].default; })
    .forEach(function (key) {
        if (!obj[key]) {
            obj[key] = schema[key].default;
        }
    });

    if (update === false) {
        // check that all required fields are present
        Object.keys(schema)
        .filter(function (key) { return schema[key].required; })
        .forEach(function (key) {
            if (!obj[key]) {
                response.success = false;
                response.errors.push({field: key, message: 'can\'t be blank'})
            }
        });
    }

    // check all `obj` fields
    _parseDocument(obj, schema, response);
    return response;
};

function _parseDocument(obj, schema, response) {

    for (var key in obj) {
        // handle objects first
        if (typeof obj[key] === 'object') {
            if (schema[key] && schema[key].type === 'Object') {
                // do nothing
            }
            else if (obj[key] !== null && !util.isArray(obj[key])) {
                _parseDocument(obj[key], schema, response);
            }
        }
        else {
            if (!schema[key]) {
                response.success = false;
                response.errors.push({field: key, message: 'doesn\'t exist in the collection schema'});
                return;
            }

            var err = _validate(obj[key], schema[key]);

            if (err) {
                response.success = false;
                response.errors.push({field: key, message: err})
            }
        }
    }
}

function _validate(field, schema) {

    var primitives = ['String', 'Number', 'Boolean', 'Array', 'Date'];

    // check length
    var len = Number(schema.limit);
    if (len && field.length > len) return schema.message || 'is too long';

    // check validation regex
    if (schema.validationRule && !(new RegExp(schema.validationRule)).test(field)) return schema.message || 'is invalid';

    // if (schema.type === 'Date') {

    //     var validDateFormats = ["YYYY-MM-DD","YYYY/MM/DD"];
    //     var m = moment(field, validDateFormats, true);

    //     if (!m.isValid()) {
    //         return schema.message || 'is not a valid date';
    //     }
    // }
    // else {

        // allow 'Mixed' fields through
        if(schema.type !== 'Mixed') {
            // check constructor of field against primitive types and check the type of field == the specified type
            // using constructor.name as array === object in typeof comparisons
            try {
                if(~primitives.indexOf(field.constructor.name) && schema.type !== field.constructor.name) return schema.message || 'is wrong type';
            }
            catch(e) {
                return schema.message || 'is wrong type';
            }
        }

    //}

    // validation passes
    return;
}

module.exports = Validator;
