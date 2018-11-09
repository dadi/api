'use strict'

const path = require('path')
const config = require(path.join(__dirname, '/../../../config'))

const MediaModel = function (document) {
  this.document = document
}

MediaModel.prototype.formatDocuments = function (documents) {
  const multiple = documents instanceof Array
  const output = (multiple ? documents : [documents]).map(document => {
    const formattedDocument = Object.assign({}, document)

    // Is this a relative path to a file in the disk? If so, we need to prepend
    // the API URL.
    if (formattedDocument.path && formattedDocument.path.indexOf('/') === 0) {
      formattedDocument.url = this.getURLForPath(formattedDocument.path)
    }

    // To maintain backwards compatibility.
    formattedDocument.mimeType = formattedDocument.mimeType ||
      formattedDocument.mimetype

    delete formattedDocument._apiVersion

    return formattedDocument
  })

  return multiple ? output : output[0]
}

// At some point we'll return a different schema based on MIME type, but for
// now we hardcode this one.
MediaModel.prototype.getSchema = function () {
  return {
    fields: {
      fileName: {
        type: 'String',
        label: 'Filename',
        comments: 'The asset filename',
        required: true
      },
      path: {
        type: 'String',
        label: 'Path',
        comments: 'The asset path after upload',
        required: true
      },
      contentLength: {
        type: 'Number',
        label: 'Size',
        comments: 'The asset size',
        required: false
      },
      width: {
        type: 'Number',
        label: 'Width',
        comments: 'The asset width',
        required: false
      },
      height: {
        type: 'Number',
        label: 'Height',
        comments: 'The asset height',
        required: false
      },
      mimeType: {
        type: 'String',
        label: 'MIME type',
        comments: 'The asset mime type',
        required: false
      }
    },
    settings: {
      cache: false,
      cacheTTL: 300,
      authenticate: true,
      count: 40,
      sortOrder: 1,
      storeRevisions: false,
      type: 'mediaCollection'
    }
  }
}

MediaModel.prototype.getURLForPath = function (path) {
  const portString = config.get('publicUrl.port')
    ? `:${config.get('publicUrl.port')}`
    : ''

  return `${config.get('publicUrl.protocol')}://${config.get('publicUrl.host')}${portString}${path}`
}

MediaModel.prototype.isValidUpdate = function (update) {
  let reservedProperties = Object.keys(this.getSchema().fields)
  let hasReservedFields = Object.keys(update).some(field => {
    if (field.indexOf(config.get('internalFieldsPrefix')) === 0) {
      return true
    }

    return Boolean(reservedProperties[field])
  })

  return !hasReservedFields
}

module.exports = new MediaModel()
