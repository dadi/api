var debug = require('debug')('api:history')
var path = require('path')
var queryUtils = require(path.join(__dirname, '/utils'))

var History = function (model) {
  this.model = model
}

History.prototype.create = function (obj, model, done) {
  // create copy of original
  var revisionObj = queryUtils.snapshot(obj)

  // TODO: use datastore plugin's internal fields
  delete revisionObj._id
  delete revisionObj.meta
  delete revisionObj.$loki

  var _done = function (database) {
    database.insert(revisionObj, model.revisionCollection, model.schema).then((doc) => {
      debug('inserted %o', doc)

      // TODO: remove mongo options
      database.update(
        { _id: obj._id },
        model.name,
        { $push: { 'history': doc[0]._id.toString() } },
        {},
        model.schema
      ).then((result) => {
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

History.prototype.createEach = function (objs, model) {
  return new Promise((resolve, reject) => {
    if (objs.length === 0) return resolve()

    objs.forEach((obj, index, array) => {
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
