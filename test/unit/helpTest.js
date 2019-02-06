const ERROR_CODES = require('./../../error-codes')
const formatError = require('@dadi/format-error')
const should = require('should')
const sinon = require('sinon')
const help = require(__dirname + '/../../dadi/lib/help')

describe('Help', function (done) {
  describe('sendBackErrorTrace', function () {
    it('should send a 500 with the error trace', done => {
      let mockError

      try {
        thisWillBreak()
      } catch (error) {
        mockError = error
      }

      let res = {
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

      let body = JSON.parse(res.end.args[0][0])

      body.success.should.eql(false)
      body.error.includes('ReferenceError: thisWillBreak is not defined').should.eql(true)
      res.statusCode.should.eql(500)

      done()
    })
  })

  describe('sendBackErrorWithCode', function () {
    it('should send an error with the formatted message corresponding to the API error code with the status code provided', done => {
      let res = {
        end: function end (resBody) {
          this.setHeader.callCount.should.eql(2)
          this.setHeader.args[0][0].should.eql('Content-Length')
          this.setHeader.args[0][1].should.be.Number
          this.setHeader.args[1][0].should.eql('Content-Type')
          this.setHeader.args[1][1].should.eql('application/json')

          let body = JSON.parse(resBody)

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
      let res = {
        end: function end (resBody) {
          this.setHeader.callCount.should.eql(2)
          this.setHeader.args[0][0].should.eql('Content-Length')
          this.setHeader.args[0][1].should.be.Number
          this.setHeader.args[1][0].should.eql('Content-Type')
          this.setHeader.args[1][1].should.eql('application/json')

          let body = JSON.parse(resBody)

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

  describe('sendBackJSONP', function () {
    it('should call the next handler if there is an error', done => {
      let nextFn = sinon.stub()

      help.sendBackJSONP('foobar', {}, nextFn)(
        new Error('Something')
      )

      nextFn.callCount.should.eql(1)

      done()
    })

    it('should throw a 404 is the callback name contains non-letter characters', done => {
      let res = {
        send: sinon.stub()
      }

      help.sendBackJSONP('foobar123', res)(
        null,
        {}
      )

      res.send.callCount.should.eql(1)
      res.send.args[0][0].should.eql(400)

      done()
    })

    it('should send a response with the given callback and JSON-stringified results', done => {
      let res = {
        end: sinon.stub(),
        setHeader: sinon.stub()
      }
      let data = {
        results: [
          { _id: '123', name: 'Restful Jim' }
        ]
      }

      help.sendBackJSONP('foobar', res)(
        null,
        data
      )

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

  describe('validateCollectionSchema', function () {
    it('should inform of missing sections', function (done) {
      var schema = {
      }

      var val = help.validateCollectionSchema(schema)
      val.success.should.be.false
      val.errors.length.should.equal(1)
      val.errors[0].section.should.equal('fields')
      val.errors[0].message.should.startWith('must be provided at least once')

      done()
    })

    it('should inform that minimum number of fields not supplied', function (done) {
      var schema = {
        fields: {},
        settings: {cache: true, authenticate: true, count: 10, sortOrder: 1}
      }

      var val = help.validateCollectionSchema(schema)
      val.success.should.be.false
      val.errors[0].section.should.equal('fields')
      val.errors[0].message.should.equal('must include at least one field')

      done()
    })

    it('should allow field collections within primary `fields` object', function (done) {
      var schema = {
        'tab1': {
          'fields': {
            'tab1Field1': {
              'type': 'String',
              'label': 'Title',
              'comments': 'The title of the entry',
              'placement': 'Main content',
              'validation': {},
              'required': false,
              'message': '',
              'display': {
                'index': true,
                'edit': true
              }
            }
          }
        },
        'tab2': {
          'fields': {
            'tab2Field1': {
              'type': 'String'
            }
          }
        },
        'settings': {cache: true, authenticate: true, count: 10, sortOrder: 1}
      }

      var val = help.validateCollectionSchema(schema)
      val.success.should.be.true

      done()
    })

    it('should return false if the schema isn\'t an object', function (done) {
      var schema1 = 1337
      var schema2 = 'some string'
      var schema3 = null
      var schema4 = ['some', 'array']

      var val1 = help.validateCollectionSchema(schema1)
      var val2 = help.validateCollectionSchema(schema2)
      var val3 = help.validateCollectionSchema(schema3)
      var val4 = help.validateCollectionSchema(schema4)

      done()
    })
  })

  describe('parseQuery', function () {
    it('should export method', function (done) {
      help.parseQuery.should.be.Function
      done()
    })

    it('should return correct JSON object for valid querystring', function (done) {
      var querystring = '{ "cap_id": 2337,"year":2224,"plate":4 }'
      var query = help.parseQuery(querystring)

      var k = '', v = ''
      for (var key in query) {
        if (query.hasOwnProperty(key) && key == 'plate') {
          v = query[key]
          k = key
          break
        }
      }

      v.should.equal(4)

      done()
    })

    it('should return empty JSON object for invalid querystring', function (done) {
      var querystring = '{ "cap_id: 2337,"year":2224,"plate":4 }'
      var query = help.parseQuery(querystring)

      var k = '', v = ''
      for (var key in query) {
        if (query.hasOwnProperty(key)) {
          v = query[key]
          k = key
          break
        }
      }

      k.should.equal('')
      v.should.equal('')

      done()
    })

    it('should do nothing for querystring with leading zeroes', function (done) {
      var querystring = '{ "title": "My 007 Movie" }'
      var query = help.parseQuery(querystring)

      var k = '', v = ''
      for (var key in query) {
        if (query.hasOwnProperty(key) && key == 'title') {
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
