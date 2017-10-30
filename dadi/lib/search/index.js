'use strict'

const path = require('path')
const config = require(path.join(__dirname, '/../../../config'))
const Connection = require(path.join(__dirname, '/../model/connection'))
const StandardAnalyser = require('./analysers/standard')
const DefaultAnalyser = StandardAnalyser
const allowedDatastores = ['@dadi/api-mongodb']
const pageLimit = 20

/**
 * Handles collection searching in API
 * @constructor Search
 * @classdesc Indexes documents as they are inserted/updated, and performs search tasks.
 * N.B. May only be used with the MongoDB Data Connector.
 */
const Search = function (model) {
  if (!model || model.constructor.name !== 'Model') throw new Error('model should be an instance of Model')

  this.model = model
  this.indexableFields = this.getIndexableFields()
}

/**
 * Determines if searching is enabled for the current collection. Search is available
 * if the main configuration setting of "enabled" is "true", and if the current collection
 * schema contains at least one indexable field. An indexable field is one that has the following
 * configuration:
 *
 * ```json
 * "search": {
 *   "weight": 2
 * }
 * ```
 * @returns {Boolean} - boolean value indicating whether Search is enabled for this collection
 */
Search.prototype.canUse = function () {
  const searchConfig = config.get('search')
  const indexfieldCount = Object.keys(this.indexableFields || {}).length

  let canUse = searchConfig.enabled &&
  indexfieldCount > 0 &&
  allowedDatastores.includes(searchConfig.datastore)

  return canUse
}

/**
 *
 */
Search.prototype.init = function () {
  this.wordCollection = config.get('search.wordCollection')
  this.searchCollection = this.model.searchCollection || this.model.name + 'Search'

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
      database: searchConfig.database,
      collection: this.wordCollection,
      override: true
    },
    this.wordCollection,
    searchConfig.datastore
  )

  this.searchConnection = Connection(
    {
      database: searchConfig.database,
      collection: this.searchCollection,
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
 * @return {Promise} - resolves with a MongoDB query containing IDs of documents that contain the searchTerm
 */
Search.prototype.find = function (searchTerm) {
  if (!this.canUse()) return {}

  try {
    const analyser = new DefaultAnalyser(this.indexableFields)
    const tokenized = analyser.tokenize(searchTerm)

    return this.getWords(tokenized).then(words => {
      return this.getInstancesOfWords(words.results).then(instances => {
        const ids = instances.map(instance => instance._id.document)
        return { _id: { '$in': ids } }
      })
    })
  } catch (err) {
    console.log(err)
  }
}

/**
 * Removes entries in the collection's search collection that match the specified documents
 * @param {Array} docs - an array of documents for which to remove word instances
 * @return {Promise} - Query to delete instances with matching document ids.
 */
Search.prototype.delete = function (docs) {
  if (!this.canUse()) return Promise.resolve()

  if (!Array.isArray(docs)) return

  const deleteQueue = docs
    .map(doc => this.clearDocumentInstances(doc._id.toString()))

  return Promise.all(deleteQueue)
}

/**
 * Query the "words" collection for results that maych any of the words specified. If there are no
 * results, re-query the collection using the same set of words but each converted to a regular expression
 *
 * @param {Array} words - an array of words extracted from the search term
 * @return {Promise} Query against the words collection.
 */
Search.prototype.getWords = function (words) {
  const wordQuery = { word: { '$in': words } }

  return this.runFind(
    this.wordConnection.db,
    wordQuery,
    this.wordCollection,
    this.getWordSchema().fields
  ).then(response => {
    // Try a second pass with regular expressions
    if (!response.length) {
      const regexWords = words.map(word => new RegExp(word))
      const regexQuery = { word: { '$in': regexWords } }

      return this.runFind(this.wordConnection.db, regexQuery, this.wordCollection, this.getWordSchema().fields)
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
  const ids = words.map(word => word._id.toString())

  // construct an aggregation query for MongoDB
  const query = [
    {
      $match: {
        word: {
          $in: ids
        }
      }
    },
    {
      $group: {
        _id: { document: '$document' },
        count: { $sum: 1 },
        weight: { $sum: '$weight' }
      }
    },
    {
      $sort: {
        weight: -1
      }
    },
    { $limit: pageLimit }
  ]

  return this.runFind(this.searchConnection.db, query, this.searchCollection, this.getSearchSchema().fields)
}

/**
 * Returns all fields from the current collction's schema that have a valid search property
 * @return {Object} - an object whose keys are the index fields, the value of which represents it's search rules
 * ```json
 * { title: { indexed: true, store: true, weight: 2 } }
 * ```
 */
Search.prototype.getIndexableFields = function () {
  const schema = this.model.schema

  return Object.assign({}, ...Object.keys(schema)
    .filter(key => this.hasSearchField(schema[key]))
    .map(key => {
      return {[key]: schema[key].search}
    }))
}

/**
 * Determine if the specified collection schema field has a valid search property
 * @param {Object} field - a collection schema field object
 * @return {Boolean} - `true` if the field has a valid search property
 */
Search.prototype.hasSearchField = function (field) {
  return typeof field === 'object' &&
    field.search &&
    !isNaN(field.search.weight)
}

/**
 * Removes properties from the specified document that aren't configured to be indexed
 *
 * @param  {Object} doc - a document to be indexed
 * @return {Object} - the specified document with non-indexable properties removed
 */
Search.prototype.removeNonIndexableFields = function (doc) {
  if (typeof doc !== 'object') return {}

  return Object.assign({}, ...Object.keys(doc)
    .filter(key => this.indexableFields[key])
    .map(key => {
      return {[key]: doc[key]}
    }))
}

/**
 * Index the specified documents
 * @param {Array} docs - an array of documents to be indexed
 * @return {Promise} - Queries to index documents.
 */
Search.prototype.index = function (docs) {
  if (!this.canUse() || !Array.isArray(docs)) return Promise.resolve()

  return Promise.all(docs.map(doc => this.indexDocument(doc)))
}

/**
 * Index the specified document, inserting words from the indexable fields into the
  * "words" collection
 * @param {Object} doc - a document to be indexed
 * @return {[type]}     [description]
 */
Search.prototype.indexDocument = function (doc) {
  const analyser = new DefaultAnalyser(this.indexableFields)
  const reducedDoc = this.removeNonIndexableFields(doc)
  const words = this.analyseDocumentWords(analyser, reducedDoc)
  const wordInsert = this.createWordInstanceInsertQuery(words)

  // insert unique words into the words collection
  return this.insert(
    this.wordConnection.db,
    wordInsert,
    this.wordCollection,
    this.getWordSchema().fields,
    { ordered: false }
  )
  .then(res => {
    return this.clearAndInsertWordInstances(words, analyser, doc._id.toString())
  })
  .catch(err => {
    // code `11000` returns if the word already exists, continue regardless
    if (err.code === 11000) {
      return this.clearAndInsertWordInstances(words, analyser, doc._id.toString())
    }
  })
}

/**
 * Analyse Document Words
 * Pass all words to an instance of analyser and return all words.
 * @param  {Object} doc A document from the database, with non-indexable fields removed.
 * @return {Array} A list of analysed words.
 */
Search.prototype.analyseDocumentWords = function (analyserInstance, doc) {
  // Analyse each field
  Object.keys(doc)
    .map(key => {
      analyserInstance.add(key, doc[key])
    })

  return analyserInstance.getAllWords()
}

/**
 * Formats the specified words for inserting into the database
 *
 * @param  {Array} words - an array of words
 * @return {Array} - an array of objects in the format `{ word: <the array item> }`
 */
Search.prototype.createWordInstanceInsertQuery = function (words) {
  return words.map(word => {
    return {word}
  })
}

/**
 * Find all words that exist in the current version of a document, removes all indexed words relating to a specific document, and finally insert new word instances
 * @param  {Array} words - an array of words matching document word list.
 * @param  {Class} analyser - an analyser
 * @param  {String} docId - the current document ID
 * @return {Promise} Chained word query, document instance delete and document instance insert.
 */
Search.prototype.clearAndInsertWordInstances = function (words, analyser, docId) {
  // The word index is unique, so results aren't always returned.
  // Fetch word entries again to get ids.
  const query = { word: { '$in': words } }

  return this.runFind(
    this.wordConnection.db,
    query,
    this.wordCollection,
    this.getWordSchema().fields
  ).then(results => {
    // Get all word instances from Analyser
    this.clearDocumentInstances(docId).then(response => {
      if (response.deletedCount) {
        // console.log(`Cleared ${response.deletedCount} documents`)
      }

      this.insertWordInstances(analyser, results.results, docId)
    })
  })
  .catch(err => {
    console.log(err)
  })
}

/**
 * Insert Word Instance
 * Insert Document word instances.
 * @param  {Class} analyser Instance of document populated analyser class.
 * @param  {[type]} words Results from database query for word list.
 * @param  {String} docId Current document ID.
 * @return {Promise} Insert query for document word instances.
 */
Search.prototype.insertWordInstances = function (analyser, words, docId) {
  const instances = analyser.getWordInstances()

  if (!instances) return

  const doc = instances
    .filter(instance => words.find(wordResult => wordResult.word === instance.word))
    .map(instance => {
      const word = words.find(wordResult => wordResult.word === instance.word)._id.toString()

      return Object.assign(instance, {word, document: docId})
    })

  // Insert word instances into search collection.
  this.insert(this.searchConnection.db, doc, this.searchCollection, this.getSearchSchema().fields)
}

/**
 * Run Find
 * Executes find method on database
 * @param {Connection} database Instance of database connection.
 * @param {Object} query Query object filter.
 * @param {String} collection Name of collection to query.
 * @param {Object} schema Field schema for collection.
 * @param {Object} options Query options.
 * @return {Promise} Database find query.
 */
Search.prototype.runFind = function (database, query, collection, schema, options = {}) {
  return database.find({query, collection, options, schema})
}

/**
 * Remove entries in the collection's search collection that match the specified document ID
 *
 * @param  {String} docId - the document ID to remove word instances for
 * @return {Promise} - Database delete query.
 */
Search.prototype.clearDocumentInstances = function (docId) {
  const query = {document: docId}
  return this.searchConnection.db.delete({query, collection: this.searchCollection, schema: this.getSearchSchema().fields})
}

/**
 * Insert documents into the database
 *
 * @param {Connection} database - the database connection
 * @param {Object|Array} data - the data to insert into the database
 * @param {String} collection - the name of the collection to insert into
 * @param {Object} schema - the collection schema
 * @param {Object} options - options to use in the query
 * @return {Promise}
 */
Search.prototype.insert = function (database, data, collection, schema, options = {}) {
  if (!data.length) return Promise.resolve()
  return database.insert({data, collection, options, schema})
}

/**
 * Index an entire collection, in batches of documents
 *
 * @param  {Number} page - the current page of documents to process
 * @param  {Number} limit - the number of documents to process
 */
Search.prototype.batchIndex = function (page = 1, limit = 1000) {
  if (!Object.keys(this.indexableFields).length) return

  const skip = (page - 1) * limit
  console.log(`Start indexing page ${page} (${limit} per page)`)

  const fields = Object.assign({}, ...Object.keys(this.indexableFields).map(key => {
    return {[key]: 1}
  }))

  const options = {
    skip,
    page,
    limit,
    fields
  }

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
  this.runFind(
    this.model.connection.db,
    {},
    this.model.name,
    this.model.schema,
    options
  ).then(results => {
    if (results.results && results.results.length > 0) {
      this.index(results.results).then(response => {
        console.log(`Indexed page ${options.page}/${results.metadata.totalPages}`)

        if (options.page * options.limit < results.metadata.totalCount) {
          return this.batchIndex(options.page + 1, options.limit)
        } else {
          console.log(`Indexed ${results.results.length} records for ${this.model.name}`)
        }
      })
    } else {
      console.log(`Indexed ${results.results.length} records for ${this.model.name}`)
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
