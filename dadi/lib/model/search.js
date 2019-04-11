'use strict'

const config = require('./../../../config')
const Connection = require('./../model/connection')
const createMetadata = require('@dadi/metadata')
const debug = require('debug')('api:search')
const natural = require('natural')
// const promiseQueue = require('js-promise-queue')
const workQueue = require('./../workQueue')

const PAGE_SIZE = 10
const POOL_SIZE = 100
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
const Search = function () {
  this.initialise()
}

/**
 * Index an entire collection, in batches of documents.
 *
 * @param  {Number} page - the current page of documents to process
 * @param  {Number} limit - the number of documents to process
 */
// Search.prototype.batchIndex = function (page = 1, limit = 1000) {
//   if (!Object.keys(this.indexableFields).length) return

//   const skip = (page - 1) * limit
//   const fields = Object.keys(this.indexableFields).map(key => {
//     return {[key]: 1}
//   })
//   const options = {
//     fields,
//     limit,
//     page,
//     skip
//   }

//   debug(`Indexing page ${page} (${limit} per page)`)

//   if (this.model.connection.db) {
//     this.runBatchIndex(options)
//   }

//   this.model.connection.once('connect', database => {
//     this.runBatchIndex(options)
//   })
// }

/**
 * Removes entries in the collection's search collection that match the
 * specified documents.
 *
 * @param {Array} documents - an array of documents for which to remove
 *                            word instances
 * @return {Promise} - Query to delete instances with matching document ids.
 */
Search.prototype.delete = function (documents) {
  if (!config.get('search.enabled') || !Array.isArray(documents)) {
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
 * Search for documents in the collections specified in the `collections` array
 * that match the terms specified in the `query` term. It expects a `modelFactory`
 * function, which is essentially `dadi/lib/model/index.js`. The only reason it is
 * required as a parameter is to get around circular dependencies. Pagination can
 * be done by supplying a `page` parameter.
 *
 * @param  {Array<String>} collections
 * @param  {Function}      modelFactory
 * @param  {Number}        page
 * @param  {String}        query
 * @return {Promise} - a query containing IDs of documents that contain the
 *                     searchTerm
 */
Search.prototype.find = function ({
  collections,
  modelFactory,
  page,
  query
}) {
  debug('find in %s: %s', this.indexCollection, query)

  const tokens = this.tokenise(query)

  // Find matches for the various tokens in the words collection.
  return this.getWordsFromCollection(tokens).then(words => {
    const wordIds = words.results.map(word => word._id.toString())

    // Find matches for the word IDs in the search index collection,
    // limiting the results to the collections specified.
    return this.getIndexResults({
      collections,
      options: {
        limit: POOL_SIZE
      },
      schema: SCHEMA_WORDS.fields,
      settings: SCHEMA_WORDS.settings,
      words: wordIds
    })
  }).then(resultsMap => {
    const documents = new Map()

    let indexableFields = {}

    // We must retrieve all the documents using their respective models.
    const queue = Object.keys(resultsMap).map(collection => {
      const model = modelFactory(collection)

      if (!model) return

      indexableFields[collection] = indexableFields[collection] ||
        this.getIndexableFields(model.schema)

      const documentIds = Object.keys(resultsMap[collection])

      return model.find({
        query: {
          _id: {
            $containsAny: documentIds
          }
        }
      }).then(({results}) => {
        results.forEach(result => {
          documents.set(result._id, {
            collection,
            document: result,
            weight: resultsMap[collection][result._id]
          })
        })
      })
    })

    return Promise.all(queue).then(() => {
      return this.runSecondPass({
        documents,
        indexableFields,
        page,
        query
      })
    }).then(results => {
      const metadata = createMetadata({page}, documents.size)

      return {
        results,
        metadata: Object.assign({}, metadata, {
          search: query
        })
      }
    })
  })
}

/**
 * Returns all fields from the current collection's schema that have a valid
 * search property.
 *
 * @param  {Object} - the collection schema
 * @return {Object} - an object whose keys are the index fields, the value of
 *                    which represents it's search rules
 *
 * ```json
 * { "title": { "weight": 2 } }
 * ```
 */
Search.prototype.getIndexableFields = function (schema) {
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
 * Search for documents in the index collection that contain references
 * to a list of words.
 *
 * @param   {String} collection - the name of the collection to search
 * @param   {object} options - options to modify the query
 * @param   {Object} schema - the JSON schema for the collection
 * @param   {Object} settings - the JSON settings configuration for the
 *                              collection
 * @param   {Object|Array} words
 * @returns {Promise.<Array, Error>}
 */
Search.prototype.getIndexResults = function ({
  collections,
  options = {},
  schema,
  settings,
  words
}) {
  let query = {
    word: {
      '$containsAny': words
    }
  }

  if (collections) {
    query.collection = {
      '$containsAny': collections
    }
  }

  return this.indexConnection.datastore.find({
    collection: this.indexCollection,
    options: Object.assign({}, options, {
      sort: {
        weight: -1
      }
    }),
    query,
    schema,
    settings
  }).then(({results}) => {
    // This is a multi-level map. On the first level, keys are names of
    // collections. On the second level, keys are document IDs mapping
    // to the total weight of the corresponding document.
    let resultsMap = {}

    results.forEach(({collection, document, weight}) => {
      resultsMap[collection] = resultsMap[collection] || {}
      resultsMap[collection][document] = resultsMap[collection][document] || 0
      resultsMap[collection][document] += weight
    })

    return resultsMap
  })
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
Search.prototype.getWordsForDocument = function (document, indexableFields) {
  const documentWords = new Map()

  Object.keys(document).forEach(field => {
    // Ignore non-indexable fields.
    if (!indexableFields[field]) {
      return
    }

    // The `weight` property defined in the `search` block of the field
    // definition. Defaults to 1 if not defined.
    const {weight: fieldWeight = 1} = indexableFields[field]

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
Search.prototype.indexDocument = function ({
  collection,
  document,
  indexableFields
}) {
  const wordsAndWeights = this.getWordsForDocument(document, indexableFields)
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
        collection,
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
  model,
  original
}) {
  if (!config.get('search.enabled')) return

  const indexableFields = this.getIndexableFields(model.schema)

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
      const needsIndexing = Object.keys(indexableFields).some(field => {
        return (originalDocument || {})[field] !== document[field]
      })

      if (!needsIndexing) {
        return
      }
    }

    workQueue.queueBackgroundJob(() => {
      this.indexDocument({
        collection: model.name,
        document,
        indexableFields
      })
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
 * Performs indexing across an entire collection.
 *
 * @param  {Object} options find query options.
 */
// Search.prototype.runBatchIndex = function (options) {
//   this.model.connection.datastore.find({
//     collection: this.model.name,
//     options: options,
//     query: {},
//     schema: this.model.schema,
//     settings: this.model.settings
//   }).then(({metadata, results}) => {
//     if (results && results.length) {
//       debug(
//         `Indexed ${results.length} records for ${this.model.name}`
//       )

//       return promiseQueue(results, this.indexDocument.bind(this), {
//         interval: 300
//       }).then(response => {
//         debug(`Indexed page ${options.page}/${metadata.totalPages}`)

//         if (options.page * options.limit < metadata.totalCount) {
//           return this.batchIndex(options.page + 1, options.limit)
//         }
//       })
//     }
//   })
// }

Search.prototype.runSecondPass = function ({
  documents,
  indexableFields,
  page = 1,
  pageSize = PAGE_SIZE,
  query
}) {
  const weights = new Map()

  // The weight of a field is calculated by:
  //
  // 1) Computing the Levenshtein distance between the field value and the
  //    search term (LD);
  // 2) Calculating the distance factor (1 / LD + 1);
  // 3) Multiplying the distance factor by the indexing weight (IW) of the
  //    document;
  //
  // The weight of a document is calculated by adding up the weights of all
  // the indexable fields (IW).
  documents.forEach(({collection, document, weight: indexWeight}) => {
    const fields = indexableFields[collection]
    const weight = Object.keys(fields).reduce((weight, field) => {
      const {distance} = natural.LevenshteinDistance(query, document[field], {
        search: true
      })
      const distanceFactor = 1 / (distance + 1)

      return weight + (indexWeight * distanceFactor)
    }, 0)

    weights.set(document._id, weight)
  })

  const offset = (page - 1) * pageSize

  return Array.from(documents.values())
    .map(({collection, document}) => {
      return Object.assign({}, document, {
        _collection: collection,
        _searchRelevance: weights.get(document._id)
      })
    })
    .sort((a, b) => {
      const weightA = weights.get(a._id)
      const weightB = weights.get(b._id)

      if (weightA === weightB) return 0

      return weightA < weightB ? 1 : -1
    })
    .slice(offset, offset + pageSize)
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

module.exports = new Search()
