var AWS = require('aws-sdk')
var concat = require('concat-stream')
var lengthStream = require('length-stream')
var path = require('path')

var config = require(path.join(__dirname, '/../../../config'))
var logger = require('@dadi/logger')

/**
 *
 * @param {string} fileName - xxx
 */
var S3Storage = function (fileName) {
  this.fileName = fileName
  this.settings = config.get('media')

  AWS.config.update({ accessKeyId: this.settings.s3.accessKey, secretAccessKey: this.settings.s3.secretKey })

  if (this.settings.s3.region && this.settings.s3.region !== '') {
    AWS.config.update({ region: this.settings.s3.region })
  }

  this.s3 = new AWS.S3()
}

/**
 *
 * @returns {string} xxx
 */
S3Storage.prototype.getBucket = function () {
  return this.settings.s3.bucketName
}

/**
 *
 * @returns {string} xxx
 */
S3Storage.prototype.getKey = function () {
  return this.fileName
}

/**
 *
 * @param {Stream} stream - xxx
 * @param {string} folderPath - xxx
 */
S3Storage.prototype.put = function (stream, folderPath) {
  return new Promise((resolve, reject) => {
    var fullPath = path.join(this.settings.basePath, folderPath, this.getKey())

    var requestData = {
      Bucket: this.getBucket(),
      Key: fullPath
    }

    if (requestData.Bucket === '' || requestData.Key === '') {
      var err = {
        statusCode: 400,
        statusText: 'Bad Request',
        message: 'Either no Bucket or Key provided: ' + JSON.stringify(requestData)
      }
      return reject(err)
    }

    if (requestData.Key.indexOf('.pdf') > 0) {
      requestData.ContentType = 'application/pdf'
    }

    var contentLength = 0

    function lengthListener (length) {
      contentLength = length
    }

    // receive the concatenated buffer and send the response
    // unless the etag hasn't changed, then send 304 and end the response
    var sendBuffer = (buffer) => {
      requestData.Body = buffer
      requestData.ContentLength = contentLength

      logger.info('S3 PUT Request:' + JSON.stringify({
        Bucket: requestData.Bucket,
        Key: requestData.Key,
        // fileName: fileName,
        ContentLength: requestData.ContentLength
      }))

      // create the AWS.Request object
      var putObjectPromise = this.s3.putObject(requestData).promise()

      putObjectPromise.then((data) => {
        var obj = {
          path: requestData.Key,
          contentLength: contentLength,
          awsUrl: `https://${requestData.Bucket}.s3.amazonaws.com/${requestData.Key}`
        }

        return resolve(obj)
      }).catch((error) => {
        console.log(error)
        return reject(error)
      })
    }

    var concatStream = concat(sendBuffer)

    // send the file stream through:
    // 1) lengthStream to obtain contentLength
    // 2) concatStream to get a buffer, which then passes the buffer to sendBuffer
    // for sending to AWS
    stream.pipe(lengthStream(lengthListener)).pipe(concatStream)
  })
}

module.exports = function (fileName) {
  return new S3Storage(fileName)
}

module.exports.S3Storage = S3Storage
