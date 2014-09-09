/*

Ok, this should create a component that takes a req, res, and next function
and looks at query string and/or body of the request and accesses a given model instance.
This should accept a model instance as an argument, and return an instance that has
POST, GET, and DELETE methods that can be accessed by the request router

This will only be used for *http://{url}/{version number}/{database name}/{collection name}*
type of endpoints

*http://{url}/enpoints/{enpoint name}* type endpoints should create a custom controller that
implements methods corrisponding to the http methods it needs to support


*/
var url = require('url');
var help = require(__dirname + '/../help');

// helpers
var sendBackJSON = help.sendBackJSON;
var sendBackJSONP = help.sendBackJSONP;
var parseQuery = help.parseQuery;


var Controller = function (model) {
    if (!model) throw new Error('Model instance required');
    this.model = model;
};

Controller.prototype.get = function (req, res, next) {
    var options = url.parse(req.url, true).query;
    var query = parseQuery(options.filter);

    var settings = this.model.settings || {};

    var limit = options.count || settings.count || 50;
    var skip = limit * ((options.page || 1) - 1);

    // determine if this is jsonp
    var done = options.callback
        ? sendBackJSONP(options.callback, res, next)
        : sendBackJSON(200, res, next);

    if (options.sort) {
        var sort = {};

        // default to 'asc'
        var order = (options.sort_order || settings.sort_order) === 'desc' ? -1 : 1;

        sort[options.sort] = order;
    }

    // white list user specified options
    options = {
        limit: limit,
        skip: skip
    };
    if (sort) options.sort = sort;

    this.model.find(query, options, done);
};

Controller.prototype.post = function (req, res, next) {

    // internal fields
    var internals = {
        api_version: req.url.split('/')[1],
    };

    if (req.params.id) {
        internals.last_modified_at = Date.now();
        internals.last_modified_by = req.client && req.client.client_id;
        return this.model.update({
            _id: req.params.id
        }, req.body, internals, sendBackJSON(200, res, next));
    }

    internals.created_at = Date.now();
    internals.created_by = req.client && req.client.client_id;

    this.model.create(req.body, internals, sendBackJSON(200, res, next));
};

Controller.prototype.delete = function (req, res, next) {
    var id = req.params.id;
    if (!id) return next();

    this.model.delete({_id: id}, function (err, results) {
        if (err) return next(err);

        res.statusCode = 204;
        res.end();
    });
};

module.exports = function (model) {
    return new Controller(model);
};

module.exports.Controller = Controller;
