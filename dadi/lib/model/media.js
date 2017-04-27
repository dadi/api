var MEDIA_SCHEMA = {
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
    mimetype: {
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
    type: 'media'
  }
}

// At some point we'll return a different schema based on MIME type, but for
// now we hardcode this one.
module.exports.getSchema = function (type) {
  return MEDIA_SCHEMA
}
