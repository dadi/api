var url = require('url')

module.exports = function (obj, type, data) {
  if (!obj || !obj.results || Object.keys(obj.results).length === 0) {
    return obj
  }
  var queryParameters = data.req && url.parse(data.req.url, true).query
  var resolveLayout = queryParameters ? (queryParameters.resolveLayout !== 'false') : true
  var layoutField = (data.options && data.options.field) || '_layout'

  if (data.schema && data.schema[layoutField] && data.schema[layoutField].schema) {
    switch (type) {
      case 'afterGet':
        if (resolveLayout) {
          obj.results.forEach((document) => {
            // Resolve layout
            document = resolve(data.schema[layoutField].schema, layoutField, document)

            // Resolve layout in history
            if (document._history) {
              document._history.forEach((historyDocument) => {
                if (historyDocument[layoutField]) {
                  historyDocument = resolve(data.schema[layoutField].schema, layoutField, historyDocument)
                }
              })
            }
          })
        }

        // Attaching layout schema to metadata
        if (data.options && data.options.addSchemaToMetadata) {
          obj.metadata.layouts = obj.metadata.layout || {}
          obj.metadata.layouts[layoutField] = data.schema[layoutField].schema
        }

        break

      case 'beforeCreate':
      case 'beforeUpdate':
        var validationErrors = validate(data.schema[layoutField].schema, layoutField, obj, type)

        if (validationErrors) {
          return Promise.reject(validationErrors)
        }

        break
    }
  }
  return obj
}

// --------------------------
// Layout resolve
// --------------------------

function resolve (layoutSchema, layoutField, document) {
  var result = []
  var freeSections = []

  if (!document[layoutField]) return document

  // Add fixed fields
  layoutSchema.forEach(function (block, index) {
    if (!block.source && !block.free) return

    if (block.free) {
      freeSections.push({
        displayName: block.displayName,
        position: index,
        name: block.name
      })
    } else {
      result.push({
        content: document.hasOwnProperty(block.source) ? document[block.source] : null,
        type: block.source
      })
    }
  })

  // Add free fields
  if (freeSections.length) {
    var counter = 0

    Object.keys(document[layoutField]).forEach(function (section) {
      var schemaSection = freeSections.find(function (obj) {
        return (obj.name === section)
      })

      document[layoutField][section].forEach(function (block, blockIndex) {
        result.splice(schemaSection.position + blockIndex + counter, 0, {
          content: document[block.source] ? document[block.source][block.index] : document[block.source],
          displayName: schemaSection.displayName,
          free: true,
          name: schemaSection.name,
          type: block.source
        })
      })

      counter += section.length - 1
    })
  }

  document[layoutField] = result

  return document
}

// --------------------------
// Layout validation
// --------------------------

function validate (layoutSchema, layoutField, document, type) {
  var errors = []
  var fieldCount = []
  var freeFieldsSections = layoutSchema.filter(function (elem) {
    return elem.free
  })

  if (document[layoutField]) {
    Object.keys(document[layoutField]).forEach(function (section) {
      var schemaSection = freeFieldsSections.find(function (obj) {
        return (obj.name === section)
      })

      if (!schemaSection) return

      if (!fieldCount[section]) {
        fieldCount[section] = {}
      }

      document[layoutField][section].forEach(function (block, blockIndex) {
        var freeField = schemaSection.fields.find(function (elem) {
          return elem.source === block.source
        })

        // Check if field is part of `free`
        if (!freeField) {
          return errors.push({field: 'layout', message: 'Layout section \'' + schemaSection.name + '\' does not accept \'' + block.source + '\' as a free field'})
        }

        // Check if `index` is within bounds
        if (!(document[block.source] instanceof Array) || (document[block.source].length <= block.index)) {
          return errors.push({field: 'layout', message: block.index + ' is not a valid index for field ' + block.source})
        }

        // Increment the field count and check for limits
        if (fieldCount[section][block.source]) {
          fieldCount[section][block.source]++
        } else {
          fieldCount[section][block.source] = 1
        }
      })
    })

    var free = layoutSchema.filter(function (elem) {
      return elem.free
    })

    free.forEach(function (section) {
      section.fields.forEach(function (field) {
        var count = (fieldCount[section.name] && fieldCount[section.name][field.source]) ? fieldCount[section.name][field.source] : 0

        // Check for `min` limit
        if (field.min && (count < field.min)) {
          errors.push({field: 'layout', message: 'Layout section \'' + section.name + '\' must contain at least ' + field.min + ' instances of \'' + field.source + '\''})
        }

        // Check for `max` limit
        if (field.max && (count > field.max)) {
          errors.push({field: 'layout', message: 'Layout section \'' + section.name + '\' cannot contain more than ' + field.max + ' instances of \'' + field.source + '\''})
        }
      })
    })
  } else {
    if (type === 'beforeCreate') {
      errors.push({message: 'Field \'' + layoutField + '\' does not exist in the collection'})
    }
  }

  if (errors.length) return errors
}
