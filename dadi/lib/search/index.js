const _ = require('underscore')
const path = require('path')
const url = require('url')
const help = require(path.join(__dirname, '/../help'))
const model = require(path.join(__dirname, '/../model'))
/*

Search middleware allowing cross-collection querying

Search query URI format:

http://host[:port]/version/search?collections=database/collection[,database2/collection2,...[,databaseN/collectionN]]&query={"title":{"$regex":"brother"}}

Example search query:

http://api.example.com/1.0/search?collections=library/books,library/films&query={"title":{"$regex":"brother"}}

*/
module.exports = function (server) {
  server.app.use('/:version/search', (req, res, next) => {
    if (req.method && req.method.toLowerCase() !== 'get') {
      return next()
    }

    let parsedUrl = url.parse(req.url, true)
    let options = parsedUrl.query

    // no collection and no query params
    if (!(options.collections && options.query)) {
      return help.sendBackJSON(400, res, next)(null, {'error': 'Bad Request'})
    }

    // split the collections param
    let collections = options.collections.split(',')

    // extract the query from the querystring
    let query = help.parseQuery(options.query)

    // determine API version
    let apiVersion = parsedUrl.pathname.split('/')[1]

    // no collections specfied
    if (collections.length === 0) {
      return help.sendBackJSON(400, res, next)(null, {'error': 'Bad Request'})
    }

    let results = {}
    let idx = 0

    _.each(collections, collection => {
      // get the database and collection name from the
      // collection parameter
      let parts = collection.split('/')
      let database, name, mod

      query._apiVersion = apiVersion

      if (Array.isArray(parts) && parts.length > 1) {
        database = parts[0]
        name = parts[1]
        mod = model(name, null, null, database)
      }

      if (mod) {
        mod.find(query, (err, docs) => {
          if (err) {
            return help.sendBackJSON(500, res, next)(err)
          }

          // add data to final results array, keyed
          // on collection name
          results[name] = docs

          idx++

          // send back data
          if (idx === collections.length) {
            return help.sendBackJSON(200, res, next)(err, results)
          }
        })
      }
    })
  })
}
