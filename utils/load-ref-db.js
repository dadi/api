const connection = require(__dirname + '/../dadi/lib/model/connection')
const config = require(__dirname + '/../config').database

config.database = 'testdb'

const conn = connection(config)

conn.on('connect', function (db) {
    // Note: this is for QA testing or example purposes only
  db.collection('user').insert({
    name: 'Tolstoy'
  }, function (err, doc) {
    if (err) throw err

    console.log(db)

    db.collection('books').insert({
      name: 'War and Peace',
      authorId: doc[0]._id
    }, function (err, books) {
      if (err) throw err

      console.log('Send a GET request to the following URL in Postman to see joined collection:')
      console.log('\thttp://localhost:3000/v1/full-book?bookid=' + books[0]._id)
      conn.mongoClient.close()
    })
  })
})
