const FieldTypes = require('./../../fields')

const Fields = function () {
  this.schema = {
    type: {
      default: 'String',
      required: true,
      type: 'string'
    },
    required: {
      default: false,
      required: false,
      type: 'boolean'
    }
  }
}

Fields.prototype.validateFields = function (fields) {
  if (Object(fields) !== fields || Object.keys(fields).length === 0) {
    return Promise.reject(new Error('NO_FIELDS_PROVIDED'))
  }

  return Promise.all(Object.keys(fields).map(field => this.validate(fields[field])))
}

/**
 * Performs validation on a candidate collection. It returns a Promise
 * that is rejected with an error object if validation fails, or
 * resolved with `undefined` otherwise.
 *
 * @param  {String}   field
 * @param  {Boolean}  options.partial Whether this is a partial value
 * @return {Promise}
 */
Fields.prototype.validate = function (newField, {partial = false} = {}) {
  let missingFields = Object.keys(this.schema).filter(field => {
    return this.schema[field].required && newField[field] === undefined
  })

  if (!partial && missingFields.length > 0) {
    let error = new Error('MISSING_FIELDS')

    error.data = missingFields

    return Promise.reject(error)
  }

  // Check the field "type" is valid in /lib/fields.
  let isValidType = Object.keys(FieldTypes).map(fieldType => {
    return FieldTypes[fieldType].type
  }).includes(newField.type.toLowerCase())

  if (!isValidType) {
    let error = new Error('INVALID_FIELD_TYPE')

    error.data = newField.type

    return Promise.reject(error)
  }

  if (!partial && missingFields.length > 0) {
    let error = new Error('MISSING_FIELDS')

    error.data = missingFields

    return Promise.reject(error)
  }

  let invalidFields = Object.keys(this.schema).filter(field => {
    if (
      newField[field] !== undefined &&
      this.schema[field].allowedInInput === false
    ) {
      return true
    }

    return (
      newField[field] !== undefined &&
      newField[field] !== null &&
      typeof newField[field] !== this.schema[field].type
    )
  })

  Object.keys(newField).forEach(field => {
    if (!this.schema[field]) {
      invalidFields.push(field)
    }
  })

  if (invalidFields.length > 0) {
    let error = new Error('INVALID_FIELDS')

    error.data = invalidFields

    return Promise.reject(error)
  }

  return Promise.resolve()
}

module.exports = new Fields()
