// Create a client object, enabling access to the api
var connection = require(__dirname + '/../bantam/lib/model/connection');
var config = require(__dirname + '/../config');

var conn = connection(config.get('auth.database'));
var clientCollectionName = config.get('auth.clientCollection');

conn.on('connect', function (db) {

    // Note: this is for QA testing or example purposes only
    db.collection(clientCollectionName).insert({
        clientId: 'testClient',
        secret: 'superSecret'
    }, function (err) {
        if (err) throw err;

        conn.mongoClient.close();
    });
})
