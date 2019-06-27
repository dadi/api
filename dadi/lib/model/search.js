'use strict'

const config = require('./../../../config')
const Connection = require('./../model/connection')
const createMetadata = require('@dadi/metadata')
const debug = require('debug')('api:search')
const logger = require('@dadi/logger')
const natural = require('natural')
const promiseQueue = require('js-promise-queue')
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
        keys: {word: 1}
      },
      {
        keys: {document: 1}
      },
      {
        keys: {weight: 1}
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
    index: [
      {
        keys: {word: 1},
        options: {unique: true}
      }
    ]
  }
}

/**
 * Handles collection searching in API
 *
 * @constructor Search
 * @classdesc Indexes documents as they are inserted/updated, and performs
 *            search tasks.
 */
const Search = function() {}

/**
 * Indexes for search every document in the given collection.
 *
 * @param {Object} model
 */
Search.prototype.batchIndexCollection = function(
  model,
  {pageNumber = 1, pageSize = 1} = {}
) {
  const options = {
    limit: pageSize,
    skip: (pageNumber - 1) * pageSize
  }

  return model
    .find({
      options,
      query: {}
    })
    .then(({metadata, results}) => {
      const indexableFields = this.getIndexableFields(model.schema)
      const factoryFn = document => {
        return this.indexDocument({
          collection: model.name,
          document,
          indexableFields
        })
      }

      return promiseQueue(results, factoryFn, {interval: 20}).then(() => {
        if (pageNumber * pageSize < metadata.totalCount) {
          return this.batchIndexCollection(model, {
            pageNumber: pageNumber + 1
          })
        }
      })
    })
}

/**
 * Takes an array of models and indexes for search alls documents in the subset
 * of collections that have indexable fields.
 *
 * @param {Array} models
 */
Search.prototype.batchIndexCollections = function(models) {
  // We're only interested in models with at least one indexable field.
  const indexableModels = models.filter(model => {
    const fields = this.getIndexableFields(model.schema)

    return Object.keys(fields).length > 0
  })

  return promiseQueue(indexableModels, this.batchIndexCollection.bind(this), {
    interval: 100
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
Search.prototype.delete = function(documents) {
  if (!config.get('search.enabled') || !Array.isArray(documents)) {
    return Promise.resolve()
  }

  debug('Deleting documents from the %s index', this.indexCollection)

  const ids = documents.map(document => document._id.toString())

  return this.indexConnection.datastore.delete({
    collection: this.indexCollection,
    query: {
      document: {
        $containsAny: ids
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
 * @param  {Object}        client
 * @param  {Array<String>} collections
 * @param  {Object}        fields
 * @param  {String}        language
 * @param  {Function}      modelFactory
 * @param  {Number}        page
 * @param  {String}        query
 * @return {Promise} - a query containing IDs of documents that contain the
 *                     searchTerm
 */
Search.prototype.find = function({
  client,
  collections,
  fields,
  language,
  modelFactory,
  page,
  query
}) {
  debug('Search find in %s: %s', this.indexCollection, query)

  const tokens = this.tokenise(query)

  // Find matches for the various tokens in the words collection.
  return this.findWords(tokens, language)
    .then(words => {
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
    })
    .then(resultsMap => {
      const documents = new Map()

      const indexableFields = {}

      // We must retrieve all the documents using their respective models.
      const queue = Object.keys(resultsMap).map(collection => {
        const model = modelFactory(collection)

        if (!model) return undefined

        indexableFields[collection] =
          indexableFields[collection] || this.getIndexableFields(model.schema)

        const documentIds = Object.keys(resultsMap[collection])

        return model
          .get({
            client,
            language,
            query: {
              _id: {
                $containsAny: documentIds
              }
            }
          })
          .then(({results}) => {
            results.forEach(result => {
              documents.set(result._id, {
                collection,
                document: result,
                weight: resultsMap[collection][result._id]
              })
            })
          })
      })

      return Promise.all(queue)
        .then(() => {
          return this.runSecondPass({
            documents,
            indexableFields,
            page,
            query
          })
        })
        .then(results => {
          const metadata = createMetadata({page}, documents.size)

          // To ensure the search algorithm works effectively, it's not a good idea
          // to exclude from the results any fields up until this point. Now that
          // all the results have been computed, we must remove from the results
          // any fields that may have been excluded due to a fields projection sent
          // in the request.
          const filteredResults = results.map(document => {
            return this.formatDocumentForOutput(document, {fields})
          })

          return {
            results: filteredResults,
            metadata: Object.assign({}, metadata, {
              search: query
            })
          }
        })
    })
}

/**
 * Query the "words" collection for results that match any of the words
 * and the language specified. If there are no results, re-query the collection
 * using a more relaxed search criteria, converting each word to a "contains"
 * regular expression.
 *
 * @param  {Array}   words
 * @param  {String}  language
 * @return {Promise}
 */
Search.prototype.findWords = function(
  words,
  language = config.get('i18n.defaultLanguage')
) {
  const {fields: schema, settings} = SCHEMA_WORDS
  const wordPairs = words.map(word => `${word}:${language}`)
  const wordQuery = {
    word: {$containsAny: wordPairs}
  }

  return this.wordConnection.datastore
    .find({
      collection: this.wordCollection,
      options: {},
      query: wordQuery,
      schema,
      settings
    })
    .then(response => {
      // Try a second pass with regular expressions.
      if (response.results.length === 0) {
        const regexWords = words.map(word => {
          return new RegExp(`${word}(.*):${language}`)
        })
        const regexQuery = Object.assign({}, wordQuery, {
          word: {$containsAny: regexWords}
        })

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
 * Receives a document about to be returned as search results and formats it
 * for output, removing any fields that were excluded by a fields projection.
 *
 * @param  {Object} document
 * @param  {Object} fields
 */
Search.prototype.formatDocumentForOutput = function(document, {fields}) {
  const languageFieldCharacter = config.get('i18n.fieldCharacter')
  const hasFieldsProjection = Boolean(fields)
  const fieldsProjectionIsInclusive =
    hasFieldsProjection &&
    Object.keys(fields).find(field => fields[field] === 1)
  const idField = `${config.get('internalFieldsPrefix')}id`

  if (!hasFieldsProjection) return document

  return Object.keys(document).reduce((newDocument, fieldString) => {
    const [field] = fieldString.split(languageFieldCharacter)

    if (
      (fieldsProjectionIsInclusive && fields[field] === 1) ||
      (!fieldsProjectionIsInclusive && fields[field] !== 0) ||
      fieldString === idField
    ) {
      newDocument[fieldString] = document[fieldString]
    }

    return newDocument
  }, {})
}

/**
 * Takes a Map that links languages to a list of words. For each language,
 * it runs a query against the words collection to find whether a specific
 * word+language pair already exists. The result is a flattened array of
 * all word+language pairs found.
 *
 * @param  {Map}     wordsByLanguage
 * @return {Promise}
 */
Search.prototype.getExistingWords = function(wordsByLanguage) {
  const {fields: schema, settings} = SCHEMA_WORDS
  const queries = Array.from(wordsByLanguage.keys()).map(language => {
    const wordsArray = wordsByLanguage.get(language).map(word => {
      return `${word}:${language}`
    })

    return this.wordConnection.datastore.find({
      collection: this.wordCollection,
      options: {},
      query: {
        word: {$containsAny: wordsArray}
      },
      schema,
      settings
    })
  })

  return Promise.all(queries).then(responses => {
    return responses.reduce((words, response) => {
      return words.concat(response.results)
    }, [])
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
Search.prototype.getIndexableFields = function(schema) {
  const indexableFields = Object.keys(schema).filter(key => {
    return (
      typeof schema[key] === 'object' &&
      schema[key].search &&
      !isNaN(schema[key].search.weight)
    )
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
Search.prototype.getIndexResults = function({
  collections,
  options = {},
  schema,
  settings,
  words
}) {
  const query = {
    word: {
      $containsAny: words
    }
  }

  if (collections) {
    query.collection = {
      $containsAny: collections
    }
  }

  return this.indexConnection.datastore
    .find({
      collection: this.indexCollection,
      options: Object.assign({}, options, {
        sort: {
          weight: -1
        }
      }),
      query,
      schema,
      settings
    })
    .then(({results}) => {
      // This is a multi-level map. On the first level, keys are names of
      // collections. On the second level, keys are document IDs mapping
      // to the total weight of the corresponding document.
      const resultsMap = {}

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
 * to the entire document is calculated. The result is a two-level Map. The
 * first level contains language codes as keys. The second level maps words to
 * their weight.
 *
 * Example input:
 *
 * ```json
 * {"title": "hello world", "title:pt": "ola mundo"}
 * ```
 *
 * Example output:
 *
 * ```json
 * {
 *   "en": {
 *     "hello": 0.5,
 *     "world": 0.5
 *   },
 *   "pt": {
 *      "ola": 0.5,
 *      "mundo": 0.5
 *    }
 * }
 * ```
 *
 * @param   {Object} document
 * @returns {Map}
 */
Search.prototype.getWordsForDocument = function(document, indexableFields) {
  const documentWords = new Map()
  const defaultLanguage = config.get('i18n.defaultLanguage')
  const languageFieldCharacter = config.get('i18n.fieldCharacter')

  Object.keys(document).forEach(fieldString => {
    const [field, language = defaultLanguage] = fieldString.split(
      languageFieldCharacter
    )
    const value = document[fieldString]

    // Ignore non-indexable fields.
    if (!indexableFields[field] || typeof value !== 'string') {
      return
    }

    if (!documentWords.has(language)) {
      documentWords.set(language, new Map())
    }

    const languageWords = documentWords.get(language)

    // The `weight` property defined in the `search` block of the field
    // definition. Defaults to 1 if not defined.
    const {weight: fieldWeight = 1} = indexableFields[field]

    // We start by converting the field into an array of tokens.
    const tokens = this.tokenise(value)

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

      languageWords.set(word, (languageWords.get(word) || 0) + weight)
    })
  })

  return documentWords
}

/**
 * Index the specified document by inserting words from the indexable fields
 * into the "words" collection.
 *
 * @param {Object} document - a document to be indexed
 * @return {[type]}     [description]
 */
Search.prototype.indexDocument = function({
  collection,
  document,
  indexableFields
}) {
  const wordsAndWeightsByLanguage = this.getWordsForDocument(
    document,
    indexableFields
  )

  // A Map linking language codes to an array of words.
  //
  // Example:
  // {"en" => ["hello", "world"], "pt" => ["ola", "mundo"]}
  const wordsByLanguage = new Map()

  // An array containing word+language pairs, separated by a `:`.
  //
  // Example:
  // [{"language": "en", "word": "hello"}, {"language": "pt", "word": "ola"}]
  const wordPairs = []

  wordsAndWeightsByLanguage.forEach((wordsAndWeights, language) => {
    const wordsForLanguage = Array.from(wordsAndWeights.keys())

    wordsByLanguage.set(language, wordsForLanguage)

    wordsForLanguage.forEach(word => {
      wordPairs.push({language, word})
    })
  })

  // Look into the words collection to determine which of the document's words,
  // if any, already exist in the words collection. The ones that don't, must
  // be inserted.
  return this.getExistingWords(wordsByLanguage)
    .then(existingWords => {
      const newWords = wordPairs.filter(({language, word}) => {
        return existingWords.every(
          entry => entry.word !== `${word}:${language}`
        )
      })
      const data = newWords.map(({language, word}) => {
        return {word: `${word}:${language}`}
      })

      if (newWords.length > 0) {
        return this.wordConnection.datastore
          .insert({
            data,
            collection: this.wordCollection,
            options: {},
            schema: SCHEMA_WORDS.fields,
            settings: SCHEMA_WORDS.settings
          })
          .then(newWordEntries => {
            return existingWords.concat(newWordEntries)
          })
      }

      return existingWords
    })
    .then(wordEntries => {
      // We must now delete from the search collection any records that reference
      // this document, which is effectively "de-indexing" it.
      return this.indexConnection.datastore
        .delete({
          collection: this.indexCollection,
          query: {
            document: document._id
          },
          schema: SCHEMA_SEARCH.fields
        })
        .then(() => {
          return wordEntries
        })
    })
    .then(wordEntries => {
      // We're now ready to insert the results from processing the document into
      // the search collection. Entries will contain the ID of the document, the
      // ID of the word and its weight relative to the document.
      const data = wordEntries.map(({_id, word: wordPair}) => {
        const [word, language] = wordPair.split(':')

        return {
          collection,
          document: document._id,
          weight: wordsAndWeightsByLanguage.get(language).get(word),
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
    })
    .catch(error => {
      logger.error({module: 'search'}, error)
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
Search.prototype.indexDocumentsInTheBackground = function({
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
Search.prototype.initialise = function() {
  if (!config.get('search.enabled')) {
    return
  }

  const searchDatabase = config.get('search.database')

  // If there is a specific data connector specified for search, we'll use it.
  // Otherwise, we use the main data connector.
  const searchDatastore =
    config.get('search.datastore') || config.get('datastore')

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
 * Returns whether the search functionality is enabled for the API.
 *
 * @return {Boolean}
 */
Search.prototype.isEnabled = function() {
  return config.get('search.enabled')
}

/**
 * Takes a set of documents that match the search criteria and runs a second
 * pass in order to find the most relevant subset. It takes a pool of results
 * of up to POOL_SIZE documents and reduces it down to at most PAGE_SIZE. It
 * also takes care of paginating the results as per the `page` and `pageSize`
 * arguments.
 *
 * @param  {Array}  documents
 * @param  {Object} indexableFields
 * @param  {Number} page
 * @param  {Number} pageSize
 * @param  {String} query
 */
Search.prototype.runSecondPass = function({
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
      if (!document[field]) return weight

      const {distance} = natural.LevenshteinDistance(query, document[field], {
        search: true
      })
      const distanceFactor = 1 / (distance + 1)

      return weight + indexWeight * distanceFactor
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
Search.prototype.tokenise = function(query) {
  const tokeniser = new natural.RegexpTokenizer({
    pattern: new RegExp(/[^a-zA-Z\u00C0-\u017F]/i)
  })

  return tokeniser.tokenize(query).map(word => {
    return word.toLowerCase()
  })
}

module.exports = new Search()
