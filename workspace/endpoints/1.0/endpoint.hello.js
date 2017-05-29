module.exports.get = (req, res, next) => {
 res.setHeader('content-type', 'application/json')
 res.statusCode = 200
 res.end(JSON.stringify({ message: 'Hello World' }))
}
