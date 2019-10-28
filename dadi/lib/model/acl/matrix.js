const log = require('@dadi/logger')
const Validator = require('@dadi/api-validator')

const ACCESS_TYPES = [
  'delete',
  'deleteOwn',
  'create',
  'read',
  'readOwn',
  'update',
  'updateOwn'
]

const validator = new Validator()

const Matrix = function(map) {
  map = this._convertArrayNotationToObjectNotation(map)

  this.map = this._convertACLObjects(map || {}, {
    shouldStringify: false
  })
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
Matrix.prototype._addFalsyTypes = function(map) {
  return Object.keys(map).reduce((output, resource) => {
    const formattedResource = {}

    ACCESS_TYPES.forEach(type => {
      formattedResource[type] = map[resource][type] || false
    })

    output[resource] = formattedResource

    return output
  }, {})
}

/**
 * Takes a map and converts any ACL objects (e.g. `fields` or `filter`)
 * inside each matrix from their object form to a JSON string if
 * `shouldStringify` is `true`, or vice-versa if it's `false`.
 *
 * @param  {Object}  map
 * @param  {Boolean} options.shouldStringify
 * @return {Object}
 */
Matrix.prototype._convertACLObjects = function(map, {shouldStringify} = {}) {
  return Object.keys(map).reduce((output, resource) => {
    output[resource] = this._convertACLObjectsInMatrix(map[resource], {
      shouldStringify
    })

    return output
  }, {})
}

/**
 * Takes a matrix and converts any ACL objects (e.g. `fields` or
 * `filter`) from their object form to a JSON string if `shouldStringify`
 * is `true`, or vice-versa if it's `false`.
 *
 * @param  {Object}  matrix
 * @param  {Boolean} options.shouldStringify
 * @return {Object}
 */
Matrix.prototype._convertACLObjectsInMatrix = function(
  matrix,
  {shouldStringify} = {}
) {
  const fromType = shouldStringify ? 'object' : 'string'
  const transformFn = shouldStringify ? JSON.stringify : JSON.parse

  return Object.keys(matrix).reduce((sanitised, accessType) => {
    if (typeof matrix[accessType] === 'object') {
      sanitised[accessType] = Object.keys(matrix[accessType]).reduce(
        (value, key) => {
          if (value === false) {
            return value
          }

          if (typeof matrix[accessType][key] === fromType) {
            try {
              const transformedValue = transformFn(matrix[accessType][key])

              value[key] = transformedValue
            } catch (error) {
              log.error(
                {
                  module: 'ACL matrix'
                },
                error
              )

              value = false
            }
          } else {
            value[key] = matrix[accessType][key]
          }

          return value
        },
        {}
      )
    } else {
      sanitised[accessType] = matrix[accessType]
    }

    return sanitised
  }, {})
}

/**
 * Takes an access map in array notation and converts it to
 * the corresponding object notation.
 *
 * @param  {Array} input
 * @return {Object}
 */
Matrix.prototype._convertArrayNotationToObjectNotation = function(input) {
  if (!Array.isArray(input)) {
    return input
  }

  const output = input.reduce((mapObject, entry) => {
    mapObject[entry.r] = entry.a

    return mapObject
  }, {})

  return output
}

/**
 * Takes an access map in object notation and converts it to
 * the corresponding array notation.
 *
 * @param  {Object} input
 * @return {Array}
 */
Matrix.prototype._convertObjectNotationToArrayNotation = function(input) {
  if (Array.isArray(input)) {
    return input
  }

  const output = Object.keys(input).map(resource => {
    return {
      r: resource,
      a: input[resource]
    }
  })

  return output
}

/**
 * Returns the access matrix for a particular resource.
 *
 * @param  {String}  name                     The name of the resource to retrieve
 * @param  {Boolean} options.addFalsyTypes    Add `false` to missing access types
 * @param  {Boolean} options.getArrayNotation Return map as array notation
 * @param  {Boolean} options.parseObjects     Get parsed version of ACL objects
 * @param  {Boolean} options.stringifyObjects Get stringified version of ACL objects
 * @return {Object}
 */
Matrix.prototype.get = function(
  name,
  {addFalsyTypes, getArrayNotation, parseObjects, stringifyObjects} = {}
) {
  const map = this.getAll({
    addFalsyTypes,
    getArrayNotation,
    parseObjects,
    stringifyObjects
  })

  return map[name]
}

/**
 * Returns the entire resource map.
 *
 * @param  {Boolean} options.addFalsyTypes    Add `false` to missing access types
 * @param  {Boolean} options.getArrayNotation Return map as array notation
 * @param  {Boolean} options.parseObjects     Get parsed version of ACL objects
 * @param  {Boolean} options.stringifyObjects Get stringified version of ACL objects
 * @return {Object}
 */
Matrix.prototype.getAll = function({
  addFalsyTypes,
  getArrayNotation,
  parseObjects,
  stringifyObjects
} = {}) {
  let map = this.map

  if (addFalsyTypes) {
    map = this._addFalsyTypes(map)
  }

  if (stringifyObjects) {
    map = this._convertACLObjects(map, {
      shouldStringify: true
    })
  } else if (parseObjects) {
    map = this._convertACLObjects(map, {
      shouldStringify: false
    })
  }

  if (getArrayNotation) {
    map = this._convertObjectNotationToArrayNotation(map)
  }

  return map
}

/**
 * Removes the resource from the resource map.
 *
 * @param  {String} name
 */
Matrix.prototype.remove = function(name) {
  delete this.map[name]
}

/**
 * Adds a resource to the resource map.
 *
 * @param {String} name
 * @param {Object} matrix
 */
Matrix.prototype.set = function(name, matrix) {
  const sanitisedMatrix = this._convertACLObjectsInMatrix(matrix, {
    shouldStringify: false
  })

  this.map[name] = Object.assign({}, this.map[name], sanitisedMatrix)
}

module.exports = Matrix
module.exports.ACCESS_TYPES = ACCESS_TYPES
