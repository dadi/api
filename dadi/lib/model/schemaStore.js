const config = require('../../../config')
const Connection = require('./connection')
const fieldComponents = require('../fields/')
const Model = require('./index')

const fieldTypes = Object.keys(fieldComponents).map(name => {
  return fieldComponents[name].type
})

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
    const {results: existingSchemas} = await this.find({
      name,
      property,
      version
    })

    if (existingSchemas.length > 0) {
      throw new Error('SCHEMA_EXISTS')
    }

    this.validate({fields, settings})

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
    const {deletedCount} = await database.delete({
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

    return deletedCount
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

  async get({collection, property}) {
    const {results} = await this.find({collection, property})

    if (results.length === 0) {
      return Promise.reject(new Error('SCHEMA_NOT_FOUND'))
    }

    return results[0]
  }

  async update({fields, name, property, settings, version}) {
    this.validate({
      fields,
      settings
    })

    const database = await this.connection
    const update = {
      fields,
      settings,
      timestamp: Date.now()
    }
    const {matchedCount} = await database.update({
      collection: config.get('schemas.collection'),
      query: {
        name,
        property,
        version
      },
      update: {
        $set: update
      }
    })

    if (matchedCount === 0) {
      return null
    }

    const updatedSchema = await this.get({
      name,
      property,
      version
    })

    // Reloading the model.
    Model({
      isListable: true,
      name,
      schema: updatedSchema.fields,
      settings: updatedSchema.settings,
      property,
      version
    })

    return updatedSchema
  }

  validate({fields, settings}) {
    const errors = []

    if (typeof fields === 'object' && fields.toString() === '[object Object]') {
      if (Object.keys(fields).length > 0) {
        Object.keys(fields).forEach(fieldName => {
          if (typeof fields[fieldName].type === 'string') {
            fields[fieldName].type = fields[fieldName].type.toLowerCase()

            if (!fieldTypes.includes(fields[fieldName].type)) {
              const availableTypes = fieldTypes.join(', ')

              errors.push(
                `Type of field \`${fieldName}\` (${fields[fieldName].type}) is not valid. Available types: ${availableTypes}`
              )
            }
          } else {
            errors.push(
              `Field \`${fieldName}\` must contain a \`type\` property`
            )
          }
        })
      } else {
        errors.push('`fields` must contain at least one field')
      }
    } else {
      errors.push('`fields` must be an object')
    }

    if (settings) {
      if (
        typeof settings === 'object' &&
        settings.toString() === '[object Object]'
      ) {
        const {
          authenticate,
          cache,
          callback,
          count,
          defaultFilters,
          displayName,
          enableVersioning,
          fieldLimiters,
          index,
          versioningCollection
        } = settings

        if (authenticate !== undefined && typeof authenticate !== 'boolean') {
          const isVerbArray =
            Array.isArray(authenticate) &&
            authenticate.every(item => {
              return ['delete', 'get', 'post', 'put'].includes(
                item.toString().toLowerCase()
              )
            })

          if (!isVerbArray) {
            errors.push(
              '`settings.authenticate` must be a Boolean or an array including one or more HTTP verbs (DELETE, GET, POST, PUT)'
            )
          }
        }

        if (cache !== undefined && typeof cache !== 'boolean') {
          errors.push('`settings.cache` must be a Boolean')
        }

        if (
          count !== undefined &&
          (typeof count !== 'number' || !Number.isInteger(count) || count <= 0)
        ) {
          errors.push('`settings.count` must be a positive, integer number')
        }

        if (
          callback &&
          (typeof callback !== 'string' || callback.trim().length === 0)
        ) {
          errors.push('`settings.callback` must be a non-empty string')
        }

        if (
          defaultFilters !== undefined &&
          defaultFilters.toString() !== '[object Object]'
        ) {
          errors.push('`settings.defaultFilters` must be an object')
        }

        if (
          displayName &&
          (typeof displayName !== 'string' || displayName.trim().length === 0)
        ) {
          errors.push('`settings.displayName` must be a non-empty string')
        }

        if (
          enableVersioning !== undefined &&
          typeof enableVersioning !== 'boolean'
        ) {
          errors.push('`settings.enableVersioning` must be a Boolean')
        }

        if (fieldLimiters !== undefined) {
          if (fieldLimiters.toString() === '[object Object]') {
            let expectedValue

            const isFieldProjection = Object.keys(fieldLimiters).every(
              (fieldName, index) => {
                if (index === 0) {
                  expectedValue = fieldLimiters[fieldName]
                } else if (fieldLimiters[fieldName] !== expectedValue) {
                  return false
                }

                return (
                  fieldLimiters[fieldName] === 1 ||
                  fieldLimiters[fieldName] === 0
                )
              }
            )

            if (!isFieldProjection) {
              errors.push(
                '`settings.fieldLimiters` must be an object with a field projection (i.e. field names as keys and either all 1 or all 0 as values)'
              )
            }
          } else {
            errors.push('`settings.fieldLimiters` must be an object')
          }
        }

        if (index !== undefined && index.toString() !== '[object Object]') {
          errors.push('`settings.index` must be an object')
        }

        if (
          versioningCollection &&
          (typeof versioningCollection !== 'string' ||
            versioningCollection.trim().length === 0)
        ) {
          errors.push(
            '`settings.versioningCollection` must be a non-empty string'
          )
        }
      } else {
        errors.push('`settings` must be an object')
      }
    }

    if (errors.length > 0) {
      const error = new Error('VALIDATION_ERROR')

      error.errors = errors

      throw error
    }
  }
}

module.exports = new SchemaStore()
module.exports.SchemaStore = SchemaStore
