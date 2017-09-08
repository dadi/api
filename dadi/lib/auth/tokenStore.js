'use strict'

const debug = require('debug')('api:tokenStore')
const path = require('path')
const Connection = require(path.join(__dirname, '/../model/connection'))
const config = require(path.join(__dirname, '/../../../config.js'))
const uuid = require('uuid')

const TokenStore = function () {
  this.collection = config.get('auth.tokenCollection')
  this.database = config.get('auth.database')
  this.schema = {
    fields: {
      token: {
        type: 'String',
        required: true
      },
      tokenExpire: {
        type: 'Number',
        required: true
      },
      created: {
        type: 'DateTime',
        required: true
      },
      value: {
        type: 'Object',
        required: false
      }
    },
    settings: {
      cache: false
    }
  }
}

/**
 * Initiates a connection to the database, returning the
 * database object once the connection has been established.
 * It assigns the resulting Promise to `this.database`, so
 * that any methods that require a connection to the database
 * can wait for that Promise to resolve and only then make
 * use of the database object.
 *
 * @return {Promise} The database object
 */
TokenStore.prototype.connect = function () {
  this.database = new Promise((resolve, reject) => {
    const dbOptions = {
      auth: true,
      collection: this.collection,
      database: this.database
    }

    this.connection = Connection(dbOptions, null, config.get('auth.datastore'))
    this.connection.once('connect', database => {
      // Initialise cleanup agent
      this.startCleanupAgent()

      // Creating indexes
      return database.index(this.collection, [
        {
          keys: {
            token: 1,
            tokenExpire: 1
          }
        }
      ]).then(result => resolve(database))
    })
  })

  return this.database
}

/**
 * Generates a new unique token.
 *
 * @return {Promise} A new token
 */
TokenStore.prototype.generateNew = function () {
  const token = uuid.v4()

  return this.get(token).then(result => {
    // If the token already exists, get a new one.
    if (result) {
      return this.generateNew()
    }

    return token
  })
}

/**
 * Finds documents in the token store that contain the given
 * token, provided that the expiry date for the token is in
 * the future.
 *
 * @param  {String} The token
 * @return {Promise} An object representing the document with
 *    the given token, or `null` if no documents
 *    have been found.
 */
TokenStore.prototype.get = function (token) {
  return this.database.then(database => {
    return database.find(
      {token, tokenExpire: {$gte: Date.now()}},
      this.collection,
      {},
      this.schema
    )
  }).then(data => {
    if (data.results.length) {
      return data.results[0]
    }

    return null
  })
}

/**
 * @param {String} The token
 * @param {Object} A data object to be appended to the
 *    token document.
 * @return {Promise} The created document
 */
TokenStore.prototype.set = function (token, data) {
  const payload = {
    created: new Date(),
    token,
    tokenExpire: Date.now() + (config.get('auth.tokenTtl') * 1000),
    value: data
  }

  return this.database.then(database => {
    return database.insert(
      payload,
      this.collection,
      // {},
      this.schema
    )
  }).then(docs => docs[0])
}

TokenStore.prototype.startCleanupAgent = function () {
  this.cleanupAgent = setInterval(() => {
    debug('Cleaning up expired tokens')

    this.database.then(database => {
      // Deleting any tokens with an expiry date in the past.
      database.delete(
        {tokenExpire: {$lt: Date.now()}},
        this.collection,
        {},
        this.schema
      ).catch(err => {
        console.log('Error whilst cleaning up expired tokens:', err)
      })
    })
  }, config.get('auth.cleanupInterval') * 1000)
}

let tokenStore

module.exports = () => {
  if (!tokenStore) {
    tokenStore = new TokenStore()
    tokenStore.connect()
  }

  return tokenStore
}

module.exports.TokenStore = TokenStore
