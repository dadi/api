var fs = require('fs');
var path = require('path');
var util = require('util');

var self = this;

// helper that sends json response
module.exports.sendBackJSON = function (successCode, res, next) {
    return function (err, results) {
        if (err) return next(err);

        res.statusCode = successCode;

        var resBody = JSON.stringify(results);
        res.setHeader('content-type', 'application/json');
        res.setHeader('content-length', resBody.length);
        res.end(resBody);
    }
}

module.exports.sendBackJSONP = function (callbackName, res, next) {
    return function (err, results) {

        // callback MUST be made up of letters only
        if (!callbackName.match(/^[a-zA-Z]+$/)) return res.send(400);

        res.statusCode = 200;

        var resBody = JSON.stringify(results);
        resBody = callbackName + '(' + resBody + ');';
        res.setHeader('content-type', 'text/javascript');
        res.setHeader('content-length', resBody.length);
        res.end(resBody);
    }
}

// function to wrap try - catch for JSON.parse to mitigate pref losses
module.exports.parseQuery = function (queryStr) {
    var ret;
    try {
        // strip leading zeroes from querystring before attempting to parse
        ret = JSON.parse(queryStr.replace(/\b0(\d+)/, "\$1"));
    } catch (e) {
        ret = {};
    }

    // handle case where queryStr is "null" or some other malicious string
    if (typeof ret !== 'object' || ret === null) ret = {};
    return ret;
}

function getKeys(obj, keyName, result) {
    for (var key in obj) {
        if (obj.hasOwnProperty(key)) {
            if (key === keyName) {
                result.push(obj[key]);
            }
            else if ("object" == typeof(obj[key])) {
                getKeys(obj[key], keyName, result);
            }
        }
    }
}

module.exports.getFieldsFromSchema = function(obj) {
    var fields = [];
    getKeys(obj, 'fields', fields);
    return JSON.stringify(fields[0]);
}

module.exports.validateCollectionSchema = function(obj) {

    // `obj` must be a "hash type object", i.e. { ... }
    if (typeof obj !== 'object' || util.isArray(obj) || obj === null) return false;

    var response = {
        success: true,
        errors: []
    };
            
    var fields = [];
    var settings = [];

    getKeys(obj, 'fields', fields);
    if (fields.length === 0) {
        response.success = false;
        response.errors.push({section: 'fields', message: 'must be provided at least once'});
    }

    getKeys(obj, 'settings', settings);
    if (settings.length === 0) {
        response.success = false;
        response.errors.push({section: 'settings', message: 'must be provided'});
    }

    if (!response.success) return response;

    // check at least one field has been provided
    if (Object.keys(fields[0]) == 0) {
        response.success = false;
        response.errors.push({section: 'fields', message: 'must include at least one field'});
        return response;
    }

    // check that all required settings are present
    var requiredSettings = ["cache","authenticate","callback","defaultFilters","fieldLimiters","allowExtension","count","sortOrder"];

    requiredSettings.forEach(function (key) {
        if (!obj.settings.hasOwnProperty(key)) {
            response.success = false;
            response.errors.push({setting: key, message: 'must be provided'});
        }
    }); 
    
    return response;
}

/**
 * Recursively create directories.
 */
module.exports.mkdirParent =  function(dirPath, mode, callback) {
    if (fs.existsSync(path.resolve(dirPath))) return;

    fs.mkdir(dirPath, mode, function(error) {
        // When it fails because the parent doesn't exist, call it again
        if (error && error.errno === 34) {
          // Create all the parents recursively
          self.mkdirParent(path.dirname(dirPath), mode, callback);
          // And then finally the directory
          self.mkdirParent(dirPath, mode, callback);
        }

        // Manually run the callback
        callback && callback(error);
    });
};
