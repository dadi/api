const path = require('path')
const mediaModel = require(
  path.join(__dirname, '/../model/media')
)

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
    if (chain.length === 0) {
      return chain.concat(rootModel)
    }

    const nodeModel = chain[chain.length - 1]
    const referenceField = nodeModel.getField(
      fields[index - 1].split('@')[0]
    )

    // Validating the node and flagging an error if invalid.
    if (
      !referenceField.type ||
      !referenceField.type.length ||
      referenceField.type.toLowerCase() !== 'reference'
    ) {
      return chain.concat(null)
    }

    const referenceCollection = field.split('@')[1] ||
      (referenceField.settings && referenceField.settings.collection)

    // If there isn't a `settings.collection` property, we're
    // dealing with a self-reference.
    if (!referenceCollection) {
      return chain.concat(nodeModel)
    }

    const referenceModel = rootModel.getForeignModel(
      referenceCollection
    )

    return chain.concat(referenceModel)
  }, [])
}

module.exports.beforeOutput = function ({
  client,
  composeOverride,
  document,
  dotNotationPath = [],
  field,
  language,
  input,
  level = 1,
  urlFields = {}
}) {
  const shouldCompose = this.shouldCompose({
    composeOverride,
    level
  })

  // We don't want to do anything if the value is falsy or if
  // composition is disabled, either globally or for this level
  // of nesting.
  if (!input || !input[field] || !shouldCompose) {
    return input
  }

  const isArray = Array.isArray(input[field])

  // We don't want to do anything if the value is an empty array.
  if (isArray && input[field].length === 0) {
    return input
  }

  const newDotNotationPath = dotNotationPath.concat(field)
  const schema = this.getField(field)
  const isStrictCompose = schema.settings &&
    Boolean(schema.settings.strictCompose)
  const values = Array.isArray(input[field])
    ? input[field]
    : [input[field]]
  let ids = values
  const idMappingField = this._getIdMappingName(field)

  // If strict compose is not enabled, we want to resolve duplicates.
  if (!isStrictCompose) {
    ids = ids.filter((id, index) => {
      return id && ids.lastIndexOf(id) === index
    })
  }

  // This generates an object mapping document IDs to collections, so
  // that we can batch requests instead of making one per ID.
  const referenceCollections = ids.reduce((collections, id) => {
    const idMapping = document[idMappingField] || {}
    const referenceCollection = idMapping[id] ||
      (schema.settings && schema.settings.collection) ||
      this.name

    collections[referenceCollection] = collections[referenceCollection] || []
    collections[referenceCollection].push(id)

    return collections
  }, {})

  const documents = {}
  const queryOptions = {}

  // Looking at the `settings.fields` array to determine which fields
  // will be requested from the composed document.
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

  // Looking at the `fields` URL parameter to determine which fields
  // will be requested from the composed document.
  Object.keys(urlFields).forEach(fieldPath => {
    const fieldPathNodes = fieldPath.split('.')

    if (fieldPath.indexOf(newDotNotationPath.join('.')) === 0) {
      const field = fieldPathNodes[level]

      if (field) {
        queryOptions.fields = queryOptions.fields || {}
        queryOptions.fields[field] = urlFields[fieldPath]
      }
    }
  })

  if (queryOptions.fields) {
    queryOptions.fields[idMappingField] = 1
  }

  return Promise.all(
    Object.keys(referenceCollections).map(collection => {
      const model = collection === this.name
        ? this
        : this.getForeignModel(collection)

      if (!model) return undefined

      return model.find({
        client,
        language,
        options: queryOptions,
        query: {
          _id: {
            $containsAny: referenceCollections[collection]
          }
        }
      }).then(({metadata, results}) => {
        return Promise.all(
          results.map(result => {
            // This isn't great. I'd like to move away from the
            // `mediaStore` magic string in favour of an `Image`
            // field type (https://github.com/dadi/api/issues/415).
            //
            // Update (Nov 18): We have the Media field in place now,
            // but we must keep this for backwards-compatibility.
            if (collection === 'mediaStore') {
              result = mediaModel.formatDocuments(result)
            }

            const nextData = Object.assign({}, arguments[0], {
              dotNotationPath: newDotNotationPath,
              level: level + 1
            })

            return model.formatForOutput(
              result,
              nextData
            ).then(formattedResult => {
              documents[result._id] = formattedResult
            })
          })
        )
      }).catch(err => {
        // If the `find` has failed due to insufficient permissions,
        // we swallow the error because we don't want the main request
        // to fail completely due to a 403 in one of the referenced
        // collections. If we do nothing here, the document ID will
        // be left untouched, which is what we want.
        if (err.message === 'FORBIDDEN') {
          return
        }

        return Promise.reject(err)
      })
    })
  ).then(() => {
    const composedIds = []
    let resolvedDocuments = ids.map(id => {
      if (documents[id]) {
        composedIds.push(ids)

        return documents[id]
      }

      return isStrictCompose ? null : id
    })

    // If strict compose is not enabled, we remove falsy values.
    if (!isStrictCompose) {
      resolvedDocuments = resolvedDocuments.filter(Boolean)
    }

    // Returning a single object if that's how it's represented
    // in the database.
    if (!isArray) {
      resolvedDocuments = resolvedDocuments[0]
    }

    const output = {
      [field]: resolvedDocuments
    }

    if (composedIds.length > 0) {
      output._composed = {
        [field]: input[field]
      }
    }

    return output
  })
}

module.exports.beforeQuery = function ({config, field, input, options}) {
  const isOperatorQuery = tree => {
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
  //
  // It looks at the various models in the chain to look for fields
  // that are not Reference fields. When it finds one, it leaves the
  // dot-notation in the node key, rather than expanding it out. For
  // example, imagine that `status` is a field of type Object:
  //
  // In:
  // {
  //   "book.author.occupation": "writer",
  //   "book.status.live": true
  // }
  //
  // Out:
  // {
  //   "book": {
  //     "author": {
  //       "occupation": "writer"
  //     },
  //     "status.live": true
  //   }
  // }
  const inputTree = {}

  Object.keys(input).forEach(path => {
    const nodes = path.split('.')
    const modelChain = createModelChain(this, nodes)
    let pointer = inputTree

    const interrupted = nodes.slice(0, -1).some((node, index) => {
      if (!modelChain[index + 1]) {
        const key = nodes.slice(index).join('.')

        pointer[key] = input[path]

        return true
      }

      pointer[node] = Object.assign({}, pointer[node])
      pointer = pointer[node]

      return false
    })

    if (!interrupted) {
      pointer[nodes.slice(-1)] = input[path]
    }
  })

  // This function takes a tree like the one in the example above and
  // processes it recursively, running the `find` method in the
  // appropriate models.
  const processTree = (tree, path = []) => {
    let queue = Promise.resolve({})

    Object.keys(tree).forEach(key => {
      const canonicalKey = key.split('@')[0]

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
              [canonicalKey]: result
            })
          })
        }

        return Object.assign({}, query, {
          [canonicalKey]: tree[key]
        })
      })
    })

    const firstKey = Object.keys(tree)[0]
    const modelChain = createModelChain(this, path.concat(firstKey))
    const model = modelChain && modelChain[modelChain.length - 1]

    return queue.then(query => {
      if (path.length === 0) {
        return query
      }

      // This is a little optimisation. If the current query didn't yield
      // any results, there's no point in processing any nodes to the left
      // because the result will always be an empty array.
      Object.keys(query).forEach(field => {
        if (query[field].$containsAny && query[field].$containsAny.length === 0) {
          return {
            $containsAny: []
          }
        }
      })

      return model.find({
        query
      }).then(({results}) => {
        return {
          $containsAny: results.map(item => item._id.toString())
        }
      })
    })
  }

  return processTree(inputTree)
}

module.exports.beforeSave = function ({
  client,
  config,
  field,
  internals,
  input,
  schema
}) {
  const isArray = Array.isArray(input[field])
  const values = isArray
    ? input[field]
    : [input[field]]
  const idMapping = {}
  const insertions = values.map(value => {
    // This is an ID or it's falsy, there's nothing left to do.
    if (!value || typeof value === 'string') {
      return value
    }

    let needsMapping = false
    const collectionField = `${config.get('internalFieldsPrefix')}collection`
    const dataField = `${config.get('internalFieldsPrefix')}data`
    let referenceCollection

    // Are we looking at the multi-collection reference format?
    if (value[collectionField] && value[dataField]) {
      referenceCollection = value[collectionField]
      value = value[dataField]

      // If the value of `_data` is a string, we assume it's an
      // ID and therefore we just need to add the collection name
      // to the mapping and we're done.
      if (typeof value === 'string') {
        idMapping[value] = referenceCollection

        return value
      }

      needsMapping = true
    } else {
      referenceCollection = schema.settings &&
        schema.settings.collection
    }

    const model = referenceCollection
      ? this.getForeignModel(referenceCollection)
      : this

    // Augment the value with the internal properties from the parent.
    Object.assign(value, internals)

    return model.formatForInput(
      value,
      {internals}
    ).then(document => {
      // The document has an ID, so it's an update.
      if (document._id) {
        return model.update({
          client,
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
        client,
        documents: document,
        internals,
        rawOutput: true
      }).then(({results}) => {
        return results[0]._id.toString()
      })
    }).then(id => {
      if (needsMapping) {
        idMapping[id] = referenceCollection
      }

      return id
    })
  })

  return Promise.all(insertions).then(value => {
    return {
      [this._getIdMappingName(field)]: idMapping,
      [field]: isArray ? value : value[0]
    }
  })
}
