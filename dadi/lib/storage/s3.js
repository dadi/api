const AWS = require('aws-sdk')
const concat = require('concat-stream')
const lengthStream = require('length-stream')
const path = require('path')
const stream = require('stream')

const config = require(path.join(__dirname, '/../../../config'))
const logger = require('@dadi/logger')

/**
 * Creates a new S3Storage instance, setting the S3 credentials from config
 * @constructor
 * @classdesc
 */
const S3Storage = function(fileName) {
  this.fileName = fileName
  this.settings = config.get('media')
  this.providerType = 'AWS S3'

  AWS.config.update({
    accessKeyId: this.settings.s3.accessKey,
    secretAccessKey: this.settings.s3.secretKey
  })

  if (this.settings.s3.region && this.settings.s3.region !== '') {
    AWS.config.update({region: this.settings.s3.region})
  }

  // Allow configuration of endpoint for Digital Ocean Spaces
  if (this.settings.s3.endpoint && this.settings.s3.endpoint !== '') {
    AWS.config.update({endpoint: this.settings.s3.endpoint})

    this.providerType = 'DigitalOcean'
  }

  this.s3 = new AWS.S3()
}

/**
 * Get the name of the bucket configured to store files
 */
S3Storage.prototype.getBucket = function() {
  return this.settings.s3.bucketName
}

/**
 * Get the value to be used as the key in the S3 filesystem
 */
S3Storage.prototype.getKey = function() {
  return this.fileName
}

/**
 * Get a file from an S3-compatible location
 *
 * @param {string} filePath - the media file's path
 */
S3Storage.prototype.get = function(filePath, route, req, res, next) {
  return new Promise((resolve, reject) => {
    const requestData = {
      Bucket: this.getBucket(),
      Key: filePath
    }

    if (requestData.Bucket === '' || requestData.Key === '') {
      const err = {
        statusCode: 400,
        statusText: 'Bad Request',
        message:
          'Either no Bucket or Key provided: ' + JSON.stringify(requestData)
      }

      return reject(err)
    }

    logger.info(
      `${this.providerType} GET Request:` +
        JSON.stringify({
          Bucket: requestData.Bucket,
          Key: requestData.Key
        })
    )

    // create the AWS.Request object
    const getObjectPromise = this.s3.getObject(requestData).promise()

    return getObjectPromise
      .then(data => {
        const bufferStream = new stream.PassThrough()

        bufferStream.push(data.Body)
        bufferStream.push(null)
        bufferStream.pipe(res)
      })
      .catch(error => {
        return reject(error)
      })
  })
}

/**
 * Upload a file to an S3-compatible location
 *
 * @param {Stream} stream - the stream containing the uploaded file
 * @param {string} folderPath - the directory structure in which to store the file
 */
S3Storage.prototype.put = function(stream, folderPath) {
  return new Promise((resolve, reject) => {
    const fullPath = path.join(
      this.settings.basePath,
      folderPath,
      this.getKey()
    )

    const requestData = {
      Bucket: this.getBucket(),
      Key: fullPath
    }

    if (requestData.Bucket === '' || requestData.Key === '') {
      const err = {
        statusCode: 400,
        statusText: 'Bad Request',
        message:
          'Either no Bucket or Key provided: ' + JSON.stringify(requestData)
      }

      return reject(err)
    }

    if (requestData.Key.indexOf('.pdf') > 0) {
      requestData.ContentType = 'application/pdf'
    }

    let contentLength = 0

    function lengthListener(length) {
      contentLength = length
    }

    // receive the concatenated buffer and send the response
    // unless the etag hasn't changed, then send 304 and end the response
    const sendBuffer = buffer => {
      requestData.Body = buffer
      requestData.ContentLength = contentLength

      logger.info(
        `${this.providerType} PUT Request:` +
          JSON.stringify({
            Bucket: requestData.Bucket,
            Key: requestData.Key,
            ContentLength: requestData.ContentLength
          })
      )

      // create the AWS.Request object
      const putObjectPromise = this.s3.putObject(requestData).promise()

      return putObjectPromise
        .then(data => {
          const obj = {
            path: requestData.Key,
            contentLength,
            awsUrl: `https://${requestData.Bucket}.s3.amazonaws.com/${requestData.Key}`
          }

          return resolve(obj)
        })
        .catch(error => {
          return reject(error)
        })
    }

    const concatStream = concat(sendBuffer)

    // send the file stream through:
    // 1) lengthStream to obtain contentLength
    // 2) concatStream to get a buffer, which then passes the buffer to sendBuffer
    // for sending to AWS
    stream.pipe(lengthStream(lengthListener)).pipe(concatStream)
  })
}

/**
 * Delete a file from an S3-compatible location
 *
 * @param {Object} file - the media file's database record
 */
S3Storage.prototype.delete = function(file) {
  return new Promise((resolve, reject) => {
    const requestData = {
      Bucket: this.getBucket(),
      Key: file.path
    }

    if (requestData.Bucket === '' || requestData.Key === '') {
      const err = {
        statusCode: 400,
        statusText: 'Bad Request',
        message:
          'Either no Bucket or Key provided: ' + JSON.stringify(requestData)
      }

      return reject(err)
    }

    logger.info(
      `${this.providerType} DELETE Request:` +
        JSON.stringify({
          Bucket: requestData.Bucket,
          Key: requestData.Key
        })
    )

    // create the AWS.Request object
    const deleteObjectPromise = this.s3.deleteObject(requestData).promise()

    deleteObjectPromise
      .then(data => {
        return resolve()
      })
      .catch(error => {
        return reject(error)
      })
  })
}

module.exports = function(fileName) {
  return new S3Storage(fileName)
}

module.exports.S3Storage = S3Storage
