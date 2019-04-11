'use strict'

const config = require('./../../../config')
const Connection = require('./../model/connection')
const debug = require('debug')('api:search')
const natural = require('natural')
const promiseQueue = require('js-promise-queue')
const workQueue = require('./../workQueue')

const PAGE_SIZE = 100
const SCHEMA_SEARCH = {
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
const SCHEMA_WORDS = {
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

/**
 * Handles collection searching in API
 *
 * @constructor Search
 * @classdesc Indexes documents as they are inserted/updated, and performs
 *            search tasks.
 */
const Search = function (model) {
  if (!model || model.constructor.name !== 'Model') {
    throw new Error('model should be an instance of Model')
  }

  this.model = model
  this.indexableFields = this.getIndexableFields()
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
  const fields = Object.keys(this.indexableFields).map(key => {
    return {[key]: 1}
  })
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
 * Removes entries in the collection's search collection that match the
 * specified documents.
 *
 * @param {Array} documents - an array of documents for which to remove
 *                            word instances
 * @return {Promise} - Query to delete instances with matching document ids.
 */
Search.prototype.delete = function (documents) {
  if (!this.isImplemented() || !Array.isArray(documents)) {
    return Promise.resolve()
  }

  debug('Deleting documents from the %s index', this.indexCollection)

  const ids = documents.map(document => document._id.toString())

  return this.indexConnection.datastore.delete({
    collection: this.indexCollection,
    query: {
      document: {
        '$containsAny': ids
      }
    },
    schema: SCHEMA_WORDS.fields
  })
}

/**
 * Find documents in the "words" collection matching the specified searchTerm,
 * using the results of the query to fetch results from the current collection's
 * search collection, ultimately leading to a set of IDs for documents that
 * contain the searchTerm.
 *
 * @param {String} searchTerm - earch query passed to the collection search
 *                              endpoint
 * @return {Promise} - a query containing IDs of documents that contain the
 *                     searchTerm
 */
Search.prototype.find = function (searchTerm) {
  debug('find in %s: %s', this.indexCollection, searchTerm)

  const tokens = this.tokenise(searchTerm)

  return this.getWordsFromCollection(tokens).then(words => {
    const wordIds = words.results.map(word => word._id.toString())
    const searchArguments = {
      collection: this.indexCollection,
      options: {
        limit: PAGE_SIZE
      },
      schema: SCHEMA_WORDS.fields,
      settings: SCHEMA_WORDS.settings,
      words: wordIds
    }

    // If the data connector implements its own search method, we'll use it.
    if (typeof this.indexConnection.datastore.search === 'function') {
      return this.indexConnection.datastore.search(searchArguments)
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
 * Returns all fields from the current collection's schema that have a valid
 * search property.
 *
 * @return {Object} - an object whose keys are the index fields, the value of
 *                    which represents it's search rules
 *
 * ```json
 * { "title": { "weight": 2 } }
 * ```
 */
Search.prototype.getIndexableFields = function () {
  const {schema} = this.model
  const indexableFields = Object.keys(schema).filter(key => {
    return typeof schema[key] === 'object' &&
      schema[key].search &&
      !isNaN(schema[key].search.weight)
  })
  const fields = indexableFields.reduce((result, key) => {
    result[key] = schema[key].search

    return result
  }, {})

  return fields
}

/**
 * Process a document for indexing. For each indexable field, the value is
 * tokenised. Each word is then processed individually and a weight relative
 * to the entire document is calculated. The result is a Map that relates
 * words to their weight.
 *
 * @param   {Object} document
 * @returns {Map}
 */
Search.prototype.getWordsForDocument = function (document) {
  const documentWords = new Map()

  Object.keys(document).forEach(field => {
    // Ignore non-indexable fields.
    if (!this.indexableFields[field]) {
      return
    }

    // The `weight` property defined in the `search` block of the field
    // definition. Defaults to 1 if not defined.
    const {weight: fieldWeight = 1} = this.indexableFields[field]

    // We start by converting the field into an array of tokens.
    const tokens = this.tokenise(document[field])

    // `fieldWords` maps each token present in the field to the number of
    // times it occurs.
    const fieldWords = tokens.reduce((map, token) => {
      map.set(token, (map.get(token) || 0) + 1)

      return map
    }, new Map())

    fieldWords.forEach((occurrences, word) => {
      // The weight of a word in a document is calculated by running the
      // following formula on each indexable field and adding up the results.
      //
      // W = (O * FW) / L
      //
      // where:
      //
      // W = weight of a word in a field
      // O = number of occurrences of the word in the field
      // FW = weight of the field
      // L = total number of words in the field
      const weight = (occurrences * fieldWeight) / tokens.length

      documentWords.set(word, (documentWords.get(word) || 0) + weight)
    })
  })

  return documentWords
}

/**
 * Query the "words" collection for results that match any of the words
 * specified. If there are no results, re-query the collection using the
 * same set of words but each converted to a regular expression.
 *
 * @param {Array} words - an array of words extracted from the search term
 * @return {Promise} Query against the words collection.
 */
Search.prototype.getWordsFromCollection = function (words) {
  const {fields: schema, settings} = SCHEMA_WORDS
  const wordQuery = { word: { '$containsAny': words } }

  return this.wordConnection.datastore.find({
    query: wordQuery,
    collection: this.wordCollection,
    options: {},
    schema,
    settings
  }).then(response => {
    // Try a second pass with regular expressions.
    if (response.results.length === 0) {
      const regexWords = words.map(word => new RegExp(word))
      const regexQuery = { word: { '$containsAny': regexWords } }

      return this.wordConnection.datastore.find({
        collection: this.wordCollection,
        options: {},
        query: regexQuery,
        schema,
        settings
      })
    }

    return response
  })
}

/**
 * Index the specified document by inserting words from the indexable fields
 * into the "words" collection.
 *
 * @param {Object} document - a document to be indexed
 * @return {[type]}     [description]
 */
Search.prototype.indexDocument = function (document) {
  const wordsAndWeights = this.getWordsForDocument(document)
  const words = Array.from(wordsAndWeights.keys())

  // Look into the words collection to determine which of the document's words,
  // if any, already exist in the words collection. The ones that doesn't, must
  // be inserted.
  return this.getWordsFromCollection(words).then(({results: existingWords}) => {
    const newWords = words.filter(word => {
      return existingWords.every(result => result.word !== word)
    })
    const data = newWords.map(word => ({ word }))

    if (newWords.length > 0) {
      return this.wordConnection.datastore.insert({
        data,
        collection: this.wordCollection,
        options: {},
        schema: SCHEMA_WORDS.fields,
        settings: SCHEMA_WORDS.settings
      }).then(newWordEntries => {
        return existingWords.concat(newWordEntries)
      })
    }

    return existingWords
  }).then(wordEntries => {
    // We must now delete from the search collection any records that reference
    // this document, which is effectively "de-indexing" it.
    return this.indexConnection.datastore.delete({
      collection: this.indexCollection,
      query: {
        document: document._id
      },
      schema: SCHEMA_SEARCH.fields
    }).then(() => {
      return wordEntries
    })
  }).then(wordEntries => {
    // We're now ready to insert the results from processing the document into
    // the search collection. Entries will contain the ID of the document, the
    // ID of the word and its weight relative to the document.
    const data = wordEntries.map(({_id, word}) => {
      return {
        collection: this.model.name,
        document: document._id,
        weight: wordsAndWeights.get(word),
        word: _id
      }
    })

    return this.indexConnection.datastore.insert({
      data,
      collection: this.indexCollection,
      options: {},
      schema: SCHEMA_SEARCH.fields,
      settings: SCHEMA_SEARCH.settings
    })
  }).catch(err => {
    console.log(err)
  })
}

/**
 * Queues a set of documents for indexing as a background job (using the work
 * queue). An `original` parameter can be supplied with an array containing a
 * previous state of the documents, in which case the two states are compared
 * and a document will only be indexed when the value of at least one indexable
 * field has changed.
 *
 * @param  {Array} documents
 * @param  {Array} original
 */
Search.prototype.indexDocumentsInTheBackground = function ({
  documents,
  original
}) {
  if (!this.isImplemented()) return

  documents.forEach(document => {
    // If `original` is supplied, it means we're processing an update and we
    // need to ensure that at least one of the indexable fields has actually
    // changed, otherwise there's no point in re-indexing the document.
    if (original) {
      // We start by finding the entry for the original document in the array
      // of original documents.
      const originalDocument = original.find(({_id}) => {
        return _id === document._id
      })

      // We flag it as needing indexing if at least one of the indexable fields
      // has changed. If that is not the case, we move on to the next document.
      const needsIndexing = Object.keys(this.indexableFields).some(field => {
        return (originalDocument || {})[field] !== document[field]
      })

      if (!needsIndexing) {
        return
      }
    }

    workQueue.queueBackgroundJob(() => {
      this.indexDocument(document)
    })
  })
}

/**
 * Initialises the word and search collections.
 */
Search.prototype.initialise = function () {
  const searchDatabase = config.get('search.database')
  const searchDatastore = config.get('search.datastore')

  // Initialising index collection.
  this.indexCollection = config.get('search.indexCollection')
  this.indexConnection = Connection(
    {
      collection: this.indexCollection,
      database: searchDatabase,
      override: true
    },
    this.indexCollection,
    searchDatastore
  )
  this.indexConnection.setMaxListeners(35)
  this.indexConnection.once('connect', database => {
    database.index(this.indexCollection, SCHEMA_SEARCH.settings.index)
  })

  // Initialising words collection.
  this.wordCollection = config.get('search.wordCollection')
  this.wordConnection = Connection(
    {
      collection: this.wordCollection,
      database: searchDatabase,
      override: true
    },
    this.wordCollection,
    searchDatastore
  )
  this.wordConnection.setMaxListeners(35)
  this.wordConnection.once('connect', database => {
    database.index(this.wordCollection, SCHEMA_WORDS.settings.index)
  })
}

/**
 * Determines if searching is enabled for the current collection. Search is
 * available if:
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
  * @returns {Boolean} - boolean value indicating whether Search is enabled for
  *                      this collection
  */
Search.prototype.isImplemented = function () {
  return config.get('search.enabled') &&
    Object.keys(this.indexableFields).length > 0
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
        `Indexed ${results.length} records for ${this.model.name}`
      )

      return promiseQueue(results, this.indexDocument.bind(this), {
        interval: 300
      }).then(response => {
        debug(`Indexed page ${options.page}/${metadata.totalPages}`)

        if (options.page * options.limit < metadata.totalCount) {
          return this.batchIndex(options.page + 1, options.limit)
        }
      })
    }
  })
}

/**
 * Search for documents in the database. This is the default search function,
 * only used when the data connector being used doesn't implement its own.
 *
 * @param   {String} collection - the name of the collection to search
 * @param   {object} options - options to modify the query
 * @param   {Object} schema - the JSON schema for the collection
 * @param   {Object} settings - the JSON settings configuration for the
 *                              collection
 * @param   {Object|Array} words
 * @returns {Promise.<Array, Error>}
 */
Search.prototype.search = function ({
  collection,
  options = {},
  schema,
  settings,
  words
}) {
  return this.indexConnection.datastore.find({
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
/**
 * Converts a string query into a series of tokens.
 *
 * @param   {String} query
 * @returns {Array<String>}
 */
Search.prototype.tokenise = function (query) {
  const tokeniser = new natural.RegexpTokenizer({
    pattern: new RegExp(/[^a-zA-Z\u00C0-\u017F]/i)
  })

  return tokeniser.tokenize(query).map(word => {
    return word.toLowerCase()
  })
}

module.exports = Search
