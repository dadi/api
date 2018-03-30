const objectPath = require('object-path')

module.exports.type = 'reference'

/**
 * Creates an array of Model instances corresponding to a
 * field query, potentially including dot-notation.
 *
 * @param  {Model} rootModel - instance of the base/root model
 * @param  {Array<String>} fields - array of node fields
 * @return {Array<Model>}
 */
function createModelChain (rootModel, fields) {
  return fields.reduce((chain, field, index) => {
    // Propagating an error state.
    if (chain === null) return chain

    if (chain.length === 0) {
      return chain.concat(rootModel)
    }

    let nodeModel = chain[chain.length - 1]
    let referenceField = nodeModel.getField(
      fields[index - 1]
    )

    // Validating the node and flagging an error if invalid.
    if (
      !referenceField.type ||
      !referenceField.type.length ||
      referenceField.type.toLowerCase() !== 'reference'
    ) {
      return null
    }

    let referenceCollection = referenceField.settings &&
      referenceField.settings.collection

    // If there isn't a `settings.collection` property, we're
    // dealing with a self-reference.
    if (!referenceCollection) {
      return chain.concat(nodeModel)
    }

    let referenceModel = rootModel.getForeignModel(
      referenceCollection
    )

    return chain.concat(referenceModel)
  }, [])
}

module.exports.beforeOutput = function ({
  composeOverride,
  dotNotationPath = [],
  field,
  input,
  level = 1,
  urlFields = {}
}) {
  let shouldCompose = this.shouldCompose({
    composeOverride,
    level
  })

  // We don't want to do anything if the value is falsy or if
  // composition is disabled, either globally or for this level
  // of nesting.
  if (!input || !input[field] || !shouldCompose) {
    return input
  }

  let isArray = Array.isArray(input[field])

  // We don't want to do anything if the value is an empty array.
  if (isArray && input[field].length === 0) {
    return input
  }

  let newDotNotationPath = dotNotationPath.concat(field)
  let schema = this.getField(field)
  let referenceCollection = schema.settings &&
    schema.settings.collection
  let strictCompose = schema.settings &&
    Boolean(schema.settings.strictCompose)
  let ids = Array.isArray(input[field])
    ? input[field]
    : [input[field]]
  let uniqueIds = strictCompose
    ? ids
    : ids.filter((id, index) => {
      return id && ids.lastIndexOf(id) === index
    })
  let referenceModel = referenceCollection
    ? this.getForeignModel(referenceCollection)
    : this

  if (!referenceModel) {
    return {
      [field]: input[field]
    }
  }

  let query = {
    _id: {
      '$in': uniqueIds
    }
  }
  let queryOptions = {}

  if (schema.settings && Array.isArray(schema.settings.fields)) {
    // Transforming something like:
    //
    // ["name", "address", "age"]
    //
    // ... into something like:
    //
    // {"name": 1, "address": 1, "age": 1}
    queryOptions.fields = schema.settings.fields.reduce((fieldsObject, field) => {
      fieldsObject[field] = 1

      return fieldsObject
    }, {})
  }

  let fieldsFromUrl = Object.keys(urlFields).reduce((fields, fieldPath) => {
    let fieldPathNodes = fieldPath.split('.')

    if (fieldPath.indexOf(newDotNotationPath.join('.')) === 0) {
      let field = fieldPathNodes[level]

      if (field) {
        fields = fields || {}
        fields[field] = urlFields[fieldPath]
      }
    }

    return fields
  }, null)

  if (fieldsFromUrl) {
    queryOptions.fields = Object.assign(
      {},
      queryOptions.fields,
      fieldsFromUrl
    )
  }

  return referenceModel.find({
    options: queryOptions,
    query
  }).then(({metadata, results}) => {
    if (results.length === 0) {
      if (strictCompose) {
        return {
          [field]: isArray ? uniqueIds.map(id => null) : null,
          _composed: {
            [field]: ids
          }
        }
      }

      return {
        [field]: isArray ? ids : ids[0]
      }
    }

    // The order of the IDs in the query wasn't preserved,
    // so we need to sort `results` according to the original
    // array.
    let sortedResults = uniqueIds.map(id => {
      if (!id) return null

      let result = results.find(result => {
        return result._id.toString() === id.toString()
      })

      if (result === undefined) {
        return strictCompose ? null : id
      }

      return result
    })

    if (!strictCompose) {
      sortedResults = sortedResults.filter(Boolean)
    }

    return referenceModel.formatForOutput(sortedResults, {
      composeOverride,
      dotNotationPath: newDotNotationPath,
      level: level + 1,
      urlFields
    }).then(composed => {
      return {
        [field]: isArray ? composed : composed[0],
        _composed: {
          [field]: input[field]
        }
      }
    })
  })
}

module.exports.beforeQuery = function ({config, field, input}) {
  let isOperatorQuery = tree => {
    return Boolean(
      tree &&
      Object.keys(tree).every(key => {
        return key[0] === '$'
      })
    )
  }

  if (isOperatorQuery(input[field])) {
    return input
  }

  // This will take an object that maps dot-notation paths to values
  // and return a tree representation of that. For example:
  //
  // In:
  // {
  //   "book.title": "For Whom The Bell Tolls",
  //   "book.author.occupation": "writer",
  //   "book.author.name": "Ernest Hemingway"
  // }
  //
  // Out:
  // {
  //   "book": {
  //     "title": "For Whom The Bell Tolls",
  //     "author": {
  //       "occupation": "writer",
  //       "name": "Ernest Hemingway"
  //     }
  //   }
  // }
  let inputTree = Object.keys(input).reduce((tree, path) => {
    objectPath.set(tree, path, input[path])

    return tree
  }, {})

  // This function takes a tree like the one in the example above and
  // processes it recursively, running the `find` method in the
  // appropriate models.
  let processTree = (tree, path = []) => {
    let queue = Promise.resolve({})

    Object.keys(tree).forEach(key => {
      queue = queue.then(query => {
        if (
          tree[key] &&
          typeof tree[key] === 'object' &&
          !isOperatorQuery(tree[key])
        ) {
          return processTree(
            tree[key],
            path.concat(key)
          ).then(result => {
            return Object.assign({}, query, {
              [key]: result
            })
          })
        }

        return Object.assign({}, query, {
          [key]: tree[key]
        })
      })
    })

    let firstKey = Object.keys(tree)[0]
    let modelChain = createModelChain(this, path.concat(firstKey))
    let model = modelChain[modelChain.length - 1]

    return queue.then(query => {
      if (path.length === 0) {
        return query
      }

      // This is a little optimisation. If the current query didn't yield
      // any results, there's no point in processing any nodes to the left
      // because the result will always be an empty array.
      Object.keys(query).forEach(field => {
        if (query[field].$in && query[field].$in.length === 0) {
          return {
            $in: []
          }
        }
      })

      return model.find({
        query
      }).then(({results}) => {
        return {
          $in: results.map(item => item._id.toString())
        }
      })
    })
  }

  return processTree(inputTree)
}

module.exports.beforeSave = function ({field, internals, input, schema}) {
  let isArray = Array.isArray(input[field])
  let values = isArray
    ? input[field]
    : [input[field]]
  let insertions = values.map(value => {
    if (!value) return value

    let referenceCollection = schema.settings &&
      schema.settings.collection
    let model = referenceCollection
      ? this.getForeignModel(referenceCollection)
      : this

    // Augment the value with the internal properties from the parent.
    Object.assign(value, internals)

    // This is an ID, there's nothing else to do.
    if (typeof value === 'string') {
      return value
    }

    return model.formatForInput(
      value,
      {internals}
    ).then(document => {
      // The document has an ID, so it's an update.
      if (document._id) {
        return model.update({
          internals: Object.assign({}, internals, {
            _lastModifiedBy: internals._createdBy
          }),
          query: {
            _id: document._id
          },
          rawOutput: true,
          update: document
        }).then(response => document._id)
      }

      return model.create({
        documents: document,
        internals,
        rawOutput: true
      }).then(({results}) => {
        return results[0]._id.toString()
      })
    })
  })

  return Promise.all(insertions).then(value => {
    return {
      [field]: isArray ? value : value[0]
    }
  })
}
