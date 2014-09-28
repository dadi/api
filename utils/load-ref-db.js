// Create a client object, enabling access to the api
var connection = require(__dirname + '/../bantam/lib/model/connection');
var config = require(__dirname + '/../config');

var conn = connection(config.auth.database);

conn.on('connect', function (db) {

    // Note: this is for QA testing or example purposes only
    db.collection('user').insert({
        name: 'Tolstoy'
    }, function (err, doc) {
        if (err) throw err;

        db.collection('books').insert({
            name: 'War and Peace',
            authorId: doc[0]._id
        }, function (err, books) {
            if (err) throw err;

            console.log('Send a GET request to the following URL in Postman to see joined collection:')
            console.log('\thttp://localhost:3000/endpoints/full-book?bookid=' + books[0]._id);
            conn.mongoClient.close();
        });
    });
})
