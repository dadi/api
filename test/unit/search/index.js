const should = require('should')
const search = require(__dirname + '/../../../dadi/lib/search')
const model = require(__dirname + '/../../../dadi/lib/model')
const cache = require(__dirname + '/../../../dadi/lib/cache')
const config = require(__dirname + '/../../../config')
var help = require(__dirname + '/../help')

const mod = model('testModel', help.getModelSchema(), null, { database: 'testdb' })
let searchInstance

before(done => {
  cache.reset()
  done()
})

beforeEach(done => {
  searchInstance = search(mod)
  done()
})

describe('Search', () => {
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
      should.exist(searchInstance.searchConnection)

      searchInstance.wordConnection.db.config.hosts[0].host.should.equal('127.0.0.1')
      searchInstance.wordConnection.db.config.hosts[0].port.should.equal(27017)
      searchInstance.searchConnection.db.config.hosts[0].host.should.equal('127.0.0.1')
      searchInstance.searchConnection.db.config.hosts[0].port.should.equal(27017)

      done()
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
})

// initialiseConnections
// applyIndexListeners
// getIndexableFields
// hasSearchField
// find
// getWords
// getInstancesOfWords
// getWordSchema [complete]
// getSearchSchema [complete]
// delete
// index
// removeNonIndexableFields
// indexDocument
// analyseDocumentWords
// createWordInstanceInsertQuery
// clearAndInsertWordInstances
// insertWordInstances
// runFind
// clearDocumentInstances
// insert
// batchIndex
// runBatchIndex
