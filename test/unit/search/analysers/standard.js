const should = require('should')
const sinon = require('sinon')
const standardAnalyser = require(__dirname + '/../../../../dadi/lib/search/analysers/standard')
const model = require(__dirname + '/../../../../dadi/lib/model')


describe('Standard Search Analyser', () => {
  it('should export constructor', done => {
    standardAnalyser.should.be.Function
    done()
  })
})
