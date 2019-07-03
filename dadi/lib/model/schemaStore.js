const config = require('../../../config')
const Connection = require('./connection')

class SchemaStore {
  constructor() {
    this._connect()
  }

  _connect() {
    const connection = Connection(
      {
        collection: config.get('schemasCollection')
      },
      config.get('schemasCollection'),
      config.get('datastore')
    )

    this.connection = connection.whenConnected()
  }

  async add({aclKey, collection, fields, property, settings, timestamp}) {
    const database = await this.connection
    const {results} = await this.find({collection, property})
    const newSchema = {
      aclKey,
      collection,
      fields,
      property,
      settings,
      timestamp: Date.now()
    }

    if (results.length > 0) {
      const existing = results[0]

      if (existing.timestamp >= timestamp) {
        return {
          existing
        }
      }

      const {results} = await database.update({
        collection: config.get('schemasCollection'),
        query: {
          _id: existing._id
        },
        update: newSchema
      })

      return {
        created: results[0],
        existing
      }
    }

    const insertedDocuments = await database.insert({
      collection: config.get('schemasCollection'),
      data: document
    })

    return {
      created: insertedDocuments[0],
      existing: null
    }
  }

  async find(query = {}) {
    const database = await this.connection

    return database.find({
      collection: config.get('schemasCollection'),
      query
    })
  }

  async get({collection, property}) {
    const {results} = await this.find({collection, property})

    if (results.length === 0) {
      return Promise.reject(new Error('SCHEMA_NOT_FOUND'))
    }

    return results[0]
  }
}

module.exports = new SchemaStore()
module.exports.SchemaStore = SchemaStore
