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

  const connection = Connection(
    {
      collection: name,
      database
    },
    name,
    config.get('datastore')
  )

  this.connection = connection.whenConnected()
}

/**
 * Stores a version of a document.
 *
 * @param {Array<Object>} documents           Documents to add
 * @param {String}        options.description Optional message describing the operation
 */
History.prototype.addVersion = async function(documents, {description}) {
  const database = await this.connection
  const versions = documents.map(document => {
    const version = Object.assign({}, document, {
      _document: document._id
    })

    delete version._id

    if (typeof description === 'string' && description.length > 0) {
      version._changeDescription = description
    }

    return version
  })

  return database.insert({
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
History.prototype.getVersion = async function(version, options = {}) {
  try {
    const database = await this.connection
    const {metadata, results} = await database.find({
      collection: this.name,
      options,
      query: {
        _id: version
      }
    })

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
  } catch (error) {
    logger.error({module: 'history'}, error)

    return {
      results: []
    }
  }
}

/**
 * Gets all versions available for a given document.
 *
 * @param  {String}         documentId
 * @return {Array<Object>}
 */
History.prototype.getVersions = async function(documentId) {
  const database = await this.connection

  return database.find({
    collection: this.name,
    options: {
      fields: {
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
