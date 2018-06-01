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
 * Returns the resource map with access matrices containing
 * the value for all access types, i.e. if a particular access
 * type is not defined for the resource, its value will be set
 * to `false` in the output.
 *
 * @return {Object}
 */
Matrix.prototype.format = function () {
  return Object.keys(this.map).reduce((output, resource) => {
    let formattedResource = {}

    ACCESS_TYPES.forEach(type => {
      formattedResource[type] = this.map[resource][type] || false
    })

    output[resource] = formattedResource

    return output
  }, {})
}

/**
 * Returns the access matrix for a particular resource if `name`
 * is defined. If not, the entire resource map is returned, i.e.
 * an object mapping resource names to access matrices.
 *
 * @param  {String} name
 * @return {Object}
 */
Matrix.prototype.get = function (name) {
  return name ? this.map[name] : this.map
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
                `Invalid value in access matrix: ${matrix[type]}.${key} (expected object)`
              )
            }
          } else {
            errors.push(
              `Invalid key in access matrix: ${matrix[type]}.${key}`
            )
          }
        })

        break

      default:
        errors.push(
          `Invalid value for ${type} (expected boolean or object)`
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
