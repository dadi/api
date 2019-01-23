const config = require('./../../../config')
const Connection = require('./connection')
const diffMatchPatch = require('diff-match-patch')
const jsonDiff = require('json0-ot-diff')
const otJson = require('ot-json0')

/**
 * Document history manager.
 *
 * @param {String} options.database Name of the database
 * @param {String} options.name     Name of the collection
 */
const History = function ({database, name}) {
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
 * @param {String}        options.description An optional message describing the operation
 * @param {Array<Object>} options.initial     Original document
 * @param {Array<Object>} options.modified    Modified document
 */
History.prototype.addVersion = function ({description, initial, modified = []}) {
  let versions = initial.map(initialDocument => {
    let modifiedDocument = modified.find(modifiedDocument => {
      return modifiedDocument._id === initialDocument._id
    }) || {}
    let version = {
      _document: initialDocument._id,
      _createdAt: Date.now(),
      _diff: this.getDiff(initialDocument, modifiedDocument)
    }

    if (typeof description === 'string') {
      version._description = description
    }

    return version
  })

  return this.connection.db.insert({
    data: versions,
    collection: this.name
  })
}

/**
 * Computes a diff object between two documents.
 *
 * @param  {Object} initial  Original document
 * @param  {Object} modified Modified document
 * @return {Object}          Diff object
 */
History.prototype.getDiff = function (initial, modified) {
  return jsonDiff(initial, modified, diffMatchPatch)
}

/**
 * Gets all versions available for a given document.
 *
 * @param  {String}         documentId
 * @return {Array<Object>}
 */
History.prototype.getVersions = function (documentId) {
  return this.connection.db.find({
    collection: this.name,
    options: {
      fields: {
        _createdAt: 1,
        _document: 1,
        _description: 1
      }
    },
    query: {
      _document: documentId
    }
  })
}

/**
 * Rolls back a given document to a previous version, by taking all the diffs
 * that came after it and applying them to the current state of the document.
 *
 * @param  {Object} document Current state of the document
 * @param  {String} version  ID of a previous version
 * @return {Object}
 */
History.prototype.rollback = function (document, version) {
  return this.connection.db.find({
    collection: this.name,
    options: {
      fields: {
        _createdAt: 1
      }
    },
    query: {
      _id: version
    }
  }).then(({results: versions}) => {
    if (versions.length === 0) {
      throw new Error('Invalid document version')
    }

    let timestamp = versions[0]._createdAt

    return this.connection.db.find({
      collection: this.name,
      options: {
        fields: {
          _diff: 1
        },
        sort: {
          _createdAt: -1
        }
      },
      query: {
        _createdAt: {
          $gte: timestamp
        }
      }
    }).then(({results: versions}) => {
      // Because we're working backwards from the latest state of the document,
      // we must invert the diffs before applying them.
      let diffs = versions.map(version => otJson.type.invert(version._diff))

      return diffs.reduce((result, diff) => {
        return otJson.type.apply(result, diff)
      }, document)
    })
  })
}

module.exports = History
