
/**
 *
 */
var DataStore = function (config) {

}

/**
 * Query the database
 *
 * @param {Object} query - the MongoDB query to perform
 * @param {String} collection - the name of the collection to insert into
 * @param {Object} options - a set of query options, such as page, limit, sort
 */
DataStore.prototype.find = function (query, collection, options) {
  return new Promise((resolve, reject) => {
    this.database.collection(collection).find(query, options, (err, cursor) => {
      cursor.toArray((err, result) => {
        if (err) return reject(err)

        return resolve(result)
      })
    })
  })
}

/**
 * Insert documents into the database
 *
 * @param {Array} data - an Array of documents to insert
 * @param {String} collection - the name of the collection to insert into
 */
DataStore.prototype.insert = function (data, collection) {
  this.database.collection(this.name).insertMany(data, (err, result) => {
    if (err) return done(err)
  })
}

/**
 * Update existing documents in the database
 *
 * @param {Array} x
 * @param {String} collection - the name of the collection that contains the documents
 */
DataStore.prototype.update = function (x, collection) {
  // this.database.collection(this.name).insertMany(x, (err, result) => {
  //   if (err) return done(err)
  // })
}

/**
 * Remove documents from the database
 */
DataStore.prototype.delete = function (arguments) {

}

module.exports = DataStore
