var should = require('should')
var sinon = require('sinon')
var model = require(__dirname + '/../../../dadi/lib/model')
var queryUtils = require(__dirname + '/../../../dadi/lib/model/utils')
var apiHelp = require(__dirname + '/../../../dadi/lib/help')
var _ = require('underscore')
var help = require(__dirname + '/../help')
var config = require(__dirname + '/../../../config')

describe('Query Utils', function () {
  describe('`processFilter` method', function () {
    it('should replace "$now" with current timestamp', function (done) {
      var query = { 'start': '$now' }

      query = queryUtils.processFilter(query, {});

      (typeof query.start).should.eql('number')

      done()
    })

    it('should process nested filters', function (done) {
      query = { 'publishedState.start': { '$gt': '$now' } }

      query = queryUtils.processFilter(query, {})

      var nested = query['publishedState.start'];

      (typeof nested['$gt']).should.eql('number')

      done()
    })
  })

  describe('`makeCaseInsensitive` method', function () {
    it('should convert a normal field query to a case insensitive regex query if schema doesn\'t specify otherwise', function (done) {
      var schema = help.getModelSchema()
      var query = { 'fieldName': 'example' }
      var expected = { 'fieldName': new RegExp(['^', 'example', '$'].join(''), 'i') }

      var result = queryUtils.makeCaseInsensitive(query, schema)

      result.should.eql(expected)

      done()
    })

    it('should not convert a query using dot notation to a case insensitive regex query if schema doesn\'t allow', function (done) {
      var schema = help.getModelSchema()
      schema['fieldName'].type = 'Object'
      schema['fieldName'].matchType = 'exact'

      var query = { 'fieldName.inner': 'example' }
      var expected = { 'fieldName.inner': 'example' }

      var result = queryUtils.makeCaseInsensitive(query, schema)

      result.should.eql(expected)
      done()
    })

    it('should convert a normal field query to a case insensitive regex query if schema specifies', function (done) {
      var schema = help.getModelSchema()
      schema['fieldName'].matchType = 'ignoreCase'

      var query = { 'fieldName': 'example' }
      var expected = { 'fieldName': new RegExp(['^', 'example', '$'].join(''), 'i') }

      var result = queryUtils.makeCaseInsensitive(query, schema)

      result.should.eql(expected)

      done()
    })

    it('should convert a normal field query to a regex query if schema specifies unknown `matchType`', function (done) {
      var schema = help.getModelSchema()
      schema['fieldName'].matchType = 'fuzzy'

      var query = { 'fieldName': 'example' }
      var expected = { 'fieldName': new RegExp(['^', 'example', '$'].join('')) }

      var result = queryUtils.makeCaseInsensitive(query, schema)

      result.should.eql(expected)

      done()
    })

    it('should not convert a normal field query to a regex query if schema doesn\'t allow', function (done) {
      var schema = help.getModelSchema()
      schema['fieldName'].matchType = 'exact'

      var query = { 'fieldName': 'example' }
      var expected = { 'fieldName': 'example' }

      var result = queryUtils.makeCaseInsensitive(query, schema)

      result.should.eql(expected)

      done()
    })

    it('should escape characters in a regex query', function (done) {
      var schema = help.getModelSchema()
      var query = { 'fieldName': 'BigEyes)' }
      var expected = { 'fieldName': new RegExp(['^', apiHelp.regExpEscape('BigEyes)'), '$'].join(''), 'i') }

      var result = queryUtils.makeCaseInsensitive(query, schema)

      result.should.eql(expected)
      done()
    })
  })

  describe('`containsNestedReferenceFields` method', function () {
    it('should return true when query is for only a nested Reference field', function (done) {
      var fields = help.getModelSchema()
      var schema = {}
      schema.fields = fields

      schema.fields.field2 = _.extend({}, schema.fields.fieldName, {
        type: 'Reference',
        required: false
      })

      schema.fields.field3 = _.extend({}, schema.fields.fieldName, {
        type: 'Object',
        required: false
      })

      var query = { 'field2.name': 'Jones' }

      var result = queryUtils.containsNestedReferenceFields(query, schema.fields)

      result.should.eql(true)

      done()
    })

    it('should return true when query contains a nested Reference field', function (done) {
      var fields = help.getModelSchema()
      var schema = {}
      schema.fields = fields

      schema.fields.field2 = _.extend({}, schema.fields.fieldName, {
        type: 'Reference',
        required: false
      })

      schema.fields.field3 = _.extend({}, schema.fields.fieldName, {
        type: 'Object',
        required: false
      })

      var query = { 'field3.id': '1234566789', 'field2.name': 'Jones' }

      var result = queryUtils.containsNestedReferenceFields(query, schema.fields)

      result.should.eql(true)

      done()
    })

    it('should return false when query does not contain a nested Reference field', function (done) {
      var fields = help.getModelSchema()
      var schema = {}
      schema.fields = fields

      schema.fields.field2 = _.extend({}, schema.fields.fieldName, {
        type: 'Reference',
        required: false
      })

      schema.fields.field3 = _.extend({}, schema.fields.fieldName, {
        type: 'Object',
        required: false
      })

      var query = { 'field3.id': '1234566789' }

      var result = queryUtils.containsNestedReferenceFields(query, schema.fields)

      result.should.eql(false)

      done()
    })
  })
})
