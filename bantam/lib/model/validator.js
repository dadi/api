// Validation should:
//   ensure that no queries use `$` operators at top level
//   ensure that all objects are JSON
//   ensure that field validation passes for inserts and updates
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

Validator.prototype.schema = function (obj) {

    // `obj` must be a "hash type object", i.e. { ... }
    if (typeof obj !== 'object' || obj instanceof Array || obj === null) return false;

    var response = {
        success: true,
        errors: []
    };
    var schema = this.model.schema;

    // check that all required fields are present
    Object.keys(schema)
    .filter(function (key) { return schema[key].required; })
    .forEach(function (key) {
        if (!obj[key]) {
            response.success = false;
            response.errors.push({field: key, message: 'can\'t be blank'})
        }
    });

    // check all `obj` fields
    Object.keys(obj)
    .forEach(function (key) {

        // if no field in the schema, fail
        if (!schema[key]) {
            response.success = false;
            response.errors.push({field: key, message: 'is invalid'});
            return;
        }

        var err = _validate(obj[key], schema[key]);
        if (err) {
            response.success = false;
            response.errors.push({field: key, message: err})
        }
    });

    return response;
};

var primitives = ['boolean', 'string', 'number'];
function _validate(field, schema) {

    // check length
    var len = Number(schema.limit);
    if (len && field.length > len) return schema.message || 'is too long';

    // check validation regex
    if (schema.validation_rule && !(new RegExp(schema.validation_rule)).test(field)) return schema.message || 'is invalid';

    // enforce schema type
    var type = schema.type.toLowerCase();
    if (~primitives.indexOf(type) && type !== typeof field) return schema.message || 'is wrong type';

    // validation passes
    return;
}

module.exports = Validator;
