'use strict'

const path = require('path')
const config = require(path.join(__dirname, '/../../../config'))
const connection = require(path.join(__dirname, '/../model/connection'))

const dbOptions = config.get('search.database')
const wordCollectionName = config.get('search.wordCollection')
const ensureIndex = database => {
  database.collection(wordCollectionName)
    .ensureIndex({
      word: 1
    },
    {
      unique: true
    },
    (err, indexName) => {
      if (err) {
        console.log(err)
      }
    })
}

const Search = function (model) {
  this.model = model
  this.collection = this.model.searchCollection || this.model.name + 'Search'
  this.indexableFields = this.getIndexableFields()
  this.connection = connection(dbOptions)
  // Force index on this.connection
  this.connection.on('connect', ensureIndex)
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

Search.prototype.find = function (query) {
  return new Promise(resolve => {
    const query = {_id: {'$in': ['58de4f88a6bf1ead62a93071']}}
    return resolve(query)
  })
}

Search.prototype.index = function (docs) {
  docs.map(doc => this.indexDocument(doc))
}

Search.prototype.indexDocument = function (doc) {
  // Group all words and insert
  // Fix issue with incorrect database selection
  // Build list of per-field word weights
  // Combine weights across entire document
  // this.insert([{word: 'bar'}, {word: 'foo'}, {word: 'baz'}, {word: 'foo'}, {word: 'qux'}], wordCollectionName)
  Object.keys(doc)
    .filter(key => this.indexableFields[key])
    .map(key => console.log('MAP', doc[key]))
}

Search.prototype.clearDocumentInstances = function (documentId) {
  // Remove all instance entries for a given document
}

Search.prototype.insert = function (documents, collectionName) {
  this.connection.db.collection(collectionName)
    .insertMany(documents, {ordered: false, upsert: true}, (err, result) => {
      if (err) console.log(err)
      console.log('Skipped', result.getWriteErrorCount())
    })
}

module.exports = function (model) {
  return new Search(model)
}

module.exports.Search = Search
