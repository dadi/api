const should = require('should')
const sinon = require('sinon')
const search = require(__dirname + '/../../../dadi/lib/search')
const model = require(__dirname + '/../../../dadi/lib/model')
const config = require(__dirname + '/../../../config')
const help = require(__dirname + '/../help')
const store = require(config.get('search.datastore'))

let mod
let searchInstance

describe('Search', () => {
  beforeEach(done => {
    mod = model('testSearchModel', help.getSearchModelSchema(), null, { database: 'testdb' })
    searchInstance = search(mod)
    done()
  })

  it('should export constructor', done => {
    search.Search.should.be.Function
    done()
  })

  it('should export a function that returns an instance', done => {
      searchInstance.should.be.an.instanceOf(search.Search)
      done()
  })

  it('should throw an error if model is incorrect type', done => {
      search.should.throw()
      done()
  })

  describe('`initialiseConnections` method', () => {
    it('should initialise required connections', done => {
      searchInstance.initialiseConnections()

      should.exist(searchInstance.wordConnection.db)
      should.exist(searchInstance.searchConnection.db)
      setTimeout(() => {
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
      mod = model('testModelNew', help.getSearchModelSchema(), null, { database: 'testdb' })
      const dbIndexStub = sinon.spy(store.prototype, 'index')

      searchInstance = search(mod)

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
})

// initialiseConnections [complete]
// applyIndexListeners [complete]
// find
// getWords
// getInstancesOfWords
// getWordSchema [complete]
// getSearchSchema [complete]
// delete
// index
// getIndexableFields [complete]
// hasSearchField [complete]
// removeNonIndexableFields [complete]
// indexDocument
// analyseDocumentWords
// createWordInstanceInsertQuery [complete]
// clearAndInsertWordInstances
// insertWordInstances
// runFind [complete]
// clearDocumentInstances [complete]
// insert
// batchIndex
// runBatchIndex
// canUse
