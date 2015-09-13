var url = require('url');
var _ = require('underscore');
var config = require(__dirname + '/../../../config');
var help = require(__dirname + '/../help');
var model = require(__dirname + '/../model');

module.exports = function (server) {

    server.app.use('/:version/search', function (req, res, next) {
    	var method = req.method && req.method.toLowerCase();
  		if (method !== 'get') {
          return next();
      }

			var path = url.parse(req.url, true);
    	var options = path.query;

    	if (!(options.collections && options.query)) {
    		return help.sendBackJSON(400, res, next)(null, {"error":"Bad Request"});
    	}

    	var collections = options.collections.split(',');
    	var query = help.parseQuery(options.query);
    	var apiVersion = path.pathname.split('/')[1];

    	if (collections.length === 0) {
    		return help.sendBackJSON(400, res, next)(null, {"error":"Bad Request"});
    	}
      
    	var results = {};
    	var idx = 0;

    	_.each(collections, function (collection) {
    		var parts = collection.split('/');
    		var database = parts[0];
    		var name = parts[1];
    		var mod = model(name, null, null, database);

    		query.apiVersion = apiVersion;

    		mod.find(query, function (err, docs) {
    			if (err) {
    				return help.sendBackJSON(500, res, next)(err);
    			}

    			results[name] = docs;

	    		idx++;

	    		if (idx === collections.length) {
  			    return help.sendBackJSON(200, res, next)(err, results);
	    		}

    		});

    	});

    });
};
