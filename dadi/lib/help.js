var fs = require('fs');
var path = require('path');
var util = require('util');
var url = require('url');
var crypto = require('crypto');
var _ = require('underscore');

var cache = require(__dirname + '/cache');
var config = require(__dirname + '/../../config');
var log = require(__dirname + '/log');
var moment = require('moment');

var self = this;

// helper that sends json response
module.exports.sendBackJSON = function (successCode, res, next) {
  return function (err, results) {
    if (err) return next(err);

    var resBody = JSON.stringify(results);

    // log response if it's already been sent
    if (res.finished) {
      log.info({res: res}, 'Response already sent. Attempting to send results: ' + resBody);
      return;
    }

    if (config.get('cors') === true) {
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    }

    res.setHeader('Server', config.get('server.name'));

    res.setHeader('content-type', 'application/json');
    res.setHeader('content-length', Buffer.byteLength(resBody));

    res.statusCode = successCode;

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

    res.setHeader('Server', config.get('server.name'));

    res.setHeader('content-type', 'text/javascript');
    res.setHeader('content-length', Buffer.byteLength(resBody));
    res.end(resBody);
  }
}

// function to wrap try - catch for JSON.parse to mitigate pref losses
module.exports.parseQuery = function (queryStr) {
  var ret;
  try {
    ret = JSON.parse(queryStr);
  }
  catch (e) {
    ret = {};
  }

  // handle case where queryStr is "null" or some other malicious string
  if (typeof ret !== 'object' || ret === null) ret = {};
  return ret;
}

// Transforms strings from a query object into more appropriate types, based
// on the field type
module.exports.transformQuery = function (obj, type) {
  var transformFunction;

  switch (type) {
    case 'DateTime':
      transformFunction = (function (obj) {
        var parsedDate = new moment(obj);

        if (!parsedDate.isValid()) return obj;

        return parsedDate.toDate();
      });

      break;

    case 'String':
      transformFunction = (function (obj) {
        if ((obj.charAt(0) === '/') && (obj.charAt(obj.length - 1) === '/')) {
          try {
            var regex = new RegExp(obj.substring(1).slice(0, -1));

            return regex;
          } catch (e) {
            return obj;
          }
        }
      });

      break;

    default:
      return obj;
  }

  Object.keys(obj).forEach((function (key) {
    if (typeof obj[key] === 'object') {
      this.transformQuery(obj[key], type);
    } else if (typeof obj[key] === 'string') {
      obj[key] = transformFunction(obj[key]);
    }
  }).bind(this));
};

module.exports.regExpEscape = function(str) {
  return str.replace(/([.?*+^$[\]\\(){}|-])/g, "\\$1");
};

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

module.exports.isJSON = function(jsonString) {
  try {
    var o = JSON.parse(jsonString);

    // Handle non-exception-throwing cases:
    // Neither JSON.parse(false) or JSON.parse(1234) throw errors, hence the type-checking,
    // but... JSON.parse(null) returns 'null', and typeof null === "object",
    // so we must check for that, too.
    if (o && typeof o === "object" && o !== null) {
      return o;
    }
  }
  catch (e) { }

  return false;
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
  var requiredSettings = ["cache","authenticate","callback","defaultFilters","fieldLimiters","count","sortOrder"];

  requiredSettings.forEach(function (key) {
    if (!obj.settings.hasOwnProperty(key)) {
      response.success = false;
      response.errors.push({setting: key, message: 'must be provided'});
    }
  });

  return response;
}

/**
 *
 * Remove each file in the specified cache folder.
 */
module.exports.clearCache = function (pathname, callback) {

	var modelDir = crypto.createHash('sha1').update(pathname).digest('hex');
	if(pathname == '*') modelDir = '';
	var cachePath = path.join(config.get('caching.directory.path'), modelDir);

	var walkSync = function(dir, filelist) {
	var fs = fs || require('fs'),
    files = fs.readdirSync(dir);
  	filelist = filelist || [];
  	files.forEach(function(file) {
    	if (fs.statSync(dir + file).isDirectory()) {
      	filelist = walkSync(dir + file + '/', filelist);
    	}
    	else {
        filelist.push(dir + file);
    	}
  	});
  	return filelist;
	};
	// delete using Redis client
	if (cache.client()) {
  	setTimeout(function() {
  		cache.delete(modelDir, function(err) {
    		return callback(null);
  		});
  	}, 200);
	}
	else {
  	var i = 0;
  	var exists = fs.existsSync(cachePath);

    if (!exists) {
    	return callback(null);
  	}
  	else {
  		var files = fs.readdirSync(cachePath);

  		if(pathname == '*') {
  			files = walkSync(cachePath + '/');
  		}

      if (_.isEmpty(files)) return callback(null)

	    files.forEach(function (filename) {
    		var file = path.join(cachePath, filename);
    		if(pathname == '*') file = filename;

        // write empty string to file, as we
        // can't effectively remove it whilst
        // the node process is running
        fs.writeFileSync(file, '');

        i++;

        // finished, all files processed
        if (i == files.length) {
          return callback(null);
        }
  		});

  	}
	}
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

module.exports.getFromObj = function(obj, path, def) {
  var i, len;

  for(i = 0, path = path.split('.'), len = path.length; i < len; i++){
    if(!obj || typeof obj !== 'object') return def;
    obj = obj[path[i]];
  }

  if(obj === undefined) return def;
  return obj;
}
