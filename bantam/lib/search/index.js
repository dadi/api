var url = require('url');
var _ = require('underscore');
var config = require(__dirname + '/../../../config');
var help = require(__dirname + '/../help');
var model = require(__dirname + '/../model');

/*

Search middleware allowing cross-collection querying

Search query URI format:

http://host[:port]/version/search?collections=database/collection[,database2/collection2,...[,databaseN/collectionN]]&query={"title":{"$regex":"brother"}}

Example search query:

http://api.example.com/1.0/search?collections=library/books,library/films&query={"title":{"$regex":"brother"}}

 */


module.exports = function (server) {

    server.app.use('/:version/search', function (req, res, next) {

    	// sorry, we only process GET requests at this endpoint
    	var method = req.method && req.method.toLowerCase();
  		if (method !== 'get') {
          return next();
      }

			var path = url.parse(req.url, true);
    	var options = path.query;

    	// no collection and no query params
    	if (!(options.collections && options.query)) {
    		return help.sendBackJSON(400, res, next)(null, {"error":"Bad Request"});
    	}

    	// split the collections param
    	var collections = options.collections.split(',');
    	
    	// extract the query from the querystring
    	var query = help.parseQuery(options.query);
    	
    	// determine API version
    	var apiVersion = path.pathname.split('/')[1];

    	// no collections specfied
    	if (collections.length === 0) {
    		return help.sendBackJSON(400, res, next)(null, {"error":"Bad Request"});
    	}
      
    	var results = {};
    	var idx = 0;

    	_.each(collections, function (collection) {
    		
    		// get the database and collection name from the 
    		// collection parameter
    		var parts = collection.split('/');
            var database, name, mod;

            query.apiVersion = apiVersion;

            if (_.isArray(parts) && parts.length > 1) {
    		  database = parts[0];
    		  name = parts[1];
    		  mod = model(name, null, null, database);
            }

            if (mod) {

        		// query!
        		mod.find(query, function (err, docs) {
        			if (err) {
        				return help.sendBackJSON(500, res, next)(err);
        			}

        			// add data to final results array, keyed 
        			// on collection name
        			results[name] = docs;

    	    		idx++;

    	    		// send back data
    	    		if (idx === collections.length) {
      			       return help.sendBackJSON(200, res, next)(err, results);
    	    		}

        		});
            }
    	});

    });
};
