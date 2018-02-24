const _ = require('underscore-contrib')
const debug = require('debug')('api:reference')
const path = require('path')
const Model = require(path.join(__dirname, '/index'))
const queryUtils = require(path.join(__dirname, '/utils'))
const promiseQueue = require('js-promise-queue')

var Reference = function (query, schema, settings) {
  this.query = query
  this.schema = schema
  this.settings = settings
}

Reference.prototype.deconstructQuery = function () {
  console.log(arguments)
  return new Promise((resolve, reject) => {
    console.log('1', this.query)
    var queries = queryUtils.processReferenceFieldQuery(this.query, this.schema)
    console.log('2', queries)

    debug('find reference %o', queries)

  // processReferenceFieldQuery sends back an array of queries
  // [0] is the query with reference field parts removed
  // [1] contains the reference field parts
    this.query = queries[0]

    console.log('3', this.query)

    this.referenceFieldQuery = queries[1]
    var referenceFieldKeys = Object.keys(this.referenceFieldQuery)
    var queue = []

    console.log('4', this.referenceFieldQuery)
    console.log('5', referenceFieldKeys)

      /*
1 { title: /^Harry Potter 1$/i, 'author.name': /^A B Cowling$/i }
2 [ { title: /^Harry Potter 1$/i },
  { 'author.name': /^A B Cowling$/i } ]
3 { title: /^Harry Potter 1$/i }
4 { 'author.name': /^A B Cowling$/i }
5 [ 'author.name' ]
      */

      // for each reference field key, query the specified collection
      // to obtain an _id value
    referenceFieldKeys.forEach(key => {
      queue.push(key)
    })

    console.log(queue)

    promiseQueue(queue, this.factoryFn.bind(this)).then(result => {
      console.log('result', result)
      return resolve(result[0])
    })
  })
}

Reference.prototype.factoryFn = function (key) {
  return new Promise((resolve, reject) => {
    // setTimeout(() => resolve(value), 2000)
    var keyParts = key.split('.')
    console.log(keyParts)

    console.log(this)

    try {
      var collection = ''
      var collectionKey = keyParts[0]
      var linkKey
      var queryKey
      var queryValue = this.referenceFieldQuery[key]
      var collectionSettings = queryUtils.getSchemaOrParent(collectionKey, this.schema).settings || {}
      var collectionLevelCompose = true
    } catch (err) {
      console.log(err)
    }

    console.log(collectionSettings)

    if (collectionKey !== collectionSettings.collection) {
      collection = collectionSettings.collection
    } else {
      collection = collectionKey
    }

    console.log(collection)

    var fieldsObj = {}
    if (collectionSettings.fields) {
      collectionSettings.fields.forEach(field => {
        fieldsObj[field] = 1
      })
    }

    console.log(fieldsObj)

    queryKey = keyParts[1]
    var collectionQuery = {}

    if (keyParts.length === 2) {
      collectionQuery[queryKey] = queryValue
    } else {
      linkKey = keyParts[1]
      queryKey = keyParts[2]
    }

    console.log(keyParts)

        // if we already have a value for this field inserted
        // into the final query object (e.g. a parent nested query has been done first),
        // supplement the current query with the ids
    if (this.query[collectionKey]) {
      collectionQuery['_id'] = this.query[collectionKey]
    }

    console.log(this.query, collectionQuery)

        // query the reference collection
    debug('find reference in %s with %o', collection, collectionQuery)

    var referenceModel = new Model(collection, {}, null, { database: collectionSettings.database || this.settings.database, compose: collectionLevelCompose })

    referenceModel.find(collectionQuery, { fields: fieldsObj }, (err, results) => {
      // if (err) return done(err)
      console.log(err, results)

      var ids = []

      if (results && results.results && results.results.length) {
        results = results.results

        if (!linkKey) { // i.e. it's a one-level nested query
          ids = _.map(_.pluck(results, '_id'), (id) => { return id.toString() })

              // update the original query with a query for the obtained _id
              // using the appropriate query type for whether the reference settings
              // allows storing as arrays or not
          this.query[collectionKey] = collectionSettings.multiple ? { '$containsAny': ids } : ids[0]
              // query[collectionKey] = collectionSettings.multiple ? { '$in': ids } : ids[0]
        } else {
              // filter the results using linkKey
              // 1. get the _id of the result matching { queryKey: queryValue }
          var parents = _.filter(results, result => {
            return new RegExp(queryValue).test(result[queryKey]) === true
          })

              // check every parent category for any children that belong to them
          for (var p = 0; p < parents.length; p++) {
            var children = _.filter(results, result => {
              if (result[linkKey]) {
                if (typeof result[linkKey] === 'string' && result[linkKey].toString() === parents[p]._id.toString()) {
                  return result
                } else if (typeof result[linkKey] === 'object') {
                  if (result[linkKey].toString() === '[object Object]' && result[linkKey]._id.toString() === parents[p]._id.toString()) {
                    return result
                  } else if (result[linkKey].toString() === parents[p]._id.toString()) {
                    return result
                  }
                }
              }
            })

            var childIds = _.map(_.pluck(children, '_id'), id => {
              return id.toString()
            })

            ids = ids.concat(childIds)
          }

          this.query[collectionKey] = { '$in': ids || [] }
        }
      } else {
            // Nothing found in the reference collection, add empty criteria to the main query
        this.query[collectionKey] = collectionSettings.multiple
              ? { '$in': [] }
              : ''
      }

      console.log('6', this.query)
      return resolve(this.query)
    })
  })
}

module.exports.Reference = Reference
