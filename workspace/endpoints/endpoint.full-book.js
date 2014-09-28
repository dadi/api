var url = require('url');
var ObjectID = require('mongodb').ObjectID;
var app = require(__dirname + '/../../bantam/lib');
var model = require(__dirname + '/../../bantam/lib/model');

module.exports.get = function (req, res, next) {

    var books = model('books');

    var user = model('user');

    var query = url.parse(req.url, true).query;
    var bookid = query && query.bookid;
    var bookQuery = bookid && {_id: bookid};
    books.castToBSON(bookQuery);

    if (bookQuery) {

        // TODO: use an async lib to avoid nesting callbacks
        return books.find(bookQuery, function (err, books) {
            if (err) return next(err);

            if (books.length) {
                var userQuery = { _id: books[0].authorId };
                user.castToBSON(userQuery);

                return user.find(userQuery, function (err, users) {
                    if (err) return next(err);

                    var book = books[0];

                    // attach the author data to the book, unless its not found
                    book.authorId = users.length ? users[0] : null;

                    res.setHeader('content-type', 'application/json');
                    res.statusCode = 200;
                    res.end(JSON.stringify(book));
                });
            }

            return next();
        });
    }

    return next();
};
