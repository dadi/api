'use strict'

const path = require('path')
const config = require(path.join(__dirname, '/../../../config'))
const Connection = require(path.join(__dirname, '/../model/connection'))
const debug = require('debug')('api:search')
const DataStore = require(path.join(__dirname, '../datastore'))
const promiseQueue = require('js-promise-queue')
const StandardAnalyser = require('./analysers/standard')
const DefaultAnalyser = StandardAnalyser
const pageLimit = 20

/**
 * Handles collection searching in API
 * @constructor Search
 * @classdesc Indexes documents as they are inserted/updated, and performs search tasks.
 * N.B. May only be used with the MongoDB Data Connector.
 */
const Search = function (model) {
  if (!model || model.constructor.name !== 'Model') {
    throw new Error('model should be an instance of Model')
  }

  this.model = model
  this.indexableFields = this.getIndexableFields()
  this.analyser = new DefaultAnalyser(this.indexableFields)
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
Search.prototype.canUse = function () {
  if (!config.get('search.enabled')) {
    return false
  }

  this.datastore = DataStore(config.get('search.datastore'))

  // Return true if there is at least one indexable field and the
  // selected data connector has a "search()" function
  return (typeof this.datastore.search !== 'undefined') &&
    Object.keys(this.indexableFields).length > 0
}

/**
 *
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
  let searchConfig = config.get('search')

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
 * Apply Index Listeners
 * Fires a call to the data controllers index method with the schemas index rules.
 */
 // TODO: this will change with @eduardo's Connection Recovery branch
Search.prototype.applyIndexListeners = function () {
  this.wordConnection.once('connect', database => {
    database.index(this.wordCollection, this.getWordSchema().settings.index)
  })

  this.searchConnection.once('connect', database => {
    database.index(this.searchCollection, this.getSearchSchema().settings.index)
  })
}

/**
 * Find documents in the "words" collection matching the specified searchTerm, using the results of the query
 * to fetch results from the current collection's search collection, ultimately leading to a set of IDs for documents
 * that contain the searchTerm
 *
 * @param {String} searchTerm - the search query passed to the collection search endpoint
 * @return {Promise} - resolves with a query containing IDs of documents that contain the searchTerm
 */
Search.prototype.find = function (searchTerm) {
  debug(this.canUse() ? 'search enabled' : 'search disabled')

  debug('find in %s: %s', this.searchCollection, searchTerm)

  let tokenized = this.analyser.tokenize(searchTerm)

  return this.getWords(tokenized).then(words => {
    let wordIds = words.results.map(word => word._id.toString())

    debug('searching %s for words %o', this.searchCollection, words.results.map(word => word.word))

    return this.searchConnection.datastore.search({
      words: wordIds,
      collection: this.searchCollection,
      schema: this.getSearchSchema().fields,
      settings: this.getSearchSchema().settings,
      opions: { limit: pageLimit }
    }).then(wordInstances => {
      wordInstances = wordInstances.map(instance => instance._id.document)

      return {
        _id: {
          '$containsAny': wordInstances
        }
      }
    })
  })
}

/**
 * Removes entries in the collection's search collection that match the specified documents
 * @param {Array} documents - an array of documents for which to remove word instances
 * @return {Promise} - Query to delete instances with matching document ids.
 */
Search.prototype.delete = function (documents) {
  if (!this.canUse() || !Array.isArray(documents)) {
    return Promise.resolve()
  }

  debug('deleting documents from the %s index', this.searchCollection)

  let deleteQueue = documents.map(document => {
    return this.clearDocumentInstances(document._id.toString())
  })

  return Promise.all(deleteQueue)
}

/**
 * Query the "words" collection for results that match any of the words specified. If there are no
 * results, re-query the collection using the same set of words but each converted to a regular expression
 *
 * @param {Array} words - an array of words extracted from the search term
 * @return {Promise} Query against the words collection.
 */
Search.prototype.getWords = function (words) {
  let wordQuery = { word: { '$containsAny': words } }

  return this.wordConnection.datastore.find({
    query: wordQuery,
    collection: this.wordCollection,
    options: {},
    schema: this.getWordSchema().fields,
    settings: this.getWordSchema().settings
  }).then(response => {
    // Try a second pass with regular expressions
    if (response.results.length === 0) {
      let regexWords = words.map(word => new RegExp(word))
      let regexQuery = { word: { '$containsAny': regexWords } }

      return this.wordConnection.datastore.find({
        query: regexQuery,
        collection: this.wordCollection,
        options: {},
        schema: this.getWordSchema().fields,
        settings: this.getWordSchema().settings
      })
    }

    return response
  })
}

/**
 * Searches the collection's "search" collection using the word ID to obtain document IDs for querying the main collection
 * The "words" argument should be similar to the following exampe:
 * ```
 * [ { _id: 59f2e4be2b58ff41a4f9c14b, word: 'quick' }, { _id: 59f2e4be2b58ff41a4f9c14c, word: 'brown' } ]
 * ```
 * @param {Array} words - an array of "word" result objects, each containing an ID that can be used to query the search collection
 * @returns {Promise.<Array, Error>} A Promise that returns an Array containing found instances of the specified words
 * ```
 * [
 *   {
 *     _id: {
 *       document: '59f2e8fb01eaec491579ff9d'
 *     },
 *     count: 2,
 *     weight: 1.2274112777602189
 *   }
 * ]
 * ```
 */
Search.prototype.getInstancesOfWords = function (words) {
  let ids = words.map(word => word._id.toString())

  return this.searchConnection.datastore.findInSearchIndex({
    documentIds: ids,
    collection: this.searchCollection,
    opions: { limit: pageLimit },
    schema: this.getSearchSchema().fields,
    settings: this.getSearchSchema().settings
  })
}

/**
 * Returns all fields from the current collction's schema that have a valid search property
 * @return {Object} - an object whose keys are the index fields, the value of which represents it's search rules
 * ```json
 * { title: { indexed: true, store: true, weight: 2 } }
 * ```
 */
Search.prototype.getIndexableFields = function () {
  let schema = this.model.schema

  let indexableFields = Object.keys(schema).filter(key => {
    return this.hasSearchField(schema[key])
  })

  let fields = {}

  indexableFields.forEach(key => {
    fields[key] = schema[key].search
  })

  return fields
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
 * Removes properties from the specified document that aren't configured to be indexed
 *
 * @param  {Object} document - a document to be indexed
 * @return {Object} the specified document with non-indexable properties removed
 */
Search.prototype.removeNonIndexableFields = function (document) {
  if (typeof document !== 'object') return {}

  // set of languages configured for API, so we can keep translation fields
  // in the document for indexing
  let supportedLanguages = config.get('i18n.languages')
  let fieldSeparator = config.get('i18n.fieldCharacter')

  let indexableFields = Object.keys(document).filter(key => {
    if (key.indexOf(fieldSeparator) > 0) {
      let keyParts = key.split(fieldSeparator)
      return this.indexableFields[keyParts[0]] && supportedLanguages.includes(keyParts[1])
    } else {
      return this.indexableFields[key]
    }
  })

  let sanitisedDocument = {}

  indexableFields.forEach(key => {
    sanitisedDocument[key] = document[key]
  })

  return sanitisedDocument
}

/**
 * Index the specified documents
 * @param {Array} documents - an array of documents to be indexed
 * @return {Promise} - Queries to index documents.
 */
Search.prototype.index = function (documents) {
  if (!this.canUse() || !Array.isArray(documents)) {
    return Promise.resolve()
  }

  promiseQueue(documents, this.indexDocument.bind(this), {
    interval: 300
  })
}

/**
 * Index the specified document by inserting words from the indexable fields into the
 * "words" collection
 *
 * @param {Object} document - a document to be indexed
 * @return {[type]}     [description]
 */
Search.prototype.indexDocument = function (document) {
  let reducedDocument = this.removeNonIndexableFields(document)
  let words = this.analyseDocumentWords(reducedDocument)
  let uniqueWords

  return this.getWords(words).then(existingWords => {
    if (existingWords.results.length) {
      uniqueWords = words.filter(word => {
        return existingWords.results.every(result => result.word !== word)
      })
    } else {
      uniqueWords = words
    }

    let data = this.formatInsertQuery(uniqueWords)

    if (!uniqueWords.length) {
      return this.clearAndInsertWordInstances(words, document._id.toString())
    }

    // insert unique words into the words collection
    return this.wordConnection.datastore.insert({
      data: data,
      collection: this.wordCollection,
      options: {},
      schema: this.getWordSchema().fields,
      settings: this.getWordSchema().settings
    }).then(response => {
      return this.clearAndInsertWordInstances(words, document._id.toString())
    }).catch(err => {
      console.log(err)
    })
  })
}

/**
 * Analyse Document Words
 * Pass all words to an instance of analyser and return all words.
 * @param  {Object} doc A document from the database, with non-indexable fields removed.
 * @return {Array} A list of analysed words.
 */
Search.prototype.analyseDocumentWords = function (doc) {
  // add the document to the analyser index
  Object.keys(doc).map(key => {
    this.analyser.add(key, doc[key])
  })

  // add the document to a fresh analyser instance so we can get only the
  // indexable words from THIS DOCUMENT
  let analyser = new DefaultAnalyser(this.indexableFields)

  Object.keys(doc).map(key => {
    analyser.add(key, doc[key])
  })

  // return indexable words from THIS DOCUMENT only
  return analyser.getAllWords()
}

/**
 * Formats the specified words for inserting into the database
 *
 * @param  {Array} words - an array of words
 * @return {Array} - an array of objects in the format `{ word: <the array item> }`
 */
Search.prototype.formatInsertQuery = function (words) {
  return words.map(word => {
    return { word }
  })
}

/**
 * Find all words that exist in the current version of a document, removes all indexed words relating to a specific document, and finally insert new word instances
 * @param  {Array} words - an array of words matching document word list.
 * @param  {Class} analyser - an analyser
 * @param  {String} docId - the current document ID
 * @return {Promise} Chained word query, document instance delete and document instance insert.
 */
Search.prototype.clearAndInsertWordInstances = function (words, docId) {
  // The word index is unique, so results aren't always returned.
  // Fetch word entries again to get ids.
  let query = {
    word: {
      '$containsAny': words
    }
  }

  return this.wordConnection.datastore.find({
    query,
    collection: this.wordCollection,
    options: {},
    schema: this.getWordSchema().fields,
    settings: this.getWordSchema().settings
  }).then(results => {
    // Get all word instances from Analyser
    return this.clearDocumentInstances(docId).then(response => {
      if (response.deletedCount) {
        debug('Removed %s documents from the %s index', response.deletedCount, this.searchCollection)
      }

      return this.insertWordInstances(results.results, docId)
    })
  })
  .catch(err => {
    console.log(err)
  })
}

/**
 * Insert Document word instances.
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

  let data = instances.map(instance => {
    let word = words.find(wordResult => wordResult.word === instance.word)._id.toString()

    return Object.assign(instance, {word, document: docId})
  })

  // Insert word instances into search collection.
  this.searchConnection.datastore.insert({
    data: data,
    collection: this.searchCollection,
    options: {},
    schema: this.getSearchSchema().fields,
    settings: this.getSearchSchema().settings
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
    query: { document: docId },
    collection: this.searchCollection,
    schema: this.getSearchSchema().fields
  })
}

/**
 * Index an entire collection, in batches of documents
 *
 * @param  {Number} page - the current page of documents to process
 * @param  {Number} limit - the number of documents to process
 */
Search.prototype.batchIndex = function (page = 1, limit = 1000) {
  if (!Object.keys(this.indexableFields).length) return

  let skip = (page - 1) * limit

  let fields = Object.assign({}, ...Object.keys(this.indexableFields).map(key => {
    return {[key]: 1}
  }))

  let options = {
    skip,
    page,
    limit,
    fields
  }

  debug(`Indexing page ${page} (${limit} per page)`)
  console.log(`Indexing page ${page} (${limit} per page)`)

  if (this.model.connection.db) {
    this.runBatchIndex(options)
  }

  this.model.connection.once('connect', database => {
    this.runBatchIndex(options)
  })
}

/**
 * Run Batch Index
 * Performs indexing across an entire collection.
 * @param  {Object} options find query options.
 */
Search.prototype.runBatchIndex = function (options) {
  this.model.connection.datastore.find({
    query: {},
    collection: this.model.name,
    options: options,
    schema: this.model.schema,
    settings: this.model.settings
  }).then(({metadata, results}) => {
    if (results && results.length) {
      debug(`Indexed ${results.length} ${results.length === 1 ? 'record' : 'records'} for ${this.model.name}`)

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
 * Return the template for the "words" collection schema, used to create the database collection
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
 * Return the template for the current collection's "search" collection schema, used to create the database collection
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

module.exports = Search
