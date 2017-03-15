'use strict'

const path = require('path')

const SearchAnalyser = require(path.join(__dirname, '/../search'))

const Search = function (model) {
  this.model = model
}

Search.prototype.index = function (docs) {
  let fields = this.getSearchableFields()

  docs.map(doc => {
    let reducedDoc = this.reduceToSearchableFields(doc, fields)
    let analysed = new SearchAnalyser(doc._id, fields, reducedDoc).get()
    // console.log(analysed)
  })
}

Search.prototype.getSearchableFields = function() {
  return Object.assign({}, ...Object.keys(this.model.schema).filter(field => {
    return typeof this.model.schema[field].search !== 'undefined'
  }).map(field => {
    return {[field]: this.model.schema[field].search}
  }))
}

Search.prototype.reduceToSearchableFields = function(doc, fields) {
  return Object.assign({}, ...Object.keys(doc).filter(field => {
    return typeof fields[field] !== 'undefined'
  }).map(field => {
    return {[field]: doc[field]}
  }))
}

module.exports = Search
