'use strict'

var sinon = require('sinon')
var should = require('should')
var _ = require('underscore')

var model = require(__dirname + '/../../../dadi/lib/model')
var hook = require(__dirname + '/../../../dadi/lib/model/hook')
var help = require(__dirname + '/../help')

var simpleSlugifyHook = 'function slugify(text) {\n'
simpleSlugifyHook += "  return text.toString().toLowerCase().replace(/ /g, '-')\n"
simpleSlugifyHook += '}\n'
simpleSlugifyHook += 'module.exports = function (obj, type, data) { \n'
simpleSlugifyHook += '  return slugify(obj);\n'
simpleSlugifyHook += '}\n'
var simpleFunction = eval(simpleSlugifyHook)

var querySlugifyHook = 'function slugify(text) {\n'
querySlugifyHook += "  if (!text)return '';\n"
querySlugifyHook += "  return text.toString().toLowerCase().replace(/ /g, '-')\n"
querySlugifyHook += '}\n'
querySlugifyHook += 'module.exports = function (obj, type, data) { \n'
querySlugifyHook += '  console.log("----> hook:", obj);\n'
querySlugifyHook += '  obj[data.options.field] = slugify(obj[data.options.field]);\n'
querySlugifyHook += '  return obj;\n'
querySlugifyHook += '}\n'
var querySlugifyFunction = eval(querySlugifyHook)

var optionsSlugifyHook = 'function slugify(text) {\n'
optionsSlugifyHook += "  if (!text)return '';\n"
optionsSlugifyHook += "  return text.toString().toLowerCase().replace(/ /g, '-')\n"
optionsSlugifyHook += '}\n'
optionsSlugifyHook += 'module.exports = function (obj, type, data) { \n'
optionsSlugifyHook += '  obj[data.options.to] = slugify(obj[data.options.from]);\n'
optionsSlugifyHook += '  return obj;\n'
optionsSlugifyHook += '}\n'
var optionsFunction = eval(optionsSlugifyHook)

var failingAsyncHook = ''
failingAsyncHook += 'function slugify(text) {\n'
failingAsyncHook += '  if (!text) return ""\n'
failingAsyncHook += '  return text.toString().toLowerCase().replace(/ /g, "-")\n'
failingAsyncHook += '}\n'
failingAsyncHook += 'module.exports = function (obj, type, data) { \n'
failingAsyncHook += '  return new Promise((resolve, reject) => {\n'
failingAsyncHook += '    if (obj[data.options.from] === "Article Two") return reject("Only Article One can be slugified")\n'
failingAsyncHook += '    obj[data.options.to] = slugify(obj[data.options.from])\n'
failingAsyncHook += '    return resolve(obj)\n'
failingAsyncHook += '  })\n'
failingAsyncHook += '}\n'
var failingAsyncFunction = eval(failingAsyncHook)

var failingSyncHook = ''
failingSyncHook += 'function slugify(text) {\n'
failingSyncHook += '  if (!text) return ""\n'
failingSyncHook += '  return text.toString().toLowerCase().replace(/ /g, "-")\n'
failingSyncHook += '}\n'
failingSyncHook += 'module.exports = function (obj, type, data) { \n'
failingSyncHook += '  if (obj[data.options.from] === "Article One") return Promise.reject("some message")\n'
failingSyncHook += '  obj[data.options.to] = slugify(obj[data.options.from])\n'
failingSyncHook += '}\n'
var failingSyncFunction = eval(failingSyncHook)

var logHook = `function writeToLog(obj, filename) {
    var fs = require('fs')
    var path = require('path')
    var file = path.resolve(path.join(__dirname, filename))
    var end = "\\n"
    var body = JSON.stringify(obj) + end
    fs.appendFileSync(file, body)
  }

  module.exports = function (obj, type, data) {
    writeToLog(obj, data.options.filename)
    return obj
  }`
var logFunction = eval(logHook)

var hijackNameHook = ''
hijackNameHook += 'module.exports = function (obj, type, data) { \n'
hijackNameHook += '  obj.results.forEach(function (doc) { doc.name = "Modified by hook" })\n'
hijackNameHook += '  return obj;\n'
hijackNameHook += '}\n'
var hijackFunction = eval(hijackNameHook)

describe('Hook', function () {
  it('should export a constructor', function (done) {
    hook.should.be.Function
    done()
  })

  describe('initialization', function () {
    it('should take a name and a type as arguments', function (done) {
      sinon.stub(hook.Hook.prototype, 'load').returns('x')
      var h = new hook('test', 0)
      hook.Hook.prototype.load.restore()

      h.name.should.equal('test')
      h.type.should.equal(0)
      done()
    })

    it('should take an object as an argument', function (done) {
      sinon.stub(hook.Hook.prototype, 'load').returns(simpleFunction)

      var data = {
        hook: 'test',
        options: { x: 1}
      }

      var h = new hook(data, 0)
      hook.Hook.prototype.load.restore()

      h.name.should.equal('test')
      h.options.x.should.eql(1)
      h.type.should.equal(0)
      done()
    })

    it('should load the hook as a function', function (done) {
      sinon.stub(hook.Hook.prototype, 'load').returns(simpleFunction)
      var h = new hook('test', 0)
      hook.Hook.prototype.load.restore()
      h.hook.should.be.Function
      done()
    })
  })

  describe('`apply` method', function (done) {
    it('should modify the passed argument', function (done) {
      sinon.stub(hook.Hook.prototype, 'load').returns(simpleFunction)

      var h = new hook('test', 'beforeCreate')
      var title = 'Title Of The Article'
      var slug = h.apply(title)

      hook.Hook.prototype.load.restore()

      slug.should.equal('title-of-the-article')
      done()
    })

    it('should modify the passed document with options', function (done) {
      sinon.stub(hook.Hook.prototype, 'load').returns(optionsFunction)

      var data = {
        hook: 'test',
        options: {
          'from': 'title',
          'to': 'slug'
        }
      }

      var h = new hook(data, 'beforeCreate')
      var obj = {
        title: 'Title Of The Article',
        slug: ''
      }
      var modifiedObj = h.apply(obj)

      hook.Hook.prototype.load.restore()

      modifiedObj.slug.should.equal('title-of-the-article')
      done()
    })
  })

  describe('`formatError` method', function (done) {
    it('should return an API-0002 error object for a user-thrown error as string', function (done) {
      sinon.stub(hook.Hook.prototype, 'load').returns(simpleFunction)

      var hookName = 'test-hook'
      var h = new hook(hookName, 'beforeCreate')
      var errorMessage = 'This is a user-thrown error'

      hook.Hook.prototype.load.restore()

      var errorObject = h.formatError(errorMessage)

      errorObject[0].code.should.equal('API-0002')
      errorObject[0].title.should.equal('Hook Error')
      errorObject[0].details.indexOf(errorMessage).should.not.equal(-1)

      done()
    })

    it('should return an API-0002 error object for a user-thrown Error object', function (done) {
      sinon.stub(hook.Hook.prototype, 'load').returns(simpleFunction)

      var hookName = 'test-hook'
      var h = new hook(hookName, 'beforeCreate')
      var errorMessage = 'This is a user-thrown error'

      hook.Hook.prototype.load.restore()

      var error = new Error(errorMessage)
      var errorObject = h.formatError(error)

      errorObject[0].code.should.equal('API-0002')
      errorObject[0].title.should.equal('Hook Error')
      errorObject[0].details.indexOf(errorMessage).should.not.equal(-1)

      done()
    })

    it('should return an API-0002 error object for a runtime error', function (done) {
      sinon.stub(hook.Hook.prototype, 'load').returns(simpleFunction)

      var hookName = 'test-hook'
      var h = new hook(hookName, 'beforeCreate')

      hook.Hook.prototype.load.restore()

      var error

      try {
        thisFunctionDoesNotExist()
      } catch (err) {
        error = err
      }

      var errorObject = h.formatError(error)

      errorObject[0].code.should.equal('API-0002')
      errorObject[0].title.should.equal('Hook Error')
      errorObject[0].details.indexOf(hookName).should.not.equal(-1)

      done()
    })

    it('should return a custom error object for a custom error (defined by a `dadiCustomError` property)', function (done) {
      sinon.stub(hook.Hook.prototype, 'load').returns(simpleFunction)

      var hookName = 'test-hook'
      var h = new hook(hookName, 'beforeCreate')

      hook.Hook.prototype.load.restore()

      var errorData = {
        code: 'MY_CUSTOM_ERROR',
        someData: {
          _id: 123456,
          name: 'foobar'
        }
      }

      var error = new Error('custom error')

      error.dadiCustomError = Object.assign({}, errorData)

      var errorObject = h.formatError(error)

      errorObject[0].code.should.eql(errorData.code)
      JSON.stringify(errorObject[0].someData).should.eql(JSON.stringify(errorData.someData))

      done()
    })

    it('should attach the name of the hook to custom errors', function (done) {
      sinon.stub(hook.Hook.prototype, 'load').returns(simpleFunction)

      var hookName = 'test-hook'
      var h = new hook(hookName, 'beforeCreate')

      hook.Hook.prototype.load.restore()

      var errorData = {
        code: 'MY_CUSTOM_ERROR',
        someData: {
          _id: 123456,
          name: 'foobar'
        }
      }

      var error = new Error('custom error')

      error.dadiCustomError = Object.assign({}, errorData)

      var errorObject = h.formatError(error)

      errorObject[0].hookName.should.eql(hookName)

      done()
    })
  })

  describe('`beforeCreate` hook', function () {
    beforeEach(help.cleanUpDB)

    it('should receive collection name and schema', function (done) {
      var schema = help.getModelSchema()

      schema.title = {
        type: 'String',
        required: false
      }

      schema.slug = {
        type: 'String',
        required: false
      }

      var settings = {
        database: 'testdb',
        storeRevisions: false,
        hooks: {
          beforeCreate: [{
            hook: 'slug',
            options: {
              from: 'title',
              to: 'slug'
            }
          }]
        }
      }

      var inspectFunction = function (obj, type, data) {
        JSON.stringify(data.schema).should.eql(JSON.stringify(schema))
        data.collection.should.eql('testModelName')
      }

      sinon.stub(hook.Hook.prototype, 'load').returns(inspectFunction)

      var mod = model('testModelName', schema, null, settings)

      mod.create({fieldName: 'foo', title: 'Article One', slug: ''}, function (err, result) {
        if (err) return done(err)

        hook.Hook.prototype.load.restore()

        // find the obj we just created
        mod.find({fieldName: 'foo'}, function (err, doc) {
          if (err) return done(err)

          done()
        })
      })
    })

    it('should modify single documents before create', function (done) {
      var schema = help.getModelSchema()

      schema.title = {
        type: 'String',
        required: false
      }

      schema.slug = {
        type: 'String',
        required: false
      }

      var settings = {
        database: 'testdb',
        storeRevisions: false,
        hooks: {
          beforeCreate: [{
            hook: 'slug',
            options: {
              from: 'title',
              to: 'slug'
            }
          }]
        }
      }

      sinon.stub(hook.Hook.prototype, 'load').returns(optionsFunction)

      var mod = model('testModelName', schema, null, settings)

      mod.create({fieldName: 'foo', title: 'Article One', slug: ''}, function (err, result) {
        if (err) return done(err)

        hook.Hook.prototype.load.restore()

        // find the obj we just created
        mod.find({}, function (err, doc) {
          if (err) return done(err)

          doc.results[0].slug.should.eql('article-one')
          done()
        })
      })
    })

    it('should modify an array of documents before create', function (done) {
      var schema = help.getModelSchema()

      schema.title = {
        type: 'String',
        required: false
      }

      schema.slug = {
        type: 'String',
        required: false
      }

      var settings = {
        database: 'testdb',
        storeRevisions: false,
        hooks: {
          beforeCreate: [{
            hook: 'slug',
            options: {
              from: 'title',
              to: 'slug'
            }
          }]
        }
      }

      sinon.stub(hook.Hook.prototype, 'load').returns(optionsFunction)

      var docs = [
        {fieldName: 'foo', title: 'Article One', slug: ''},
        {fieldName: 'foo', title: 'Article Two', slug: ''}
      ]

      var mod = model('testModelName', schema, null, settings)

      mod.create(docs, function (err, result) {
        if (err) return done(err)

        hook.Hook.prototype.load.restore()

        // find the obj we just created
        mod.find({fieldName: 'foo'}, function (err, doc) {
          if (err) return done(err)
          doc.results[0].slug.should.eql('article-one')
          doc.results[1].slug.should.eql('article-two')
          done()
        })
      })
    })

    it('should not insert documents that fail asynchronous beforeCreate processing', function () {
      var schema = help.getModelSchema()
      schema.title = { type: 'String', required: false }

      schema.slug = { type: 'String', required: false }

      var settings = { database: 'testdb', storeRevisions: false, hooks: { beforeCreate: [{ hook: 'slug', options: { from: 'title', to: 'slug' } }] } }

      sinon.stub(hook.Hook.prototype, 'load').returns(failingAsyncFunction)

      var docs = [
        {fieldName: 'foo', title: 'Article One', slug: ''},
        {fieldName: 'foo', title: 'Article Two', slug: ''}
      ]

      var mod = model('testModelName', schema, null, settings)

      return mod.create(docs, function (err, result) {
        hook.Hook.prototype.load.restore()

        if (err) return (err)

        // find the objs we just created
        mod.find({fieldName: 'foo'}, function (err, doc) {
          if (err) return done(err)
          doc.results.length.should.eql(1)
          doc.results[0].slug.should.eql('article-one')
        })
      })
    })

    it('should not insert documents that fail synchronous beforeCreate processing', function () {
      var schema = help.getModelSchema()
      schema.title = { type: 'String', required: false }

      schema.slug = { type: 'String', required: false }

      var settings = { database: 'testdb', storeRevisions: false, hooks: { beforeCreate: [{ hook: 'slug', options: { from: 'title', to: 'slug' } }] } }

      sinon.stub(hook.Hook.prototype, 'load').returns(failingSyncFunction)

      var docs = [
        {fieldName: 'foo', title: 'Article One', slug: ''},
        {fieldName: 'foo', title: 'Article Two', slug: ''}
      ]

      var mod = model('testModelName', schema, null, settings)

      return mod.create(docs, function (err, result) {
        hook.Hook.prototype.load.restore()

        // find the objs we just created
        mod.find({fieldName: 'foo'}, function (err, doc) {
          doc.results.should.eql([])
        })
      })
    })
  })

  describe('`afterCreate` hook', function () {
    beforeEach(help.cleanUpDB)

    it('should receive collection name and schema', function (done) {
      var schema = help.getModelSchema()
      schema.title = {
        type: 'String',
        required: false
      }

      schema.slug = {
        type: 'String',
        required: false
      }

      var settings = {
        database: 'testdb',
        storeRevisions: false,
        hooks: {
          afterCreate: [{
            hook: 'slug',
            options: {
              from: 'title',
              to: 'slug'
            }
          }]
        }
      }

      var inspectFunction = function (obj, type, data) {
        JSON.stringify(data.schema).should.eql(JSON.stringify(schema))
        data.collection.should.eql('testModelName')
      }

      sinon.stub(hook.Hook.prototype, 'load').returns(inspectFunction)

      var mod = model('testModelName', schema, null, settings)

      mod.create({fieldName: 'foo', title: 'Article One', slug: ''}, function (err, result) {
        if (err) return done(err)

        hook.Hook.prototype.load.restore()

        // find the obj we just created
        mod.find({fieldName: 'foo'}, function (err, doc) {
          if (err) return done(err)

          done()
        })
      })
    })

    it('should modify single documents after create', function (done) {
      var schema = help.getModelSchema()
      schema.title = {
        type: 'String',
        required: false
      }

      schema.slug = {
        type: 'String',
        required: false
      }

      var settings = {
        database: 'testdb',
        storeRevisions: false,
        hooks: {
          afterCreate: [{
            hook: 'writeToLog',
            options: {
              filename: 'testAfterCreateHook.log'
            }
          }]
        }
      }

      sinon.stub(hook.Hook.prototype, 'load').returns(logFunction)

      var mod = model('testModelName', schema, null, settings)

      mod.create({fieldName: 'foo', title: 'Article One', slug: ''}, function (err, result) {
        if (err) return done(err)

        // find the obj we just created
        mod.find({fieldName: 'foo'}, function (err, doc) {
          if (err) return done(err)

          hook.Hook.prototype.load.restore()

          doc.results[0].slug.should.eql('')

          var fs = require('fs')
          var path = require('path')
          var file = path.resolve(path.join(__dirname, 'testAfterCreateHook.log'))

          fs.stat(file, function (err, stats) {
            (err === null).should.eql(true)
            fs.unlinkSync(file)
            done()
          })
        })
      })
    })

    it('should modify an array of documents after create', function (done) {
      var schema = help.getModelSchema()

      schema.title = {
        type: 'String',
        required: false
      }

      schema.slug = {
        type: 'String',
        required: false
      }

      var settings = {
        database: 'testdb',
        storeRevisions: false,
        hooks: {
          afterCreate: [{
            hook: 'writeToLog',
            options: {
              filename: 'testAfterCreateHook.log'
            }
          }]
        }
      }

      sinon.stub(hook.Hook.prototype, 'load').returns(logFunction)

      var docs = [
        {fieldName: 'foo', title: 'Article One', slug: ''},
        {fieldName: 'foo', title: 'Article Two', slug: ''}
      ]

      var mod = model('testModelName', schema, null, settings)

      mod.create(docs, function (err, result) {
        if (err) return done(err)

        // find the objs we just created
        mod.find({fieldName: 'foo'}, function (err, doc) {
          if (err) return done(err)

          hook.Hook.prototype.load.restore()

          doc.results[0].slug.should.eql('')
          doc.results[1].slug.should.eql('')

          var fs = require('fs')
          var path = require('path')
          var file = path.resolve(path.join(__dirname, 'testAfterCreateHook.log'))

          fs.stat(file, function (err, stats) {
            (err === null).should.eql(true)
            var logFileBody = fs.readFileSync(file)
            // var obj = JSON.parse(logFileBody.toString())
            var obj = JSON.parse(logFileBody.toString().split('\n')[0])
            obj._id.toString().should.eql(doc.results[0]._id.toString())
            fs.unlinkSync(file)
            done()
          })
        })
      })
    })
  })

  describe('`beforeUpdate` hook', function () {
    beforeEach(help.cleanUpDB)

    it('should receive collection name and schema', function (done) {
      var schema = help.getModelSchema()
      schema.title = {
        type: 'String',
        required: false
      }

      schema.slug = {
        type: 'String',
        required: false
      }

      var settings = {
        database: 'testdb',
        storeRevisions: false,
        hooks: {
          beforeUpdate: [{
            hook: 'slug',
            options: {
              from: 'title',
              to: 'slug'
            }
          }]
        }
      }

      var inspectFunction = function (obj, type, data) {
        JSON.stringify(data.schema).should.eql(JSON.stringify(schema))
        data.collection.should.eql('testModelName')
      }

      sinon.stub(hook.Hook.prototype, 'load').returns(inspectFunction)

      var mod = model('testModelName', schema, null, settings)

      mod.create({fieldName: 'foo', title: 'Article One', slug: ''}, function (err, result) {
        if (err) return done(err)

        hook.Hook.prototype.load.restore()

        // find the obj we just created
        mod.find({fieldName: 'foo'}, function (err, doc) {
          if (err) return done(err)
          done()
        })
      })
    })

    it('should modify documents before update', function (done) {
      var schema = help.getModelSchema()

      schema.title = {
        type: 'String',
        required: false
      }

      schema.slug = {
        type: 'String',
        required: false
      }

      var settings = {
        database: 'testdb',
        storeRevisions: false,
        hooks: {
          beforeUpdate: [{
            hook: 'slug',
            options: {
              from: 'title',
              to: 'slug'
            }
          }]
        }
      }

      sinon.stub(hook.Hook.prototype, 'load').returns(optionsFunction)

      var mod = model('testModelName', schema, null, settings)

      mod.create({fieldName: 'foo', title: 'Article One', slug: ''}, function (err, result) {
        if (err) return done(err)

        var id = result.results[0]._id.toString()

        // update the obj we just created
        mod.update({ _id: id }, {title: 'Article Two'}, function (err, doc) {
          if (err) return done(err)

          hook.Hook.prototype.load.restore()

          setTimeout(function () {
            // find the obj
            mod.find({ _id: id }, function (err, doc) {
              if (err) return done(err)
              doc.results[0].slug.should.eql('article-two')
              done()
            })
          }, 500)
        })
      })
    })
  })

  describe('`afterUpdate` hook', function () {
    beforeEach(help.cleanUpDB)

    it('should receive collection name and schema', function (done) {

      var schema = help.getModelSchema()
      schema.title = {
        type: 'String',
        required: false
      }

      schema.slug = {
        type: 'String',
        required: false
      }

      var settings = {
        database: 'testdb',
        storeRevisions: false,
        hooks: {
          afterUpdate: [{
            hook: 'slug',
            options: {
              from: 'title',
              to: 'slug'
            }
          }]
        }
      }

      var inspectFunction = function (obj, type, data) {
        JSON.stringify(data.schema).should.eql(JSON.stringify(schema))
        data.collection.should.eql('testModelName')
      }

      sinon.stub(hook.Hook.prototype, 'load').returns(inspectFunction)

      var mod = model('testModelName', schema, null, settings)

      mod.create({fieldName: 'foo', title: 'Article One', slug: ''}, function (err, result) {
        if (err) return done(err)

        hook.Hook.prototype.load.restore()

        // find the obj we just created
        mod.find({fieldName: 'foo'}, function (err, doc) {
          if (err) return done(err)

          done()
        })
      })
    })

    it('should modify documents after update', function (done) {
      var schema = help.getModelSchema()

      schema.title = {
        type: 'String',
        required: false
      }

      schema.slug = {
        type: 'String',
        required: false
      }

      var settings = {
        database: 'testdb',
        storeRevisions: false,
        hooks: {
          afterUpdate: [{
            hook: 'writeToLog',
            options: {
              filename: 'testAfterUpdateHook.log'
            }
          }]
        }
      }

      sinon.stub(hook.Hook.prototype, 'load').returns(logFunction)

      var mod = model('testModelName', schema, null, settings)

      mod.create({fieldName: 'foo', title: 'Article One', slug: ''}, function (err, result) {
        if (err) return done(err)

        var id = result.results[0]._id.toString()

        // update the obj we just created
        mod.update({ _id: id }, {title: 'Article Two'}, function (err, doc) {
          if (err) return done(err)

          hook.Hook.prototype.load.restore()

          doc.results[0].slug.should.eql('')

          var fs = require('fs')
          var path = require('path')
          var file = path.resolve(path.join(__dirname, 'testAfterUpdateHook.log'))
          fs.stat(file, function (err, stats) {
            (err === null).should.eql(true)
            var logFileBody = fs.readFileSync(file)
            var obj = JSON.parse(logFileBody.toString())

            obj[0]._id.toString().should.eql(doc.results[0]._id.toString())
            fs.unlinkSync(file)
            done()
          })
        })
      })
    })
  })

  describe('`beforeDelete` hook', function () {
    beforeEach(help.cleanUpDB)

    it('should receive collection name and schema', function (done) {
      var schema = help.getModelSchema()
      schema.title = {
        type: 'String',
        required: false
      }

      schema.slug = {
        type: 'String',
        required: false
      }

      var settings = {
        database: 'testdb',
        storeRevisions: false,
        hooks: {
          beforeDelete: [{
            hook: 'slug',
            options: {
              from: 'title',
              to: 'slug'
            }
          }]
        }
      }

      var inspectFunction = function (obj, type, data) {
        JSON.stringify(data.schema).should.eql(JSON.stringify(schema))
        data.collection.should.eql('testModelName')
      }

      sinon.stub(hook.Hook.prototype, 'load').returns(inspectFunction)

      var mod = model('testModelName', schema, null, settings)

      mod.create({fieldName: 'foo', title: 'Article One', slug: ''}, function (err, result) {
        if (err) return done(err)

        var id = result.results[0]._id.toString()

        // delete the obj we just created
        mod.delete({ _id: id }, function (err, doc) {
          if (err) return done(err)

          hook.Hook.prototype.load.restore()

          // find the obj we just created
          mod.find({fieldName: 'foo'}, function (err, doc) {
            if (err) return done(err)

            done()
          })
        })
      })
    })

    it('should receive an array of documents that will be deleted', function (done) {
      var schema = help.getModelSchema()
      schema.title = {
        type: 'String',
        required: false
      }

      schema.slug = {
        type: 'String',
        required: false
      }

      var settings = {
        database: 'testdb',
        storeRevisions: false,
        hooks: {
          beforeDelete: [{
            hook: 'slug',
            options: {
              from: 'title',
              to: 'slug'
            }
          }]
        }
      }

      var inspectFunction = function (obj, type, data) {
        should.exist(data.deletedDocs)
        data.deletedDocs.should.be.Array
        data.deletedDocs.length.should.eql(1)
        data.deletedDocs[0].fieldName.should.eql('foo')
      }

      sinon.stub(hook.Hook.prototype, 'load').returns(inspectFunction)

      var mod = model('testModelName', schema, null, settings)

      mod.create({fieldName: 'foo', title: 'Article One', slug: ''}, function (err, result) {
        if (err) return done(err)

        var id = result.results[0]._id.toString()

        // delete the obj we just created
        mod.delete({ _id: id }, function (err, doc) {
          if (err) return done(err)

          hook.Hook.prototype.load.restore()

          // find the obj we just created
          mod.find({fieldName: 'foo'}, function (err, doc) {
            if (err) return done(err)

            done()
          })
        })
      })
    })

    // this one writes to a log file before deleting the document
    // see the logFunction declared at the top of this file
    it('should fire delete hook for documents before delete', function (done) {

      var schema = help.getModelSchema()
      schema.title = {
        type: 'String',
        required: false
      }

      schema.slug = {
        type: 'String',
        required: false
      }

      var settings = {
        database: 'testdb',
        storeRevisions: false,
        hooks: {
          beforeDelete: [{
            hook: 'writeToLog',
            options: {
              filename: 'testBeforeDeleteHook.log'
            }
          }]
        }
      }

      sinon.stub(hook.Hook.prototype, 'load').returns(logFunction)

      var mod = model('testModelName', schema, null, settings)

      mod.create({fieldName: 'foo', title: 'Article One', slug: ''}, function (err, result) {
        if (err) return done(err)

        var id = result.results[0]._id.toString()

        // delete the obj we just created
        mod.delete({ _id: id }, function (err, doc) {
          if (err) return done(err)

          hook.Hook.prototype.load.restore()

          setTimeout(function () {
            // try to find the obj
            mod.find({ _id: id }, function (err, doc) {
              if (err) return done(err)

              var fs = require('fs')
              var path = require('path')
              var file = path.resolve(path.join(__dirname, 'testBeforeDeleteHook.log'))
              fs.stat(file, function (err, stats) {
                (err === null).should.eql(true)
                fs.unlinkSync(file)
                done()
              })
            })
          }, 500)
        })
      })
    })
  })

  describe('`afterDelete` hook', function () {
    beforeEach(help.cleanUpDB)

    it('should receive collection name and schema', function (done) {
      var schema = help.getModelSchema()
      schema.title = {
        type: 'String',
        required: false
      }

      schema.slug = {
        type: 'String',
        required: false
      }

      var settings = {
        database: 'testdb',
        storeRevisions: false,
        hooks: {
          afterDelete: [{
            hook: 'slug',
            options: {
              from: 'title',
              to: 'slug'
            }
          }]
        }
      }

      var inspectFunction = function (obj, type, data) {
        JSON.stringify(data.schema).should.eql(JSON.stringify(schema))
        data.collection.should.eql('testModelName')
      }

      sinon.stub(hook.Hook.prototype, 'load').returns(inspectFunction)

      var mod = model('testModelName', schema, null, settings)

      mod.create({fieldName: 'foo', title: 'Article One', slug: ''}, function (err, result) {
        if (err) return done(err)

        // delete the obj we just created
        mod.delete({fieldName: 'foo'}, function (err, doc) {
          if (err) return done(err)

          hook.Hook.prototype.load.restore()

          done()
        })
      })
    })

    it('should receive an array of documents that were deleted', function (done) {
      var schema = help.getModelSchema()
      schema.title = {
        type: 'String',
        required: false
      }

      schema.slug = {
        type: 'String',
        required: false
      }

      var settings = {
        database: 'testdb',
        storeRevisions: false,
        hooks: {
          afterDelete: [{
            hook: 'slug',
            options: {
              from: 'title',
              to: 'slug'
            }
          }]
        }
      }

      var inspectFunction = function (obj, type, data) {
        should.exist(data.deletedDocs)
        data.deletedDocs.should.be.Array
        data.deletedDocs.length.should.eql(1)
        data.deletedDocs[0].fieldName.should.eql('foo')
      }

      sinon.stub(hook.Hook.prototype, 'load').returns(inspectFunction)

      var mod = model('testModelName', schema, null, settings)

      mod.create({fieldName: 'foo', title: 'Article One', slug: ''}, function (err, result) {
        if (err) return done(err)

        var id = result.results[0]._id.toString()

        // delete the obj we just created
        mod.delete({ _id: id }, function (err, doc) {
          if (err) return done(err)

          hook.Hook.prototype.load.restore()

          // find the obj we just created
          mod.find({fieldName: 'foo'}, function (err, doc) {
            if (err) return done(err)

            done()
          })
        })
      })
    })

    // this one writes to a log file before deleting the document
    // see the logFunction declared at the top of this file
    it('should fire delete hook for documents after delete', function (done) {

      var schema = help.getModelSchema()
      schema.title = {
        type: 'String',
        required: false
      }

      schema.slug = {
        type: 'String',
        required: false
      }

      var settings = {
        database: 'testdb',
        storeRevisions: false,
        hooks: {
          afterDelete: [{
            hook: 'writeToLog',
            options: {
              filename: 'testBeforeDeleteHook.log'
            }
          }]
        }
      }

      sinon.stub(hook.Hook.prototype, 'load').returns(logFunction)

      var mod = model('testModelName', schema, null, settings)

      mod.create({fieldName: 'foo', title: 'Article One', slug: ''}, function (err, result) {
        if (err) return done(err)

        var id = result.results[0]._id.toString()

        // delete the obj we just created
        mod.delete({ _id: id }, function (err, doc) {
          if (err) return done(err)

          hook.Hook.prototype.load.restore()

          setTimeout(function () {
            // try to find the obj
            mod.find({ _id: id }, function (err, doc) {
              if (err) return done(err)

              var fs = require('fs')
              var path = require('path')
              var file = path.resolve(path.join(__dirname, 'testBeforeDeleteHook.log'))
              fs.stat(file, function (err, stats) {
                (err === null).should.eql(true)
                fs.unlinkSync(file)
                done()
              })
            })
          }, 500)
        })
      })
    })
  })

  describe('`beforeGet` hook', function () {
    beforeEach(help.cleanUpDB)

    it('should receive collection name and schema', function (done) {

      var schema = help.getModelSchema()
      schema.title = {
        type: 'String',
        required: false
      }

      schema.slug = {
        type: 'String',
        required: false
      }

      var settings = {
        database: 'testdb',
        storeRevisions: false,
        hooks: {
          beforeGet: [{
            hook: 'slug',
            options: {
              from: 'title',
              to: 'slug'
            }
          }]
        }
      }

      var inspectFunction = function (obj, type, data) {
        JSON.stringify(data.schema).should.eql(JSON.stringify(schema))
        data.collection.should.eql('testModelName')
      }

      sinon.stub(hook.Hook.prototype, 'load').returns(inspectFunction)

      var mod = model('testModelName', schema, null, settings)

      mod.create({fieldName: 'foo', title: 'Article One', slug: ''}, function (err, result) {
        if (err) return done(err)

        hook.Hook.prototype.load.restore()

        // find the obj we just created
        mod.find({fieldName: 'foo'}, function (err, doc) {
          if (err) return done(err)

          done()
        })
      })
    })

    it('should modify the query before processing the GET', function (done) {

      var schema = help.getModelSchema()
      schema.title = {
        type: 'String',
        required: false
      }

      schema.slug = {
        type: 'String',
        required: false
      }

      var settings = {
        database: 'testdb',
        storeRevisions: false,
        hooks: {
          beforeGet: [{
            hook: 'slug',
            options: {
              field: 'title'
            }
          }]
        }
      }

      sinon.stub(hook.Hook.prototype, 'load').returns(querySlugifyFunction)

      var mod = model('testModelName', schema, null, settings)

      mod.create({fieldName: 'Some field', title: 'article-one'}, function (err, result) {
        if (err) return done(err)

        // find the obj we just created
        mod.get({title: 'Article One'},function (err, doc) {
          if (err) return done(err)

          hook.Hook.prototype.load.restore()

          doc.results[0].fieldName.should.eql('Some field')

          done()
        })
      })
    })
  })

  describe('`afterGet` hook', function () {
    beforeEach(help.cleanUpDB)

    it('should receive collection name and schema', function (done) {

      var schema = help.getModelSchema()
      schema.title = {
        type: 'String',
        required: false
      }

      schema.slug = {
        type: 'String',
        required: false
      }

      var settings = {
        database: 'testdb',
        storeRevisions: false,
        hooks: {
          afterGet: [{
            hook: 'slug',
            options: {
              from: 'title',
              to: 'slug'
            }
          }]
        }
      }

      var inspectFunction = function (obj, type, data) {
        JSON.stringify(data.schema).should.eql(JSON.stringify(schema))
        data.collection.should.eql('testModelName')
      }

      sinon.stub(hook.Hook.prototype, 'load').returns(inspectFunction)

      var mod = model('testModelName', schema, null, settings)

      mod.create({fieldName: 'foo', title: 'Article One', slug: ''}, function (err, result) {
        if (err) return done(err)

        hook.Hook.prototype.load.restore()

        // find the obj we just created
        mod.find({fieldName: 'foo'}, function (err, doc) {
          if (err) return done(err)

          done()
        })
      })
    })

    it('should modify documents before responding to a GET', function (done) {

      var schema = help.getModelSchema()
      schema.title = {
        type: 'String',
        required: false
      }

      schema.slug = {
        type: 'String',
        required: false
      }

      var settings = {
        database: 'testdb',
        storeRevisions: false,
        hooks: {
          afterGet: ['slug']
        }
      }

      sinon.stub(hook.Hook.prototype, 'load').returns(hijackFunction)

      var mod = model('testModelName', schema, null, settings)

      mod.create({fieldName: 'foo', title: 'Article One', slug: ''}, function (err, result) {
        if (err) return done(err)

        // find the obj we just created
        mod.get({fieldName: 'foo'},function (err, doc) {
          if (err) return done(err)

          hook.Hook.prototype.load.restore()

          doc.results[0].name.should.eql('Modified by hook')

          done()
        })
      })
    })
  })
})
