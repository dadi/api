const moment = require('moment')

module.exports.type = 'datetime'

function convertDateTimeInQuery(input, schema, recursive) {
  if (input === null) return input

  if (input === '$now') {
    return Date.now()
  }

  if (typeof input === 'string' || typeof input === 'number') {
    let format

    if (
      typeof input !== 'number' &&
      schema.format !== 'iso' &&
      schema.format !== 'unix'
    ) {
      format = schema.format
    }

    const dateTime = moment.utc(input, format)
    const timestamp = dateTime.valueOf()

    if (Number.isNaN(timestamp)) {
      throw new Error('Not a valid DateTime value')
    }

    return timestamp
  }

  if (!recursive) {
    throw new Error('Not a valid DateTime value')
  }

  const output = {}

  Object.keys(input).forEach(key => {
    output[key] = convertDateTimeInQuery(input[key], schema, true)
  })

  return output
}

module.exports.beforeOutput = function({field, input, schema}) {
  if (!input[field]) {
    return {
      [field]: null
    }
  }

  const dateTime = moment.utc(input[field])
  let value

  switch (schema.format) {
    case undefined:
    case 'iso':
      value = dateTime.toISOString()

      break

    case 'unix':
      value = dateTime.valueOf()

      break

    default:
      value = dateTime.format(schema.format)

      break
  }

  return {
    [field]: value
  }
}

module.exports.beforeQuery = function({field, input, schema}) {
  return convertDateTimeInQuery(input, schema, true)
}

module.exports.beforeSave = function({field, input, schema}) {
  return {
    [field]: convertDateTimeInQuery(input[field], schema, false)
  }
}
