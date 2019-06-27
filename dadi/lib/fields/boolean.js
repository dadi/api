module.exports.type = 'boolean'

module.exports.beforeQuery = function({field, input}) {
  if (typeof input[field] === 'boolean') {
    return {
      // If the query is "where field is false", modify it
      // to "where field is not true" to ensure that records
      // that don't have the specified field are also returned
      [field]: input[field] ? true : {$ne: true}
    }
  }

  // If the input value is not a Boolean, it only makes sense to accept it
  // if it's an object with a boolean `$ne` operator inside it.
  return typeof input[field].$ne === 'boolean' ? input : {}
}
