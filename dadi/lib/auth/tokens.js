var uuid = require('node-uuid');
var config = require(__dirname + '/../../../config.js');
var connection = require(__dirname + '/../model/connection');

var tokenStore = require(__dirname + '/tokenStore')();
var dbOptions = config.get('auth.database');
dbOptions.auth = true;
var clientStore = connection(dbOptions);
var clientCollectionName = config.get('auth.clientCollection') || 'clientStore';

/**
 * Generate a token and test that it doesn't already exist in the token store.
 * If it does exist, keep generating tokens until we've got a unique one.
 */
function getToken(callback) {
  (function checkToken() {
    var token = uuid.v4();
    tokenStore.get(token, function (err, val) {
      if (val) {
        checkToken();
      }
      else {
        callback(token);
      }
    })
  })()
}

module.exports.generate = function (req, res, next) {

    // Look up the creds in clientStore
    var _done = function (database) {
        database.collection(clientCollectionName).findOne({
            clientId: req.body.clientId,
            secret: req.body.secret
        }, function (err, client) {

            if (err) return next(err);

            if (client) {

              // Generate token
              var token;
              getToken(function (returnedToken) {
                token = returnedToken;

                // Ensure we have a TTL for token documents
                tokenStore.expire(function (err) {});

                // Save token
                return tokenStore.set(token, client, function (err) {
                    if (err) return next(err);

                    var tok = {
                        accessToken: token,
                        tokenType: 'Bearer',
                        expiresIn: config.get('auth.tokenTtl')
                    };

                    var json = JSON.stringify(tok);
                    res.setHeader('Content-Type', 'application/json');
                    res.setHeader('Cache-Control', 'no-store');
                    res.setHeader('Pragma', 'no-cache');
                    res.end(json);
                });
              });
            }
            else {
              var err = new Error('Invalid Credentials');
              err.statusCode = 401;
              res.setHeader('WWW-Authenticate', 'Bearer, error="invalid_credentials", error_description="Invalid credentials supplied"');
              return next(err);
            }
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
