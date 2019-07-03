const COLLECTIONS = {
  'library/book': {
    fields: {
      title: {
        type: 'String',
        required: true
      },
      author: {
        type: 'Reference',
        settings: {
          collection: 'person',
          fields: ['name', 'spouse']
        }
      },
      booksInSeries: {
        type: 'Reference',
        settings: {
          collection: 'book',
          multiple: true
        }
      }
    },
    settings: {
      cache: false,
      authenticate: true,
      count: 40
    }
  },

  'library/person': {
    fields: {
      name: {
        type: 'String',
        required: true
      },
      occupation: {
        type: 'String',
        required: false
      },
      nationality: {
        type: 'String',
        required: false
      },
      education: {
        type: 'String',
        required: false
      },
      spouse: {
        type: 'Reference'
      }
    },
    settings: {
      cache: false,
      authenticate: true,
      count: 40,
      lastModifiedAt: 1496029984536
    }
  },

  'testdb/test-schema': {
    fields: {
      field1: {
        type: 'String',
        label: 'Title',
        comments: 'The title of the entry',
        validation: {},
        required: false
      },
      title: {
        type: 'String',
        label: 'Title',
        comments: 'The title of the entry',
        validation: {},
        required: false,
        search: {
          weight: 2
        }
      },
      leadImage: {
        type: 'Media'
      },
      leadImageJPEG: {
        type: 'Media',
        validation: {
          mimeTypes: ['image/jpeg']
        }
      },
      legacyImage: {
        type: 'Reference',
        settings: {
          collection: 'mediaStore'
        }
      },
      fieldReference: {
        type: 'Reference',
        settings: {
          collection: 'test-reference-schema'
        }
      }
    },
    settings: {
      cache: true,
      cacheTTL: 300,
      authenticate: true,
      count: 40,
      sortOrder: 1,
      storeRevisions: true,
      revisionCollection: 'testSchemaHistory'
    }
  }
}

module.exports = {
  ...COLLECTIONS,

  'testdb/test-schema-authenticate-false': {
    ...COLLECTIONS['testdb/test-schema'],
    settings: {
      ...COLLECTIONS['testdb/test-schema'].settings,
      authenticate: false
    }
  }
}
