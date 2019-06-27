const path = require('path')
const url = require('url')
const model = require(path.join(__dirname, '/../../../dadi/lib/model'))

module.exports.get = function (req, res, next) {
  const books = model('books')
  const user = model('user')

  const query = url.parse(req.url, true).query
  const bookid = query && query.bookid
  const bookQuery = bookid && {_id: bookid}

  if (bookQuery) {
    // books.castToBSON(bookQuery)
    // TODO: use an async lib to avoid nesting callbacks
    return books.find(bookQuery, function (err, books) {
      if (err) return next(err)

      if (books.results.length) {
        const userQuery = { _id: books.results[0].authorId }

        user.castToBSON(userQuery)

        return user.find(userQuery, function (err, users) {
          if (err) return next(err)

          const book = books.results[0]

          // attach the author data to the book, unless its not found
          book.authorId = users.length ? users[0] : null

          res.setHeader('content-type', 'application/json')
          res.statusCode = 200
          res.end(JSON.stringify(book))
        })
      }

      return next()
    })
  }

  return next()
}
