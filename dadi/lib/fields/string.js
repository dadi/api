module.exports.type = 'string'

function escapeRegExp (string) {
  return string.replace(/([.?*+^$[\]\\(){}|-])/g, '\\$1')
}

function sanitiseString (string, schema = {}) {
  // Do nothing for falsy values.
  if (string === null || string === undefined || string === false) {
    return string
  }

  // If the string is representing a number, we leave it alone.
  // This retains backward-compatibility for situations where the
  // value of a String field is treated as a number, and operated on
  // with expressions like $gt or $lt. It raises the question as to
  // why you'd do something like that, worth revisiting in the future.
  if (parseFloat(string).toString() === string) {
    return string
  }

  if (typeof string === 'string') {
    switch (schema.matchType) {
      case undefined:
      case 'ignoreCase':
        return new RegExp(['^', escapeRegExp(string), '$'].join(''), 'i')

      case 'exact':
        return string

      default:
        return new RegExp(['^', escapeRegExp(string), '$'].join(''))
    }
  }

  let sanitisedString = {}

  Object.keys(string).forEach(key => {
    sanitisedString[key] = key === '$regex'
      ? new RegExp(string[key], 'i')
      : sanitiseString(string[key], schema)
  })

  return sanitisedString
}

module.exports.beforeQuery = ({field, input, schema}) => {
  return sanitiseString(input, schema)
}
