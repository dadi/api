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
var config = require(__dirname + '/../../../config');
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
        var order = (options.sortOrder || settings.sortOrder) === 'desc' ? -1 : 1;

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
        apiVersion: req.url.split('/')[1]
    };

    // if id is present in the url, then this is an update
    if (req.params.id) {
        internals.lastModifiedAt = Date.now();
        internals.lastModifiedBy = req.client && req.client.clientId;
        return this.model.update({
            _id: req.params.id
        }, req.body, internals, sendBackJSON(200, res, next));
    }

    // if no id is present, then this is a create
    internals.createdAt = Date.now();
    internals.createdBy = req.client && req.client.clientId;

    this.model.create(req.body, internals, sendBackJSON(200, res, next));
};

Controller.prototype.delete = function (req, res, next) {
    var id = req.params.id;
    if (!id) return next();

    this.model.delete({_id: id}, function (err, results) {
        if (err) return next(err);

        if (config.feedback) {

            // send 200 with json message
            return help.sendBackJSON(200, res, next)(null, {
                status: 'success',
                message: 'Document deleted successfully'
            });
        }

        // send no-content success 
        res.statusCode = 204;
        res.end();
    });
};

module.exports = function (model) {
    return new Controller(model);
};

module.exports.Controller = Controller;
