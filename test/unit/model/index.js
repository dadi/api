var should = require('should')
var sinon = require('sinon')
var model = require(__dirname + '/../../../dadi/lib/model')
var queryUtils = require(__dirname + '/../../../dadi/lib/model/utils')
var apiHelp = require(__dirname + '/../../../dadi/lib/help')
var Validator = require(__dirname + '/../../../dadi/lib/model/validator')
var connection = require(__dirname + '/../../../dadi/lib/model/connection')
var _ = require('underscore')
var help = require(__dirname + '/../help')
var acceptanceHelper = require(__dirname + '/../../acceptance/help')
var config = require(__dirname + '/../../../config')

describe('Model', function () {
  // beforeEach((done) => {
  //   // help.clearCollection('testModelName', function() {
  //   //   help.clearCollection('testModelNameHistory', function() {
  //   //      done()
  //   //   })
  //   // })
  //   acceptanceHelper.dropDatabase('testdb', err => {
  //     done()
  //   })
  // })

  it('should export a function', function (done) {
    model.should.be.Function
    done()
  })

  it('should export a constructor', function (done) {
    model.Model.should.be.Function
    done()
  })

  it('should export function that creates an instance of Model when passed schema', function (done) {
    model('testModelName', help.getModelSchema(), null, {database: 'testdb'}).should.be.an.instanceOf(model.Model)
    done()
  })

  it('should export function that gets instance of Model when not passed schema', function (done) {
    model('testModelName').should.be.an.instanceOf(model.Model)
    done()
  })

  it.skip('should only create one instance of Model for a specific name', function (done) {
    model('testModelName', help.getModelSchema(), null, {database: 'testdb'}).should.equal(model('testModelName', help.getModelSchema(), null, {database: 'testdb'}))
    done()
  })

  describe('initialization options', function () {
    it('should take model name and schema as arguments', function (done) {
      model('testModelName', help.getModelSchema(), null, {database: 'testdb'}).name.should.equal('testModelName')
      done()
    })

    it.skip('should accept database connection as third argument', function (done) {
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

      // TODO: stub the connect method so this doesn't cause a connection attempt

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
        database: 'testdb',
        cache: true,
        count: 25
      })

      should.exist(mod.settings)

      mod.settings.cache.should.be.true
      mod.settings.count.should.equal(25)

      done()
    })

    it('should attach history collection by default if not specified and `storeRevisions` is not false', function (done) {
      var mod = model('testModelName', help.getModelSchema(), null, { database: 'testdb' })
      should.exist(mod.settings)
      mod.revisionCollection.should.equal('testModelNameHistory')

      done()
    })

    it('should attach history collection if specified', function (done) {
      var mod = model('testModelName', help.getModelSchema(), null, { database: 'testdb', revisionCollection: 'modelHistory' })
      mod.revisionCollection.should.equal('modelHistory')

      done()
    })

    it('should attach history collection if `storeRevisions` is true', function (done) {
      var mod = model('testModelName', help.getModelSchema(), null, { database: 'testdb', storeRevisions: true })
      should.exist(mod.revisionCollection)
      mod.revisionCollection.should.equal('testModelNameHistory')

      done()
    })

    it('should attach specified history collection if `storeRevisions` is true', function (done) {
      var mod = model('testModelName', help.getModelSchema(), null, { database: 'testdb', storeRevisions: true, revisionCollection: 'modelHistory' })
      should.exist(mod.revisionCollection)
      mod.revisionCollection.should.equal('modelHistory')

      done()
    })

    it('should accept collection indexing settings', function (done) {
      var mod1 = model('testModelName', help.getModelSchema(), null, {
        index: {
          enabled: true,
          keys: { orderDate: 1 }
        }
      })

      setTimeout(function() {
        should.exist(mod1.settings)
        should.exist(mod1.settings.index)

        JSON.stringify(mod1.settings.index[0].keys).should.eql(JSON.stringify({ orderDate: 1 }))
      done()
      }, 300)
    })

    it('should accept collection indexing settings for v1.14.0 and above', function (done) {
      var mod = model('testModelName', help.getModelSchema(), null, { index: [ { keys: { orderDate: 1 } } ] })

      should.exist(mod.settings)
      JSON.stringify(mod.settings.index[0].keys).should.equal(JSON.stringify({ orderDate: 1 }))
      done()
    })

    it('should accept collection displayName setting', function (done) {
      var mod = model('testModelName', help.getModelSchema(), null, { database: 'testdb', displayName: 'TEST MODEL' })

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

  describe('`count` method', function () {
    it('should be added to model', function (done) {
      model('testModelName', help.getModelSchema(), null, { database: 'testdb' }).count.should.be.Function
      done()
    })

    it('should accept a query and an options object and callback', function (done) {
      model('testModelName', help.getModelSchema(), null, { database: 'testdb' }).count({}, {}, done)
    })

    it('should return a metadata object', function (done) {
      model('testModelName', help.getModelSchema(), null, { database: 'testdb' }).count({}, function (err, result) {
        result.should.exist
        done()
      })
    })
  })

  describe('`stats` method', function () {
    it('should be added to model', function (done) {
      model('testModelName', help.getModelSchema(), null, { database: 'testdb' }).stats.should.be.Function
      done()
    })

    it('should accept an options object and callback', function (done) {
      model('testModelName', help.getModelSchema(), null, { database: 'testdb' }).stats({}, done)
    })

    it('should return an object', function (done) {
      model('testModelName', help.getModelSchema(), null, { database: 'testdb' }).stats({}, function (err, stats) {
        stats.should.exist
        done()
      })
    })
  })

  describe('`find` method', function () {
    it('should be added to model', function (done) {
      model('testModelName', help.getModelSchema(), null, { database: 'testdb' }).find.should.be.Function
      done()
    })

    it('should accept query object and callback', function (done) {
      model('testModelName', help.getModelSchema(), null, { database: 'testdb' }).find({}, done)
    })

    it.skip('should accept JSON array for aggregation queries and callback', function (done) {
      var query = [
        { $match: { status: 'A' } }
      ]
      model('testModelName', help.getModelSchema(), null, { database: 'testdb' }).find(query, done)
    })

    it('should pass error to callback when query uses `$where` operator', function (done) {
      model('testModelName').find({$where: 'this.fieldName === "foo"'}, function (err) {
        should.exist(err)
        done()
      })
    })
  })

  describe('includeHistory param', function () {
    beforeEach((done) => {
      acceptanceHelper.dropDatabase('testdb', err => {
        done()
      })
    })

    it('should override `done` method if options.includeHistory = true', function (done) {
      var mod = model('testModelName', help.getModelSchema(), null, { database: 'testdb', storeRevisions: true })

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
      var mod = model('testModelName', help.getModelSchema(), null, { database: 'testdb', storeRevisions: true })

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
      var mod = model('testModelName', help.getModelSchema(), null, { database: 'testdb', storeRevisions: true })

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
    beforeEach((done) => {
      acceptanceHelper.dropDatabase('testdb', err => {
        done()
      })
    })

    it('should add v:1 to a new document', function (done) {
      var mod = model('testModelName', help.getModelSchema(), null, { database: 'testdb', storeRevisions: true })

      mod.create({fieldName: 'foo'}, function (err, results) {
        if (err) return done(err)

        results.results.should.exist
        results.results.should.be.Array
        results.results[0].v.should.eql(1)
        done()
      })
    })

    it('should increment the version number when updating a document', function (done) {
      var mod = model('testModelName', help.getModelSchema(), null, { database: 'testdb', storeRevisions: true })
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
    beforeEach((done) => {
      acceptanceHelper.dropDatabase('testdb', err => {
        done()
      })
    })

    it('should be added to model', function (done) {
      model('testModelName', help.getModelSchema(), null, { database: 'testdb' }).revisions.should.be.Function
      done()
    })

    it('should accept id param and return history collection', function (done) {
      var mod = model('testModelName', help.getModelSchema(), null, { database: 'testdb', storeRevisions: true })

      mod.create({fieldName: 'foo'}, function (err, result) {
        if (err) return done(err)

        mod.update({fieldName: 'foo'}, {fieldName: 'bar'}, function (err, result) {
          if (err) return done(err)

          mod.find({fieldName: 'bar'}, function (err, doc) {
            if (err) return done(err)

            var doc_id = doc.results[0]._id
            var revision_id = doc.results[0].history[0] // expected history object

            model('testModelName', help.getModelSchema(), null, { database: 'testdb' }).revisions(doc_id, {}, function (err, result) {
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
      model('testModelName', help.getModelSchema(), null, { database: 'testdb' }).createIndex.should.be.Function
      done()
    })

    it('should create index if indexing settings are supplied', function (done) {
      var mod = model('testModelName',
        help.getModelSchema(),
        null,
        {
          database: 'testdb',
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
        var fields = help.getModelSchema()
        var schema = {}
        schema.fields = fields

        schema.fields.field2 = _.extend({}, schema.fields.fieldName, {
          type: 'Number',
          required: false
        })

        var mod = model('testModelName',
          schema.fields,
          null,
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
        var fields = help.getModelSchema()
        var schema = {}
        schema.fields = fields

        schema.fields.field3 = _.extend({}, schema.fields.fieldName, {
          type: 'String',
          required: false
        })

        var mod = model('testModelName',
          schema.fields,
          null,
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
              // console.log(err.code)
              // console.log(err.message)
              err.message.indexOf('duplicate').should.be.above(-1)
              // err.code.should.eql('11000')
              done()
            })
          })
        }, 1000)
      })
    })

    it('should support multiple indexes', function (done) {
      help.cleanUpDB(() => {
        var fields = help.getModelSchema()
        var schema = {}
        schema.fields = fields

        schema.fields.field3 = _.extend({}, schema.fields.fieldName, {
          type: 'String',
          required: false
        })

        var mod = model('testModelName',
          schema.fields,
          null,
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
            mod.create({fieldName: 'ABCDEF'}, function (err, result) {
              should.exist(err)
              err.message.indexOf('duplicate').should.be.above(-1)
              // err.name.should.eql('MongoError')
              // err.code.should.eql('11000')
              mod.create({field3: '1234'}, function (err, result) {
                mod.create({field3: '1234'}, function (err, result) {
                  should.exist(err)
                  err.message.indexOf('duplicate').should.be.above(-1)
                  done()
                })
              })
            })
          })
        }, 1000)
      })
    })
  })

  describe('`create` method', function () {
    // beforeEach(help.cleanUpDB)
    beforeEach((done) => {
      acceptanceHelper.dropDatabase('testdb', err => {
        done()
      })
    })

    it('should be added to model', function (done) {
      model('testModelName', help.getModelSchema(), null, { database: 'testdb' }).create.should.be.Function
      done()
    })

    it('should accept Object and callback', function (done) {
      var mod = model('testModelName', help.getModelSchema(), null, { database: 'testdb' })
      mod.create({fieldName: 'foo'}, done)
    })

    it('should accept Array and callback', function (done) {
      var mod = model('testModelName', help.getModelSchema(), null, { database: 'testdb' })
      mod.create([{fieldName: 'foo'}, {fieldName: 'bar'}], done)
    })

    it('should save model to database', function (done) {
      var mod = model('testModelName', help.getModelSchema(), null, { database: 'testdb' })
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
      var mod = model('testModelName', help.getModelSchema(), null, { database: 'testdb' })
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
      var mod = model('testModelName', schema, null, { database: 'testdb' })
      mod.create({fieldName: '123456'}, function (err) {
        should.exist(err)
        done()
      })
    })
  })

  describe('`update` method', function () {
    beforeEach((done) => {
      acceptanceHelper.dropDatabase('testdb', err => {
        var mod = model('testModelName', help.getModelSchemaWithMultipleFields(), null, { database: 'testdb' })

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

    // beforeEach(function (done) {
    //   help.cleanUpDB(function (err) {
    //     if (err) return done(err)
        // var mod = model('testModelName', help.getModelSchemaWithMultipleFields(), null, { database: 'testdb' })
        //
        // // create model to be updated by tests
        // mod.create({
        //   field1: 'foo', field2: 'bar'
        // }, function (err, result) {
        //   if (err) return done(err)
        //
        //   should.exist(result && result.results)
        //   result.results[0].field1.should.equal('foo')
        //   done()
        // })
    //   })
    // })

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
      var mod = model('testModelName', help.getModelSchemaWithMultipleFields(), null, { database: 'testdb', storeRevisions: true })
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
      var mod = model('testModelName', schema, null, {database: 'testdb'})
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
      model('testModelName', help.getModelSchema(), null, { database: 'testdb' }).delete.should.be.Function
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

  describe('validator', function () {
    it('should be attached to Model', function (done) {
      var mod = model('testModelName', help.getModelSchema(), null, { database: 'testdb' })
      mod.validate.should.be.Object
      mod.validate.query.should.be.Function
      mod.validate.schema.should.be.Function
      done()
    })

    describe('query', function () {
      it('should not allow the use of `$where` in queries', function (done) {
        var mod = model('testModelName', help.getModelSchema(), null, { database: 'testdb' })
        mod.validate.query({$where: 'throw new Error("Insertion Attack!")'}).success.should.be.false
        done()
      })

      it('should allow querying with key values', function (done) {
        var mod = model('testModelName', help.getModelSchema(), null, { database: 'testdb' })
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

        var mod = model('schemaTest', schema, null, { database: 'testdb' })
        mod.validate.query({'fieldMixed.innerProperty': 'foo'}).success.should.be.true
        done()
      })
    })

    describe('schema', function () {
      it('should return true for object that matches schema', function (done) {
        var schema = help.getModelSchema()
        var mod = model('schemaTest', schema, null, { database: 'testdb' })
        mod.validate.schema({fieldName: 'foobar'}).success.should.be.true
        done()
      })

      it('should return false for object that contains undefined field', function (done) {
        var schema = help.getModelSchema()
        var mod = model('schemaTest', schema, null, { database: 'testdb' })
        mod.validate.schema({nonSchemaField: 'foobar', fieldName: 'baz'}).success.should.be.false
        done()
      })

      it('should check length limit for field', function (done) {
        var schema = help.getModelSchema()
        _.extend(schema.fieldName, {validation: { maxLength: 5}})
        var mod = model('schemaTest', schema, null, { database: 'testdb' })
        mod.validate.schema({fieldName: '123456'}).success.should.be.false
        done()
      })

      it('should ensure all required fields are present', function (done) {
        var schema = help.getModelSchema()
        schema.requiredField = _.extend({}, schema.fieldName, {required: true})

        var mod = model('schemaTest', schema, null, { database: 'testdb' })
        var v = mod.validate.schema({fieldName: 'foo'})
        v.errors[0].field.should.eql('requiredField')
        v.success.should.be.false
        done()
      })

      it('should check `validation` if available', function (done) {
        var schema = help.getModelSchema()
        _.extend(schema.fieldName, {validation: { regex: { pattern: /[a-z]+/} } })
        var mod = model('schemaTest', schema, null, { database: 'testdb' })
        mod.validate.schema({fieldName: '0123'}).success.should.be.false
        mod.validate.schema({fieldName: 'qwerty'}).success.should.be.true
        done()
      })
    })
  })
})
