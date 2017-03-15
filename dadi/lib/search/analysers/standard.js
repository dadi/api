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
    // console.log("ADDED", this.tfidf)
  }


  results (id) {
    // let result = {id}
    // Cycle through each document (field value)
    let results = Object.assign({}, ...this.tfidf.documents.map((document, index) => {
      return Object.assign({}, ...this.tfidf.listTerms(index).map((item) => {
        // console.log({[item.term]: item.tfidf, weight: item.tfidf})
        return {[item.term]: 
          {
            id: id,
            weight: item.tfidf
          }
        }
        // return {[item.term]: item.tfidf}
        // console.log(`[${this.fields[index]}]: [term: ${item.term}] [Inverse frequency: ${item.tfidf}]`)
      }))
    }))
    console.log(JSON.stringify(results, null, 2))
  } 
}

let example = {
  value: 'foo',
  matches: [
    {
      id: 'ObjectId', // Document ID
      weight: 1.5,
      instances: [{
        field: 'fieldName',
        count: 20
      }]
    }
  ]
}