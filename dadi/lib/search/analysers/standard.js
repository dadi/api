'use strict'

const natural = require('natural')
const TfIdf = natural.TfIdf
const tokenizer = new natural.WordTokenizer()

class StandardAnalyzer {
  constructor (fieldRules) {
    this.fieldRules = fieldRules
    this.tfidf = new TfIdf()
  }

  add (field, value) {
    if (Array.isArray(value)) {
      let filteredValues = value.filter(this.isValid)
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
      .map(item => item.term)
  }

  getAllWords () {
    let words = this.tfidf.documents.map((doc, indx) => {
      return this.getWordsInField(indx)
    })

    if (words.length) {
      words = words.reduce((a, b) => a.concat(b))
    }

    return this.unique(words)
  }

  tokenize (query) {
    return tokenizer
      .tokenize(query)
      .map(word => word.toLowerCase())
  }

  unique (list) {
    if (!Array.isArray(list)) {
      return []
    }

    return [...new Set(list)]
  }

  areValidWords (words) {
    if (!Array.isArray(words)) {
      return false
    }

    return words.every(word => {
      return typeof word === 'object' &&
        word.hasOwnProperty('weight') &&
        word.hasOwnProperty('word')
    })
  }

  mergeWeights (words) {
    if (!this.areValidWords(words)) return []

    return words
      .reduce((prev, current) => {
        let match = prev.find(wordSearch => wordSearch.word === current.word)

        if (match) {
          match.count = match.count ? match.count + 1 : 2
          match.weight += current.weight
          return prev
        }
        return prev.concat(current)
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
    let words = this.getAllWords()
    if (!words || !words.length) return []

    let docWords = this.tfidf.documents
      .map((doc, index) => {
        let rules = this.fieldRules[doc.__key.split(':')[0]]

        return words
          .filter(word => doc[word])
          .map(word => {
            let weight = this.tfidf.tfidf(word, index) * rules.weight

            return {
              weight,
              word
            }
          })
      }).reduce((a, b) => a.concat(b))

    return this.mergeWeights(docWords)
  }
}

module.exports = StandardAnalyzer
