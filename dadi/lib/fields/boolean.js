module.exports.type = 'boolean'

module.exports.beforeQuery = function ({config, field, input, options}) {
  // If the query is "where field is false", modify it
  // to "where field is not true" to ensure that records
  // that don't have the specified field are also returned
  if ((input[field]) !== true) {
    return {
      [field]: { '$ne': true }
    }
  }

  return input
}
