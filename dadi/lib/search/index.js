'use strict'

const StandardAnalyser = require('./analysers/standard')

const analysers = {
  standard_analyser: new StandardAnalyser()
}

const defaultAnalyser = analysers.standard_analyser

const Search = function (model) {
  this.model = model
  this.fields = this.getSearchableFields()
}

Search.prototype.getSearchableFields = function () {
  return Object.keys(this.model.schema).filter(field => {
    return typeof this.model.schema[field].search !== 'undefined'
  })
}

Search.prototype.buildQuery = function (value) {
  let searchRegex = new RegExp(value.split(' ').join('|'), 'i')

  return {$or: Object.assign([], this.fields.map(field => {
    return {[field]: searchRegex}
  }))}
}

Search.prototype.terms = function (terms) {
  this.searchTerms = terms.split(' ')
  return this
}

Search.prototype.analyse = function (fields, doc) {
  Object.keys(doc).forEach(docKey => {
    let useDefault = typeof fields[docKey] === 'boolean' || (typeof fields[docKey] === 'object' && !fields[docKey].analyser)
    let analyser = useDefault ? defaultAnalyser : (analysers[fields[docKey].analyser] || defaultAnalyser)

    // Accumulate fields to analyse
    analyser.add(docKey, doc[docKey])
  })
  return Object.assign(doc, {search: this.results()})
}

Search.prototype.results = function () {
  return Object.assign({}, ...Object.keys(analysers).map(key => {
    return {[key]: analysers[key].results(this.searchTerms)}
  }))
}

module.exports = function (model) {
  return new Search(model)
}

module.exports.Search = Search
