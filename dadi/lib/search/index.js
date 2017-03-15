'use strict'


const standardAnalyser = require('./analysers/standard')

const analysers = {
  standard_analyser: new standardAnalyser()
}

const defaultAnalyser = analysers.standard_analyser

const Search = function (_id, fields, doc) {
  this.fields = fields
  this.doc = doc
  this._id = _id
}

Search.prototype.get = function () {

  Object.keys(this.doc).forEach(docKey => {
    let useDefault = typeof this.fields[docKey] === 'boolean' || (typeof this.fields[docKey] === 'object' && !this.fields[docKey].analyser)
    let analyser = useDefault ? defaultAnalyser : (analysers[this.fields[docKey].analyser] || defaultAnalyser)

    // Analysers can sometimes build accumulative results, so we simply pass to the analyser each time to let the analyser make that decision
    analyser.add(docKey, this.doc[docKey])
    // console.log(analysed)
    // if (typeof fields[docKey] === 'boolean') {
      // Set to true, use default
    // } else if (typeof fields[docKey] === 'object') {

    // }
  })
  this.results()
}

Search.prototype.results = function () {
  return Object.keys(analysers).map(key => {
    return analysers[key].results(this._id)
  })
}

// Search.prototype.find = function () {

// }

module.exports = function (_id, fields, doc) {
  return new Search(_id, fields, doc)
}

module.exports.Search = Search