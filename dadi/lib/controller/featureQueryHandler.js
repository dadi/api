const config = require('./../../../config')

let FEATURES = require('./../../../features')

module.exports = server => {
  server.use((req, res, next) => {
    if (
      config.get('featureQuery.enabled') &&
      req.headers &&
      req.headers['x-dadi-requires']
    ) {
      let requestedFeatures = req.headers['x-dadi-requires'].split(';')
      let supportedFeatures = requestedFeatures.filter(feature => {
        return FEATURES.includes(feature)
      })

      if (supportedFeatures.length > 0) {
        res.setHeader('x-dadi-supports', supportedFeatures.join(';'))
      }
    }

    next()
  })
}

// Used for tests only.
module.exports.setFeatures = newFeatures => {
  FEATURES = newFeatures
}
