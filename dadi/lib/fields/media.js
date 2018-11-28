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
  let composedIDs = []

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
    return mediaObjectIDs.map((id, index) => {
      let value = typeof normalisedValue[index] === 'object'
        ? normalisedValue[index]
        : {}

      if (mediaObjects[id]) {
        let mergedValue = Object.assign({}, mediaObjects[id], value)
        let sortedValue = Object.keys(mergedValue).sort().reduce((sortedValue, field) => {
          sortedValue[field] = mergedValue[field]

          return sortedValue
        }, {})

        composedIDs.push(id.toString())

        return sortedValue
      }

      return id
    })
  }).then(composedValue => {
    let output = Object.assign(input, {
      [field]: isArraySyntax ? composedValue : composedValue[0]
    })

    if (composedIDs.length > 0) {
      output._composed = {
        [field]: isArraySyntax ? composedIDs : composedIDs[0]
      }
    }

    return output
  })
}

module.exports.beforeSave = function ({
  config,
  field,
  input,
  schema
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
  let queue = Promise.resolve()

  // If there is a validation block with a `mimeTypes` property, it means we
  // need to ensure that the IDs supplied correspond to valid media objects
  // with a certain MIME type. As a result, we must:
  //
  // 1) Identify the media bucket and get the corresponding model;
  // 2) Grab the media objects referenced by the IDs;
  // 3) Look for any item on that list that doesn't exist, doesn't have a MIME
  //    type or has one that isn't included in the list of valid MIME types;
  // 4) Reject the request if the list produced in 3) is not empty.
  if (schema.validation && Array.isArray(schema.validation.mimeTypes)) {
    let allowedMimeTypes = schema.validation.mimeTypes
    let bucketName = (schema.settings && schema.settings.mediaBucket) ||
      config.get('media.defaultBucket')
    let model = this.getForeignModel(bucketName)

    queue = queue.then(() => {
      return model.find({
        query: {
          _id: {
            $in: normalisedValue.map(item => item._id)
          }
        }
      }).then(({results}) => {
        if (results.length < normalisedValue.length) {
          let error = new Error('has one or more values that do not match valid media objects')

          error.code = 'ERROR_INVALID_ID'

          return Promise.reject(error)
        }

        let invalidResults = results.find(result => {
          let mimeType = result.mimeType || result.mimetype

          return !mimeType || !allowedMimeTypes.includes(mimeType)
        })

        if (invalidResults) {
          let error = new Error(`has invalid MIME type. Expected: ${allowedMimeTypes.join(', ')}`)

          error.code = 'ERROR_INVALID_MIME_TYPE'

          return Promise.reject(error)
        }
      })
    })
  }

  return queue.then(() => ({
    [field]: isArraySyntax ? normalisedValue : normalisedValue[0]
  }))
}
