'use strict'
const natural = require('natural')

const TfIdf = natural.TfIdf
const tokenizer = new natural.WordTokenizer()

module.exports = class StandardAnalyzer {
  constructor (fieldRules) {
    this.fieldRules = fieldRules
    this.fields = []
    this.tfidf = new TfIdf()
  }

  add (field, value) {
    if (Array.isArray(value)) {
      value.forEach(val => this.tfidf.addDocument(val, field))
    } else {
      this.tfidf.addDocument(value, field)
    }
    this.fields.push(field)
  }

  results (terms) {
    let results = {}

    this.tfidf.tfidfs(terms, (i, measure) => {
      Object.assign(results, {[this.fields[i]]: measure})
    })
    return {
      fields: results,
      weight: Object.keys(results)
        .reduce((acc, val) => {
          return acc + results[val]
        }, 0)
      }
  }

  getWordsInField (index) {
    return this.tfidf.listTerms(index)
      .map(item => item.term)
  }

  getAllWords () {
    const words = this.tfidf.documents.map((doc, indx) => {
      return this.getWordsInField(indx)
    }).reduce((a, b) => a.concat(b))

    return this.unique(words)
  }

  unique (list) {
    return [...new Set(list)]
  }

  getWordInstances () {
    const words = this.getAllWords()

    return this.tfidf.documents
      .map((doc, index) => {
        const rules = this.fieldRules[doc.__key]

        return words
          .filter(word => doc[word])
          .map(word => {
            const weight = this.tfidf.tfidf(word, index) * rules.weight
            return {
              weight,
              word
            }
          })
      }).reduce((a, b) => a.concat(b))
  }
}