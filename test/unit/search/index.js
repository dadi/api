const config = require(__dirname + '/../../../config')
const help = require(__dirname + '/../help')
const Model = require(__dirname + '/../../../dadi/lib/model')
const Search = require(__dirname + '/../../../dadi/lib/search')
const should = require('should')
const sinon = require('sinon')
const store = require(config.get('search.datastore'))

let mod
let searchInstance

describe('Search', () => {
  beforeEach(done => {
    mod = Model('testSearchModel', help.getSearchModelSchema(), null, { database: 'testdb' })
    searchInstance = new Search(mod)
    searchInstance.init()
    done()
  })

  it('should export constructor', done => {
    Search.should.be.Function
    done()
  })

  it('should export a function that returns an instance', done => {
      searchInstance.should.be.an.instanceOf(Search)
      done()
  })

  it('should throw an error if model is incorrect type', done => {
    should.throws(function () { var x = new Search() })
    done()
  })

  describe('`initialiseConnections` method', () => {
    it('should initialise required connections', done => {
      searchInstance.initialiseConnections()

      setTimeout(() => {
        should.exist(searchInstance.wordConnection.db)
        should.exist(searchInstance.searchConnection.db)
        searchInstance.wordConnection.db.config.hosts[0].host.should.eql('127.0.0.1')
        searchInstance.wordConnection.db.config.hosts[0].port.should.eql(27017)
        searchInstance.searchConnection.db.config.hosts[0].host.should.eql('127.0.0.1')
        searchInstance.searchConnection.db.config.hosts[0].port.should.eql(27017)

        done()
      }, 500)
    })
  })

  describe('`applyIndexListeners` method', () => {
    it('should call database index method once connection is established', done => {
      mod = Model('testModelNew', help.getSearchModelSchema(), null, { database: 'testdb' })
      const dbIndexStub = sinon.spy(store.prototype, 'index')

      searchInstance = new Search(mod)

      setTimeout(() => {
        dbIndexStub.called.should.be.true
        dbIndexStub.lastCall.args[0].should.eql('testModelNewSearch')
        dbIndexStub.lastCall.args[1].should.be.Object
        dbIndexStub.restore()

        done()
      }, 1000)
    })
  })

  describe('`getWordSchema` method', () => {
    it('should return an object', done => {
      const schema = searchInstance.getWordSchema()
      schema.should.be.Object
      done()
    })
  })

  describe('`getSearchSchema` method', () => {
    it('should return an object', done => {
      const schema = searchInstance.getSearchSchema()
      schema.should.be.Object
      done()
    })
  })

  describe('`getIndexableFields` method', () => {
    it('should return an object', done => {
      searchInstance.getIndexableFields().should.be.Object
      done()
    })

    it('should return an object containing only indexable fields', done => {
      searchInstance.getIndexableFields().should.be.an.instanceOf(Object).and.have.property('searchableFieldName', {weight: 2})
      searchInstance.getIndexableFields().should.not.have.property('fieldName')
      searchInstance.getIndexableFields().should.not.have.property('invalidSearchableFieldName')
      done()
    })
  })

  describe('`removeNonIndexableFields` method', () => {
    it('should return an object if doc is invalid', done => {
      searchInstance.removeNonIndexableFields().should.be.Object
      done()
    })

    it('should remove non-indexable fields from document', done => {
      searchInstance.removeNonIndexableFields(help.getSampleSearchDocument())
      .should.not.have.property('fieldName')
      searchInstance.removeNonIndexableFields(help.getSampleSearchDocument())
      .should.not.have.property('invalidSearchableFieldName')
      searchInstance.removeNonIndexableFields(help.getSampleSearchDocument())
      .should.have.property('searchableFieldName', 'baz')
      done()
    })
  })

  describe('`createWordInstanceInsertQuery` method', () => {
    it('should convert list of words to valid insert query object', done => {
      searchInstance.createWordInstanceInsertQuery(['foo']).should.be.an.instanceOf(Array)
      searchInstance.createWordInstanceInsertQuery(['foo'])[0].should.have.property('word', 'foo')
      done()
    })
  })

  describe('`hasSeachField` method', () => {
    it('should return false if a field is invalid', done => {
      searchInstance.hasSearchField().should.be.false
      done()
    })

    it('should return false if a field does not contain a valid search parameter', done => {
      searchInstance.hasSearchField({search: 'foo'}).should.be.false
      done()
    })

    it('should return true if a field has a valid search and search weight parameter', done => {
      searchInstance.hasSearchField({search: {weight: 2}}).should.be.true
      done()
    })
  })

  describe('`runFind` method', () => {
    it('should search the database based on the query', done => {
      const dbFindStub = sinon.spy(store.prototype, 'find')

      searchInstance.runFind(searchInstance.model.connection.db, {foo: 'bar'}, searchInstance.model.name, searchInstance.model.schema, {})
      dbFindStub.called.should.be.true
      dbFindStub.lastCall.args[0].should.have.property('query', {foo: 'bar'})
      dbFindStub.restore()

      done()
    })
  })

  describe('`clearDocumentInstances` method', () => {
    it('should delete all search instance documents with filtered query', done => {
      const dbDeleteStub = sinon.spy(store.prototype, 'delete')

      searchInstance.clearDocumentInstances('mockDocId')
      dbDeleteStub.called.should.be.true
      dbDeleteStub.lastCall.args[0].should.have.property('query', {document: 'mockDocId'})
      dbDeleteStub.restore()

      done()
    })
  })

  describe('`delete` method', () => {
    it('should return without firing clearDocumentInstances if an array of documents is not provided', done => {
      const dbDeleteStub = sinon.spy(searchInstance, 'clearDocumentInstances')

      searchInstance.delete({_id: 'mockDocId'})
      dbDeleteStub.called.should.be.false
      dbDeleteStub.restore()

      done()
    })

    it('should execute clearDocumentInstances if an array of documents is provided', done => {
      const dbDeleteStub = sinon.spy(searchInstance, 'clearDocumentInstances')

      searchInstance.delete([{_id: 'mockDocId'}])
      dbDeleteStub.called.should.be.true
      dbDeleteStub.lastCall.args[0].should.eql('mockDocId')
      dbDeleteStub.restore()

      done()
    })
  })

  describe('`insert` method', () => {
    it('should not execute the database insert if no data is provided', done => {
      const dbInsertStub = sinon.spy(store.prototype, 'insert')

      searchInstance.insert({}, {}, {}, {}, {})
      dbInsertStub.called.should.be.false
      dbInsertStub.restore()

      done()
    })
  })

  describe('`batchIndex` method', () => {
    it('should not execute the runBatchIndex method if no fields can be indexed', done => {
      let schema = help.getSearchModelSchema()
      delete schema.searchableFieldName

      let mod = Model('testSearchModel', schema, null, { database: 'testdb' })
      const unIndexable = new Search(mod)
      unIndexable.init()

      const stub = sinon.spy(unIndexable, 'runBatchIndex')

      unIndexable.batchIndex(1, 100)
      stub.called.should.be.false
      stub.restore()
      done()
    })

    it('should call the runBatchIndex method with correct arguments when using defaults', done => {
      let schema = help.getSearchModelSchema()
      let mod = Model('testSearchModel', schema, null, { database: 'testdb' })
      const indexable = new Search(mod)
      indexable.init()

      const stub = sinon.spy(indexable, 'runBatchIndex')

      indexable.batchIndex()
      stub.called.should.be.true
      let args = stub.lastCall.args[0]
      args.page.should.eql(1)
      args.limit.should.eql(1000)
      args.skip.should.eql(0)
      args.fields.should.eql({searchableFieldName: 1})
      stub.restore()
      done()
    })

    it('should call the runBatchIndex method with correct arguments when using specific params', done => {
      let schema = help.getSearchModelSchema()
      let mod = Model('testSearchModel', schema, null, { database: 'testdb' })
      const indexable = new Search(mod)
      indexable.init()

      const stub = sinon.spy(indexable, 'runBatchIndex')

      indexable.batchIndex(2, 500)
      stub.called.should.be.true
      let args = stub.lastCall.args[0]
      args.page.should.eql(2)
      args.limit.should.eql(500)
      args.skip.should.eql(500)
      args.fields.should.eql({searchableFieldName: 1})
      stub.restore()
      done()
    })
  })

  describe.skip('runBatchIndex', function () {
    it('should call batchIndex repeatedly when there are more results', done => {
      let schema = help.getSearchModelSchema()
      let mod = Model('testSearchModel', schema, null, { database: 'testdb' })
      const indexable = new Search(mod)
      indexable.init()

      const spy = sinon.spy(indexable, 'batchIndex')

      function guid () {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
          var r = Math.random()*16|0, v = c == 'x' ? r : (r&0x3|0x8)
          return v.toString(16)
        })
      }

      mod.create([
        { searchableFieldName: guid() },
        { searchableFieldName: guid() },
      ], {}, (obj) => {
        console.log(obj)
      })

      // const dbFindStub = sinon.stub(store.prototype, 'find').callsFake(() => {
      //   return Promise.resolve({
      //     results: [
      //
      //       { _id: 2, searchableFieldName: guid() }
      //     ],
      //     metadata: {
      //       totalPages: 2,
      //       totalCount: 2
      //     }
      //   })
      // })

      indexable.runBatchIndex({ page: 1, limit: 1 })

      setTimeout(() => {
        // console.log(spy)
        spy.restore()
        done()
      }, 1000)
//      stub.called.should.be.true
      // console.log(stub)
      // let args = stub.lastCall.args[0]
      // args.page.should.eql(2)
      // args.limit.should.eql(500)
      // args.skip.should.eql(500)
      // args.fields.should.eql({searchableFieldName: 1})
    })
  })
})

// TODO: test the following
// find
// getWords
// getInstancesOfWords
// index
// indexDocument
// analyseDocumentWords
// clearAndInsertWordInstances
// insertWordInstances
// insert
// batchIndex
// runBatchIndex
// canUse
