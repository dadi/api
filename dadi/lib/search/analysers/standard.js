'use strict'

const TfIdf = require('natural').TfIdf

module.exports = class StandardAnalyzer {
  constructor () {
    this.fields = []
    this.tfidf = new TfIdf()
  }

  add (field, value) {
    this.tfidf.addDocument(value)
    this.fields.push(field)
  }

  results (terms) {
    let results = {}

    this.tfidf.tfidfs(terms, (i, measure) => {
      Object.assign(results, {[this.fields[i]]: measure})
    })
    return {
      fields: results,
      weight: Object.keys(results).reduce((acc, val) => {
        return acc + results[val]
      }, 0)}
  }
}
