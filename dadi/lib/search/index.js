'use strict'

const path = require('path')
const config = require(path.join(__dirname, '/../../../config'))
const connection = require(path.join(__dirname, '/../model/connection'))
const StandardAnalyser = require('./analysers/standard')
const logger = require('@dadi/logger')

const DefaultAnalyser = StandardAnalyser
const wordCollection = config.get('search.wordCollection')

const Search = function (model) {
  this.model = model
  this.searchCollection = this.model.searchCollection || this.model.name + 'Search'
  this.indexableFields = this.getIndexableFields()
  this.searchConnection = connection(config.get('search.database'))
  // Force index on this.searchConnection
  this.searchConnection.on('connect', (database) => {
    database.collection(wordCollection).ensureIndex({word: 1}, {unique: true})
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
      return this.getInstancesOfWords(words)
        .then(instances => {
          const ids = instances.map(instance => instance.document)

          return {_id: {'$in': ids}}
        })
    })
}

Search.prototype.getInstancesOfWords = function (words) {
  const ids = words.map(word => word._id)
  const query = {word: {'$in': ids}}

  return this.runFind(query, this.searchCollection)
}

Search.prototype.getWords = function (tokenized) {
  const query = {word: {'$in': tokenized}}

  return this.runFind(query, wordCollection)
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
  const analyser = new DefaultAnalyser(this.indexableFields)

  Object.keys(fields)
    .map(key => {
      analyser.add(key, fields[key])
    })

  const words = analyser.getAllWords()
  const wordInsert = words.map(word => {
    return {word}
  })

  // Insert unique words into word collection.
  this.insert(wordInsert, wordCollection)
    .then(res => {
      // The word index is unique, so results aren't always returned.
      // Fetch word entries again to get ids.
      const query = {word: {'$in': words}}
      this.runFind(query, wordCollection)
        .then(result => {
          // Get all word instances from Analyser.
          this.clearDocumentInstances(doc._id)
            .then(res => {
              this.insertWordInstances(analyser, result, doc._id)
            })
        })
    })
}

Search.prototype.insertWordInstances = function (analyser, result, docId) {
  const instances = analyser
    .getWordInstances()
    .filter(instance => result.find(result => result.word === instance.word))
    .map(instance => {
      const word = result.find(result => result.word === instance.word)._id

      return Object.assign(instance, {word, document: docId})
    })
  // Insert word instances into search collection.
  this.insert(instances, this.searchCollection)
}

Search.prototype.runFind = function (query, collectionName) {
  return new Promise(resolve => {
    this.searchConnection.db.collection(collectionName)
      .find(query, {}, (err, cursor) => {
        if (err) logger.error(err)
        cursor.toArray((err, result) => {
          if (err) logger.error(err)
          resolve(result)
        })
      })
  })
}

Search.prototype.clearDocumentInstances = function (documentId) {
  // Remove all instance entries for a given document
  return new Promise(resolve => {
    this.searchConnection.db
      .collection(this.searchCollection)
      .deleteMany({document: documentId}, (err, result) => {
        if (err) logger.error(err)
        resolve(result)
      })
  })
}

Search.prototype.insert = function (documents, collectionName) {
  return new Promise(resolve => {
    this.searchConnection.db.collection(collectionName)
      .insertMany(documents, {ordered: false}, (err, result) => {
        if (err) logger.error(err)
        resolve(result)
      })
  })
}

module.exports = function (model) {
  return new Search(model)
}

module.exports.Search = Search
