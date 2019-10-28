const config = require('../../../config')
const Connection = require('./connection')
const Model = require('./index')
const Validator = require('@dadi/api-validator')

class SchemaStore {
  constructor() {
    this.validator = new Validator()

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

  async addFields({fields, name, property}) {
    const database = await this.connection
    const {results} = await this.find({
      name,
      property
    })

    if (results.length === 0) {
      throw new Error('SCHEMA_NOT_FOUND')
    }

    const {fields: currentFields} = results[0]
    const newFields = Object.keys(fields).reduce((result, fieldName) => {
      if (currentFields[fieldName]) {
        const error = new Error('FIELD_ALREADY_EXISTS')

        error.field = fieldName

        throw error
      }

      result[fieldName] = fields[fieldName]

      return result
    }, {})
    const updatedFields = Object.assign({}, currentFields, newFields)

    await this.validate({
      fields: updatedFields
    })

    const update = {
      fields: updatedFields,
      timestamp: Date.now()
    }
    const {matchedCount} = await database.update({
      collection: config.get('schemas.collection'),
      query: {
        name,
        property
      },
      update: {
        $set: update
      }
    })

    if (matchedCount === 0) {
      throw new Error('SCHEMA_NOT_FOUND')
    }

    const updatedSchema = await this.get({
      name,
      property
    })

    // Reloading the model.
    Model({
      isListable: true,
      name,
      schema: updatedSchema.fields,
      settings: updatedSchema.settings,
      property
    })

    return updatedSchema
  }

  async addFromSeed({
    fields,
    name,
    property,
    settings,
    timestamp = Date.now()
  }) {
    const database = await this.connection
    const {results: existingSchemas} = await this.find({
      name,
      property
    })
    const newSchema = {
      name,
      fields,
      property,
      settings,
      timestamp
    }

    if (existingSchemas.length > 0) {
      const existing = existingSchemas[0]

      if (existing.timestamp >= timestamp) {
        return {
          existing
        }
      }

      await database.update({
        collection: config.get('schemas.collection'),
        query: {
          _id: existing._id
        },
        update: {
          $set: newSchema
        }
      })

      // Reloading the model after update.
      Model({
        isListable: true,
        name,
        property,
        schema: fields,
        settings
      })

      return {
        created: true,
        existing
      }
    }

    const insertedDocuments = await database.insert({
      collection: config.get('schemas.collection'),
      data: newSchema
    })

    // Loading model after creation.
    Model({
      isListable: true,
      name,
      property,
      schema: fields,
      settings
    })

    return {
      created: insertedDocuments[0],
      existing: null
    }
  }

  async bootstrap() {
    const {results: schemas} = await this.find()

    schemas.forEach(schema => {
      // Loading the model.
      Model({
        isListable: true,
        name: schema.name,
        property: schema.property,
        schema: schema.fields,
        settings: schema.settings
      })
    })
  }

  async create({fields, name, settings, property, timestamp}) {
    const {results: existingSchemas} = await this.find({
      name,
      property
    })

    if (existingSchemas.length > 0) {
      throw new Error('SCHEMA_EXISTS')
    }

    await this.validate({
      fields,
      name,
      property,
      requiredFields: ['name', 'property'],
      settings
    })

    const database = await this.connection
    const results = await database.insert({
      collection: config.get('schemas.collection'),
      data: {
        fields,
        name,
        settings,
        property,
        timestamp: timestamp || Date.now()
      }
    })

    // Reloading the model.
    Model({
      isListable: true,
      name,
      schema: fields,
      settings,
      property
    })

    return results
  }

  async delete({name, property}) {
    const database = await this.connection
    const {deletedCount} = await database.delete({
      collection: config.get('schemas.collection'),
      query: {
        name,
        property
      }
    })

    Model.unload({
      name,
      property
    })

    return deletedCount
  }

  async deleteFields({fields, name, property}) {
    const database = await this.connection
    const {results} = await this.find({
      name,
      property
    })

    if (results.length === 0) {
      throw new Error('SCHEMA_NOT_FOUND')
    }

    const {fields: currentFields} = results[0]
    const hasValidFields = fields.some(fieldName => currentFields[fieldName])

    if (!hasValidFields) {
      throw new Error('FIELD_NOT_FOUND')
    }

    const updatedFields = Object.keys(currentFields).reduce(
      (result, fieldName) => {
        if (!fields.includes(fieldName)) {
          result[fieldName] = currentFields[fieldName]
        }

        return result
      },
      {}
    )

    await this.validate({
      fields: updatedFields
    })

    const update = {
      fields: updatedFields,
      timestamp: Date.now()
    }
    const {matchedCount} = await database.update({
      collection: config.get('schemas.collection'),
      query: {
        name,
        property
      },
      update: {
        $set: update
      }
    })

    if (matchedCount === 0) {
      throw new Error('SCHEMA_NOT_FOUND')
    }

    const updatedSchema = await this.get({
      name,
      property
    })

    // Reloading the model.
    Model({
      isListable: true,
      name,
      schema: updatedSchema.fields,
      settings: updatedSchema.settings,
      property
    })

    return updatedSchema
  }

  async find(query = {}) {
    const database = await this.connection

    return database.find({
      collection: config.get('schemas.collection'),
      query
    })
  }

  formatForOutput(schemas) {
    const isArray = Array.isArray(schemas)
    const schemasArray = isArray ? schemas : [schemas]
    const formattedSchemas = schemasArray.map(schema => {
      return Object.assign({}, schema, {_id: undefined})
    })

    return isArray ? formattedSchemas : formattedSchemas[0]
  }

  async get({name, property}) {
    const {results} = await this.find({name, property})

    if (results.length === 0) {
      return Promise.reject(new Error('SCHEMA_NOT_FOUND'))
    }

    return results[0]
  }

  async updateFields({fields, name, property}) {
    const database = await this.connection
    const {results} = await this.find({
      name,
      property
    })

    if (results.length === 0) {
      throw new Error('SCHEMA_NOT_FOUND')
    }

    const {fields: currentFields} = results[0]
    const hasValidFields = Object.keys(fields).some(
      fieldName => currentFields[fieldName]
    )

    if (!hasValidFields) {
      throw new Error('FIELD_NOT_FOUND')
    }

    const updatedFields = Object.keys(currentFields).reduce(
      (result, fieldName) => {
        // If the field is not part of the update, it remains unchanged.
        if (!fields[fieldName]) {
          result[fieldName] = currentFields[fieldName]

          return result
        }

        const newFieldName = fields[fieldName].name || fieldName
        const newFieldSchema = Object.assign(
          {},
          currentFields[fieldName],
          fields[fieldName]
        )

        // The update may contain a `name` property, which we need to remove
        // before inserting.
        delete newFieldSchema.name

        result[newFieldName] = newFieldSchema

        return result
      },
      {}
    )

    await this.validate({
      fields: updatedFields
    })

    const update = {
      fields: updatedFields,
      timestamp: Date.now()
    }
    const {matchedCount} = await database.update({
      collection: config.get('schemas.collection'),
      query: {
        name,
        property
      },
      update: {
        $set: update
      }
    })

    if (matchedCount === 0) {
      throw new Error('SCHEMA_NOT_FOUND')
    }

    const updatedSchema = await this.get({
      name,
      property
    })

    // Reloading the model.
    Model({
      isListable: true,
      name,
      schema: updatedSchema.fields,
      settings: updatedSchema.settings,
      property
    })

    return updatedSchema
  }

  async updateSettings({name, property, settings}) {
    const database = await this.connection
    const {results} = await this.find({
      name,
      property
    })

    if (results.length === 0) {
      throw new Error('SCHEMA_NOT_FOUND')
    }

    const {settings: currentSettings} = results[0]
    const updatedSettings = Object.assign({}, currentSettings, settings)

    await this.validate({
      settings: updatedSettings
    })

    const update = {
      settings: updatedSettings,
      timestamp: Date.now()
    }
    const {matchedCount} = await database.update({
      collection: config.get('schemas.collection'),
      query: {
        name,
        property
      },
      update: {
        $set: update
      }
    })

    if (matchedCount === 0) {
      throw new Error('SCHEMA_NOT_FOUND')
    }

    const updatedSchema = await this.get({
      name,
      property
    })

    // Reloading the model.
    Model({
      isListable: true,
      name,
      schema: updatedSchema.fields,
      settings: updatedSchema.settings,
      property
    })

    return updatedSchema
  }

  async validate({fields, name, property, requiredFields = [], settings}) {
    let combinedErrors = []

    try {
      const schema = {
        name: {
          type: 'string',
          required: requiredFields.includes('name')
        },
        property: {
          type: 'string',
          required: requiredFields.includes('property')
        }
      }

      await this.validator.validateDocument({
        document: {name, property},
        schema
      })
    } catch (errors) {
      combinedErrors = combinedErrors.concat(errors)
    }

    if (settings !== undefined) {
      try {
        await this.validator.validateSchemaSettings(settings)
      } catch (errors) {
        combinedErrors = combinedErrors.concat(errors)
      }
    }

    if (fields !== undefined) {
      try {
        await this.validator.validateSchemaFields(fields)
      } catch (errors) {
        combinedErrors = combinedErrors.concat(errors)
      }
    }

    if (combinedErrors.length > 0) {
      const error = new Error('VALIDATION_ERROR')

      error.errors = combinedErrors

      throw error
    }
  }
}

module.exports = new SchemaStore()
module.exports.SchemaStore = SchemaStore
