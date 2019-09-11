'use strict'

const path = require('path')
const config = require(path.join(__dirname, '/../../../config'))

const MediaModel = function(document) {
  this.document = document
}

MediaModel.prototype.formatDocuments = function(input) {
  const documents = Array.isArray(input) ? input : [input]
  const output = documents.map(rawDocument => {
    if (!rawDocument || typeof rawDocument !== 'object') {
      return rawDocument
    }

    const document = Object.assign({}, rawDocument, {
      _apiVersion: undefined
    })

    let storageType = document._storageType

    // The document might not have a `_storageType` property, because it wasn't
    // introduced until version 6.0.0. In such cases, we can infer the type of
    // storage by looking at the `path` property. If it begins with a trailing
    // slash, it's a relative path to a file on disk, so we know the storage
    // type is `disk`. Otherwise, it must be `s3`, because it was the only
    // other type of storage available at the time.
    if (!storageType) {
      storageType =
        document.path && document.path.indexOf('/') === 0 ? 'disk' : 's3'
    }

    if (document.path) {
      document.url = this.getURLForPath(document.path, storageType)
    }

    // To maintain backwards compatibility.
    document.mimeType = document.mimeType || document.mimetype

    return document
  })

  return Array.isArray(input) ? output : output[0]
}

// At some point we'll return a different schema based on MIME type, but for
// now we hardcode this one.
MediaModel.prototype.getSchema = function() {
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

MediaModel.prototype.getURLForPath = function(path, storageType) {
  const mediaPublicUrl = config.get('media.publicUrl')

  // We normalise the path by removing any trailing slash.
  const normalisedPath = path.indexOf('/') === 0 ? path.slice(1) : path

  if (mediaPublicUrl) {
    return `${mediaPublicUrl}/${normalisedPath}`
  }

  // If we don't have a public media URL but the storage type is the local
  // disk, we can still provide a public URL for the file, using API's own
  // public URL.
  if (storageType === 'disk') {
    const portString = config.get('publicUrl.port')
      ? `:${config.get('publicUrl.port')}`
      : ''

    return `${config.get('publicUrl.protocol')}://${config.get(
      'publicUrl.host'
    )}${portString}/${normalisedPath}`
  }
}

MediaModel.prototype.isValidUpdate = function(update) {
  const reservedProperties = Object.keys(this.getSchema().fields)
  const hasReservedFields = Object.keys(update).some(field => {
    if (field.indexOf(config.get('internalFieldsPrefix')) === 0) {
      return true
    }

    return Boolean(reservedProperties[field])
  })

  return !hasReservedFields
}

module.exports = new MediaModel()
