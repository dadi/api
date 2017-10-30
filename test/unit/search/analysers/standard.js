const should = require('should')
const sinon = require('sinon')
const standardAnalyser = require(__dirname + '/../../../../dadi/lib/search/analysers/standard')
const model = require(__dirname + '/../../../../dadi/lib/model')

const indexableFields = {
  foo: {
    search: {
      weight: 2
    }
  }
}

let analyser

describe('Standard Search Analyser', () => {
  beforeEach(done => {
    analyser = new standardAnalyser(indexableFields)
    done()
  })

  it('should export constructor', done => {
    standardAnalyser.should.be.Function
    done()
  })

  describe('`isValid` method', () => {
    it('should return false if value is not a valid string', done => {
      analyser.isValid(undefined).should.be.false
      done()
    })

    it('should return true if value is a valid string', done => {
      analyser.isValid('foo').should.be.true
      done()
    })
  })

  describe('`tokenize` method', () => {
    it('should return a tokenized array of words from a string', done => {
      const tokens = analyser.tokenize('Foo Bar Baz')

      tokens.should.be.an.instanceOf(Array)
        .and.have.lengthOf(3)
      tokens.should.eql(['foo', 'bar', 'baz'])
      done()
    })
  })

  describe('`unique` method', () => {
    it('should reduce an array to unique values', done => {
      analyser.unique(['foo', 'foo', 'bar'])
        .should.be.an.instanceOf(Array)
        .and.have.lengthOf(2)
      done()
    })

    it('should return empty array if the input is not a valid array', done => {
      analyser.unique(undefined)
        .should.be.an.instanceOf(Array)
        .and.have.lengthOf(0)
      done()
    })
  })

  describe('`areValidWords` method', () => {
    it('should return false if array of words is invalid', done => {
      analyser.areValidWords(undefined)
        .should.be.false

      analyser.areValidWords([
        {
          word: 'foo'
        }
      ])
        .should.be.false

      analyser.areValidWords([
        {
          word: 'foo',
          weight: 2
        }
      ])
        .should.be.true

      done()
    })
  })

  describe('`mergeWeights` method', () => {
    it('should return empty array if words are invalid', done => {
      analyser.mergeWeights(undefined)
        .should.be.an.instanceOf(Array)
        .and.have.lengthOf(0)

      analyser.mergeWeights([{
        word: 'foo'
      }])
        .should.be.an.instanceOf(Array)
        .and.have.lengthOf(0)
      done()
    })

    it('should reduce multiple word instances to a unique instance of the highest weight value', done => {
      analyser.mergeWeights([
        { weight: 2.85116730682758, word: 'foo' },
        { weight: 2.280933845462064, word: 'foo' }
      ])
      .should.be.an.instanceOf(Array)
      .and.have.lengthOf(1)

      analyser.mergeWeights([
        { weight: 2.85116730682758, word: 'foo' },
        { weight: 2.280933845462064, word: 'foo' }
      ])[0]
        .should.be.an.instanceOf(Object)
        .and.have.property('weight', 2.5660505761448222)

      done()
    })
  })
})

// add
// getWordsInField
// getAllWords
// getWordInstances
