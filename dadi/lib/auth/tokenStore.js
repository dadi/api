'use strict'

const debug = require('debug')('api:tokenStore')
const log = require('@dadi/logger')
const path = require('path')
const Connection = require(path.join(__dirname, '/../model/connection'))
const config = require(path.join(__dirname, '/../../../config.js'))
const uuid = require('uuid')

const TokenStore = function () {
  this.recoveringFromDBDisconnect = false
  this.collection = config.get('auth.tokenCollection')
  this.databaseName = config.get('auth.database')
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
      override: true,
      collection: this.collection,
      database: this.databaseName
    }

    this.connection = Connection(dbOptions, this.collection, config.get('auth.datastore'))
    this.connection.once('connect', database => {
      if (this.recoveringFromDBDisconnect) {
        this.recoveringFromDBDisconnect = false

        return resolve(this.connect())
      }

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

    this.connection.once('disconnect', err => {
      log.error({module: 'tokenStore'}, err)

      this.recoveringFromDBDisconnect = true

      return reject(new Error('DB_DISCONNECTED'))
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
    return database.find({
      query: {token, tokenExpire: {$gte: Date.now()}},
      collection: this.collection,
      schema: this.schema.fields,
      settings: this.schema.settings
    })
  }).then(data => {
    if (data.results.length) {
      return data.results[0]
    }

    return null
  })
}

/**
 * Writes a token to the database.
 *
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
    return database.insert({
      data: payload,
      collection: this.collection,
      schema: this.schema.fields,
      settings: this.schema.settings
    })
  }).then(docs => docs[0])
}

/**
 * Starts the clean-up agent, which will regularly remove
 * expired tokens at the interval defined in config.
 *
 * @return {Number} A reference to the `setInterval` call
 */
TokenStore.prototype.startCleanupAgent = function () {
  this.cleanupAgent = setInterval(() => {
    debug('Cleaning up expired tokens')

    this.database.then(database => {
      // Deleting any tokens with an expiry date in the past.
      database.delete({
        query: { tokenExpire: { $lt: Date.now() } },
        collection: this.collection,
        schema: this.schema
      }).catch(err => {
        console.log('Error whilst cleaning up expired tokens:', err)
      })
    })
  }, config.get('auth.cleanupInterval') * 1000)

  return this.cleanupAgent
}

/**
 * Stops the clean-up agent, removing any checks for expired
 * tokens.
 */
TokenStore.prototype.stopCleanupAgent = function () {
  clearInterval(this.cleanupAgent)
}

let tokenStore

module.exports = () => {
  if (!tokenStore) {
    tokenStore = new TokenStore()
    tokenStore.connect().catch(err => {
      log.error({module: 'tokenStore'}, err)
    })
  }

  return tokenStore
}

module.exports.TokenStore = TokenStore
