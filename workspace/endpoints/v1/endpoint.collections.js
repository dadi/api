var app = require('@dadi/api')
var _ = require('underscore')

module.exports.get = function (req, res, next) {
  var data = {}
  var collections = []
  var components = app.App ? app.App.components : app.components

  _.each(components, function (value, key) {
    if (value.model) {
      var model = value.model
      var slug = model.name
      var parts = _.compact(key.split('/'))

      var name = model.settings.displayName || model.name

      var collection = {
        name: name,
        slug: slug,
        version: parts[0],
        database: parts[1],
        path: '/' + parts[0] + '/' + parts[1] + '/' + slug
      }

      if ((model.settings && model.settings.showInMenu === false) || collection.version === 'endpoints' || !collection.name) {
          // do nothing, don't push the collection
      } else {
          // default to showing in menu
        collections.push(collection)
      }
    }
  })

  collections.sort()

  data['collections'] = collections

  res.setHeader('content-type', 'application/json')
  res.statusCode = 200
  res.end(JSON.stringify(data))
}
