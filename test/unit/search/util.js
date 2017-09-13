const should = require('should')
const sinon = require('sinon')
const searchUtil = require(__dirname + '/../../../dadi/lib/search/util')
const model = require(__dirname + '/../../../dadi/lib/model')

const testArray = [['foo', 'bar'], ['baz', 'qux']]

describe('Utils', () => {
  it('should export constructor', done => {
    searchUtil.mergeArrays.should.be.Function
    done()
  })

  describe('`mergeArrays` method', () => {
    it('should merge two arrays together', done => {
      testArray.reduce(searchUtil.mergeArrays).should.eql(['foo', 'bar', 'baz', 'qux'])
      done()
    })
  })
})
