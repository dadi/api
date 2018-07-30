module.exports.type = 'string'

function escapeRegExp (string) {
  return string.replace(/([.?*+^$[\]\\(){}|-])/g, '\\$1')
}

function sanitise (input, schema = {}) {
  if (typeof input === 'string') {
    switch (schema.matchType) {
      case undefined:
      case 'ignoreCase':
        return new RegExp(['^', escapeRegExp(input), '$'].join(''), 'i')

      case 'exact':
        return input

      default:
        return new RegExp(['^', escapeRegExp(input), '$'].join(''))
    }
  }

  if (input.$regex) {
    return new RegExp(input.$regex, 'i')
  }

  return input
}

module.exports.beforeQuery = ({field, input, schema}) => {
  // Do nothing for falsy values.
  if (input === null || input === undefined || input === false) {
    return input
  }

  let sanitisedInput = Object.keys(input).reduce((result, key) => {
    result[key] = sanitise(input[key], schema)

    return result
  }, {})

  return sanitisedInput
}
