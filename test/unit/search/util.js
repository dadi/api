const should = require('should')
const searchUtil = require(__dirname + '/../../../dadi/lib/search/util')

describe('Utils', () => {
  it('should export a function', done => {
    searchUtil.mergeArrays.should.be.Function
    done()
  })

  describe('`mergeArrays` method', () => {
    it('should merge two arrays together', done => {
      const testArray = [['foo', 'bar'], ['baz', 'qux']]
      testArray.reduce(searchUtil.mergeArrays).should.eql(['foo', 'bar', 'baz', 'qux'])
      done()
    })
  })
})
