const ERROR_CODES = require('./../../error-codes')
const formatError = require('@dadi/format-error')
const sinon = require('sinon')
const help = require(__dirname + '/../../dadi/lib/help')

describe('Help', function(done) {
  describe('sendBackErrorTrace', function() {
    it('should send a 500 with the error trace', done => {
      let mockError

      try {
        thisWillBreak() // eslint-disable-line no-undef
      } catch (error) {
        mockError = error
      }

      const res = {
        end: sinon.stub(),
        setHeader: sinon.stub()
      }

      help.sendBackErrorTrace(res, {})(mockError)

      res.setHeader.callCount.should.eql(2)
      res.setHeader.args[0][0].should.eql('content-type')
      res.setHeader.args[0][1].should.eql('application/json')
      res.setHeader.args[1][0].should.eql('content-length')
      res.setHeader.args[1][1].should.be.Number

      res.end.callCount.should.eql(1)

      const body = JSON.parse(res.end.args[0][0])

      body.success.should.eql(false)
      body.error
        .includes('ReferenceError: thisWillBreak is not defined')
        .should.eql(true)
      res.statusCode.should.eql(500)

      done()
    })
  })

  describe('sendBackErrorWithCode', function() {
    it('should send an error with the formatted message corresponding to the API error code with the status code provided', done => {
      const res = {
        end: function end(resBody) {
          this.setHeader.callCount.should.eql(3)
          this.setHeader.args[0][0].should.eql('Content-Length')
          this.setHeader.args[0][1].should.be.Number
          this.setHeader.args[1][0].should.eql('Content-Type')
          this.setHeader.args[1][1].should.eql('application/json')

          const body = JSON.parse(resBody)

          body.should.eql(
            formatError.createError('api', '0006', null, ERROR_CODES)
          )

          this.statusCode.should.eql(403)
          done()
        },
        setHeader: sinon.stub()
      }

      help.sendBackErrorWithCode('0006', 403, res, () => {})
    })

    it('should send an error with the formatted message corresponding to the API error code with the status code 500 if one is not provided', done => {
      const res = {
        end: function end(resBody) {
          this.setHeader.callCount.should.eql(3)
          this.setHeader.args[0][0].should.eql('Content-Length')
          this.setHeader.args[0][1].should.be.Number
          this.setHeader.args[1][0].should.eql('Content-Type')
          this.setHeader.args[1][1].should.eql('application/json')

          const body = JSON.parse(resBody)

          body.should.eql(
            formatError.createError('api', '0006', null, ERROR_CODES)
          )
          this.statusCode.should.eql(500)

          done()
        },
        setHeader: sinon.stub()
      }

      help.sendBackErrorWithCode('0006', res, {})
    })
  })

  describe('sendBackJSONP', function() {
    it('should call the next handler if there is an error', done => {
      const nextFn = sinon.stub()

      help.sendBackJSONP('foobar', {}, nextFn)(new Error('Something'))

      nextFn.callCount.should.eql(1)

      done()
    })

    it('should throw a 404 is the callback name contains non-letter characters', done => {
      const res = {
        send: sinon.stub()
      }

      help.sendBackJSONP('foobar123', res)(null, {})

      res.send.callCount.should.eql(1)
      res.send.args[0][0].should.eql(400)

      done()
    })

    it('should send a response with the given callback and JSON-stringified results', done => {
      const res = {
        end: sinon.stub(),
        setHeader: sinon.stub()
      }
      const data = {
        results: [{_id: '123', name: 'Restful Jim'}]
      }

      help.sendBackJSONP('foobar', res)(null, data)

      res.setHeader.callCount.should.eql(2)
      res.setHeader.args[0][0].should.eql('content-type')
      res.setHeader.args[0][1].should.eql('text/javascript')
      res.setHeader.args[1][0].should.eql('content-length')
      res.setHeader.args[1][1].should.be.Number

      res.end.callCount.should.eql(1)
      res.end.args[0][0].should.eql(`foobar(${JSON.stringify(data)});`)

      done()
    })
  })

  describe('parseQuery', function() {
    it('should export method', function(done) {
      help.parseQuery.should.be.Function
      done()
    })

    it('should return correct JSON object for valid querystring', function(done) {
      const querystring = '{ "cap_id": 2337,"year":2224,"plate":4 }'
      const query = help.parseQuery(querystring)

      let k = '',
        v = ''

      for (const key in query) {
        if (key === 'plate') {
          v = query[key]
          k = key
          break
        }
      }

      v.should.equal(4)

      done()
    })

    it('should return empty JSON object for invalid querystring', function(done) {
      const querystring = '{ "cap_id: 2337,"year":2224,"plate":4 }'
      const query = help.parseQuery(querystring)

      let k = '',
        v = ''

      for (const key in query) {
        v = query[key]
        k = key
        break
      }

      k.should.equal('')
      v.should.equal('')

      done()
    })

    it('should do nothing for querystring with leading zeroes', function(done) {
      const querystring = '{ "title": "My 007 Movie" }'
      const query = help.parseQuery(querystring)

      let k = '',
        v = ''

      for (const key in query) {
        if (key === 'title') {
          v = query[key]
          k = key
          break
        }
      }

      v.should.equal('My 007 Movie')

      done()
    })

    // it('should return correct JSON object for querystring with leading zeroes', function (done) {
    //   var querystring = '{ "cap_id": 2337,"year":2224,"plate":04 }';
    //   var query = help.parseQuery(querystring);

    //   var k = "", v = "";
    //   for(var key in query) {
    //     if(query.hasOwnProperty(key) && key == 'plate') {
    //       v = query[key];
    //       k = key;
    //       break;
    //     }
    //   }

    //   v.should.equal(4);

    //   done();
    // });
  })
})
