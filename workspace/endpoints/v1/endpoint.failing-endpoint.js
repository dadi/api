/*

A failing endpoint, testing that we don't crash the server...
 */
const url = require('url')

module.exports.get = function (req, res, next) {
  const message = 'Hello World'

  const query = url.parse(req.url, true).query

  if (query.type === 'reference') throw new ReferenceError()
  if (query.type === 'type') throw new TypeError()

  res.setHeader('content-type', 'application/json')
  res.statusCode = 200
  res.end(JSON.stringify({message}))
}
