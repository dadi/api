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
      var mod = model('testModelName', help.getModelSchema(), null, { database: 'testdb' })
      var h = new History(mod).model.name.should.equal('testModelName')
      done()
    })

    it('should attach specified history collection if `storeRevisions` is true', function (done) {
      var mod = model('testModelName', help.getModelSchema(), null, { database: 'testdb', storeRevisions: true, revisionCollection: 'modelHistory' })
      should.exist(mod.revisionCollection)
      mod.revisionCollection.should.equal('modelHistory')

      done()
    })
  })

  describe('`create` method', function () {
    beforeEach(help.cleanUpDB)

    it('should be added to history', function (done) {
      var mod = model('testModelName', help.getModelSchema(), null, { database: 'testdb', storeRevisions: true })
      var h = new History(mod).model.history.create.should.be.Function
      done()
    })

    it('should save model to history', function (done) {
      var mod = model('testModelName', help.getModelSchema(), null, { database: 'testdb', storeRevisions: true })

      mod.create({fieldName: 'foo'}, function (err, result) {
        if (err) return done(err)

        // find the obj we just created
        mod.find({fieldName: 'foo'}, function (err, doc) {
          if (err) return done(err)

          mod.history.create(doc.results[0], mod, (err, res) => {
            if (err) return done(err)

            mod.find({fieldName: 'foo'}, function (err, doc) {
              if (err) return done(err)

              should.exist(doc['results'])
              doc['results'][0]._history.length.should.equal(1)
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
      var mod = model('testModelName', help.getModelSchema(), null, { database: 'testdb' })
      var h = new History(mod).model.history.createEach.should.be.Function
      done()
    })

    it('should save all models to history', function (done) {
      this.timeout(4000)

      var mod = model('testModelName', help.getModelSchema(), null, { database: 'testdb', storeRevisions: true })

      mod.create({fieldName: 'foo-1'}, function (err, result) {
        if (err) return done(err)
        mod.create({fieldName: 'foo-2'}, function (err, result) {
          if (err) return done(err)
          // find the objs we just created
          mod.find({}, function (err, docs) {
            if (err) return done(err)

            mod.history.createEach(docs['results'], 'delete', mod).then(() => {
              mod.find({ fieldName: { '$regex' : '^foo-' } }, function (err, docs) {
                if (err) return done(err)

                docs.results[0]._history.length.should.equal(1)
                docs.results[1]._history.length.should.equal(1)
                done()
              })
            }).catch((err) => {
              done(err)
            })
          })
        })
      })
    })

    it('should add action=update to history revisions when a document is updated', function (done) {
      var mod = model('testModelName', help.getModelSchema(), null, { database: 'testdb', storeRevisions: true })

      mod.create({ fieldName: 'foo-1' }, function (err, result) {
        mod.update({ fieldName: 'foo-1' }, { fieldName: 'foo-2' }, function (err, result) {
          mod.find({}, { includeHistory: true }, function (err, docs) {
            should.exist(docs.results[0]._history)
            should.exist(docs.results[0]._history[0])
            should.exist(docs.results[0]._history[0]._action)
            docs.results[0]._history[0]._action.should.eql('update')
            done()
          })
        })
      })
    })

    it('should add action=delete to history revisions when a document is deleted', function (done) {
      var mod = model('testModelName', help.getModelSchema(), null, { database: 'testdb', storeRevisions: true })

      mod.create({ fieldName: 'foo-1' }, function (err, result) {
        mod.delete({ fieldName: 'foo-1' }, function (err, result) {

          mod = model('testModelNameHistory', help.getModelSchema(), null, { database: 'testdb', storeRevisions: true })

          mod.find({}, {}, function (err, docs) {
            should.exist(docs.results[0])
            should.exist(docs.results[0]._originalDocumentId)
            should.exist(docs.results[0]._action)
            docs.results[0]._action.should.eql('delete')
            done()
          })
        })
      })
    })

    it('should add the original document id to history revisions', function (done) {
      var mod = model('testModelName', help.getModelSchema(), null, { database: 'testdb', storeRevisions: true })

      mod.create({ fieldName: 'foo-1' }, function (err, result) {
        var id = result.results[0]._id

        mod.update({ fieldName: 'foo-1' }, { fieldName: 'foo-2' }, function (err, result) {
          mod.find({}, { includeHistory: true }, function (err, docs) {
            should.exist(docs.results[0]._history)
            should.exist(docs.results[0]._history[0])
            should.exist(docs.results[0]._history[0]._originalDocumentId)

            docs.results[0]._history[0]._originalDocumentId.should.eql(id.toString())
            done()
          })
        })
      })
    })
  })
})