const fields = require('require-directory')(module)

module.exports = fields
module.exports.hooksByFieldType = Object.keys(fields).reduce((hooks, key) => {
  let type = fields[key].type

  // Exit if the field doesn't export a `type` property.
  if (!type) return hooks

  // Ensure `type` is an array.
  if (!Array.isArray(type)) {
    type = [type]
  }

  type.forEach(item => {
    const sanitisedItem = item.toString().toLowerCase()

    hooks[sanitisedItem] = hooks[sanitisedItem] || []
    hooks[sanitisedItem].push(fields[key])
  })

  return hooks
}, {})
