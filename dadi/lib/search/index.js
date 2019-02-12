'use strict'

const config = require('./../../../config')
const Connection = require('./../model/connection')
const debug = require('debug')('api:search')
const promiseQueue = require('js-promise-queue')
const StandardAnalyser = require('./analysers/standard')

const PAGE_SIZE = 100

/**
 * Handles collection searching in API
 *
 * @constructor Search
 * @classdesc Indexes documents as they are inserted/updated, and performs search tasks.
 */
const Search = function (model) {
  if (!model || model.constructor.name !== 'Model') {
    throw new Error('model should be an instance of Model')
  }

  this.model = model
  this.indexableFields = this.getIndexableFields()
  this.analyser = new StandardAnalyser(this.indexableFields)
}

/**
 * Pass all words to an instance of analyser and return all words.
 *
 * @param  {Object} doc A document from the database, with non-indexable fields removed.
 * @return {Array} A list of analysed words.
 */
Search.prototype.analyseDocumentWords = function (doc) {
  // Add the document to the analyser index.
  Object.keys(doc).map(key => {
    this.analyser.add(key, doc[key])
  })

  // Add the document to a fresh analyser instance so we can get only the
  // indexable words from THIS DOCUMENT.
  const analyser = new StandardAnalyser(this.indexableFields)

  Object.keys(doc).map(key => {
    analyser.add(key, doc[key])
  })

  // Return indexable words from THIS DOCUMENT only.
  return analyser.getAllWords()
}

/**
 * Fires a call to the data controllers index method with the schemas index rules.
 */
Search.prototype.applyIndexListeners = function () {
  this.wordConnection.once('connect', database => {
    database.index(this.wordCollection, this.getWordSchema().settings.index)
  })

  this.searchConnection.once('connect', database => {
    database.index(this.searchCollection, this.getSearchSchema().settings.index)
  })
}

/**
 * Index an entire collection, in batches of documents.
 *
 * @param  {Number} page - the current page of documents to process
 * @param  {Number} limit - the number of documents to process
 */
Search.prototype.batchIndex = function (page = 1, limit = 1000) {
  if (!Object.keys(this.indexableFields).length) return

  const skip = (page - 1) * limit
  const fields = Object.assign({}, ...Object.keys(this.indexableFields).map(key => {
    return {[key]: 1}
  }))
  const options = {
    fields,
    limit,
    page,
    skip
  }

  debug(`Indexing page ${page} (${limit} per page)`)

  if (this.model.connection.db) {
    this.runBatchIndex(options)
  }

  this.model.connection.once('connect', database => {
    this.runBatchIndex(options)
  })
}

/**
 * Find all words that exist in the current version of a document, removes all
 * indexed words relating to a specific document, and finally insert new word
 * instances.
 *
 * @param  {Array} words - an array of words matching document word list.
 * @param  {Class} analyser - an analyser
 * @param  {String} docId - the current document ID
 * @return {Promise} Chained word query, document instance delete and document instance insert.
 */
Search.prototype.clearAndInsertWordInstances = function (words, docId) {
  // The word index is unique, so results aren't always returned.
  // Fetch word entries again to get ids.
  const query = {
    word: {
      '$containsAny': words
    }
  }
  const {fields: schema, settings} = this.getWordSchema()

  return this.wordConnection.datastore.find({
    collection: this.wordCollection,
    options: {},
    query,
    schema,
    settings
  }).then(results => {
    // Get all word instances from Analyser
    return this.clearDocumentInstances(docId).then(response => {
      if (response.deletedCount > 0) {
        debug(
          'Removed %s documents from the %s index',
          response.deletedCount,
          this.searchCollection
        )
      }

      return this.insertWordInstances(results.results, docId)
    })
  })
  .catch(err => {
    console.log(err)
  })
}

/**
 * Remove entries in the collection's search collection that match the specified document ID
 *
 * @param  {String} docId - the document ID to remove word instances for
 * @return {Promise} - Database delete query.
 */
Search.prototype.clearDocumentInstances = function (docId) {
  return this.searchConnection.datastore.delete({
    collection: this.searchCollection,
    query: { document: docId },
    schema: this.getSearchSchema().fields
  })
}

/**
 * Removes entries in the collection's search collection that match the specified documents
 * @param {Array} documents - an array of documents for which to remove word instances
 * @return {Promise} - Query to delete instances with matching document ids.
 */
Search.prototype.delete = function (documents) {
  if (!this.isImplemented() || !Array.isArray(documents)) {
    return Promise.resolve()
  }

  debug('Deleting documents from the %s index', this.searchCollection)

  const deleteQueue = documents.map(document => {
    return this.clearDocumentInstances(document._id.toString())
  })

  return Promise.all(deleteQueue)
}

/**
 * Find documents in the "words" collection matching the specified searchTerm,
 * using the results of the query to fetch results from the current collection's
 * search collection, ultimately leading to a set of IDs for documents that
 * contain the searchTerm.
 *
 * @param {String} searchTerm - earch query passed to the collection search endpoint
 * @return {Promise} - a query containing IDs of documents that contain the searchTerm
 */
Search.prototype.find = function (searchTerm) {
  debug('find in %s: %s', this.searchCollection, searchTerm)

  const {fields: schema, settings} = this.getWordSchema()
  const tokenized = this.analyser.tokenize(searchTerm)

  return this.getWords(tokenized).then(words => {
    const wordIds = words.results.map(word => word._id.toString())
    const searchArguments = {
      collection: this.searchCollection,
      options: {
        limit: PAGE_SIZE
      },
      schema,
      settings,
      words: wordIds
    }

    // If the data connector implements its own search method, we'll use it.
    if (typeof this.searchConnection.datastore.search === 'function') {
      return this.searchConnection.datastore.search(searchArguments)
    }

    // We're here because the data connector doesn't implement its own search
    // method, so we'll use the default one.
    return this.search(searchArguments)
  }).then(wordInstances => {
    const ids = wordInstances.map(instance => instance._id.document)

    return {
      _id: {
        '$containsAny': ids
      }
    }
  })
}

/**
 * Formats the specified words for inserting into the database
 *
 * @param  {Array} words - an array of words
 * @return {Array} - an array of objects in the format `{ word: <the array item> }`
 */
Search.prototype.formatInsertQuery = function (words) {
  return words.map(word => ({ word }))
}

/**
 * Returns all fields from the current collction's schema that have a valid search property
 * @return {Object} - an object whose keys are the index fields, the value of which represents it's search rules
 * ```json
 * { title: { indexed: true, store: true, weight: 2 } }
 * ```
 */
Search.prototype.getIndexableFields = function () {
  const {schema} = this.model
  const indexableFields = Object.keys(schema).filter(key => {
    return this.hasSearchField(schema[key])
  })
  const fields = indexableFields.reduce((result, key) => {
    result[key] = schema[key].search

    return result
  }, {})

  return fields
}

/**
 * Return the template for the current collection's "search" collection
 * schema, used to create the database collection.
 *
 * @return {Object} - the collection schema for the "search" collection
 */
Search.prototype.getSearchSchema = function () {
  return {
    fields: {
      word: {
        type: 'Reference',
        required: true
      },
      document: {
        type: 'Reference',
        required: true
      },
      weight: {
        type: 'Number',
        required: true
      }
    },
    settings: {
      cache: true,
      index: [
        {
          keys: { word: 1 }
        },
        {
          keys: { document: 1 }
        },
        {
          keys: { weight: 1 }
        }
      ]
    }
  }
}

/**
 * Query the "words" collection for results that match any of the words specified. If there are no
 * results, re-query the collection using the same set of words but each converted to a regular expression
 *
 * @param {Array} words - an array of words extracted from the search term
 * @return {Promise} Query against the words collection.
 */
Search.prototype.getWords = function (words) {
  const wordQuery = { word: { '$containsAny': words } }

  return this.wordConnection.datastore.find({
    query: wordQuery,
    collection: this.wordCollection,
    options: {},
    schema: this.getWordSchema().fields,
    settings: this.getWordSchema().settings
  }).then(response => {
    // Try a second pass with regular expressions
    if (response.results.length === 0) {
      const regexWords = words.map(word => new RegExp(word))
      const regexQuery = { word: { '$containsAny': regexWords } }

      return this.wordConnection.datastore.find({
        collection: this.wordCollection,
        options: {},
        query: regexQuery,
        schema: this.getWordSchema().fields,
        settings: this.getWordSchema().settings
      })
    }

    return response
  })
}

/**
 * Return the template for the "words" collection schema, used to
 * create the database collection.
 *
 * @return {Object} - the collection schema for the "words" collection
 */
Search.prototype.getWordSchema = function () {
  return {
    fields: {
      word: {
        type: 'String',
        required: true
      }
    },
    settings: {
      cache: true,
      index: [{
        keys: { word: 1 },
        options: { unique: true }
      }]
    }
  }
}

/**
 * Determine if the specified collection schema field has a valid search property
 * @param {Object} field - a collection schema field object
 * @return {Boolean} `true` if the field has a valid search property
 */
Search.prototype.hasSearchField = function (field) {
  return typeof field === 'object' &&
    field.search &&
    !isNaN(field.search.weight)
}

/**
 * Index the specified documents.
 *
 * @param {Array} documents - an array of documents to be indexed
 * @return {Promise} - Queries to index documents.
 */
Search.prototype.index = function (documents) {
  if (!this.isImplemented() || !Array.isArray(documents)) {
    return Promise.resolve()
  }

  promiseQueue(documents, this.indexDocument.bind(this), {
    interval: 300
  })
}

/**
 * Index the specified document by inserting words from the indexable fields into the
 * "words" collection.
 *
 * @param {Object} document - a document to be indexed
 * @return {[type]}     [description]
 */
Search.prototype.indexDocument = function (document) {
  const {fields: schema, settings} = this.getWordSchema()
  const reducedDocument = this.removeNonIndexableFields(document)
  const words = this.analyseDocumentWords(reducedDocument)

  let uniqueWords

  return this.getWords(words).then(existingWords => {
    if (existingWords.results.length > 0) {
      uniqueWords = words.filter(word => {
        return existingWords.results.every(result => result.word !== word)
      })
    } else {
      uniqueWords = words
    }

    const data = this.formatInsertQuery(uniqueWords)

    if (!uniqueWords.length) {
      return this.clearAndInsertWordInstances(words, document._id.toString())
    }

    // Insert unique words into the words collection.
    return this.wordConnection.datastore.insert({
      data,
      collection: this.wordCollection,
      options: {},
      schema,
      settings
    }).then(response => {
      return this.clearAndInsertWordInstances(words, document._id.toString())
    }).catch(err => {
      console.log(err)
    })
  })
}

/**
 * Initialises the word and search collections.
 */
Search.prototype.init = function () {
  this.wordCollection = config.get('search.wordCollection')
  this.searchCollection = this.model.searchCollection || this.model.name + 'Search'

  debug('initialised wordCollection: %s, indexCollection: %s', this.wordCollection, this.searchCollection)

  this.initialiseConnections()
  this.applyIndexListeners()
}

/**
 * Initialise connections to the `word` database collection and the current collection's
 * `search` database collection - typically the collection name with "Search" appended.
 */
Search.prototype.initialiseConnections = function () {
  const searchConfig = config.get('search')

  this.wordConnection = Connection(
    {
      collection: this.wordCollection,
      database: searchConfig.database,
      override: true
    },
    this.wordCollection,
    searchConfig.datastore
  )

  this.searchConnection = Connection(
    {
      collection: this.searchCollection,
      database: searchConfig.database,
      override: true
    },
    this.searchCollection,
    searchConfig.datastore
  )

  this.wordConnection.setMaxListeners(35)
  this.searchConnection.setMaxListeners(35)
}

/**
 * Insert document word instances.
 *
 * @param  {Class} analyser Instance of document populated analyser class.
 * @param  {[type]} words Results from database query for word list.
 * @param  {String} docId Current document ID.
 * @return {Promise} Insert query for document word instances.
 */
Search.prototype.insertWordInstances = function (words, docId) {
  let instances = this.analyser.getWordInstances()

  if (!instances) return

  instances = instances.filter(instance => {
    return words.find(wordResult => {
      return wordResult.word === instance.word
    })
  })

  const {fields: schema, settings} = this.getWordSchema()
  const data = instances.map(instance => {
    const word = words.find(wordResult => {
      return wordResult.word === instance.word
    })._id.toString()

    return Object.assign(instance, {word, document: docId})
  })

  // Insert word instances into search collection.
  this.searchConnection.datastore.insert({
    data,
    collection: this.searchCollection,
    options: {},
    schema,
    settings
  })
}

/**
 * Determines if searching is enabled for the current collection. Search is available if:
 *  - the configured DataStore allows it,
 *  - the main configuration setting of "enabled" is "true", and
 *  - the current collection schema contains at least one indexable field.
 *
 * An indexable field has the following configuration:
 *
 * ```json
 * "search": {
  *   "weight": 2
  * }
  * ```
  * @returns {Boolean} - boolean value indicating whether Search is enabled for this collection
  */
Search.prototype.isImplemented = function () {
  return config.get('search.enabled') &&
    Object.keys(this.indexableFields).length > 0
}

/**
 * Removes properties from the specified document that aren't configured to be indexed
 *
 * @param  {Object} document - a document to be indexed
 * @return {Object} the specified document with non-indexable properties removed
 */
Search.prototype.removeNonIndexableFields = function (document) {
  if (typeof document !== 'object') return {}

  // Set of languages configured for API, so we can keep translation fields
  // in the document for indexing.
  const supportedLanguages = config.get('i18n.languages')
  const fieldSeparator = config.get('i18n.fieldCharacter')
  const indexableFields = Object.keys(document).filter(key => {
    if (key.indexOf(fieldSeparator) > 0) {
      const keyParts = key.split(fieldSeparator)

      return this.indexableFields[keyParts[0]] &&
        supportedLanguages.includes(keyParts[1])
    }

    return this.indexableFields[key]
  })
  const sanitisedDocument = indexableFields.reduce((result, key) => {
    result[key] = document[key]

    return result
  }, {})

  return sanitisedDocument
}

/**
 * Performs indexing across an entire collection.
 *
 * @param  {Object} options find query options.
 */
Search.prototype.runBatchIndex = function (options) {
  this.model.connection.datastore.find({
    collection: this.model.name,
    options: options,
    query: {},
    schema: this.model.schema,
    settings: this.model.settings
  }).then(({metadata, results}) => {
    if (results && results.length) {
      debug(
        `Indexed ${results.length} ${results.length === 1 ? 'record' : 'records'} for ${this.model.name}`
      )

      if (results.length > 0) {
        this.index(results).then(response => {
          debug(`Indexed page ${options.page}/${metadata.totalPages}`)

          if (options.page * options.limit < metadata.totalCount) {
            return this.batchIndex(options.page + 1, options.limit)
          }
        })
      }
    }
  })
}

/**
 * Search for documents in the database. This is the default search function,
 * only used when the data connector being used doesn't implement its own.
 *
 * @param {string} collection - the name of the collection to search
 * @param {object} options - options to modify the query
 * @param {Object} schema - the JSON schema for the collection
 * @param {Object} settings - the JSON settings configuration for the collection
 * @param {Object|Array} words -
 * @returns {Promise.<Array, Error>}
 */
Search.prototype.search = function ({
  collection,
  options = {},
  schema,
  settings,
  words
}) {
  return this.searchConnection.datastore.find({
    collection,
    options: Object.assign({}, options, {
      sort: {
        weight: -1
      }
    }),
    query: {
      word: {
        '$containsAny': words
      }
    },
    schema,
    settings
  }).then(({results}) => {
    return results.map(({document, weight, word}) => ({
      document,
      weight,
      word
    }))
  }).then(results => {
    const matches = results.reduce((groups, document) => {
      const key = document.document

      groups[key] = groups[key] || {
        count: 0,
        weight: 0
      }

      groups[key].count++
      groups[key].weight = groups[key].weight + document.weight

      return groups
    }, {})

    const output = Object.keys(matches).map(match => {
      return {
        _id: {
          document: match
        },
        count: matches[match].count,
        weight: matches[match].weight
      }
    })

    output.sort((a, b) => {
      if (a.weight === b.weight) return 0

      return a.weight < b.weight ? 1 : -1
    })

    return output
  })
}

module.exports = Search
