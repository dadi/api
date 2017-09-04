'use strict'

const Search = function (model) {
  this.model = model
}

Search.prototype.find = function (query) {
  return new Promise(resolve => {
    const query = {_id: {'$in': ['58de4f88a6bf1ead62a93071']}}
    return resolve(query)
  })
}

module.exports = function (model) {
  return new Search(model)
}

module.exports.Search = Search
