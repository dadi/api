var should = require('should')
var DataStore = require(__dirname + '/../../dadi/lib/datastore')

describe('DataStore', function () {
  it('should throw an error when specifying an unknown connector', function (done) {
    should.throws(function () { return DataStore('xxx') })
    done()
  })
})
