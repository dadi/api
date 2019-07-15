'use strict'

const config = require('../../config')
const debug = require('debug')('api:filestore')
const EventEmitter = require('events').EventEmitter
const Loki = require('lokijs')
const metadata = require('@dadi/metadata')
const path = require('path')
const sinon = require('sinon')
const util = require('util')
const Update = require('./lib/update')
const uuid = require('uuid')

const DEBUG = Boolean(process.env.DEBUG_DB)
const STATE_DISCONNECTED = 0
const STATE_CONNECTED = 1

const databasePool = {}
const instancePool = []
const mockConnection = {
  failed: false,
  exceptForCollections: []
}

/**
 * @typedef ConnectionOptions
 * @type {Object}
 * @property {string} database - the name of the database file to use
 * @property {Object} collection - the name of the collection to use
 */

/**
 * @typedef QueryOptions
 * @type {Object}
 * @property {number} limit - the number of records to return
 * @property {number} skip - an offset, the number of records to skip
 * @property {Object} sort - an object specifying properties to sort by. `{"title": 1}` will sort the results by the `title` property in ascending order. To reverse the sort, use `-1`: `{"title": -1}`
 * @property {Object} fields - an object specifying which properties to return. `{"title": 1}` will return results with all properties removed except for `_id` and `title`
 */

/**
 * Handles the interaction with LokiJS
 * @constructor DataStore
 * @classdesc DataStore adapter for using LokiJS with DADI API
 * @implements EventEmitter
 */
const DataStore = function(options) {
  this.databasePath = __dirname

  this.internalProperties = ['$loki', 'meta']

  this.readyState = STATE_DISCONNECTED

  instancePool.push(this)

  this._spies = {
    index: sinon.spy(this, 'index')
  }
}

util.inherits(DataStore, EventEmitter)

DataStore.prototype._debug = function(title, data = {}) {
  if (!DEBUG) return

  if (this.database.___id.name !== 'testdb') return

  data.id = this.database.___id

  console.log('')
  console.log('////////////////////////////////////////////////')
  console.log(title.toUpperCase())
  console.log('')

  Object.keys(data).forEach(key => {
    console.log(`- ${key}: ${JSON.stringify(data[key])}`)
  })

  console.log('')
  console.log(
    '\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\\'
  )
  console.log('')
}

DataStore.prototype._mockConnect = function() {
  this.readyState = STATE_CONNECTED

  mockConnection.failed = false
}

DataStore.prototype._mockDisconnect = function() {
  this.readyState = STATE_DISCONNECTED

  mockConnection.failed = true

  this.emit('DB_ERROR', {})
}

DataStore.prototype._mockIsDisconnected = function(collection) {
  return mockConnection.failed
}

/**
 * Receives a fields projection (or an array of fields to include) and an array
 * of documents. Returns the same array of documents after applying the field
 * projection.
 *
 * @param {Array|Object} fields    - an array of field names or a projection
 * @param {Array}        documents - an array of documents
 * @returns {Array} an array of filtered documents
 */
DataStore.prototype.applyFieldsFilterToResults = function(fields, documents) {
  if (!fields || Object.keys(fields).length === 0) {
    return documents
  }

  const projection = Array.isArray(fields)
    ? fields.reduce((result, field) => {
        result[field] = 1

        return result
      }, {})
    : fields
  const isExclusion = Object.keys(projection).some(field => {
    return projection[field] === 0
  })

  return documents.map(document => {
    return Object.keys(document).reduce((result, field) => {
      if (
        field === '_id' ||
        (isExclusion && projection[field] === undefined) ||
        (!isExclusion && projection[field] === 1)
      ) {
        result[field] = document[field]
      }

      return result
    }, {})
  })
}

/**
 * Connect
 *
 * @param {ConnectionOptions} options
 */
DataStore.prototype.connect = function({database = 'default', collection}) {
  if (this._mockIsDisconnected(collection)) {
    this.readyState = STATE_DISCONNECTED

    return Promise.reject(new Error('DB_DISCONNECTED'))
  }

  const connectionKey = `${database}.db`

  if (databasePool[connectionKey]) {
    this.database = databasePool[connectionKey]
  } else {
    this.database = new Loki(connectionKey, {
      adapter: new Loki.LokiMemoryAdapter()
    })

    // For debugging
    this.database.___id = {
      name: database,
      uuid: Math.random()
    }
    this._debug('connect: new db', {
      database,
      collection
    })

    databasePool[connectionKey] = this.database
  }

  this.readyState = STATE_CONNECTED
  this.name = connectionKey

  databasePool[connectionKey] = this.database

  return Promise.resolve()
}

/**
 * Remove documents from the database
 *
 * @param {Object} query - the query that selects documents for deletion
 * @param {string} collection - the name of the collection to delete from
 * @param {Object} schema - the JSON schema for the collection
 * @returns {Promise.<Array, Error>} A promise that returns an Object with one property `deletedCount`,
 *     or an Error if the operation fails
 */
DataStore.prototype.delete = function({query, collection, schema}) {
  if (this._mockIsDisconnected(collection)) {
    this.readyState = STATE_DISCONNECTED

    return Promise.reject(new Error('DB_DISCONNECTED'))
  }

  query = this.prepareQuery(query)

  return new Promise((resolve, reject) => {
    this.getCollection(collection).then(collection => {
      const results = collection.chain().find(query)

      const count = results.data().length

      this._debug('delete', {
        count,
        results: results.data(),
        query
      })

      results.remove()

      return resolve({deletedCount: count})
    })
  })
}

DataStore.prototype.destroy = function() {
  databasePool[this.name] = null
}

DataStore.prototype.dropDatabase = function(collectionName) {
  if (!this.database) return Promise.resolve()

  const collectionsCleared = []

  this.database.collections.forEach(collection => {
    if (!collectionName || collectionName === collection.name) {
      collectionsCleared.push(collection.name)

      collection.clear()
    }
  })

  this._debug('drop database', {
    collection: collectionName,
    collections: this.database.collections.map(c => c.name),
    collectionsCleared
  })

  return Promise.resolve()
}

/**
 * Query the database
 *
 * @param {Object} query - the query to perform
 * @param {string} collection - the name of the collection to query
 * @param {QueryOptions} options - a set of query options, such as offset, limit, sort, fields
 * @param {Object} schema - the JSON schema for the collection
 * @returns {Promise.<Array, Error>} A promise that returns an Array of results,
 *     or an Error if the operation fails
 */
DataStore.prototype.find = function({
  query,
  collection: collectionName,
  options = {},
  schema
}) {
  if (this._mockIsDisconnected(collectionName)) {
    this.readyState = STATE_DISCONNECTED

    return Promise.reject(new Error('DB_DISCONNECTED'))
  }

  options = options || {}

  query = this.prepareQuery(query, schema)

  return new Promise((resolve, reject) => {
    this.getCollection(collectionName)
      .then(collection => {
        let results

        const sort = this.getSortParameters(options)
        const baseResultset = collection.chain().find(query)
        const branchedResultset = baseResultset.branch()

        // count of records matching the filter
        const count = branchedResultset.count()

        results = baseResultset
          .simplesort(sort.property, sort.descending)
          .offset(options.skip || 0)
          .limit(options.limit || 100)
          .data()

        // Apply filters projection, if defined.
        results = this.applyFieldsFilterToResults(options.fields, results)

        this._debug('find', {
          collection: collectionName,
          query,
          results
        })

        const returnData = {}

        returnData.results = results.map(
          this.formatDocumentForOutput.bind(this)
        )
        returnData.metadata = this.getMetadata(options, count)

        return resolve(returnData)
      })
      .catch(err => {
        return reject(err)
      })
  })
}

DataStore.prototype.formatDocumentForOutput = function(document) {
  return Object.keys(document).reduce((newDocument, key) => {
    if (this.internalProperties.includes(key)) return newDocument

    newDocument[key] = document[key]

    return newDocument
  }, {})
}

/**
 *
 */
DataStore.prototype.getCollection = function(collectionName) {
  return new Promise((resolve, reject) => {
    let collection = this.database.getCollection(collectionName)

    if (!collection) {
      collection = this.database.addCollection(collectionName, {
        disableChangesApi: false
      })
    }

    return resolve(collection)
  })
}

/**
 * Given a collection schema, returns the field settings for a specified key or it's
 * parent if the key is using dot notation.
 * If dot notation is used, the first part of the key is used to
 * locate the parent in the schema to determine the settings.
 */
DataStore.prototype.getFieldOrParentSchema = function(key, schema) {
  const keyOrParent = key.split('.').length > 1 ? key.split('.')[0] : key

  return schema[keyOrParent]
}

/**
 * Get an array of indexes
 *
 * @param {string} collectionName - the name of the collection to get indexes for
 * @returns {Array} - an array of index objects, each with a name property
 */
DataStore.prototype.getIndexes = function(collectionName) {
  if (this._mockIsDisconnected(collectionName)) {
    this.readyState = STATE_DISCONNECTED

    return Promise.reject(new Error('DB_DISCONNECTED'))
  }

  return new Promise((resolve, reject) => {
    this.getCollection(collectionName).then(collection => {
      const indexes = []

      Object.keys(collection.binaryIndices).forEach(key => {
        indexes.push({name: key})
      })

      Object.keys(collection.constraints.unique).forEach(key => {
        indexes.push({name: key, unique: true})
      })

      return resolve(indexes)
    })
  })
}

/**
 *
 * @param {Object} options - the query options passed from API, such as page, limit, skip
 * @param {number} count - the number of results returned in the query
 * @returns {Object} an object containing the metadata for the query, such as totalPages, totalCount
 */
DataStore.prototype.getMetadata = function(options, count) {
  return metadata(options, count)
}

/**
 *
 */
DataStore.prototype.getSortParameters = function(options) {
  const sort = {
    property: '$loki',
    descending: false
  }

  if (options.sort) {
    sort.property = Object.keys(options.sort)[0]
    sort.descending = options.sort[sort.property] === -1
  }

  return sort
}

DataStore.prototype.index = function(collectionName, indexes) {
  return new Promise((resolve, reject) => {
    this.getCollection(collectionName).then(collection => {
      const results = []

      indexes.forEach((index, idx) => {
        if (
          Object.keys(index.keys).length === 1 &&
          Object.keys(index.keys)[0] === '_id'
        ) {
          // ignore _id index request, db handles this automatically
        } else {
          if (index.options && index.options.unique) {
            const uniqIdx = collection.ensureUniqueIndex(
              Object.keys(index.keys)[0]
            )

            results.push({
              collection,
              index: uniqIdx.field
            })
          } else {
            collection.ensureIndex(Object.keys(index.keys)[0])

            results.push({
              collection: collectionName,
              index: Object.keys(index.keys)[0]
            })
          }

          if (idx === indexes.length - 1) {
            return resolve()
          }
        }
      })
    })
  })
}

/**
 * Insert documents into the database
 *
 * @param {Object|Array} data - a single document or an Array of documents to insert
 * @param {string} collection - the name of the collection to insert into
 * @param {Object} schema - the JSON schema for the collection
 * @returns {Promise.<Array, Error>} A promise that returns an Array of inserted documents,
 *     or an Error if the operation fails
 */
DataStore.prototype.insert = function({
  data,
  collection: collectionName,
  options = {},
  schema,
  settings = {}
}) {
  if (this._mockIsDisconnected(collectionName)) {
    this.readyState = STATE_DISCONNECTED

    return Promise.reject(new Error('DB_DISCONNECTED'))
  }

  // make an Array of documents if an Object has been provided
  if (!Array.isArray(data)) {
    data = [data]
  }

  // Cheap trick to make data immutable. We wouldn't use this in a real
  // data connector, but it's acceptable for the test connector.
  data = JSON.parse(JSON.stringify(data))

  this._debug('insert', {
    collectionName,
    data
  })

  // add an _id if the document doesn't come with one
  data.forEach(document => {
    document._id = document._id || uuid.v4()
  })

  return new Promise((resolve, reject) => {
    this.getCollection(collectionName).then(collection => {
      try {
        let results = collection.insert(data)

        results = Array.isArray(results) ? results : [results]
        results = results.map(this.formatDocumentForOutput.bind(this))

        return resolve(results)
      } catch (err) {
        return reject(err)
      }
    })
  })
}

/**
 *
 */
DataStore.prototype.prepareQuery = function(originalQuery, schema) {
  let query = Object.assign({}, originalQuery)

  Object.keys(query).forEach(key => {
    if (Object.prototype.toString.call(query[key]) === '[object RegExp]') {
      const re = new RegExp(query[key])

      query[key] = {$regex: [re.source, re.flags]}
    } else {
      if (typeof query[key] === 'object' && query[key]) {
        Object.keys(query[key]).forEach(k => {
          // change $ne: null to $ne: undefined, as per https://github.com/techfort/LokiJS/issues/285
          if (
            k === '$ne' &&
            typeof query[key][k] === 'object' &&
            query[key][k] === null
          ) {
            query[key] = {$ne: undefined}
          }
        })
      }
    }
  })

  // Transform a query like this:
  //
  // {"fieldOne": 1, "fieldTwo": {"$gt": 1, "$lt": 10}}
  //
  // ... into:
  //
  // [
  //   {"fieldOne": 1},
  //   {"fieldTwo": {"$gt": 1}},
  //   {"fieldTwo": {"$lt": 10}}
  // ]
  const expressions = Object.keys(query).reduce((expressions, field) => {
    if (Boolean(query[field]) && typeof query[field] === 'object') {
      Object.keys(query[field]).forEach(operator => {
        expressions.push({
          [field]: {
            [operator]: query[field][operator]
          }
        })
      })
    } else {
      expressions.push({
        [field]: query[field]
      })
    }

    return expressions
  }, [])

  // Construct an $and query when more than one expression is given.
  if (expressions.length > 1) {
    query = {
      $and: expressions
    }
  }

  return query
}

/**
 *
 * @param {Object} options - the query options passed from API, such as page, limit, skip
 * @returns {Object} an object containing the metadata about the collection
 */
DataStore.prototype.stats = function(collection, options) {
  return Promise.resolve({
    count: 1,
    size: 1,
    averageObjectSize: 1,
    storageSize: 1,
    indexes: 1,
    totalIndexSize: 1,
    indexSizes: 1
  })
}

/**
 * Update documents in the database
 *
 * @param {Object} query - the query that selects documents for update
 * @param {string} collection - the name of the collection to update documents in
 * @param {Object} update - the update for the documents matching the query
 * @param {Object} schema - the JSON schema for the collection
 * @returns {Promise.<Array, Error>} A promise that returns an Array of updated documents,
 *     or an Error if the operation fails
 */
DataStore.prototype.update = function({
  query,
  collection,
  update,
  options = {},
  schema
}) {
  if (this._mockIsDisconnected(collection)) {
    this.readyState = STATE_DISCONNECTED

    return Promise.reject(new Error('DB_DISCONNECTED'))
  }

  query = this.prepareQuery(query)

  this._debug('update', {
    collection,
    query,
    update
  })

  return new Promise((resolve, reject) => {
    this.getCollection(collection).then(collection => {
      const updateFn = new Update(update)
      const results = collection
        .chain()
        .find(query)
        .data()

      collection.update(updateFn.update(results))

      return resolve({
        matchedCount: results.length
      })
    })
  })
}

global.___dbOps = global.___dbOps || []

const WRAPPED_METHODS = [
  'connect',
  'delete',
  'destroy',
  'dropDatabase',
  'find',
  'getIndexes',
  'index',
  'insert',
  //'stats',
  'update'
]

WRAPPED_METHODS.forEach(methodName => {
  const wrappedMethodName = '$$' + methodName

  DataStore.prototype[wrappedMethodName] = DataStore.prototype[methodName]
  DataStore.prototype[methodName] = function() {
    if (global.___skipTestFromScript) {
      return this[wrappedMethodName].apply(this, arguments)
    }

    const op = {
      t: methodName,
      a: Array.from(arguments)
    }

    // In some situations, the order in which the data connector returns
    // a result set is irrelevant. We must flag those situations in the
    // script output so that the comparison method on the data connector
    // side can adjust accordingly.
    if (
      methodName === 'find' &&
      op.a[0].collection === config.get('search.wordCollection')
    ) {
      op.looseResultSearch = true
    }

    global.___dbOps.push(op)

    return Promise.resolve(this[wrappedMethodName].apply(this, arguments))
      .then(result => {
        op.r = result

        return result
      })
      .catch(error => {
        op.e = true

        return Promise.reject(error)
      })
  }
})

module.exports = DataStore
module.exports.settings = {
  connectWithCollection: false
}
module.exports._mock = {
  connect: () => {
    instancePool.forEach(instance => instance._mockConnect())
  },

  disconnect: () => {
    instancePool.forEach(instance => instance._mockDisconnect())
  },

  setFailedConnection: state => {
    mockConnection.failed = state
  }
}
