const log = require('@dadi/logger')

const ACCESS_TYPES = [
  'delete',
  'deleteOwn',
  'create',
  'read',
  'readOwn',
  'update',
  'updateOwn'
]

const Matrix = function (map) {
  this.map = map || {}
}

/**
 * Returns the resource map with access matrices formatted
 * for insertion in the database.
 *
 * @param  {Object} map
 * @return {Object}
 */
Matrix.prototype._formatForInput = function (map) {
  return Object.keys(map).reduce((output, resource) => {
    output[resource] = this._formatMatrixForInput(
      this.map[resource]
    )

    return output
  }, {})
}

/**
 * Returns the resource map with access matrices containing
 * the value for all access types, i.e. if a particular access
 * type is not defined for the resource, its value will be set
 * to `false` in the output.
 *
 * @param  {Object} map
 * @return {Object}
 */
Matrix.prototype._formatForOutput = function (map) {
  return Object.keys(map).reduce((output, resource) => {
    let formattedResource = {}

    ACCESS_TYPES.forEach(type => {
      let value = map[resource][type]

      if (typeof value === 'object') {
        value = Object.keys(value).reduce((sanitised, key) => {
          if (typeof value[key] === 'string') {
            try {
              let parsedValue = JSON.parse(value[key])

              sanitised[key] = parsedValue
            } catch (error) {
              log.error({
                module: 'ACL matrix'
              }, error)
            }
          } else {
            sanitised[key] = value[key]
          }

          return sanitised
        }, {})
      }

      formattedResource[type] = value || false
    })

    output[resource] = formattedResource

    return output
  }, {})
}

/**
 * Returns the access matrix formatted for insertion in the database.
 *
 * @param  {Object} map
 * @return {Object}
 */
Matrix.prototype._formatMatrixForInput = function (matrix) {
  return Object.keys(matrix).reduce((sanitised, accessType) => {
    if (typeof matrix[accessType] === 'object') {
      sanitised[accessType] = Object.keys(matrix[accessType]).reduce((value, key) => {
        value[key] = typeof matrix[accessType][key] === 'object'
          ? JSON.stringify(matrix[accessType][key])
          : matrix[accessType][key]

        return value
      }, {})
    } else {
      sanitised[accessType] = matrix[accessType]
    }

    return sanitised
  }, {})
}

/**
 * Returns the access matrix for a particular resource.
 *
 * @param  {String}  name                      The name of the resource to retrieve
 * @param  {Boolean} options.formatForInput   Whether to format the result for input
 * @param  {Boolean} options.formatForOutput} Whether to format the result for input
 * @return {Object}
 */
Matrix.prototype.get = function (name, {
  formatForInput,
  formatForOutput
} = {}) {
  let map = this.map

  if (formatForInput) {
    map = this._formatForInput(map)
  } else if (formatForOutput) {
    map = this._formatForOutput(map)
  }

  return map[name]
}

/**
 * Returns the entire resource map.
 *
 * @param  {Boolean} options.formatForInput   Whether to format the result for input
 * @param  {Boolean} options.formatForOutput} Whether to format the result for input
 * @return {Object}
 */
Matrix.prototype.getAll = function ({
  formatForInput,
  formatForOutput
} = {}) {
  if (formatForInput) {
    return this._formatForInput(this.map)
  }

  if (formatForOutput) {
    return this._formatForOutput(this.map)
  }

  return this.map
}

/**
 * Removes the resource from the resource map.
 *
 * @param  {String} name
 */
Matrix.prototype.remove = function (name) {
  delete this.map[name]
}

/**
 * Adds a resource to the resource map.
 *
 * @param {String} name
 * @param {Object} matrix
 */
Matrix.prototype.set = function (name, matrix) {
  this.validate(matrix)

  this.map[name] = Object.assign({}, this.map[name], matrix)
}

/**
 * Validates an access matrix. Returns an error if validation fails.
 * Otherwise, `undefined` is returned.
 *
 * @param  {Object} matrix
 */
Matrix.prototype.validate = function (matrix) {
  let errors = []

  Object.keys(matrix).forEach(type => {
    if (!ACCESS_TYPES.includes(type)) {
      errors.push(`Invalid access type: ${type}`)
    }

    switch (typeof matrix[type]) {
      case 'boolean':
        return

      case 'object':
        Object.keys(matrix[type]).forEach(key => {
          if (['fields', 'filter'].includes(key)) {
            if (typeof matrix[type][key] !== 'object') {
              errors.push(
                `Invalid value in access matrix for key ${type}.${key} (expected object)`
              )
            } else if (key === 'fields') {
              let fieldsObj = matrix[type][key]
              let fields = Object.keys(fieldsObj)

              // A valid fields projection is an object where all fields are
              // 0 or 1, never combining the two.
              let invalidProjection = fields.some((field, index) => {
                if (fieldsObj[field] !== 0 && fieldsObj[field] !== 1) {
                  return true
                }

                let nextField = fields[index + 1]

                if (
                  nextField !== undefined &&
                  fieldsObj[field] !== fieldsObj[nextField]
                ) {
                  return true
                }
              })

              if (invalidProjection) {
                errors.push(
                  `Invalid field projection in access matrix for ${type} access type. Accepted values for keys are either 0 or 1 and they cannot be combined in the same projection`
                )
              }
            }
          } else {
            errors.push(
              `Invalid key in access matrix: ${type}.${key}`
            )
          }
        })

        break

      default:
        errors.push(
          `Invalid value for ${type}. Expected Boolean or Object`
        )
    }
  })

  if (errors.length > 0) {
    let error = new Error('ACCESS_MATRIX_VALIDATION_FAILED')

    error.data = errors

    throw error
  }
}

module.exports = Matrix
module.exports.ACCESS_TYPES = ACCESS_TYPES
