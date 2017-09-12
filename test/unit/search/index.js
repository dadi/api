const should = require('should')
const search = require(__dirname + '/../../../dadi/lib/search')
const model = require(__dirname + '/../../../dadi/lib/model')
const cache = require(__dirname + '/../../../dadi/lib/cache')
const config = require(__dirname + '/../../../config')
var help = require(__dirname + '/../help')

before(done => {
  cache.reset()
  done()
})

describe('Search', () => {
  it('should export constructor', done => {
    search.Search.should.be.Function
    done()
  })

  // it('should export a function that returns an instance', done => {
  //     const mod = model('testModel', help.getModelSchema(), null, { database: 'testdb' })
  //     const search = Search(mod)
  //     search.should.be.an.instanceOf(search.Search)
  //     done()
  // })
})
