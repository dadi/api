var should = require('should')
var sinon = require('sinon')
var model = require(__dirname + '/../../../dadi/lib/model')
var queryUtils = require(__dirname + '/../../../dadi/lib/model/utils')
var apiHelp = require(__dirname + '/../../../dadi/lib/help')
var _ = require('underscore')
var help = require(__dirname + '/../help')
var config = require(__dirname + '/../../../config')

describe('Query Utils', function () {
  describe('`convertApparentObjectIds` method', function () {
    it('should convert Strings to ObjectIDs when a field type is ObjectID', function (done) {
      var fields = help.getModelSchema()
      var schema = {}
      schema.fields = fields

      schema.fields.field2 = _.extend({}, schema.fields.fieldName, {
        type: 'ObjectID',
        required: false
      })

      var query = { 'field2': '55cb1658341a0a804d4dadcc' }

      query = queryUtils.convertApparentObjectIds(query, schema.fields)

      var type = typeof query.field2
      type.should.eql('object')

      done()
    })

    it('should allow $in query to convert Strings to ObjectIDs for Reference fields', function (done) {
      var fields = help.getModelSchema()
      var schema = {}
      schema.fields = fields

      schema.fields.field2 = _.extend({}, schema.fields.fieldName, {
        type: 'Reference',
        required: false
      })

      var query = { 'field2': { '$in': ['55cb1658341a0a804d4dadcc'] } }

      query = queryUtils.convertApparentObjectIds(query, schema.fields)

      var type = typeof query.field2
      type.should.eql('object')

      done()
    })

    it('should not convert (sub query) Strings to ObjectIDs when a field type is Object', function (done) {
      var fields = help.getModelSchema()
      var schema = {}
      schema.fields = fields

      schema.fields.field2 = _.extend({}, schema.fields.fieldName, {
        type: 'ObjectID',
        required: false
      })

      schema.fields.field3 = _.extend({}, schema.fields.fieldName, {
        type: 'Object',
        required: false
      })

      var query = { 'field3': {'id': '55cb1658341a0a804d4dadcc' }}

      query = queryUtils.convertApparentObjectIds(query, schema.fields)

      var type = typeof query.field3.id
      type.should.eql('string')

      done()
    })

    it('should not convert (dot notation) Strings to ObjectIDs when a field type is Object', function (done) {
      var fields = help.getModelSchema()
      var schema = {}
      schema.fields = fields

      schema.fields.field2 = _.extend({}, schema.fields.fieldName, {
        type: 'ObjectID',
        required: false
      })

      schema.fields.field3 = _.extend({}, schema.fields.fieldName, {
        type: 'Object',
        required: false
      })

      var query = { 'field3.id': '55cb1658341a0a804d4dadcc' }

      query = queryUtils.convertApparentObjectIds(query, schema.fields)

      var type = typeof query[Object.keys(query)[0]]
      type.should.eql('string')

      done()
    })
  })

  describe('`makeCaseInsensitive` method', function () {
    it('should convert a normal field query to a case insensitive query', function (done) {
      var query = { 'test': 'example' }
      var expected = { 'test': new RegExp(['^', 'example', '$'].join(''), 'i') }

      var result = queryUtils.makeCaseInsensitive(query)

      result.should.eql(expected)

      done()
    })

    it('should convert a regex query to a case insensitive query', function (done) {
      var query = { 'test': { '$regex': 'example'} }
      var expected = { 'test': { '$regex': new RegExp('example', 'i') } }

      var result = queryUtils.makeCaseInsensitive(query)

      result.should.eql(expected)
      done()
    })

    it('should escape characters in a regex query', function (done) {
      var query = { 'test': 'BigEyes)' }
      var expected = { 'test': new RegExp(['^', apiHelp.regExpEscape('BigEyes)'), '$'].join(''), 'i') }

      var result = queryUtils.makeCaseInsensitive(query)

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