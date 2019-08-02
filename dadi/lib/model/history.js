const config = require('./../../../config')
const Connection = require('./connection')
const logger = require('@dadi/logger')

/**
 * Document history manager.
 *
 * @param {String} options.database Name of the database
 * @param {String} options.name     Name of the collection
 */
const History = function({database, name}) {
  this.name = name
  this.connection = Connection(
    {
      collection: name,
      database
    },
    name,
    config.get('datastore')
  )
}

/**
 * Stores a version of a document as a diff.
 *
 * @param {Array<Object>} documents           Documents to add
 * @param {String}        options.author      The client ID that generated the version
 * @param {String}        options.date The timestamp of the change
 * @param {String}        options.description Optional message describing the operation
 */
History.prototype.addVersion = function(
  documents,
  {author, date, description}
) {
  const versions = documents.map(document => {
    const version = Object.assign({}, document, {
      _author: author,
      _date: date,
      _document: document._id
    })

    delete version._id

    if (typeof description === 'string' && description.length > 0) {
      version._changeDescription = description
    }

    return version
  })

  return this.connection.db.insert({
    data: versions,
    collection: this.name
  })
}

/**
 * Returns a previous version of a given document.
 *
 * @param  {String} version  ID of a previous version
 * @return {Object}
 */
History.prototype.getVersion = function(version, options = {}) {
  return this.connection.db
    .find({
      collection: this.name,
      options,
      query: {
        _id: version
      }
    })
    .then(({metadata, results}) => {
      return {
        results: results.map(result => {
          return Object.assign({}, result, {
            _id: result._document,
            _document: undefined
          })
        }),
        metadata: Object.assign({}, metadata, {
          version
        })
      }
    })
    .catch(error => {
      logger.error({module: 'history'}, error)

      return {
        results: []
      }
    })
}

/**
 * Gets all versions available for a given document.
 *
 * @param  {String}         documentId
 * @return {Array<Object>}
 */
History.prototype.getVersions = function(documentId) {
  return this.connection.db.find({
    collection: this.name,
    options: {
      fields: {
        _author: 1,
        _date: 1,
        _document: 1,
        _changeDescription: 1
      }
    },
    query: {
      _document: documentId
    }
  })
}

module.exports = History
