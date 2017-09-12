var should = require('should')
var search = require(__dirname + '/../../../dadi/lib/search')
var config = require(__dirname + '/../../../config')

describe('Search', () => {
  it('should export constructor', done => {
    search.Search.should.be.Function
    done()
  })
})
