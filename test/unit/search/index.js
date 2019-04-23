const acceptanceHelper = require('./../../acceptance/help')
const config = require('./../../../config')
const faker = require('faker')
const help = require('./../help')
const Model = require('./../../../dadi/lib/model')
const Search = require('./../../../dadi/lib/search')
const should = require('should')
const sinon = require('sinon')
const store = require(config.get('search.datastore'))

let mod
let searchInstance

describe.skip('Search', () => {
  before(() => {
    config.set('search.enabled', true)
  })

  beforeEach(done => {
    mod = Model('testSearchModel', help.getSearchModelSchema(), null, { database: 'testdb' })
    searchInstance = new Search(mod)
    searchInstance.initialise()
    done()
  })

  after(() => {
    config.set('search.enabled', false)
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
      should.exist(searchInstance.wordConnection.db)
      should.exist(searchInstance.indexConnection.db)

      done()
    })
  })

  describe.skip('`applyIndexListeners` method', () => {
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

  describe('`batchIndex` method', () => {
    it('should not execute the runBatchIndex method if no fields can be indexed', done => {
      let schema = help.getSearchModelSchema()
      delete schema.searchableFieldName

      let mod = Model('testSearchModel', schema, null, { database: 'testdb' })
      const unIndexable = new Search(mod)
      unIndexable.initialise()

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
      indexable.initialise()

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
      indexable.initialise()

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

  describe('batchIndex', function () {
    beforeEach((done) => {
      acceptanceHelper.dropDatabase('testdb', err => {
        done()
      })
    })

    it('should call runBatchIndex repeatedly when there are more results', done => {
      let schema = help.getSearchModelSchema()
      let mod = Model('testSearchModel', schema, null, { database: 'testdb' })
      let indexable = new Search(mod)
      indexable.initialise()

      let spy = sinon.spy(indexable, 'runBatchIndex')

      let docs = [
        { searchableFieldName: faker.name.findName() },
        { searchableFieldName: faker.name.findName() },
        { searchableFieldName: faker.name.findName() },
        { searchableFieldName: faker.name.findName() },
        { searchableFieldName: faker.name.findName() }
      ]

      // insert documents directly
      mod.connection.db.insert({
        data: docs,
        collection: 'testSearchModel',
        schema
      })

      let indexStub = sinon.stub(indexable, 'index').callsFake(() => {
        return Promise.resolve({
          results: docs,
          metadata: {
            totalPages: 5,
            totalCount: 5
          }
        })
      })

      indexable.batchIndex(1, 1)

      setTimeout(() => {
        spy.restore()
        indexStub.restore()
        spy.callCount.should.be.above(1)
        let args = spy.args
        args[0][0].skip.should.eql(0)
        args[0][0].page.should.eql(1)
        args[1][0].skip.should.eql(1)
        args[1][0].page.should.eql(2)
        args[2][0].skip.should.eql(2)
        args[2][0].page.should.eql(3)
        args[3][0].skip.should.eql(3)
        args[3][0].page.should.eql(4)
        args[4][0].skip.should.eql(4)
        args[4][0].page.should.eql(5)
        done()
      }, 3000)
    })
  })
})
