var uuid = require('node-uuid');
var config = require(__dirname + '/../../../config');
var connection = require(__dirname + '/../model/connection');

var tokenStore = require(__dirname + '/tokenStore')();
var clientStore = connection(config.auth.database);
var clientCollectionName = config.auth.client_collection || 'client-store';

module.exports.generate = function (req, res, next) {

    // look up the creds in clientStore
    var _done = function (database) {
        database.collection(clientCollectionName).findOne({
            client_id: req.body.client_id,
            secret: req.body.secret
        }, function (err, client) {
            if (err) return next(err);

            if (client) {

                // generate token
                var token = uuid.v4();

                // save token
                return tokenStore.set(token, client, function (err) {
                    if (err) return next(err);

                    var tok = {
                        access_token: token,
                        token_type: 'Bearer'
                    };

                    var json = JSON.stringify(tok);
                    res.setHeader('Content-Type', 'application/json');
                    res.setHeader('Cache-Control', 'no-store');
                    res.setHeader('Pragma', 'no-cache');
                    res.end(json);
                });
            }

            var err = new Error('Invalid Credentials');
            err.statusCode = 401;
            next(err);
        });
    };

    if (clientStore.db) return _done(clientStore.db);

    clientStore.on('connect', _done);
};

module.exports.validate = function (token, done) {
    tokenStore.get(token, function (err, doc) {
        if (err) return done(err);

        if (doc) return done(null, doc.value);

        done();
    });
};

module.exports.store = tokenStore;
