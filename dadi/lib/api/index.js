var util = require('util');
var log = require(__dirname + '/../log');

var MiddlewareEngine = require('../../../../middleware');

var Api = function () {
    MiddlewareEngine.call(this);

    this.use(defaultError);

};

util.inherits(Api, MiddlewareEngine);

module.exports = function () {
    return new Api();
};

module.exports.Api = Api;

// Default error handler, in case application doesn't define error handling
function defaultError(err, req, res, next) {

    var resBody;

    log.error({module: 'api'}, err);

    if (err.json) {
        resBody = JSON.stringify(err.json);
    }
    else {
        resBody = JSON.stringify(err);
    }

    res.statusCode = err.statusCode || 500;
    res.setHeader('content-type', 'application/json');
    res.setHeader('content-length', Buffer.byteLength(resBody));
    return res.end(resBody);

}
