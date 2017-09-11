const debug = require('debug')('api:history')
const path = require('path')
const queryUtils = require(path.join(__dirname, '/utils'))

const History = function (model) {
  this.model = model
}

History.prototype.create = function (obj, model, done) {
  // create copy of original
  let revisionObj = queryUtils.snapshot(obj)
  revisionObj._originalDocumentId = obj._id

  // TODO: use datastore plugin's internal fields
  delete revisionObj._id
  delete revisionObj.meta
  delete revisionObj.$loki

  const _done = function (database) {
    database.insert({
      data: revisionObj,
      collection: model.revisionCollection,
      schema: model.schema,
      settings: model.settings
    }).then((doc) => {
      debug('inserted %o', doc)

      // TODO: remove mongo options
      database.update({
        query: { _id: obj._id },
        collection: model.name,
        update: { $push: { '_history': doc[0]._id.toString() } },
        schema: model.schema
      }).then((result) => {
        return done(null, obj)
      }).catch((err) => {
        done(err)
      })
    }).catch((err) => {
      done(err)
    })
  }

  if (model.connection.db) return _done(model.connection.db)

  // if the db is not connected queue the insert
  model.connection.once('connect', _done)
}

History.prototype.createEach = function (objs, action, model, done) {
  return new Promise((resolve, reject) => {
    if (objs.length === 0) return resolve()

    objs.forEach((obj, index, array) => {
      obj._action = action

      this.create(obj, model, (err, doc) => {
        if (err) return reject(err)

        if (index === array.length - 1) {
          return resolve()
        }
      })
    })
  })
}

module.exports = History
