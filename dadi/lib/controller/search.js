'use strict'

const path = require('path')
const url = require('url')
const config = require(path.join(__dirname, '/../../../config'))
const help = require(path.join(__dirname, '/../help'))

const prepareQueryOptions = require(path.join(__dirname, './index')).prepareQueryOptions

const SearchController = function (model) {
  this.model = model
}

/**
 *
 */
SearchController.prototype.get = function (req, res, next) {
  let path = url.parse(req.url, true)
  let options = path.query

  let queryOptions = prepareQueryOptions(options, this.model.settings)

  if (queryOptions.errors.length !== 0) {
    sendBackJSON(400, res, next)(null, queryOptions)
  } else {
    queryOptions = queryOptions.queryOptions
  }

  let err

  // if (typeof options === 'function') {
  //   done = options
  //   options = {}
  // }

  console.log(this.model)
  console.log(queryOptions)

  if (!this.model.searchHandler.canUse()) {
    err = new Error('Not Implemented')
    err.statusCode = 501
    err.json = {
      errors: [{
        message: `Search is disabled or an invalid data connector has been specified.`
      }]
    }
  }

  if (!queryOptions.search || queryOptions.search.length < config.get('search.minQueryLength')) {
    err = new Error('Bad Request')
    err.statusCode = 400
    err.json = {
      errors: [{
        message: `Search query must be at least ${config.get('search.minQueryLength')} characters.`
      }]
    }
  }

  if (err) {
    return help.sendBackJSON(400, res, next)(err)
  }

  this.model.searchHandler.find(queryOptions.search).then(query => {
    let ids = query._id['$containsAny'].map(id => id.toString())

    this.model.get(query, queryOptions, (err, results) => {
      console.log(err, results)
      // sort the results
      results.results = results.results.sort((a, b) => {
        let aIndex = ids.indexOf(a._id.toString())
        let bIndex = ids.indexOf(b._id.toString())

        if (aIndex === bIndex) return 1

        return aIndex < bIndex ? -1 : 1
      })

      return help.sendBackJSON(200, res, next)(err, results)
    }, req)
  }).catch(err => {
    console.log(err)
    return help.sendBackJSON(null, res, next)(err)
  })

  // this.model.search(queryOptions, sendBackJSON(200, res, next), req)
}

module.exports = function (model) {
  return new SearchController(model)
}

module.exports.SearchController = SearchController
