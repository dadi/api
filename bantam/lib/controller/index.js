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
        var order = Number(options.sort_order || settings.sort_order);

        // check for NaN
        if (order !== order) order = 1;
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

// helper that sends json response
function sendBackJSON(successCode, res, next) {
    return function (err, results) {
        if (err) return next(err);

        res.statusCode = successCode;

        var resBody = JSON.stringify(results);
        res.setHeader('content-type', 'application/json');
        res.setHeader('content-length', resBody.length);
        res.end(resBody);
    }
}

function sendBackJSONP(callbackName, res, next) {
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
function parseQuery(queryStr) {
    var ret;
    try {
        ret = JSON.parse(queryStr);
    } catch (e) {
        ret = {};
    }

    // handle case where queryStr is "null" or some other malicious string
    if (typeof ret !== 'object' || ret === null) ret = {};
    return ret;
}
