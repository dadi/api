const config = require('../../../config')
const Connection = require('./connection')
const Model = require('./index')

class SchemaStore {
  constructor() {
    this._connect()
  }

  _connect() {
    const connection = Connection(
      {
        collection: config.get('schemas.collection')
      },
      config.get('schemas.collection'),
      config.get('datastore')
    )

    this.connection = connection.whenConnected()
  }

  // async add({aclKey, collection, fields, property, settings, timestamp}) {
  //   const database = await this.connection
  //   const {results} = await this.find({collection, property})
  //   const newSchema = {
  //     aclKey,
  //     collection,
  //     fields,
  //     property,
  //     settings,
  //     timestamp: Date.now()
  //   }

  //   if (results.length > 0) {
  //     const existing = results[0]

  //     if (existing.timestamp >= timestamp) {
  //       return {
  //         existing
  //       }
  //     }

  //     const {results} = await database.update({
  //       collection: config.get('schemas.collection'),
  //       query: {
  //         _id: existing._id
  //       },
  //       update: newSchema
  //     })

  //     return {
  //       created: results[0],
  //       existing
  //     }
  //   }

  //   const insertedDocuments = await database.insert({
  //     collection: config.get('schemas.collection'),
  //     data: document
  //   })

  //   return {
  //     created: insertedDocuments[0],
  //     existing: null
  //   }
  // }

  async bootstrap() {
    const {results: schemas} = await this.find()

    schemas.forEach(schema => {
      // Loading the model.
      Model({
        isListable: true,
        name: schema.name,
        property: schema.property,
        schema: schema.fields,
        settings: schema.settings,
        version: schema.version
      })
    })
  }

  async create({fields, name, settings, property, version}) {
    const database = await this.connection
    const results = await database.insert({
      collection: config.get('schemas.collection'),
      data: {
        fields,
        name,
        settings,
        property,
        timestamp: Date.now(),
        version
      }
    })

    // Reloading the model.
    Model({
      isListable: true,
      name,
      schema: fields,
      settings,
      property,
      version
    })

    return results
  }

  async delete({name, property, version}) {
    const database = await this.connection

    await database.delete({
      collection: config.get('schemas.collection'),
      query: {
        name,
        property,
        version
      }
    })

    Model.unload({
      name,
      property,
      version
    })
  }

  async find(query = {}) {
    const database = await this.connection

    return database.find({
      collection: config.get('schemas.collection'),
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
