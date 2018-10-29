module.exports.type = 'media'

module.exports.beforeOutput = function ({
  client,
  config,
  field,
  input,
  schema
}) {
  let bucket = (schema.settings && schema.settings.mediaBucket) || config.get('media.defaultBucket')
  let model = this.getForeignModel(bucket)

  if (!model) {
    return input
  }

  let isArraySyntax = Array.isArray(input[field])
  let normalisedValue = isArraySyntax ? input[field] : [input[field]]
  let mediaObjectIDs = normalisedValue.map(value => {
    if (typeof value !== 'string') {
      return value._id
    }

    return value
  }).filter(Boolean)

  if (mediaObjectIDs.length === 0) {
    return input
  }

  return model.get({
    client,
    query: {
      _id: {
        $in: mediaObjectIDs
      }
    }
  }).then(({results}) => {
    return results.reduce((mediaObjects, result) => {
      mediaObjects[result._id] = result

      return mediaObjects
    }, {})
  }).then(mediaObjects => {
    return normalisedValue.map(value => {
      if (mediaObjects[value._id]) {
        let mergedValue = Object.assign({}, mediaObjects[value._id], value)
        let sortedValue = Object.keys(mergedValue).sort().reduce((sortedValue, field) => {
          sortedValue[field] = mergedValue[field]

          return sortedValue
        }, {})

        return sortedValue
      }

      return value
    })
  }).then(composedValue => {
    return Object.assign(input, {
      [field]: isArraySyntax ? composedValue : composedValue[0]
    })
  })
}

module.exports.beforeSave = function ({
  field,
  input
}) {
  let isArraySyntax = Array.isArray(input[field])
  let normalisedValue = (isArraySyntax ? input[field] : [input[field]]).map(value => {
    if (typeof value === 'string') {
      return {
        _id: value
      }
    }

    return value
  })

  return {
    [field]: isArraySyntax ? normalisedValue : normalisedValue[0]
  }
}
