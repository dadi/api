// Create a client object, enabling access to the api
var connection = require(__dirname + '/../bantam/lib/model/connection');
var config = require(__dirname + '/../config');

var conn = connection(config.auth.database);
var clientCollectionName = config.auth.client_collection || 'client-store';

conn.on('connect', function (db) {

    // Note: this is for QA testing or example purposes only
    db.collection(clientCollectionName).insert({
        client_id: 'test-client',
        secret: 'super_secret'
    }, function (err) {
        if (err) throw err;

        conn.mongoClient.close();
    });
})
