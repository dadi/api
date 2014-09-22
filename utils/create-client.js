// Create a client object, enabling access to the api
var connection = require(__dirname + '/../bantam/lib/model/connection');
var config = require(__dirname + '/../config');

var conn = connection(config.auth.database);
var clientCollectionName = config.auth.clientCollection || 'clientStore';

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
