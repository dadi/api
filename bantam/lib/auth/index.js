var config = require(__dirname + '/../../../config');
var tokens = require(__dirname + '/tokens');
var _ = require('underscore');


function mustAuthenticate(endpoints, url) {
    
    // all /config requests must be authenticated
    if (url.indexOf('config') > -1) return true;

    var endpointKey = _.find(_.keys(endpoints), function (k){ return k.indexOf(url) > -1; });
    
    if (!endpointKey) return true;

    if (endpoints[endpointKey].model && endpoints[endpointKey].model.settings) {
        return endpoints[endpointKey].model.settings.authenticate;
    }
    else {
        return true;
    }
}

// This attaches middleware to the passed in app instance
module.exports = function (server) {
    var tokenRoute = config.auth.tokenUrl || '/token';

    // Authorize
    server.app.use(function (req, res, next) {

        // Let requests for tokens through, along with endpoints configured to not use authentication
        if (req.url === tokenRoute || !mustAuthenticate(server.components, req.url)) return next();

        // require an authorization header for every request
        if (!(req.headers && req.headers.authorization)) return fail();

        // Strip token value out of request headers
        var parts = req.headers.authorization.split(' ');
        var token;

        // Headers should be `Authorization: Bearer <%=tokenvalue%>`
        if (parts.length == 2 && /^Bearer$/i.test(parts[0])) {
            token = parts[1];
        }

        if (!token) return fail();

        tokens.validate(token, function (err, client) {
            if (err) return next(err);

            // If token is good continue, else `fail()`
            if (client) {

                // Token is valid attach client to request
                req.client = client;
                return next();
            }

            fail();
        });

        function fail() {
            var err = new Error('Unauthorized');
            err.statusCode = 401;
            next(err);
        }
    });

    // Setup token service
    server.app.use(tokenRoute, function (req, res, next) {
        var method = req.method && req.method.toLowerCase();
        if (method === 'post') {
            return tokens.generate(req, res, next);
        }
        next();
    });
};
