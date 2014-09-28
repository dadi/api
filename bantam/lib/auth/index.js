var config = require(__dirname + '/../../../config');
var tokens = require(__dirname + '/tokens');

// This attaches middleware to the passed in app instance
module.exports = function (app) {
    var tokenRoute = config.auth.tokenUrl || '/token';

    // authorize
    app.use(function (req, res, next) {

        // let requests for tokens through
        if (req.url === tokenRoute) return next();

        // require an authorization header for every request
        if (!(req.headers && req.headers.authorization)) return fail();

        // strip token value out of request headers
        var parts = req.headers.authorization.split(' ');
        var token;

        // headers should be `Authorization: Bearer <%=tokenvalue%>`
        if (parts.length == 2 && /^Bearer$/i.test(parts[0])) {
            token = parts[1];
        }

        if (!token) return fail();

        tokens.validate(token, function (err, client) {
            if (err) return next(err);

            // if token is good continue, else `fail()`
            if (client) {

                // token is valid attach client to request
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

    // setup token service
    app.use(tokenRoute, function (req, res, next) {
        var method = req.method && req.method.toLowerCase();
        if (method === 'post') {
            return tokens.generate(req, res, next);
        }
        next();
    });
};
