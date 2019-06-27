/**
 * Example hook: Creates a URL-friendly version (slug) of a field
 *
 * @param {string} `input` The string to slugify
 * @returns {string} The slugged version of the input
 * @api public
 */

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^\w-]+/g, '')
    .replace(/--+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '')
}

module.exports = function(obj, type, data) {
  // We use the options object to know what field to use as the source
  // and what field to populate with the slug
  obj[data.options.to] = slugify(obj[data.options.from])

  return obj
}
