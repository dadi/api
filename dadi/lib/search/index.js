'use strict'

const path = require('path')
const config = require(path.join(__dirname, '/../../../config'))
const Connection = require(path.join(__dirname, '/../model/connection'))
const StandardAnalyser = require('./analysers/standard')

const DefaultAnalyser = StandardAnalyser

const pageLimit = 20

const Search = function (model) {
  this.words = []
  const database = config.get('search.database')
  this.model = model
  this.wordCollection = config.get('search.wordCollection')
  this.searchCollection = this.model.searchCollection || this.model.name + 'Search'
  this.indexableFields = this.getIndexableFields()

  this.wordConnection = Connection({database, collection: this.wordCollection, override: true}, this.wordCollection, config.get('search.datastore'))
  this.searchConnection = Connection({database, collection: this.searchCollection, override: true}, this.searchCollection, config.get('search.datastore'))

  this.applyIndexListeners()

  return this
}

Search.prototype.applyIndexListeners = function () {
  this.wordConnection.once('connect', database => {
    database.index(this.wordCollection, this.getWordSchema().settings.index)
  })
  this.searchConnection.once('connect', database => {
    database.index(this.searchCollection, this.getSearchSchema().settings.index)
  })
}

Search.prototype.getIndexableFields = function () {
  const schema = this.model.schema

  return Object.assign({}, ...Object.keys(schema)
    .filter(key => this.hasSearchField(schema[key]))
    .map(key => {
      return {[key]: schema[key].search}
    }))
}

Search.prototype.hasSearchField = function (field) {
  return field.search && !isNaN(field.search.weight)
}

Search.prototype.find = function (searchTerm) {
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

Search.prototype.getInstancesOfWords = function (words) {
  const ids = words.map(word => word._id)

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

  return this.runFind(this.searchConnection.db, query, this.searchCollection, this.getSearchSchema())
}

Search.prototype.getWords = function (words) {
  const query = {word: {'$in': words}}

  return this.runFind(this.wordConnection.db, query, this.wordCollection, this.getWordSchema())
    .then(response => {
      // Try a second pass with regular expressions
      if (!response.length) {
        const regexWords = words.map(word => new RegExp(word))
        const regexQuery = {word: {'$in': regexWords}}

        return this.runFind(this.wordConnection.db, regexQuery, this.wordCollection, this.getWordSchema())
      }
      return response
    })
}

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

Search.prototype.delete = function (docs) {
  const deleteQueue = docs
    .map(doc => this.clearDocumentInstances(doc._id))

  return Promise.all(deleteQueue)
}

Search.prototype.index = function (docs) {
  return Promise.all(docs.map(doc => this.indexDocument(doc)))
}

Search.prototype.reduceDocumentFields = function (doc) {
  return Object.assign({}, ...Object.keys(doc)
    .filter(key => this.indexableFields[key])
    .map(key => {
      return {[key]: doc[key]}
    }))
}

Search.prototype.indexDocument = function (doc) {
  const fields = this.reduceDocumentFields(doc)
  const analyser = new DefaultAnalyser(this.indexableFields)

  Object.keys(fields)
    .map(key => {
      analyser.add(key, fields[key])
    })

  const words = analyser.getAllWords()
  const wordInsert = words.map(word => {
    return {word}
  })

  this.words = this.words.concat(words)

  // Insert unique words into word collection.
  return this.insert(
    this.wordConnection.db,
    wordInsert,
    this.wordCollection,
    {
      ordered: false
    },
    this.getWordSchema()
  )
  .then(res => {
    return this.clearAndInsertWordInstances(words, wordInsert, analyser, doc._id)
  })
  .catch(err => {
    if (err.code === 11000) {
      return this.clearAndInsertWordInstances(words, wordInsert, analyser, doc._id)
    }
  })
}

Search.prototype.clearAndInsertWordInstances = function (words, wordInsert, analyser, docId) {
  // The word index is unique, so results aren't always returned.
  // Fetch word entries again to get ids.
  const query = {word: {'$in': words}}
  return this.runFind(this.wordConnection.db, query, this.wordCollection, this.getWordSchema())
    .then(result => {
      // Get all word instances from Analyser.
      this.clearDocumentInstances(docId)
        .then(res => {
          if (res.deletedCount) console.log(`Cleared ${res.deletedCount} documents`)
          this.insertWordInstances(wordInsert, analyser, result, docId)
        })
    })
    .catch(e => {
      console.log(e)
    })
}

Search.prototype.insertWordInstances = function (wordInsert, analyser, result, docId) {
  const instances = analyser
    .getWordInstances()

  if (!instances) return

  const doc = instances
    .filter(instance => result.results.find(result => result.word === instance.word))
    .map(instance => {
      const word = result.results.find(result => result.word === instance.word)._id

      return Object.assign(instance, {word, document: docId})
    })

  // Insert word instances into search collection.
  this.insert(this.searchConnection.db, doc, this.searchCollection, {}, this.getSearchSchema())
}

Search.prototype.runFind = function (database, query, collection, schema, options = {}) {
  return database.find({query, collection, options, schema})
}

Search.prototype.clearDocumentInstances = function (documentId) {
  // Remove all instance entries for a given document
  const query = {document: documentId}
  return this.searchConnection.db.delete({query, collection: this.searchCollection, schema: this.getSearchSchema()})
}

Search.prototype.insert = function (database, data, collection, options, schema) {
  if (!data.length) return Promise.resolve()
  return database.insert({data, collection, options, schema})
}

Search.prototype.batchIndex = function (page = 1, limit = 1000) {
  console.log(`Start indexing page ${page} (${limit} per page)`)

  const skip = (page - 1) * limit

  if (!Object.keys(this.indexableFields).length) return

  const fields = Object.assign({}, ...Object.keys(this.indexableFields).map(key => {
    return {[key]: 1}
  }))

  const index = database => {
    this.runFind(database, {}, this.model.name, this.model.schema, {
      skip,
      page,
      limit,
      fields
    })
    .then(res => {
      this.index(res.results)
        .then(c => {
          console.log(`Indexed page ${page}/${res.metadata.totalPages}`)
          if (page * limit < res.metadata.totalCount) {
            return this.batchIndex(page + 1, limit)
          } else {
            const all = [...new Set(this.words)]
            console.log(`Inserted ${all.length} words`)
            console.log(`Indexed ${res.results.length} records for ${this.model.name}`)
          }
        })
    })
  }

  if (this.model.connection.db) {
    index(this.model.connection.db)
  }

  this.model.connection.once('connect', database => {
    index(database)
  })
}

module.exports = function (model) {
  return new Search(model)
}

module.exports.Search = Search
