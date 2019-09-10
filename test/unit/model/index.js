const should = require('should')
const model = require(__dirname + '/../../../dadi/lib/model')
const help = require(__dirname + '/../help')
const acceptanceHelper = require(__dirname + '/../../acceptance/help')

describe('Model', function() {
  beforeEach(done => {
    model.unloadAll()

    help.clearCollection('testModelName', function() {
      help.clearCollection('testModelNameVersions', function() {
        done()
      })
    })
  })

  it('should export a function', function(done) {
    model.should.be.Function
    done()
  })

  it('should export a constructor', function(done) {
    model.Model.should.be.Function
    done()
  })

  it('should export function that creates an instance of Model when passed schema', function(done) {
    model({
      name: 'testModelName',
      schema: help.getModelSchema(),
      property: 'testdb'
    }).should.be.an.instanceOf(model.Model)

    done()
  })

  it('should export function that gets instance of Model when not passed schema', function(done) {
    model({name: 'testModelName', property: 'testdb'}).should.be.an.instanceOf(
      model.Model
    )

    done()
  })

  it('should only create one instance of Model for a specific name/database pair', function(done) {
    const model1 = model({
      name: 'testModelName',
      schema: help.getModelSchema(),
      property: 'testdb'
    })
    const model2 = model({
      name: 'testModelName',
      schema: help.getModelSchema(),
      property: 'testdb'
    })

    model1.should.eql(model2)

    done()
  })

  describe('initialization options', function() {
    it('should throw an error if the first parameter is a string (legacy format)', function(done) {
      try {
        model('testModelName', help.getModelSchema(), null, {
          database: 'testdb'
        })
      } catch (error) {
        error.message
          .indexOf('The model constructor expects an object')
          .should.eql(0)

        done()
      }
    })

    it('should take model name, property and schema as named parameters', function(done) {
      model({
        name: 'testModelName',
        schema: help.getModelSchema(),
        property: 'testdb'
      }).name.should.equal('testModelName')

      done()
    })

    it('should attach history collection by default if not specified and `storeRevisions` is not false', function(done) {
      const mod = model({
        name: 'testModelName',
        schema: help.getModelSchema(),
        property: 'testdb'
      })

      should.exist(mod.settings)
      should.exist(mod.history)
      mod.history.name.should.equal('testModelNameVersions')

      done()
    })

    it('should attach history collection if specified (using legacy `revisionCollection` property)', function(done) {
      const mod = model({
        name: 'testModelName',
        schema: help.getModelSchema(),
        property: 'testdb',
        settings: {
          revisionCollection: 'modelHistory'
        }
      })

      mod.history.name.should.equal('modelHistory')

      done()
    })

    it('should attach history collection if specified', function(done) {
      const mod = model({
        name: 'testModelName',
        schema: help.getModelSchema(),
        property: 'testdb',
        settings: {
          versioningCollection: 'modelHistory'
        }
      })

      mod.history.name.should.equal('modelHistory')

      done()
    })

    it('should attach history collection if `storeRevisions` is true', function(done) {
      const mod = model({
        name: 'testModelName',
        schema: help.getModelSchema(),
        settings: {
          storeRevisions: true
        },
        property: 'testdb'
      })

      should.exist(mod.history)
      mod.history.name.should.equal('testModelNameVersions')

      done()
    })

    it('should attach specified history collection if `storeRevisions` is true', function(done) {
      const mod = model({
        name: 'testModelName',
        property: 'testdb',
        schema: help.getModelSchema(),
        settings: {
          storeRevisions: true,
          revisionCollection: 'modelHistory'
        }
      })

      should.exist(mod.history)
      mod.history.name.should.equal('modelHistory')

      done()
    })

    it('should attach history collection if `enableVersioning` is true', function(done) {
      const mod = model({
        name: 'testModelName',
        property: 'testdb',
        schema: help.getModelSchema(),
        settings: {
          enableVersioning: true
        }
      })

      should.exist(mod.history)
      mod.history.name.should.equal('testModelNameVersions')

      done()
    })

    it('should attach specified history collection if `enableVersioning` is true', function(done) {
      const mod = model({
        name: 'testModelName',
        property: 'testdb',
        schema: help.getModelSchema(),
        settings: {
          enableVersioning: true,
          versioningCollection: 'modelHistory'
        }
      })

      should.exist(mod.history)
      mod.history.name.should.equal('modelHistory')

      done()
    })

    it('should accept collection indexing settings', function(done) {
      const mod1 = model({
        name: 'testModelName',
        property: 'testdb',
        schema: help.getModelSchema(),
        settings: {
          index: {
            enabled: true,
            keys: {orderDate: 1}
          }
        }
      })

      setTimeout(function() {
        should.exist(mod1.settings)
        should.exist(mod1.settings.index)

        JSON.stringify(mod1.settings.index[0].keys).should.eql(
          JSON.stringify({orderDate: 1})
        )

        done()
      }, 300)
    })

    it('should accept collection indexing settings for v1.14.0 and above', function(done) {
      const mod = model({
        name: 'testModelName',
        property: 'testdb',
        schema: help.getModelSchema(),
        settings: {
          index: [{keys: {orderDate: 1}}]
        }
      })

      should.exist(mod.settings)

      JSON.stringify(mod.settings.index[0].keys).should.equal(
        JSON.stringify({orderDate: 1})
      )

      done()
    })

    it('should accept collection displayName setting', function(done) {
      const mod = model({
        name: 'testModelName',
        property: 'testdb',
        schema: help.getModelSchema(),
        settings: {
          displayName: 'TEST MODEL'
        }
      })

      should.exist(mod.settings)
      mod.settings.displayName.should.equal('TEST MODEL')

      done()
    })

    it('should attach `type` definition to model', function(done) {
      const val = 'test type'

      help.testModelProperty('type', val)

      done()
    })

    it('should attach `label` definition to model', function(done) {
      const val = 'test label'

      help.testModelProperty('label', val)

      done()
    })

    it('should attach `comments` definition to model', function(done) {
      const val = 'test comments'

      help.testModelProperty('comments', val)

      done()
    })

    it('should attach `validation` definition to model', function(done) {
      const val = '{ regex: { pattern: { /w+/ } } }'

      help.testModelProperty('validation', val)

      done()
    })

    it('should attach `required` definition to model', function(done) {
      const val = true

      help.testModelProperty('required', val)

      done()
    })

    it('should attach `message` definition to model', function(done) {
      const val = 'test message'

      help.testModelProperty('message', val)

      done()
    })
  })

  describe('`count` method', function() {
    it('should accept a query, an options object and a callback and return a metadata object', function(done) {
      model({
        name: 'testModelName',
        schema: help.getModelSchema(),
        property: 'testdb'
      }).count({}, {}, (err, response) => {
        response.metadata.page.should.be.Number
        response.metadata.offset.should.be.Number
        response.metadata.totalCount.should.be.Number
        response.metadata.totalPages.should.be.Number

        done()
      })
    })

    it('should accept a query and an options object as named arguments and return a Promise with a metadata object', () => {
      return model({
        name: 'testModelName',
        schema: help.getModelSchema(),
        property: 'testdb'
      })
        .count()
        .then(response => {
          response.metadata.page.should.be.Number
          response.metadata.offset.should.be.Number
          response.metadata.totalCount.should.be.Number
          response.metadata.totalPages.should.be.Number
        })
    })
  })

  describe('`stats` method', function() {
    it('should accept an options object', () => {
      return model({
        name: 'testModelName',
        schema: help.getModelSchema(),
        property: 'testdb'
      }).getStats({})
    })

    it('should return an object', () => {
      return model({
        name: 'testModelName',
        schema: help.getModelSchema(),
        property: 'testdb'
      })
        .getStats({})
        .then(stats => {
          stats.should.exist
        })
    })

    it('should return an error when db is disconnected', () => {
      const mod = model({
        name: 'testModelName',
        schema: help.getModelSchema(),
        property: 'testdb'
      })
      const connectedDb = mod.connection.db

      mod.connection.db = null

      return mod.getStats().catch(err => {
        mod.connection.db = connectedDb
        err.should.exist
        err.message.should.eql('DB_DISCONNECTED')
      })
    })
  })

  describe('`find` method', function() {
    describe('legacy syntax', () => {
      it('should accept query object and callback', done => {
        model({
          name: 'testModelName',
          schema: help.getModelSchema(),
          property: 'testdb'
        }).find({}, (err, response) => {
          response.results.should.be.Array

          done()
        })
      })

      it('should accept query object, options object and callback', done => {
        model({
          name: 'testModelName',
          schema: help.getModelSchema(),
          property: 'testdb'
        }).find({}, {}, (err, response) => {
          response.results.should.be.Array

          done()
        })
      })

      it('should pass error to callback when query uses `$where` operator', function(done) {
        model({name: 'testModelName', property: 'testdb'}).find(
          {
            $where: 'this.fieldName === "foo"'
          },
          err => {
            should.exist(err)

            done()
          }
        )
      })
    })

    it('should accept named parameters', () => {
      model({
        name: 'testModelName',
        schema: help.getModelSchema(),
        property: 'testdb'
      })
        .find({
          query: {}
        })
        .then(response => {
          response.results.should.be.Array
        })
    })

    it('should reject with error when query uses `$where` operator', done => {
      model({name: 'testModelName', property: 'testdb'})
        .find({
          query: {
            $where: 'this.fieldName === "foo"'
          }
        })
        .catch(error => {
          should.exist(error)

          done()
        })
    })
  })

  describe('`get` method', function() {
    describe('legacy syntax', () => {
      it('should accept query object and callback', done => {
        model({
          name: 'testModelName',
          schema: help.getModelSchema(),
          property: 'testdb'
        }).get({}, (err, response) => {
          response.results.should.be.Array

          done()
        })
      })

      it('should accept query object, options object and callback', done => {
        model({
          name: 'testModelName',
          schema: help.getModelSchema(),
          property: 'testdb'
        }).get({}, {}, (err, response) => {
          response.results.should.be.Array

          done()
        })
      })

      it('should pass error to callback when query uses `$where` operator', function(done) {
        model({name: 'testModelName', property: 'testdb'}).get(
          {
            $where: 'this.fieldName === "foo"'
          },
          err => {
            should.exist(err)

            done()
          }
        )
      })
    })

    it('should accept named parameters', () => {
      model({
        name: 'testModelName',
        schema: help.getModelSchema(),
        property: 'testdb'
      })
        .get({
          query: {}
        })
        .then(response => {
          response.results.should.be.Array
        })
    })

    it('should reject with error when query uses `$where` operator', done => {
      model({name: 'testModelName', property: 'testdb'})
        .get({
          query: {
            $where: 'this.fieldName === "foo"'
          }
        })
        .catch(error => {
          should.exist(error)

          done()
        })
    })
  })

  describe('`getIndexes` method', function() {
    beforeEach(done => {
      acceptanceHelper.dropDatabase('testdb', null, err => {
        done()
      })
    })

    it('should return indexes', function(done) {
      const mod = model({
        name: 'testModelName',
        property: 'testdb',
        schema: help.getModelSchema(),
        settings: {
          index: {
            enabled: true,
            keys: {
              fieldName: 1
            },
            options: {
              unique: false
            }
          }
        }
      })

      help.whenModelsConnect([mod]).then(() => {
        mod.create({fieldName: 'ABCDEF'}, function(err, result) {
          if (err) return done(err)

          setTimeout(function() {
            // mod.connection.db = null

            mod.getIndexes(indexes => {
              const result = indexes.some(index => {
                return index.name.indexOf('fieldName') > -1
              })

              result.should.eql(true)
              done()
            })
          }, 1000)
        })
      })
    })
  })

  describe('`createIndex` method', function() {
    it('should create index if indexing settings are supplied', function(done) {
      const mod = model({
        name: 'testModelName',
        property: 'testdb',
        schema: help.getModelSchema(),
        settings: {
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
      })

      mod.create({fieldName: 'ABCDEF'}, function(err, result) {
        if (err) return done(err)

        setTimeout(function() {
          mod.getIndexes(indexes => {
            const result = indexes.some(index => {
              return index.name.indexOf('fieldName') > -1
            })

            result.should.eql(true)
            done()
          })
        }, 1000)
      })
    })

    it.skip('should support compound indexes', function(done) {
      help.cleanUpDB(() => {
        const fields = help.getModelSchema()
        const schema = {}

        schema.fields = fields

        schema.fields.field2 = Object.assign({}, schema.fields.fieldName, {
          type: 'Number',
          required: false
        })

        const mod = model({
          name: 'testModelName',
          schema: schema.fields,
          property: 'testdb',
          settings: {
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
        })

        mod.create({fieldName: 'ABCDEF', field2: 2}, function(err, result) {
          if (err) return done(err)

          setTimeout(function() {
            // Peform a query, with explain to show we hit the query
            mod.getIndexes(indexes => {
              // var explanationString = JSON.stringify(explanation.results[0])
              // explanationString.indexOf('fieldName_1_field2_1').should.be.above(-1)
              console.log(indexes)
              done()
            })
          }, 1000)
        })
      })
    })

    it('should support unique indexes', function(done) {
      help.cleanUpDB(() => {
        const fields = help.getModelSchema()
        const schema = {}

        schema.fields = fields

        schema.fields.field3 = Object.assign({}, schema.fields.fieldName, {
          type: 'String',
          required: false
        })

        const mod = model({
          name: 'testModelName',
          property: 'testdb',
          schema: schema.fields,
          settings: {
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
        })

        setTimeout(function() {
          mod.create({field3: 'ABCDEF'}, function(err, result) {
            if (err) return done(err)

            mod.create({field3: 'ABCDEF'}, function(err, result) {
              should.exist(err)
              err.message
                .toLowerCase()
                .indexOf('duplicate')
                .should.be.above(-1)
              done()
            })
          })
        }, 1000)
      })
    })

    it('should support multiple indexes', function(done) {
      help.cleanUpDB(() => {
        const fields = help.getModelSchema()
        const schema = {}

        schema.fields = fields

        schema.fields.field3 = Object.assign({}, schema.fields.fieldName, {
          type: 'String',
          required: false
        })

        const mod = model({
          name: 'testModelName',
          property: 'testdb',
          schema: schema.fields,
          settings: {
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
        })

        setTimeout(function() {
          mod.create({fieldName: 'ABCDEF'}, function(err, result) {
            mod.create({fieldName: 'ABCDEF'}, function(err, result) {
              should.exist(err)
              err.message
                .toLowerCase()
                .indexOf('duplicate')
                .should.be.above(-1)

              mod.create({field3: '1234'}, function(err, result) {
                mod.create({field3: '1234'}, function(err, result) {
                  should.exist(err)
                  err.message
                    .toLowerCase()
                    .indexOf('duplicate')
                    .should.be.above(-1)
                  done()
                })
              })
            })
          })
        }, 1000)
      })
    })
  })

  describe('`create` method', function() {
    beforeEach(done => {
      acceptanceHelper.dropDatabase('testdb', err => {
        done()
      })
    })

    describe('legacy syntax', () => {
      it('should accept Object and callback', function(done) {
        const mod = model({
          name: 'testModelName',
          schema: help.getModelSchema(),
          property: 'testdb'
        })

        mod.create({fieldName: 'foo'}, done)
      })

      it('should accept Array and callback', function(done) {
        const mod = model({
          name: 'testModelName',
          schema: help.getModelSchema(),
          property: 'testdb'
        })

        mod.create([{fieldName: 'foo'}, {fieldName: 'bar'}], done)
      })

      it('should save model to database', function(done) {
        const mod = model({
          name: 'testModelName',
          schema: help.getModelSchema(),
          property: 'testdb'
        })

        mod.create({fieldName: 'foo'}, err => {
          if (err) return done(err)

          mod.find({fieldName: 'foo'}, (err, doc) => {
            if (err) return done(err)

            should.exist(doc['results'])
            doc['results'][0].fieldName.should.equal('foo')

            done()
          })
        })
      })

      it('should pass error to callback if validation fails', function(done) {
        const schema = help.getModelSchema()
        const mod = model({
          name: 'testModelName',
          schema: Object.assign({}, schema, {
            fieldName: Object.assign({}, schema.fieldName, {
              validation: {maxLength: 5}
            })
          }),
          property: 'testdb'
        })

        mod.create({fieldName: '123456'}, err => {
          should.exist(err)

          done()
        })
      })
    })

    it('should accept Object', () => {
      const mod = model({
        name: 'testModelName',
        schema: help.getModelSchema(),
        property: 'testdb'
      })

      return mod.create({
        documents: {fieldName: 'foo'}
      })
    })

    it('should accept Array', () => {
      const mod = model({
        name: 'testModelName',
        schema: help.getModelSchema(),
        property: 'testdb'
      })

      return mod.create({
        documents: [{fieldName: 'foo'}, {fieldName: 'bar'}]
      })
    })

    it('should save model to database', () => {
      const mod = model({
        name: 'testModelName',
        schema: help.getModelSchema(),
        property: 'testdb'
      })

      return mod
        .create({
          documents: {fieldName: 'foo'}
        })
        .then(documents => {
          return mod.find({
            query: {fieldName: 'foo'}
          })
        })
        .then(({metadata, results}) => {
          should.exist(metadata)
          should.exist(results)

          results[0].fieldName.should.equal('foo')
        })
    })

    it('should reject with error if validation fails', done => {
      const schema = help.getModelSchema()
      const mod = model({
        name: 'testModelName',
        schema: Object.assign({}, schema, {
          fieldName: Object.assign({}, schema.fieldName, {
            validation: {maxLength: 5}
          })
        }),
        property: 'testdb'
      })

      mod
        .create({
          documents: {fieldName: '123456'}
        })
        .catch(err => {
          should.exist(err)

          done()
        })
    })
  })

  describe('`update` method', function() {
    beforeEach(done => {
      acceptanceHelper.dropDatabase('testdb', err => {
        const mod = model({
          name: 'testModelName',
          schema: help.getModelSchemaWithMultipleFields(),
          property: 'testdb'
        })

        // Create model to be updated by tests.
        mod
          .create({
            documents: {
              field1: 'foo',
              field2: 'bar'
            }
          })
          .then(result => {
            should.exist(result && result.results)
            result.results[0].field1.should.equal('foo')

            done()
          })
          .catch(done)
      })
    })

    describe('legacy syntax', () => {
      it('should accept query, update object, and callback', done => {
        const mod = model({name: 'testModelName', property: 'testdb'})

        mod.update({field1: 'foo'}, {field1: 'bar'}, done)
      })

      it('should update an existing document', done => {
        const mod = model({name: 'testModelName', property: 'testdb'})
        const updateDoc = {field1: 'bar'}

        mod.update({field1: 'foo'}, updateDoc, (err, result) => {
          if (err) return done(err)

          result.results.should.exist
          result.results[0].field1.should.equal('bar')

          // make sure document was updated
          mod.find({field1: 'bar'}, (err, result) => {
            if (err) return done(err)

            should.exist(result['results'] && result['results'][0])
            result['results'][0].field1.should.equal('bar')

            done()
          })
        })
      })

      it('should create new history revision when updating an existing document and `storeRevisions` is true', done => {
        const mod = model({
          name: 'testModelName',
          schema: help.getModelSchemaWithMultipleFields(),
          property: 'testdb',
          settings: {
            storeRevisions: true
          }
        })
        const updateDoc = {field1: 'bar'}

        mod.update({field1: 'foo'}, updateDoc, (err, result) => {
          if (err) return done(err)

          result.results.should.exist
          result.results[0].field1.should.equal('bar')

          // make sure document was updated
          mod.find({field1: 'bar'}, (err, result) => {
            if (err) return done(err)

            should.exist(result['results'] && result['results'][0])
            result['results'][0].field1.should.equal('bar')

            setTimeout(() => {
              mod
                .getVersions({
                  documentId: result.results[0]._id
                })
                .then(({results}) => {
                  results.length.should.equal(1)

                  done()
                })
            }, 50)
          })
        })
      })

      it('should pass error to callback if schema validation fails', done => {
        const schema = help.getModelSchema()
        const mod = model({
          name: 'testModelName',
          schema: Object.assign({}, schema, {
            fieldName: Object.assign({}, schema.fieldName, {
              validation: {maxLength: 5}
            })
          }),
          property: 'testdb'
        })

        mod.update({fieldName: 'foo'}, {fieldName: '123456'}, err => {
          should.exist(err)

          done()
        })
      })

      it('should pass error to callback when query uses `$where` operator', done => {
        model({name: 'testModelName', property: 'testdb'}).update(
          {$where: 'this.fieldName === "foo"'},
          {fieldName: 'bar'},
          err => {
            should.exist(err)

            done()
          }
        )
      })
    })

    it('should accept query and update object', () => {
      const mod = model({name: 'testModelName', property: 'testdb'})

      return mod.update({
        query: {field1: 'foo'},
        update: {field1: 'bar'}
      })
    })

    it('should update an existing document', () => {
      const mod = model({name: 'testModelName', property: 'testdb'})
      const updateDoc = {field1: 'bar'}

      return mod
        .update({
          query: {field1: 'foo'},
          update: updateDoc
        })
        .then(result => {
          result.results.should.exist
          result.results[0].field1.should.equal('bar')

          return mod.find({
            query: {field1: 'bar'}
          })
        })
        .then(({metadata, results}) => {
          should.exist(results && results[0])
          results[0].field1.should.equal('bar')
        })
    })

    it('should create new history revision when updating an existing document and `storeRevisions` is true', done => {
      const mod = model({
        name: 'testModelName',
        schema: help.getModelSchemaWithMultipleFields(),
        property: 'testdb',
        settings: {
          storeRevisions: true
        }
      })
      const updateDoc = {field1: 'bar'}

      mod
        .update({
          query: {field1: 'foo'},
          update: updateDoc
        })
        .then(({results}) => {
          results.should.exist
          results[0].field1.should.equal('bar')

          return mod.find({
            query: {field1: 'bar'}
          })
        })
        .then(({results}) => {
          should.exist(results && results[0])
          results[0].field1.should.equal('bar')

          setTimeout(() => {
            mod
              .getVersions({
                documentId: results[0]._id
              })
              .then(({results}) => {
                results.length.should.equal(1)

                done()
              })
          }, 50)
        })
    })

    it('should reject with error if schema validation fails', done => {
      const schema = help.getModelSchema()
      const mod = model({
        name: 'testModelName',
        schema: Object.assign({}, schema, {
          fieldName: Object.assign({}, schema.fieldName, {
            validation: {maxLength: 5}
          })
        }),
        property: 'testdb'
      })

      mod
        .update({
          query: {fieldName: 'foo'},
          update: {fieldName: '123456'}
        })
        .catch(error => {
          should.exist(error)

          done()
        })
    })

    it('should reject with error when query uses `$where` operator', done => {
      model({name: 'testModelName', property: 'testdb'})
        .update({
          query: {$where: 'this.fieldName === "foo"'},
          update: {fieldName: 'bar'}
        })
        .catch(err => {
          should.exist(err)

          done()
        })
    })
  })

  describe('`delete` method', function() {
    beforeEach(help.cleanUpDB)

    describe('legacy syntax', () => {
      it('should accept a query object and callback', done => {
        const schema = help.getModelSchema()
        const mod = model({name: 'testModelName', schema, property: 'testdb'})

        mod.delete({fieldName: 'foo'}, done)
      })

      it('should delete a single document', done => {
        const schema = help.getModelSchema()
        const mod = model({name: 'testModelName', schema, property: 'testdb'})

        mod.create({fieldName: 'foo'}, (err, result) => {
          if (err) return done(err)

          result.results[0].fieldName.should.equal('foo')

          mod.delete({fieldName: 'foo'}, (err, result) => {
            if (err) return done(err)

            result.deletedCount.should.equal(1)

            mod.find({}, (err, result) => {
              if (err) return done(err)

              result['results'].length.should.equal(0)

              done()
            })
          })
        })
      })

      it('should delete multiple documents', done => {
        const schema = help.getModelSchema()
        const mod = model({name: 'testModelName', schema, property: 'testdb'})

        mod.create(
          [{fieldName: 'foo'}, {fieldName: 'bar'}, {fieldName: 'baz'}],
          (err, result) => {
            if (err) return done(err)

            result.results[0].fieldName.should.equal('foo')
            result.results[1].fieldName.should.equal('bar')
            result.results[2].fieldName.should.equal('baz')

            mod.delete(
              {
                fieldName: {
                  $in: ['foo', 'bar', 'baz']
                }
              },
              (err, result) => {
                if (err) return done(err)

                result.deletedCount.should.equal(3)

                mod.find({}, (err, result) => {
                  if (err) return done(err)

                  result['results'].length.should.equal(0)

                  done()
                })
              }
            )
          }
        )
      })

      it('should pass error to callback when query uses `$where` operator', done => {
        model({name: 'testModelName', property: 'testdb'}).delete(
          {
            $where: 'this.fieldName === "foo"'
          },
          err => {
            should.exist(err)
            done()
          }
        )
      })
    })

    it('should accept a query object', () => {
      const schema = help.getModelSchema()
      const mod = model({name: 'testModelName', schema, property: 'testdb'})

      return mod.delete({
        query: {fieldName: 'foo'}
      })
    })

    it('should delete a single document', () => {
      const schema = help.getModelSchema()
      const mod = model({name: 'testModelName', schema, property: 'testdb'})

      return mod
        .create({
          documents: {fieldName: 'foo'}
        })
        .then(({metadata, results}) => {
          results[0].fieldName.should.equal('foo')

          return mod.delete({
            query: {fieldName: 'foo'}
          })
        })
        .then(result => {
          result.deletedCount.should.equal(1)

          return mod.find({})
        })
        .then(({metadata, results}) => {
          results.length.should.equal(0)
        })
    })

    it('should delete multiple documents', () => {
      const schema = help.getModelSchema()
      const mod = model({name: 'testModelName', schema, property: 'testdb'})

      return mod
        .create({
          documents: [
            {fieldName: 'foo'},
            {fieldName: 'bar'},
            {fieldName: 'baz'}
          ]
        })
        .then(({results}) => {
          results[0].fieldName.should.equal('foo')
          results[1].fieldName.should.equal('bar')
          results[2].fieldName.should.equal('baz')

          return mod.delete({
            query: {
              fieldName: {
                $in: ['foo', 'bar', 'baz']
              }
            }
          })
        })
        .then(result => {
          result.deletedCount.should.equal(3)

          return mod.find({})
        })
        .then(({metadata, results}) => {
          results.length.should.equal(0)
        })
    })

    it('should pass error to callback when query uses `$where` operator', () => {
      return model({name: 'testModelName', property: 'testdb'})
        .delete({
          query: {
            $where: 'this.fieldName === "foo"'
          }
        })
        .catch(error => {
          should.exist(error)
        })
    })
  })

  describe('validateQuery', function() {
    it('should be attached to Model', function(done) {
      const mod = model({
        name: 'testModelName',
        schema: help.getModelSchema(),
        property: 'testdb'
      })

      mod.validateQuery.should.be.Function
      done()
    })

    describe('query', function() {
      it('should not allow the use of `$where` in queries', function(done) {
        const mod = model({
          name: 'testModelName',
          schema: help.getModelSchema(),
          property: 'testdb'
        })

        mod.validateQuery({$where: 'throw new Error("Insertion Attack!")'})
          .success.should.be.false
        done()
      })

      it('should allow querying with key values', function(done) {
        const mod = model({
          name: 'testModelName',
          schema: help.getModelSchema(),
          property: 'testdb'
        })

        mod.validateQuery({fieldName: 'foo'}).success.should.be.true
        done()
      })

      it('should allow querying with key values too', function(done) {
        let schema = help.getModelSchema()

        schema = Object.assign({}, schema, {
          fieldMixed: {
            type: 'Mixed',
            label: 'Mixed Field',
            required: false,
            display: {index: true, edit: true}
          }
        })

        const mod = model({name: 'schemaTest', schema, property: 'testdb'})

        mod.validateQuery({'fieldMixed.innerProperty': 'foo'}).success.should.be
          .true
        done()
      })
    })
  })

  describe('`_mergeQueryAndAclFields` method', () => {
    it('should use the fields provided by the query if ACL does not specify any', () => {
      const testModel = model({
        name: 'testModelName',
        schema: help.getModelSchema(),
        property: 'testdb'
      })

      const queryFields = {
        field1: 1,
        field2: 1
      }

      testModel._mergeQueryAndAclFields(queryFields).should.eql(queryFields)
    })

    it('should use the fields provided by the ACL filter if the query does not specify any', () => {
      const testModel = model({
        name: 'testModelName',
        schema: help.getModelSchema(),
        property: 'testdb'
      })

      const aclFields = {
        field1: 1,
        field2: 1
      }

      testModel._mergeQueryAndAclFields(null, aclFields).should.eql(aclFields)
    })

    it('should merge the fields from the query and the ACL filter so that the ACL restrictions are respected', () => {
      const testModel = model({
        name: 'testModelName',
        schema: help.getModelSchema(),
        property: 'testdb'
      })

      testModel
        ._mergeQueryAndAclFields({one: 1}, {one: 1, two: 1})
        .should.eql({one: 1})

      testModel
        ._mergeQueryAndAclFields({one: 0}, {one: 1, two: 1})
        .should.eql({two: 1})

      testModel
        ._mergeQueryAndAclFields({one: 0}, {two: 0})
        .should.eql({one: 0, two: 0})

      testModel
        ._mergeQueryAndAclFields({one: 1, two: 1}, {four: 0})
        .should.eql({one: 1, two: 1})

      should.throws(
        () => testModel._mergeQueryAndAclFields({one: 1}, {two: 1}),
        Error
      )
    })
  })
})
