'use strict'

const path = require('path')
const _ = require('underscore')

const SearchAnalyser = require(path.join(__dirname, '/../search'))

const Search = function (model) {
  this.model = model
  this.analyser = new SearchAnalyser(model)
}

Search.prototype.analyse = function (docs, terms) {
  let fields = this.getFieldSearch()
  if (!docs) return
  return docs.map(doc => {
    let reducedDoc = this.reduceToSearchableFields(doc)
    return this.analyser.terms(terms).analyse(fields, reducedDoc)
  }) // Then sort
}

Search.prototype.getFieldSearch = function () {
  return Object.assign({}, ...Object.keys(this.model.schema).filter(field => {
    return typeof this.model.schema[field].search !== 'undefined'
  }).map(field => {
    return {[field]: this.model.schema[field].search}
  }))
}

Search.prototype.reduceToSearchableFields = function (doc) {
  return Object.assign({}, ...Object.keys(doc).filter(field => {
    return _.contains(this.analyser.fields, field)
  }).map(field => {
    return {[field]: doc[field]}
  }))
}

module.exports = Search
