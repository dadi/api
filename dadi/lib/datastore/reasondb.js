'use strict'

var _ = require('underscore')
var path = require('path')
var config = require(path.join(__dirname, '/../../../config'))
var ReasonDB = require('reasondb/lib/index.js')
var uuid = require('uuid')

// TODO: require a pre-built classes file, based on collection schemas
class tokenStore {
  constructor() { }
}

class books {
  constructor() { }
}

class book {
  constructor() { }
}

class person {
  constructor() { }
}

/**
 *
 */
var DataStore = function (settings) {
  // TODO: load all settings from config
  this.db = new ReasonDB(settings.path, '@key', ReasonDB.LocalStore)

  // TODO: remove this
  this.db.insert({clientId: "testClient", secret: "superSecret"}).into(Object).exec()
}

function formatQuery(query) {
  for (var key in query) {
    if (query.hasOwnProperty(key)) {
      if (/string|number/.test(typeof query[key])) {
        query[key] = { "$eq": query[key] }
      }
    }
  }

  return query
}

/**
 *
 */
DataStore.prototype.find = function (query, klass) {
  console.log(query)
  // TODO: accept query options
  return new Promise((resolve, reject) => {
    query = formatQuery(query)

    console.log('>', klass, JSON.stringify(query))

    try {
      klass = klass ? eval(klass) : Object
    } catch (err) {
      klass = Object
    }

    this.db.select().from({$o: klass}).where({$o: query}).exec().then((cursor) => {
      var results = []

      cursor.forEach((row) => {
        results.push(JSON.parse(JSON.stringify(row[0])))
      }).then(() => {
        return resolve(results)
      })
    })
  })
}

/**
 *
 */
DataStore.prototype.insert = function (data, klass) {
  try {
    klass = klass ? eval(klass) : Object
  } catch (err) {
    klass = Object
  }

  if (!_.isArray(data)) {
    data = [data]
  }

  var queue = []

  console.log(data)

  _.each(data, (record) => {
    record._id = record._id || uuid.v4()

    // TODO: add history back - an issue with saving empty arrays so it's removed until
    // I figure out whats going on
    if (record.history) delete record.history

    queue.push(this.db.insert(record).into(klass).exec().then((result) => { return result }))
  })

  return Promise.all(queue).then((results) => {
    results = _.flatten(results)
    return JSON.parse(JSON.stringify(results))
  })
}

DataStore.prototype.delete = function () {

}

module.exports = DataStore
