var should = require('should')
var sinon = require('sinon')
var model = require(__dirname + '/../../../dadi/lib/model')
var queryUtils = require(__dirname + '/../../../dadi/lib/model/utils')
var apiHelp = require(__dirname + '/../../../dadi/lib/help')
var Validator = require(__dirname + '/../../../dadi/lib/model/validator')
var connection = require(__dirname + '/../../../dadi/lib/model/connection')
var _ = require('underscore')
var help = require(__dirname + '/../help')
var config = require(__dirname + '/../../../config')

describe('Model', function () {
  beforeEach(function (done) {
    help.clearCollection('testModelName', function() {
      help.clearCollection('testModelNameHistory', function() {
        connection.resetConnections()
        done()
      })
    })
  })

  it('should export a function', function (done) {
    model.should.be.Function
    done()
  })

  it('should export a constructor', function (done) {
    model.Model.should.be.Function
    done()
  })

  it('should export function that creates an instance of Model when passed schema', function (done) {
    model('testModelName', help.getModelSchema()).should.be.an.instanceOf(model.Model)
    done()
  })

  it('should export function that gets instance of Model when not passed schema', function (done) {
    model('testModelName').should.be.an.instanceOf(model.Model)
    done()
  })

  it('should only create one instance of Model for a specific name', function (done) {
    model('testModelName').should.equal(model('testModelName'))
    done()
  })

  describe('initialization options', function () {
    it('should take model name and schema as arguments', function (done) {
      model('testModelName', help.getModelSchema()).name.should.equal('testModelName')
      done()
    })

    it('should accept database connection as third argument', function (done) {
      config.set('database.enableCollectionDatabases', true)
      connection.resetConnections()
      var conn = connection({
        'username': '',
        'password': '',
        'database': 'test',
        'replicaSet': '',
        'hosts': [
          {
            'host': 'localhost',
            'port': 27020
          }
        ]
      })

      var mod = model('testModelName', help.getModelSchema(), conn)
      should.exist(mod.connection)
      mod.connection.connectionOptions.hosts[0].host.should.equal('localhost')
      mod.connection.connectionOptions.hosts[0].port.should.equal(27020)
      mod.connection.connectionOptions.database.should.equal('test')

      config.set('database.enableCollectionDatabases', false)

      done()
    })

    it('should accept model settings as fourth argument', function (done) {
      var mod = model('testModelName', help.getModelSchema(), null, {
        cache: true,
        count: 25
      })
      should.exist(mod.settings)
      mod.settings.cache.should.be.true
      mod.settings.count.should.equal(25)

      done()
    })

    it('should attach history collection by default if not specified and `storeRevisions` is not false', function (done) {
      var conn = connection()
      var mod = model('testModelName', help.getModelSchema(), conn)
      should.exist(mod.settings)
      mod.revisionCollection.should.equal('testModelNameHistory')

      done()
    })

    it('should attach history collection if specified', function (done) {
      var conn = connection()
      var mod = model('testModelName', help.getModelSchema(), conn, { revisionCollection: 'modelHistory' })
      mod.revisionCollection.should.equal('modelHistory')

      done()
    })

    it('should attach history collection if `storeRevisions` is true', function (done) {
      var conn = connection()
      var mod = model('testModelName', help.getModelSchema(), conn, { storeRevisions: true })
      should.exist(mod.revisionCollection)
      mod.revisionCollection.should.equal('testModelNameHistory')

      done()
    })

    it('should attach specified history collection if `storeRevisions` is true', function (done) {
      var conn = connection()
      var mod = model('testModelName', help.getModelSchema(), conn, { storeRevisions: true, revisionCollection: 'modelHistory' })
      should.exist(mod.revisionCollection)
      mod.revisionCollection.should.equal('modelHistory')

      done()
    })

    it.skip('should accept collection indexing settings', function (done) {
      var mod = model('testModelName', help.getModelSchema(), null, {
        index: {
          enabled: true,
          keys: { orderDate: 1 }
        }
      })

      should.exist(mod.settings)
      JSON.stringify(mod.settings.index[0].keys).should.equal(JSON.stringify({ orderDate: 1 }))

      done()
    })

    it('should accept collection indexing settings for v1.14.0 and above', function (done) {
      var mod = model('testModelName', help.getModelSchema(), null, { index: [ { keys: { orderDate: 1 } } ] })

      should.exist(mod.settings)
      JSON.stringify(mod.settings.index[0].keys).should.equal(JSON.stringify({ orderDate: 1 }))
      done()
    })

    it('should accept collection displayName setting', function (done) {
      var mod = model('testModelName', help.getModelSchema(), null, { displayName: 'TEST MODEL' })

      should.exist(mod.settings)
      mod.settings.displayName.should.equal('TEST MODEL')

      done()
    })

    it('should attach `type` definition to model', function (done) {
      var val = 'test type'

      help.testModelProperty('type', val)
      done()
    })

    it('should attach `label` definition to model', function (done) {
      var val = 'test label'

      help.testModelProperty('label', val)
      done()
    })

    it('should attach `comments` definition to model', function (done) {
      var val = 'test comments'

      help.testModelProperty('comments', val)
      done()
    })

    it('should attach `limit` definition to model', function (done) {
      var val = 'test limit'

      help.testModelProperty('limit', val)
      done()
    })

    it('should attach `placement` definition to model', function (done) {
      var val = 'test placement'

      help.testModelProperty('placement', val)
      done()
    })

    it('should attach `validation` definition to model', function (done) {
      var val = '{ regex: { pattern: { /w+/ } } }'

      help.testModelProperty('validation', val)
      done()
    })

    it('should attach `required` definition to model', function (done) {
      var val = true

      help.testModelProperty('required', val)
      done()
    })

    it('should attach `message` definition to model', function (done) {
      var val = 'test message'

      help.testModelProperty('message', val)
      done()
    })

    it('should attach `display` definition to model', function (done) {
      var val = {
        index: true,
        edit: true
      }

      help.testModelProperty('display', val)
      done()
    })
  })

  describe('`convertObjectIdsForSave` method', function () {
    it('should be added to model', function (done) {
      model('testModelName', help.getModelSchema()).convertObjectIdsForSave.should.be.Function
      done()
    })

    it('should accept schema and object and replace ObjectIDs in array', function (done) {
      var fields = help.getModelSchema()
      var schema = {}
      schema.fields = fields

      schema.fields.field2 = _.extend({}, schema.fields.fieldName, {
        type: 'ObjectID',
        required: false
      })

      var mod = model('testModelName', schema)

      var obj = {fieldName: 'Hello', field2: ['55cb1658341a0a804d4dadcc'] }
      obj = mod.convertObjectIdsForSave(schema.fields, obj)

      var t = typeof obj.field2[0]
      t.should.eql('object')

      done()
    })

    it('should accept schema and object and replace ObjectIDs as single value', function (done) {
      var fields = help.getModelSchema()
      var schema = {}
      schema.fields = fields

      schema.fields.field2 = _.extend({}, schema.fields.fieldName, {
        type: 'ObjectID',
        required: false
      })

      var mod = model('testModelName', schema)

      var obj = {fieldName: 'Hello', field2: '55cb1658341a0a804d4dadcc' }

      obj = mod.convertObjectIdsForSave(schema.fields, obj)

      var t = typeof obj.field2
      t.should.eql('object')

      done()
    })
  })

  describe('`stats` method', function () {
    it('should be added to model', function (done) {
      model('testModelName', help.getModelSchema()).stats.should.be.Function
      done()
    })

    it('should accept an options object and callback', function (done) {
      model('testModelName', help.getModelSchema()).stats({}, done)
    })

    it('should return an object', function (done) {
      model('testModelName', help.getModelSchema()).stats({}, function (err, stats) {
        stats.should.exist
        done()
      })
    })
  })

  describe('`find` method', function () {
    it('should be added to model', function (done) {
      model('testModelName', help.getModelSchema()).find.should.be.Function
      done()
    })

    it('should accept query object and callback', function (done) {
      model('testModelName', help.getModelSchema()).find({}, done)
    })

    it('should accept JSON array for aggregation queries and callback', function (done) {
      var query = [
        { $match: { status: 'A' } }
      ]
      model('testModelName', help.getModelSchema()).find(query, done)
    })

    it('should pass error to callback when query uses `$where` operator', function (done) {
      model('testModelName').find({$where: 'this.fieldName === "foo"'}, function (err) {
        should.exist(err)
        done()
      })
    })
  })

  describe('includeHistory param', function () {
    it('should override `done` method if options.includeHistory = true', function (done) {
      var conn = connection()
      var mod = model('testModelName', help.getModelSchema(), conn, { storeRevisions: true })

      var method = sinon.spy(model.Model.prototype, 'injectHistory')

      mod.create({fieldName: 'foo'}, function (err, result) {
        if (err) return done(err)

        mod.find({fieldName: 'foo'}, { includeHistory: true }, function (err, results) {
          if (err) return done(err)

          method.restore()
          method.called.should.eql(true)

          results.results.should.exist
          results.results.should.be.Array
          results.results[0].fieldName.should.eql('foo')
          done()
        })
      })
    })

    it('should add history to results if options.includeHistory = true', function (done) {
      var conn = connection()
      var mod = model('testModelName', help.getModelSchema(), conn, { storeRevisions: true })

      mod.create({fieldName: 'foo'}, function (err, result) {
        if (err) return done(err)

        mod.update({fieldName: 'foo'}, {fieldName: 'bar'}, function (err, result) {
          if (err) return done(err)

          mod.find({}, { includeHistory: true }, function (err, results) {
            if (err) return done(err)

            results.results.should.exist
            results.results.should.be.Array
            results.results[0].history.should.exist
            results.results[0].history[0].fieldName.should.eql('foo')
            done()
          })
        })
      })
    })

    it('should use specified historyFilters when includeHistory = true', function (done) {
      var conn = connection()
      var mod = model('testModelName', help.getModelSchema(), conn, { storeRevisions: true })

      mod.create({fieldName: 'foo'}, function (err, result) {
        if (err) return done(err)

        mod.update({fieldName: 'foo'}, {fieldName: 'bar'}, function (err, result) {
          if (err) return done(err)

          mod.find({}, { includeHistory: true, historyFilters: '{ "fieldName": "foo" }' }, function (err, results) {
            if (err) return done(err)

            results.results.should.exist
            results.results.should.be.Array
            should.exist(results.results[0].history)
            should.exist(results.results[0].fieldName)
            done()
          })
        })
      })
    })
  })

  describe('Version number', function () {
    it('should add v:1 to a new document', function (done) {
      var conn = connection()
      var mod = model('testModelName', help.getModelSchema(), conn, { storeRevisions: true })

      mod.create({fieldName: 'foo'}, function (err, result) {
        if (err) return done(err)

        mod.find({}, { includeHistory: true }, function (err, results) {
          if (err) return done(err)

          results.results.should.exist
          results.results.should.be.Array
          results.results[0].v.should.eql(1)
          done()
        })
      })
    })

    it('should increment the version number when updating a document', function (done) {
      var conn = connection()
      var mod = model('testModelName', help.getModelSchema(), conn, { storeRevisions: true })

      mod.create({fieldName: 'foo'}, function (err, result) {
        if (err) return done(err)

        mod.update({fieldName: 'foo'}, {fieldName: 'bar'}, function (err, result) {
          if (err) return done(err)

          mod.find({fieldName: 'bar'}, { includeHistory: true }, function (err, results) {
            if (err) return done(err)

            results.results.should.exist
            results.results.should.be.Array
            results.results[0].v.should.eql(2)
            results.results[0].history[0].v.should.eql(1)
            done()
          })
        })
      })
    })
  })

  describe('`revisions` method', function () {
    it('should be added to model', function (done) {
      model('testModelName', help.getModelSchema()).revisions.should.be.Function
      done()
    })

    it('should accept id param and return history collection', function (done) {
      var conn = connection()
      var mod = model('testModelName', help.getModelSchema(), conn, { storeRevisions: true })

      mod.create({fieldName: 'foo'}, function (err, result) {
        if (err) return done(err)

        mod.update({fieldName: 'foo'}, {fieldName: 'bar'}, function (err, result) {
          if (err) return done(err)

          mod.find({fieldName: 'bar'}, function (err, doc) {
            if (err) return done(err)

            var doc_id = doc.results[0]._id
            var revision_id = doc.results[0].history[0] // expected history object

            model('testModelName', help.getModelSchema()).revisions(doc_id, {}, function (err, result) {
              if (err) return done(err)

              result.should.be.Array

              if (result[0]) {
                result[0]._id.toString().should.equal(revision_id.toString())
              }
            })
            done()
          })
        })
      })
    })
  })

  describe('`createIndex` method', function () {
    it('should be added to model', function (done) {
      model('testModelName', help.getModelSchema()).createIndex.should.be.Function
      done()
    })

    it('should create index if indexing settings are supplied', function (done) {
      var conn = connection()
      var mod = model('testModelName',
        help.getModelSchema(),
        conn,
        {
          index: {
            enabled: true,
            keys: {
              fieldName: 1
            },
            options: {
              unique: false,
              background: true,
              dropDups: false,
              w: 1
            }
          }
        }
      )

      mod.create({fieldName: 'ABCDEF'}, function (err, result) {
        if (err) return done(err)

        setTimeout(function() {
          // Peform a query, with explain to show we hit the index
          mod.find({'fieldName': 'ABC'}, {explain: true}, function (err, explanation) {
            var explanationString = JSON.stringify(explanation.results[0])
            explanationString.indexOf('fieldName_1').should.be.above(-1)
            done()
          })
        }, 1000)
      })
    })

    it('should support compound indexes', function (done) {
      help.cleanUpDB(() => {
        var conn = connection()
        var fields = help.getModelSchema()
        var schema = {}
        schema.fields = fields

        schema.fields.field2 = _.extend({}, schema.fields.fieldName, {
          type: 'Number',
          required: false
        })

        var mod = model('testModelName',
          schema.fields,
          conn,
          {
            index: {
              enabled: true,
              keys: {
                fieldName: 1,
                field2: 1
              },
              options: {
                unique: false,
                background: true,
                dropDups: false,
                w: 1
              }
            }
          }
        )

        mod.create({fieldName: 'ABCDEF', field2: 2}, function (err, result) {
          if (err) return done(err)

          setTimeout(function() {
            // Peform a query, with explain to show we hit the query
            mod.find({'fieldName': 'ABC', 'field2': 1}, {explain: true}, function (err, explanation) {
              var explanationString = JSON.stringify(explanation.results[0])
              explanationString.indexOf('fieldName_1_field2_1').should.be.above(-1)

              done()
            })
          }, 1000)
        })
      })
    })

    it('should support unique indexes', function (done) {
      help.cleanUpDB(() => {
        var conn = connection()
        var fields = help.getModelSchema()
        var schema = {}
        schema.fields = fields

        schema.fields.field3 = _.extend({}, schema.fields.fieldName, {
          type: 'String',
          required: false
        })

        var mod = model('testModelName',
          schema.fields,
          conn,
          {
            index: {
              enabled: true,
              keys: {
                field3: 1
              },
              options: {
                unique: true
              }
            }
          }
        )

        setTimeout(function() {
          mod.create({field3: 'ABCDEF'}, function (err, result) {
            if (err) return done(err)

            mod.create({field3: 'ABCDEF'}, function (err, result) {
              should.exist(err)

              err.name.should.eql('MongoError')
              err.code.should.eql('11000')
              done()
            })
          })
        }, 1000)
      })
    })

    it('should support multiple indexes', function (done) {
      help.cleanUpDB(() => {
        var conn = connection()
        var fields = help.getModelSchema()
        var schema = {}
        schema.fields = fields

        schema.fields.field3 = _.extend({}, schema.fields.fieldName, {
          type: 'String',
          required: false
        })

        var mod = model('testModelName',
          schema.fields,
          conn,
          {
            index: [
              {
                keys: {
                  fieldName: 1
                },
                options: {
                  unique: true
                }
              },
              {
                keys: {
                  field3: 1
                },
                options: {
                  unique: true
                }
              }
            ]
          }
        )

        setTimeout(function() {
          mod.create({fieldName: 'ABCDEF'}, function (err, result) {
            if (err) return done(err)

            mod.create({fieldName: 'ABCDEF'}, function (err, result) {
              should.exist(err)

              err.name.should.eql('MongoError')
              err.code.should.eql('11000')
              done()
            })
          })
        }, 1000)
      })
    })
  })

  describe('`create` method', function () {
    beforeEach(help.cleanUpDB)

    it('should be added to model', function (done) {
      model('testModelName', help.getModelSchema()).create.should.be.Function
      done()
    })

    it('should accept Object and callback', function (done) {
      var mod = model('testModelName', help.getModelSchema())
      mod.create({fieldName: 'foo'}, done)
    })

    it('should accept Array and callback', function (done) {
      var mod = model('testModelName', help.getModelSchema())
      mod.create([{fieldName: 'foo'}, {fieldName: 'bar'}], done)
    })

    it('should save model to database', function (done) {
      var mod = model('testModelName', help.getModelSchema())
      mod.create({fieldName: 'foo'}, function (err) {
        if (err) return done(err)

        mod.find({fieldName: 'foo'}, function (err, doc) {
          if (err) return done(err)

          should.exist(doc['results'])
          doc['results'][0].fieldName.should.equal('foo')
          done()
        })
      })
    })

    it('should save model to history collection', function (done) {
      var mod = model('testModelName', help.getModelSchema())
      mod.create({fieldName: 'foo'}, function (err) {
        if (err) return done(err)

        mod.find({fieldName: 'foo'}, function (err, doc) {
          if (err) return done(err)
          should.exist(doc['results'])
          doc['results'][0].history.should.be.Array
          doc['results'][0].history.length.should.equal(0) // no updates yet
          done()
        })
      })
    })

    it('should pass error to callback if validation fails', function (done) {
      var schema = help.getModelSchema()
      _.extend(schema.fieldName, {validation: { maxLength: 5}})
      var mod = model('testModelName', schema)
      mod.create({fieldName: '123456'}, function (err) {
        should.exist(err)
        done()
      })
    })
  })

  describe('`update` method', function () {
    beforeEach(function (done) {
      help.cleanUpDB(function (err) {
        if (err) return done(err)
        var mod = model('testModelName', help.getModelSchemaWithMultipleFields())

        // create model to be updated by tests
        mod.create({
          field1: 'foo', field2: 'bar'
        }, function (err, result) {
          if (err) return done(err)

          should.exist(result && result.results)
          result.results[0].field1.should.equal('foo')
          done()
        })
      })
    })

    it('should be added to model', function (done) {
      model('testModelName').update.should.be.Function
      done()
    })

    it('should accept query, update object, and callback', function (done) {
      var mod = model('testModelName')
      mod.update({field1: 'foo'}, {field1: 'bar'}, done)
    })

    it('should update an existing document', function (done) {
      var mod = model('testModelName')
      var updateDoc = {field1: 'bar'}

      mod.update({field1: 'foo'}, updateDoc, function (err, result) {
        if (err) return done(err)

        result.results.should.exist
        result.results[0].field1.should.equal('bar')

        // make sure document was updated
        mod.find({field1: 'bar'}, function (err, result) {
          if (err) return done(err)

          should.exist(result['results'] && result['results'][0])
          result['results'][0].field1.should.equal('bar')
          done()
        })
      })
    })

    it('should create new history revision when updating an existing document and `storeRevisions` is true', function (done) {
      var conn = connection()
      var mod = model('testModelName', help.getModelSchemaWithMultipleFields(), conn, { storeRevisions: true })
      var updateDoc = {field1: 'bar'}

      mod.update({field1: 'foo'}, updateDoc, function (err, result) {
        if (err) return done(err)

        result.results.should.exist
        result.results[0].field1.should.equal('bar')

        // make sure document was updated
        mod.find({field1: 'bar'}, function (err, result) {
          if (err) return done(err)

          should.exist(result['results'] && result['results'][0])
          result['results'][0].field1.should.equal('bar')

          should.exist(result['results'][0].history)
          result['results'][0].history.length.should.equal(1); // one revision, from the update

          done()
        })
      })
    })

    it('should pass error to callback if schema validation fails', function (done) {
      var schema = help.getModelSchema()
      _.extend(schema.fieldName, {validation: { maxLength: 5 }})
      var mod = model('testModelName', schema)
      mod.update({fieldName: 'foo'}, {fieldName: '123456'}, function (err) {
        should.exist(err)
        done()
      })
    })

    it('should pass error to callback when query uses `$where` operator', function (done) {
      model('testModelName').update({$where: 'this.fieldName === "foo"'}, {fieldName: 'bar'}, function (err) {
        should.exist(err)
        done()
      })
    })
  })

  describe('`delete` method', function () {
    beforeEach(help.cleanUpDB)

    it('should be added to model', function (done) {
      model('testModelName', help.getModelSchema()).delete.should.be.Function
      done()
    })

    it('should accept a query object and callback', function (done) {
      model('testModelName').delete({fieldName: 'foo'}, done)
    })

    it('should delete a single document', function (done) {
      var mod = model('testModelName')
      mod.create({fieldName: 'foo'}, function (err, result) {
        if (err) return done(err)
        result.results[0].fieldName.should.equal('foo')

        mod.delete({fieldName: 'foo'}, function (err, numAffected) {
          if (err) return done(err)

          numAffected.should.equal(1)

          mod.find({}, function (err, result) {
            if (err) return done(err)

            result['results'].length.should.equal(0)
            done()
          })
        })
      })
    })

    it('should delete multiple documents', function (done) {
      var mod = model('testModelName')
      mod.create([{fieldName: 'foo'}, {fieldName: 'bar'}, {fieldName: 'baz'}], function (err, result) {
        if (err) return done(err)
        result.results[0].fieldName.should.equal('foo')
        result.results[1].fieldName.should.equal('bar')
        result.results[2].fieldName.should.equal('baz')

        mod.delete({fieldName: {$in: ['foo', 'bar', 'baz']}}, function (err, numAffected) {
          if (err) return done(err)

          numAffected.should.equal(3)

          mod.find({}, function (err, result) {
            if (err) return done(err)

            result['results'].length.should.equal(0)
            done()
          })
        })
      })
    })

    it('should pass error to callback when query uses `$where` operator', function (done) {
      model('testModelName').delete({$where: 'this.fieldName === "foo"'}, function (err) {
        should.exist(err)
        done()
      })
    })
  })

  describe('composer', function () {
    it('should be attached to Model', function (done) {
      var mod = model('testModelName', help.getModelSchema())
      mod.composer.should.be.Object
      mod.composer.compose.should.be.Function
      done()
    })

    describe('compose', function () {
      // some defaults

      var bookSchema = {
        'title': {
          'type': 'String',
          'required': true
        },
        'author': {
          'type': 'Reference',
          'settings': {
            'collection': 'person',
            'fields': ['name', 'spouse']
          }
        },
        'booksInSeries': {
          'type': 'Reference',
          'settings': {
            'collection': 'book',
            'multiple': true
          }
        }
      }

      var personSchema = {
        'name': {
          'type': 'String',
          'required': true
        },
        'occupation': {
          'type': 'String',
          'required': false
        },
        'nationality': {
          'type': 'String',
          'required': false
        },
        'education': {
          'type': 'String',
          'required': false
        },
        'spouse': {
          'type': 'Reference'
        }
      }

      var schema = help.getModelSchema()

      var refField = {
        'refField': {
          'type': 'Reference',
          'settings': {
            // "database": "library2", // leave out to default to the same
            // "collection": "authors", // leave out to default to the same
            // "fields": ["firstName", "lastName"]
          }
        }
      }

      var nameFields = {
        'firstName': {
          'type': 'String',
          'required': false
        },
        'lastName': {
          'type': 'String',
          'required': false
        }
      }

      _.extend(schema, refField)
      _.extend(schema, nameFields)

      var mod = model('testModelName', schema)

      beforeEach(function (done) {
        help.cleanUpDB(function () {
          // create some docs
          for (var i = 0; i < 5; i++) {
            mod.create({fieldName: 'foo_' + i, firstName: 'Foo', lastName: i.toString()}, function (err, result) {
              if (err) return done(err)
            })
            if (i == 4) done()
          }
        })
      })

      it('should populate a reference field containing an ObjectID', function (done) {
        var conn = connection()
        // var mod = model('testModelName', schema)

        // find a doc
        mod.find({ fieldName: 'foo_3' } , {}, function (err, result) {
          var anotherDoc = result.results[0]

          // add the id to another doc
          mod.update({ fieldName: 'foo_1' }, { refField: anotherDoc._id }, function (err, result) {
            // doc1 should now have anotherDoc == doc3
            mod.find({fieldName: 'foo_1'}, { 'compose': true }, function (err, result) {

              //console.log(JSON.stringify(result))

              var doc = result.results[0]
              should.exist(doc.refField.fieldName)
              doc.refField.fieldName.should.equal('foo_3')

              // composed property
              should.exist(doc.composed)
              should.exist(doc.composed.refField)
              doc.composed.refField.should.eql(doc.refField._id)

              done()
            })
          })
        })
      })

      it('should populate a reference field with specified fields only', function (done) {
        var conn = connection()

        schema.refField.settings['fields'] = ['firstName', 'lastName']

        // find a doc
        mod.find({ fieldName: 'foo_3' } , {}, function (err, result) {
          var anotherDoc = result.results[0]

          // add the id to another doc
          mod.update({ fieldName: 'foo_1' }, { refField: anotherDoc._id }, function (err, result) {
            // doc1 should now have anotherDoc == doc3
            mod.find({fieldName: 'foo_1'}, { 'compose': true }, function (err, result) {
              // console.log(JSON.stringify(result))

              var doc = result.results[0]
              should.not.exist(doc.refField.fieldName)
              should.exist(doc.refField.firstName)
              should.exist(doc.refField.lastName)
              doc.refField.firstName.should.equal('Foo')
              doc.refField.lastName.should.equal('3')

              // composed property
              should.exist(doc.composed)
              should.exist(doc.composed.refField)
              doc.composed.refField.should.eql(doc.refField._id)

              done()
            })
          })
        })
      })

      it('should reference a document in the specified collection', function (done) {
        var conn = connection()

        // create two models
        var book = model('book', bookSchema, conn)
        var person = model('person', personSchema, conn)

        person.create({name: 'Neil Murray'}, function (err, result) {
          var id = result.results[0]._id

          person.create({name: 'J K Rowling', spouse: id}, function (err, result) {
            var id = result.results[0]._id

            book.create({title: 'Harry Potter 1', author: id}, function (err, result) {
              var bookid = result.results[0]._id
              var books = []
              books.push(bookid)

              book.create({title: 'Harry Potter 2', author: id, booksInSeries: books}, function (err, result) {
                // find a book
                book.find({ title: 'Harry Potter 2' } , { 'compose': true }, function (err, result) {
                  var doc = result.results[0]
                  should.exist(doc.author.name)
                  doc.author.name.should.equal('J K Rowling')

                  done()
                })
              })
            })
          })
        })
      })

      it('should allow specifying to not resolve the references via the model settings', function (done) {
        var conn = connection()

        // create two models
        var book = model('book', bookSchema, conn, { 'compose': false })
        var person = model('person', personSchema, conn, { 'compose': false })

        person.create({name: 'Neil Murray'}, function (err, result) {
          var id = result.results[0]._id

          person.create({name: 'J K Rowling', spouse: id}, function (err, result) {
            var id = result.results[0]._id

            book.create({title: 'Harry Potter 1', author: id}, function (err, result) {
              var bookid = result.results[0]._id
              var books = []
              books.push(bookid)

              book.create({title: 'Harry Potter 2', author: id, booksInSeries: books}, function (err, result) {
                // find a book
                book.find({ title: 'Harry Potter 2' } , { 'compose': true }, function (err, result) {
                  // console.log(JSON.stringify(result, null, 2))

                  var doc = result.results[0]
                  should.exist(doc.author.name)
                  should.not.exist(doc.author.spouse.name)

                  return done()
                })
              })
            })
          })
        })
      })

      it('should allow specifying to resolve the references via the model settings', function (done) {
        var conn = connection()

        // create two models
        var book = model('book', bookSchema, conn, { 'compose': true })
        var person = model('person', personSchema, conn, { 'compose': true })

        person.create({name: 'Neil Murray'}, function (err, result) {
          var id = result.results[0]._id

          person.create({name: 'J K Rowling', spouse: id}, function (err, result) {
            var id = result.results[0]._id

            book.create({title: 'Harry Potter 1', author: id}, function (err, result) {
              var bookid = result.results[0]._id
              var books = []
              books.push(bookid)

              book.create({title: 'Harry Potter 2', author: id, booksInSeries: books}, function (err, result) {
                // find a book
                book.find({ title: 'Harry Potter 2' } , { 'compose': true }, function (err, result) {
                  var doc = result.results[0]
                  should.exist(doc.author.name)
                  should.exist(doc.author.spouse.name)

                  return done()
                })
              })
            })
          })
        })
      })

      it('should populate a reference field containing an array of ObjectIDs', function (done) {
        // find a doc
        mod.find({ fieldName: { '$regex': 'foo' } } , {}, function (err, result) {
          // remove foo_1 from the results so we can add the remaining docs
          // to it as a reference
          var foo1 = _.findWhere(result.results, { fieldName: 'foo_1' })
          result.results.splice(result.results.indexOf(foo1), 1)

          var anotherDoc = _.map(_.pluck(result.results, '_id'), function(id) {
            return id.toString()
          })

          // add the id to another doc
          mod.update({ fieldName: 'foo_1' }, { refField: anotherDoc }, function (err, result) {
            // doc1 should now have refField as array of docs
            mod.find({fieldName: 'foo_1'}, { 'compose': true }, function (err, result) {
              var doc = result.results[0]
              doc.refField.length.should.eql(4)

              // composed property
              should.exist(doc.composed)
              should.exist(doc.composed.refField)
              doc.composed.refField.length.should.eql(4)

              done()
            })
          })
        })
      })

      describe('Reference field nested query', function () {
        it('should allow querying nested Reference field properties', function (done) {
          var conn = connection()

          // add a setting & replace "author" with "person" for this test
          bookSchema.author.settings.multiple = false
          var bookSchemaString = JSON.stringify(bookSchema)
          bookSchemaString = bookSchemaString.replace('author','person')


          var book = model('book', JSON.parse(bookSchemaString), conn)
          var person = model('person', personSchema, conn)

          person.create({name: 'Neil Murray'}, function (err, result) {
            var neil = result.results[0]._id

            person.create({name: 'J K Rowling', spouse: neil}, function (err, result) {
              var rowling = result.results[0]._id.toString()

              book.create({title: 'Harry Potter 1', person: rowling}, function (err, result) {
                var bookid = result.results[0]._id
                var books = []
                books.push(bookid)

                book.create({title: 'Neil\'s Autobiography', person: neil}, function (err, result) {

                  // find book where author.name = J K Rowling

                  book.find({ 'person.name': 'J K Rowling' }, { compose: true }, function (err, result) {
                    //console.log(JSON.stringify(result, null, 2))

                    result.results.length.should.eql(1)
                    var doc = result.results[0]
                    should.exist(doc.person.name)
                    doc.person.name.should.equal('J K Rowling')

                    done()
                  })
                })
              })
            })
          })
        })

        it('should allow querying second level nested Reference field properties', function (done) {
          var conn = connection()

          // add a setting & replace "author" with "person" for this test
          bookSchema.author.settings.multiple = false
          bookSchema.author.settings.compose = true
          bookSchema.settings = {
            compose: true
          }

          var bookSchemaString = JSON.stringify(bookSchema)
          bookSchemaString = bookSchemaString.replace('author','person')

          personSchema.spouse.settings = {
            compose: true
          }

          var book = model('book', JSON.parse(bookSchemaString), conn)
          var person = model('person', personSchema, conn)

          // console.log(JSON.stringify(book, null, 2))
          // console.log(JSON.stringify(person, null, 2))

          person.create({name: 'Neil Murray'}, function (err, result) {
            var neil = result.results[0]._id

            person.create({name: 'J K Rowling', spouse: neil}, function (err, result) {
              var rowling = result.results[0]._id.toString()

              book.create({title: 'Harry Potter 1', person: rowling}, function (err, result) {
                var bookid = result.results[0]._id
                var books = []
                books.push(bookid)

                book.find({ "person.spouse.name": "Neil Murray" }, { compose: true }, function (err, result) {

                  result.results.length.should.eql(1)
                  var doc = result.results[0]
                  should.exist(doc.person.spouse)
                  doc.person.name.should.equal('J K Rowling')

                  done()
                })
              })
            })
          })
        })

        it('should return results when multiple documents match a nested query', function (done) {
          var conn = connection()

          var categoriesSchema = {
            fields: {
              parent: {
                type: "Reference",
                settings: {
                  collection: "categories"
                },
                required: false
              },
              name: {
                type: "String",
                label: "Name",
                required: false
              },
              furl: {
                type: "String",
                label: "Friendly URL",
                required: false
              }
            },
            settings: {
              compose: true
            }
          }

          var articleSchema = {
            fields: {
              title: {
                type: 'String',
                required: true
              },
              categories: {
                type: 'Reference',
                settings: {
                  collection: "categories",
                  multiple: true
                }
              }
            },
            settings: {
              compose: true
            }
          }

          var category = model('categories', categoriesSchema.fields, conn)
          category.compose = true
          var article = model('articles', articleSchema.fields, conn)
          article.compose = true

          // parent categories
          category.create({name: 'Sports', furl: 'sports'}, function (err, result) {
            var sports = result.results[0]._id

            category.create({name: 'Music', furl: 'music'}, function (err, result) {
              var music = result.results[0]._id

              // child categories
              category.create({name: 'Music News', furl: 'news', parent: music.toString()}, function (err, result) {
                var musicNews = result.results[0]._id
                category.create({name: 'Sports News', furl: 'news', parent: sports.toString()}, function (err, result) {
                  var sportsNews = result.results[0]._id

                  category.create({name: 'Sports Events', furl: 'events', parent: sports.toString()}, function (err, result) {

                    // add an article
                    article.create({title: 'A Day at the Opera', categories: [musicNews.toString()]}, function (err, result) {

                      // add an article
                      article.create({title: 'A Day at the Races', categories: [sportsNews.toString()]}, function (err, result) {

                        article.find({ "categories.furl": "news", "categories.parent.furl": "sports" }, { compose: true, fields: {"categories": 1} }, function (err, result) {
                          //console.log(JSON.stringify(result.results))
                          result.results.length.should.eql(1)

                          var doc = result.results[0]
                          doc.categories[0].name.should.equal('Sports News')
                          doc.categories[0].parent.name.should.equal('Sports')
                          done()
                        })
                      })
                    })
                  })
                })
              })
            })
          })
        })

        it('should allow querying nested Reference fields with a different property name', function (done) {
          var conn = connection()

          // add a setting & replace "author" with "person" for this test
          bookSchema.author.settings.multiple = false

          var book = model('book', bookSchema, conn)
          var person = model('person', personSchema, conn)

          person.create({name: 'Neil Murray'}, function (err, result) {
            var neil = result.results[0]._id

            person.create({name: 'J K Rowling', spouse: neil}, function (err, result) {
              var rowling = result.results[0]._id.toString()

              book.create({title: 'Harry Potter 1', author: rowling}, function (err, result) {
                var bookid = result.results[0]._id
                var books = []
                books.push(bookid)

                book.create({title: 'Neil\'s Autobiography', author: neil}, function (err, result) {

                  // find book where author.name = J K Rowling

                  book.find({ 'author.name': 'J K Rowling' }, { compose: true }, function (err, result) {
                    //console.log(JSON.stringify(result, null, 2))

                    result.results.length.should.eql(1)
                    var doc = result.results[0]
                    should.exist(doc.author.name)
                    doc.author.name.should.equal('J K Rowling')

                    done()
                  })
                })
              })
            })
          })
        })

        it('should only return specified fields when querying nested Reference field properties', function (done) {
          var conn = connection()

          bookSchema.author.settings.multiple = false

          // create two models
          var book = model('book', bookSchema, conn)
          var person = model('person', personSchema, conn)

          person.create({name: 'Neil Murray'}, function (err, result) {
            var neil = result.results[0]._id

            person.create({name: 'J K Rowling', spouse: neil}, function (err, result) {
              var rowling = result.results[0]._id.toString()

              book.create({title: 'Harry Potter 1', author: rowling}, function (err, result) {
                var bookid = result.results[0]._id
                var books = []
                books.push(bookid)

                book.create({title: 'Neil\'s Autobiography', author: neil}, function (err, result) {

                  // find book where author.name = J K Rowling

                  book.find({ 'author.name': 'J K Rowling' }, { compose: true, fields: { 'title': 1, 'author': 1 }}, function (err, result) {

                    result.results.length.should.eql(1)
                    var doc = result.results[0]
                    should.exist(doc._id)
                    should.exist(doc.title)
                    should.exist(doc.author.name)
                    should.exist(doc.composed)
                    should.not.exist(doc.history)

                    done()
                  })
                })
              })
            })
          })
        })

        it('should allow querying normal fields and nested Reference field properties', function (done) {
          var conn = connection()

          bookSchema.author.settings.multiple = false

          // create two models
          var book = model('book', bookSchema, conn)
          var person = model('person', personSchema, conn)

          person.create({name: 'Neil Murray'}, function (err, result) {
            var neil = result.results[0]._id

            person.create({name: 'J K Rowling', spouse: neil}, function (err, result) {
              var rowling = result.results[0]._id.toString()

              book.create({title: 'Harry Potter 1', author: rowling}, function (err, result) {

                book.create({title: 'Harry Potter 2', author: rowling}, function (err, result) {

                  book.create({title: 'Neil\'s Autobiography', author: neil}, function (err, result) {

                    // find book where author.name = J K Rowling

                    book.find({ title: 'Harry Potter 1', 'author.name': 'J K Rowling' }, {compose: true}, function (err, result) {

                      result.results.length.should.eql(1)
                      var doc = result.results[0]
                      should.exist(doc.author.name)
                      doc.author.name.should.equal('J K Rowling')
                      done()
                    })
                  })
                })
              })
            })
          })
        })

        it('should only return matching results when querying nested Reference field properties', function (done) {
          var conn = connection()
          bookSchema.author.settings.multiple = false

          // create two models
          var book = model('book', bookSchema, conn)
          var person = model('person', personSchema, conn)
          person.create({name: 'Neil Murray'}, function (err, result) {
            var neil = result.results[0]._id
            person.create({name: 'J K Rowling', spouse: neil}, function (err, result) {
              var rowling = result.results[0]._id.toString()
              book.create({title: 'Harry Potter 1', author: rowling}, function (err, result) {
                book.create({title: 'Harry Potter 2', author: rowling}, function (err, result) {
                  book.create({title: 'Neil\'s Autobiography', author: neil}, function (err, result) {

                    // find book where author.name = J K Rowling
                    book.find({ title: 'Harry Potter 1', 'author.name': 'A B Cowling' }, {compose: true}, function (err, result) {
                      result.results.length.should.eql(0)
                      done()
                    })
                  })
                })
              })
            })
          })
        })
      })
    })
  })

  describe('validator', function () {
    it('should be attached to Model', function (done) {
      var mod = model('testModelName', help.getModelSchema())
      mod.validate.should.be.Object
      mod.validate.query.should.be.Function
      mod.validate.schema.should.be.Function
      done()
    })

    describe('query', function () {
      it('should not allow the use of `$where` in queries', function (done) {
        var mod = model('testModelName')
        mod.validate.query({$where: 'throw new Error("Insertion Attack!")'}).success.should.be.false
        done()
      })

      it('should allow querying with key values', function (done) {
        var mod = model('testModelName')
        mod.validate.query({fieldName: 'foo'}).success.should.be.true
        done()
      })

      it('should allow querying with key values too', function (done) {
        var schema = help.getModelSchema()
        schema = _.extend(schema, {
          fieldMixed: {
            type: 'Mixed',
            label: 'Mixed Field',
            required: false,
            display: { index: true, edit: true }
          }
        }
        )

        var mod = model('schemaTest', schema)
        mod.validate.query({'fieldMixed.innerProperty': 'foo'}).success.should.be.true
        done()
      })
    })

    describe('schema', function () {
      beforeEach(function (done) {
        model('schemaTest', help.getModelSchema())
        done()
      })

      it('should return true for object that matches schema', function (done) {
        var mod = model('schemaTest')
        mod.validate.schema({fieldName: 'foobar'}).success.should.be.true
        done()
      })

      it('should return false for object that contains undefined field', function (done) {
        var mod = model('schemaTest')
        mod.validate.schema({nonSchemaField: 'foobar', fieldName: 'baz'}).success.should.be.false
        done()
      })

      it('should check length limit for field', function (done) {
        var schema = help.getModelSchema()
        _.extend(schema.fieldName, {validation: { maxLength: 5}})
        var mod = model('limitTest', schema)
        mod.validate.schema({fieldName: '123456'}).success.should.be.false
        done()
      })

      it('should ensure all required fields are present', function (done) {
        var schema = help.getModelSchema()
        schema.requiredField = _.extend({}, schema.fieldName, {required: true})

        var mod = model('requiredTest', schema)
        mod.validate.schema({fieldName: 'foo'}).success.should.be.false
        done()
      })

      it('should check `validation` if available', function (done) {
        var schema = help.getModelSchema()
        _.extend(schema.fieldName, {validation: { regex: { pattern: /[a-z]+/} } })
        var mod = model('validationRuleTest', schema)
        mod.validate.schema({fieldName: '0123'}).success.should.be.false
        mod.validate.schema({fieldName: 'qwerty'}).success.should.be.true
        done()
      })
    })
  })
})
