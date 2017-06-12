var should = require('should')
var model = require(__dirname + '/../../../dadi/lib/model')
var History = require(__dirname + '/../../../dadi/lib/model/history')
var connection = require(__dirname + '/../../../dadi/lib/model/connection')
var _ = require('underscore')
var help = require(__dirname + '/../help')

describe('History', function () {
  it('should export a constructor', function (done) {
    History.should.be.Function
    done()
  })

  describe('initialization options', function () {
    it('should take a model name as an argument', function (done) {
      var mod = model('testModelName', help.getModelSchema())
      var h = new History(mod).model.name.should.equal('testModelName')
      done()
    })

    it('should attach specified history collection if `storeRevisions` is true', function (done) {
      var conn = connection()
      var mod = model('testModelName', help.getModelSchema(), conn, { storeRevisions: true, revisionCollection: 'modelHistory' })
      should.exist(mod.revisionCollection)
      mod.revisionCollection.should.equal('modelHistory')

      done()
    })
  })

  describe('`create` method', function () {
    beforeEach(help.cleanUpDB)

    it('should be added to history', function (done) {
      var conn = connection()
      var mod = model('testModelName', help.getModelSchema(), conn, { storeRevisions: true })
      var h = new History(mod).model.history.create.should.be.Function
      done()
    })

    it('should save model to history', function (done) {
      var conn = connection()
      var mod = model('testModelName', help.getModelSchema(), conn, { storeRevisions: true })

      mod.create({fieldName: 'foo'}, function (err, result) {
        if (err) return done(err)

        // find the obj we just created
        mod.find({fieldName: 'foo'}, function (err, doc) {
          if (err) return done(err)

          mod.history.create(doc['results'][0], mod, function (err, res) {
            if (err) return done(err)

            mod.find({fieldName: 'foo'}, function (err, doc) {
              if (err) return done(err)

              should.exist(doc['results'])
              doc['results'][0].history.length.should.equal(1)
              done()
            })
          })
        })
      })
    })
  })

  describe('`createEach` method', function () {
    beforeEach(help.cleanUpDB)

    it('should be added to history', function (done) {
      var mod = model('testModelName', help.getModelSchema())
      var h = new History(mod).model.history.createEach.should.be.Function
      done()
    })

    it('should save all models to history', function (done) {
      var conn = connection()
      var mod = model('testModelName', help.getModelSchema(), conn, { storeRevisions: true })

      mod.create({fieldName: 'foo-1'}, function (err, result) {
        if (err) return done(err)
        mod.create({fieldName: 'foo-2'}, function (err, result) {
          if (err) return done(err)
          // find the objs we just created
          mod.find({}, function (err, docs) {
            if (err) return done(err)

            mod.history.createEach(docs['results'], 'update', mod, function (err, res) {
              if (err) return done(err)

              mod.find({}, function (err, docs) {
                if (err) return done(err)

                //console.log(docs.results[0])

                docs.results[0].history.length.should.equal(1)
                docs.results[1].history.length.should.equal(1)
                done()
              })
            })
          })
        })
      })
    })

    it('should add action=update to history revisions when a document is updated', function (done) {
      var conn = connection()
      var mod = model('testModelName', help.getModelSchema(), conn, { storeRevisions: true })

      mod.create({ fieldName: 'foo-1' }, function (err, result) {
        mod.update({ fieldName: 'foo-1' }, { fieldName: 'foo-2' }, function (err, result) {
          mod.find({}, { includeHistory: true }, function (err, docs) {
            should.exist(docs.results[0].history)
            should.exist(docs.results[0].history[0])
            should.exist(docs.results[0].history[0].action)
            docs.results[0].history[0].action.should.eql('update')
            done()
          })
        })
      })
    })

    it('should add action=delete to history revisions when a document is deleted', function (done) {
      var conn = connection()
      var mod = model('testModelName', help.getModelSchema(), conn, { storeRevisions: true })

      mod.create({ fieldName: 'foo-1' }, function (err, result) {
        mod.delete({ fieldName: 'foo-1' }, function (err, result) {
          mod = model('testModelNameHistory', help.getModelSchema(), conn, { storeRevisions: false })
          mod.find({}, {}, function (err, docs) {
            should.exist(docs.results[0])
            should.exist(docs.results[0].originalDocumentId)
            should.exist(docs.results[0].action)
            docs.results[0].action.should.eql('delete')
            done()
          })
        })
      })
    })

    it('should add the original document id to history revisions', function (done) {
      var conn = connection()
      var mod = model('testModelName', help.getModelSchema(), conn, { storeRevisions: true })

      mod.create({ fieldName: 'foo-1' }, function (err, result) {
        var id = result.results[0]._id
        mod.update({ fieldName: 'foo-1' }, { fieldName: 'foo-2' }, function (err, result) {
          mod.find({}, { includeHistory: true }, function (err, docs) {
            should.exist(docs.results[0].history)
            should.exist(docs.results[0].history[0])
            should.exist(docs.results[0].history[0].originalDocumentId)
            docs.results[0].history[0].originalDocumentId.should.eql(id)
            done()
          })
        })
      })
    })
  })
})
