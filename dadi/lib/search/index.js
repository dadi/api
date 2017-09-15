'use strict'

const path = require('path')
const config = require(path.join(__dirname, '/../../../config'))
const Connection = require(path.join(__dirname, '/../model/connection'))
const StandardAnalyser = require('./analysers/standard')

const DefaultAnalyser = StandardAnalyser

const allowedDatastores = ['@dadi/api-mongodb']

const pageLimit = 20

const Search = function (model) {
  if (!this.canUse()) return this

  if (!model || model.constructor.name !== 'Model') throw new Error('model should be an instance of Model')

  this.model = model
  this.wordCollection = config.get('search.wordCollection')
  this.searchCollection = this.model.searchCollection || this.model.name + 'Search'
  this.indexableFields = this.getIndexableFields()

  this.initialiseConnections()
  this.applyIndexListeners()

  return this
}

Search.prototype.canUse = function () {
  return config.get('search.enabled') &&
    allowedDatastores.includes(config.get('search.datastore'))
}

/**
 * Initialise Connections
 * Creates a connection to the word database.
 * Creates a connection to the models search collection.
 */
Search.prototype.initialiseConnections = function () {
  const database = config.get('search.database')

  this.wordConnection = Connection(
    {
      database,
      collection: this.wordCollection,
      override: true
    },
    this.wordCollection,
    config.get('search.datastore')
  )
  this.searchConnection = Connection(
    {
      database,
      collection: this.searchCollection,
      override: true
    },
    this.searchCollection,
    config.get('search.datastore')
  )
  this.wordConnection.setMaxListeners(35)
  this.searchConnection.setMaxListeners(35)
}

/**
 * Apply Index Listeners
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
 * Find
 * @param {String} searchTerm Search query.
 * @return {Promise} Resolves with a query to be used against document collection.
 */
Search.prototype.find = function (searchTerm) {
  if (!this.canUse()) return {}

  const analyser = new DefaultAnalyser(this.indexableFields)
  const tokenized = analyser.tokenize(searchTerm)

  return this.getWords(tokenized)
    .then(words => {
      return this.getInstancesOfWords(words.results)
        .then(instances => {
          const ids = instances.map(instance => instance._id.document)

          return {_id: {'$in': ids}}
        })
    })
}

/**
 * Get Words
 * @param {Array} words list of word strings.
 * @return {Promise} Query against the words collection.
 */
Search.prototype.getWords = function (words) {
  const query = {word: {'$in': words}}

  return this.runFind(this.wordConnection.db, query, this.wordCollection, this.getWordSchema().fields)
    .then(response => {
      // Try a second pass with regular expressions
      if (!response.length) {
        const regexWords = words.map(word => new RegExp(word))
        const regexQuery = {word: {'$in': regexWords}}

        return this.runFind(this.wordConnection.db, regexQuery, this.wordCollection, this.getWordSchema().fields)
      }
      return response
    })
}

/**
 * Get Instance of Words
 * @param {Array} words List of word ids to be queried against search collection.
 * @return {Promise} Query against the search collection.
 */
Search.prototype.getInstancesOfWords = function (words) {
  const ids = words.map(word => word._id.toString())

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
        _id: {document: '$document'},
        count: {$sum: 1},
        weight: {$sum: '$weight'}
      }
    },
    {
      $sort: {
        weight: -1
      }
    },
    {$limit: pageLimit}
  ]

  return this.runFind(this.searchConnection.db, query, this.searchCollection, this.getSearchSchema().fields)
}

/**
 * Get Word Schema
 * @return {Object} The schema to define the words collection.
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
        keys: {
          word: 1
        },
        options: {
          unique: true
        }
      }]
    }
  }
}

/**
 * Get Search Schema
 * @return {Object} The schema to define the search collection.
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
          keys: {
            word: 1
          }
        },
        {
          keys: {
            document: 1
          }
        },
        {
          keys: {
            weight: 1
          }
        }
      ]
    }
  }
}

/**
 * Delete
 * @param {Array} docs List of documents.
 * @return {Promise} Query to delete instances with matching document ids.
 */
Search.prototype.delete = function (docs) {
  if (!this.canUse()) return Promise.resolve()

  if (!Array.isArray(docs)) return
  const deleteQueue = docs
    .map(doc => this.clearDocumentInstances(doc._id.toString()))

  return Promise.all(deleteQueue)
}

/**
 * Index
 * @param {Array} docs List of documents.
 * @return {Promise} Queries to index documents.
 */
Search.prototype.index = function (docs) {
  if (!this.canUse() || !Array.isArray(docs)) return Promise.resolve()

  return Promise.all(docs.map(doc => this.indexDocument(doc)))
}

/**
 * Get Indexable Field
 * @return {Object} A key value representation of the field name its search rules.
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
 * Has Search Fields
 * @param {Object} field schema field object.
 * @return {Boolean} The field is a valid search field.
 */
Search.prototype.hasSearchField = function (field) {
  return typeof field === 'object' &&
    field.search &&
    !isNaN(field.search.weight)
}

/**
 * Remove Non-Indexable Fields
 * Reduce the document to fields that exist in this controllers indexable fields Object.
 * @param  {Object} doc A document from the database.
 * @return {Object} The document with non-indexable fields removed.
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
 * Index Document
 * @param {Object} doc A document from the database.
 * @return {[type]}     [description]
 */
Search.prototype.indexDocument = function (doc) {
  const analyser = new DefaultAnalyser(this.indexableFields)
  const reducedDoc = this.removeNonIndexableFields(doc)
  const words = this.analyseDocumentWords(analyser, reducedDoc)
  const wordInsert = this.createWordInstanceInsertQuery(words)
  // Insert unique words into word collection.
  return this.insert(
    this.wordConnection.db,
    wordInsert,
    this.wordCollection,
    this.getWordSchema().fields,
    {
      ordered: false
    }
  )
  .then(res => {
    return this.clearAndInsertWordInstances(words, analyser, doc._id.toString())
  })
  .catch(err => {
    // Code `11000` returns if the word already exists.
    // Continue regardless.
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
 * Create Word Instance Insert Query
 * Format word instances for insertion.
 * @param  {Array} words A list of words.
 * @return {Array} A formatted list of words.
 */
Search.prototype.createWordInstanceInsertQuery = function (words) {
  return words.map(word => {
    return {word}
  })
}

/**
 * Clear and Insert Word Instances
 * Finds all words that exist in current version of a document.
 * Removes all instances relating to a specific document.
 * Insert new word instances.
 * @param  {Array} words List of words matching document word list.
 * @param  {Class} analyser Instance of document populated analyser class.
 * @param  {String} docId Current document ID.
 * @return {Promise} Chained word query, document instance delete and document instance insert.
 */
Search.prototype.clearAndInsertWordInstances = function (words, analyser, docId) {
  // The word index is unique, so results aren't always returned.
  // Fetch word entries again to get ids.
  const query = {word: {'$in': words}}
  return this.runFind(this.wordConnection.db, query, this.wordCollection, this.getWordSchema().fields)
    .then(result => {
      // Get all word instances from Analyser.
      this.clearDocumentInstances(docId)
        .then(res => {
          if (res.deletedCount) console.log(`Cleared ${res.deletedCount} documents`)
          this.insertWordInstances(analyser, result.results, docId)
        })
    })
    .catch(e => {
      console.log(e)
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
  const instances = analyser
    .getWordInstances()

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
 * Clear Document Instances
 * Remove all instance entries for a given document.
 * @param  {String} docId Current document ID.
 * @return {Promise} Database delete query.
 */
Search.prototype.clearDocumentInstances = function (docId) {
  const query = {document: docId}

  return this.searchConnection.db.delete({query, collection: this.searchCollection, schema: this.getSearchSchema().fields})
}

/**
 * [insert description]
 * @param {Connection} database Instance of database connection.
 * @param  {Object/Array} data Insert payload.
 * @param {String} collection Name of collection to query.
 * @param {Object} schema Field schema for collection.
 * @param {Object} options Query options.
 * @return {Promise} Database insert query.
 */
Search.prototype.insert = function (database, data, collection, schema, options = {}) {
  if (!data.length) return Promise.resolve()
  return database.insert({data, collection, options, schema})
}

/**
 * Batch Index
 * Performs indexing across an entire collection.
 * @param  {Number} page Current page offset.
 * @param  {Number} limit Query limit.
 */
Search.prototype.batchIndex = function (page = 1, limit = 1000) {
  const skip = (page - 1) * limit
  console.log(`Start indexing page ${page} (${limit} per page)`)

  if (!Object.keys(this.indexableFields).length) return

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
  this.runFind(this.model.connection.db, {}, this.model.name, this.model.schema, options)
  .then(res => {
    this.index(res.results)
      .then(resp => {
        console.log(`Indexed page ${options.page}/${res.metadata.totalPages}`)
        if (options.page * options.limit < res.metadata.totalCount) {
          return this.batchIndex(options.page + 1, options.limit)
        } else {
          console.log(`Indexed ${res.results.length} records for ${this.model.name}`)
        }
      })
  })
}

module.exports = function (model) {
  return new Search(model)
}

module.exports.Search = Search
