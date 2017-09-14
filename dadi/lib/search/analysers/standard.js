'use strict'
const natural = require('natural')
const tokenizer = new natural.WordTokenizer()
const util = require('../util')
const TfIdf = natural.TfIdf

module.exports = class StandardAnalyzer {
  constructor (fieldRules) {
    this.fieldRules = fieldRules
    this.tfidf = new TfIdf()
  }

  add (field, value) {
    if (Array.isArray(value)) {
      const filteredValues = value.filter(this.isValid)
      filteredValues.forEach(val => this.tfidf.addDocument(val, field))
    } else if (this.isValid(value)) {
      this.tfidf.addDocument(value, field)
    }
  }

  isValid (value) {
    return typeof value === 'string'
  }

  getWordsInField (index) {
    return this.tfidf.listTerms(index)
      .map(item => {
        return item.term
      })
  }

  getAllWords () {
    let words = this.tfidf.documents.map((doc, indx) => {
      return this.getWordsInField(indx)
    })

    if (words.length) {
      words = words.reduce(util.mergeArrays)
    }

    return this.unique(words)
  }

  tokenize (query) {
    return tokenizer
      .tokenize(query)
      .map(word => word.toLowerCase())
  }

  unique (list) {
    if (!Array.isArray(list)) return []
    return [...new Set(list)]
  }

  areValidWords (words) {
    return Array.isArray(words) &&
    words.every(word => {
      return typeof word === 'object' &&
        word.hasOwnProperty('weight') &&
        word.hasOwnProperty('word')
    })
  }

  mergeWeights (words) {
    if (!this.areValidWords(words)) return []

    return words
      .reduce((prev, curr) => {
        const match = prev.find(wordSearch => wordSearch.word === curr.word)

        if (match) {
          match.count = match.count ? match.count + 1 : 2
          match.weight += curr.weight
          return prev
        }
        return prev.concat(curr)
      }, [])
      .map(match => {
        if (match.count) {
          match.weight = match.weight / match.count
          delete match.count
        }
        return match
      })
  }

  getWordInstances () {
    const words = this.getAllWords()
    if (!words || !words.length) return []

    const docWords = this.tfidf.documents
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

    return this.mergeWeights(docWords)
  }
}
