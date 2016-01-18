var url = require('url');
var _ = require('underscore');
var config = require(__dirname + '/../../../config.js');
var tokens = require(__dirname + '/tokens');

function mustAuthenticate(endpoints, path) {

    path = url.parse(path, true);

    // all /config requests must be authenticated
    if (path.pathname.indexOf('config') > -1) return true;

    // docs requests don't need to be authenticated
    if (path.pathname.indexOf('docs') > 0) return false;

    var endpointKey = _.find(_.keys(endpoints), function (k){ return k.indexOf(path.pathname) > -1; });

    if (!endpointKey) return true;

    if (endpoints[endpointKey].model && endpoints[endpointKey].model.settings) {
        return endpoints[endpointKey].model.settings.authenticate;
    }
    else {
        return true;
    }
}

function isAuthorized(endpoints, req, client) {

    var path = url.parse(req.url, true);

    var urlParts = _.compact(path.pathname.split('/'));
    var version = urlParts.shift();

    var endpointKey = _.find(_.keys(endpoints), function (k){ return k.indexOf(path.pathname) > -1; });

    // check if this is a master config request first
    // if (path.pathname.indexOf('api/config') > -1 && client.permissions) {
    //     if (client.permissions.collections && client.permissions.collections.indexOf(path.pathname) < 0) {
    //         return false;
    //     }

    //     if (client.permissions.endpoints && client.permissions.endpoints.indexOf(path.pathname) < 0) {
    //         return false;
    //     }
    // }

    // check if user accessType allows access to collection config
    if (path.pathname.indexOf('config') > -1 && req.method === 'POST') {
      if (client.accessType && client.accessType === 'admin') {
        return true;
      }
      else {
        return false;
      }
    }

    if (!endpointKey || !client.permissions) return true;

    var authorized = true;

    if (endpoints[endpointKey].model && client.permissions.collections) {
        authorized = _.findWhere(client.permissions.collections, { path: endpoints[endpointKey].model.name });
    }
    else if (endpoints[endpointKey].get && client.permissions.endpoints) {
        authorized = _.findWhere(client.permissions.endpoints, { path: urlParts.pop() });
    }
    else {
        authorized = false;
    }

    if (authorized && authorized.apiVersion) {
      authorized = (authorized.apiVersion === version);
    }

    return authorized;
}

// This attaches middleware to the passed in app instance
module.exports = function (server) {
    var tokenRoute = config.get('auth.tokenUrl') || '/token';

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

                if (!isAuthorized(server.components, req, client)) {
                    var err = new Error('ClientId not authorized to access requested collection.');
                    err.statusCode = 401;
                    return next(err);
                }
                else {
                    // Token is valid attach client to request
                    req.client = client;
                    return next();
                }
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
