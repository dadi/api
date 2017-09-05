'use strict'

const path = require('path')
const config = require(path.join(__dirname, '/../../../config'))
const connection = require(path.join(__dirname, '/../model/connection'))
const StandardAnalyser = require('./analysers/standard')

const analysers = {
  StandardAnalyser
}

const defaultAnalyser = StandardAnalyser

const wordCollectionName = config.get('search.wordCollection')

const ensureIndex = (database, collection, rules, options) => {
  database.collection(collection)
    .ensureIndex(rules, options)
}

const Search = function (model) {
  this.model = model
  this.searchCollection = this.model.searchCollection || this.model.name + 'Search'
  this.indexableFields = this.getIndexableFields()
  this.searchConnection = connection(config.get('search.database'))
  // Force index on this.searchConnection
  this.searchConnection.on('connect', (database) => {
    database.collection(wordCollectionName).ensureIndex({word: 1}, {unique: true})
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

Search.prototype.find = function (query) {
  return new Promise(resolve => {
    const query = {_id: {'$in': ['58de4f88a6bf1ead62a93071']}}
    return resolve(query)
  })
}

Search.prototype.index = function (docs) {
  docs.map(doc => this.indexDocument(doc))
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
  const analyser = new defaultAnalyser(this.indexableFields)

  Object.keys(fields)
    .map(key => {
      analyser.add(key, fields[key])
    })

  const words = analyser.getAllWords()
  
  const wordInsert = words.map(word => {
    return {word}
  })


  this.insert(wordInsert, wordCollectionName)
    .then(res => {
      const query = {word: {'$in': words}}
      this.runFind(query, wordCollectionName)
        .then(result => {
          const instances = analyser
            .getWordInstances()
            .filter(instance => result.find(result => result.word === instance.word))
            .map(instance => {
              const word = result.find(result => result.word === instance.word)._id

              return Object.assign(instance, {word, document: doc._id})
            })

          this.insert(instances, this.searchCollection)
        })

    })
}

Search.prototype.runFind = function (query, collectionName) {
  return new Promise(resolve => {
    this.searchConnection.db.collection(collectionName)
      .find(query, {}, (err, cursor) => {
        cursor.toArray((err, result) => {
          resolve(result)
        })
      })
  })
}

Search.prototype.clearDocumentInstances = function (documentId) {
  // Remove all instance entries for a given document
}

Search.prototype.insert = function (documents, collectionName) {
  return new Promise(resolve => {
    this.searchConnection.db.collection(collectionName)
      .insertMany(documents, {ordered: false}, (err, result) => {
        resolve(result)
      })
  })
}

module.exports = function (model) {
  return new Search(model)
}

module.exports.Search = Search
