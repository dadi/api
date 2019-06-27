const path = require('path')
const app = require(path.join(__dirname, '/../../../dadi/lib/'))

module.exports.get = function (req, res, next) {
  const data = {}
  const collections = []
  const components = app.App ? app.App.components : app.components

  components.forEach((value, key) => {
    if (value.model) {
      const model = value.model
      const slug = model.name
      const parts = key.split('/').filter(Boolean)

      const name = model.settings.displayName || model.name

      const collection = {
        name,
        slug,
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
