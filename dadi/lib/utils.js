const concat = require('concat-stream')
const lengthStream = require('length-stream')
const zlib = require('zlib')

module.exports.pipeStream = function (stream, compress, isCompressed, res) {
  let contentLength = 0

  // Set the content length after the stream has passed through.
  function lengthListener (length) {
    contentLength = length
  }

  // Receive the concatenated buffer and send the response.
  function sendBuffer (buffer) {
    res.setHeader('Content-Length', contentLength)
    res.end(buffer)
  }

  if (compress || isCompressed) {
    res.setHeader('Content-Encoding', 'gzip')
  }

  let concatStream = concat(sendBuffer)

  if (compress) {
    console.log('gzipping', compress, isCompressed)
    console.trace()
    stream = stream.pipe(zlib.createGzip())
  }

  stream = stream.pipe(lengthStream(lengthListener))

  return stream.pipe(concatStream)
}
