var sinon = require('sinon')
var should = require('should')
var _ = require('underscore')

var model = require(__dirname + '/../../../dadi/lib/model')
var hook = require(__dirname + '/../../../dadi/lib/model/hook')
var connection = require(__dirname + '/../../../dadi/lib/model/connection')
var help = require(__dirname + '/../help')

var simpleSlugifyHook = 'function slugify(text) {\n'
simpleSlugifyHook += "  return text.toString().toLowerCase().replace(/ /g, '-')\n"
simpleSlugifyHook += '}\n'
simpleSlugifyHook += 'module.exports = function (obj, type, data) { \n'
simpleSlugifyHook += '  return slugify(obj);\n'
simpleSlugifyHook += '}\n'
var simpleFunction = eval(simpleSlugifyHook)

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
failingSyncHook += '  if (obj[data.options.from] === "Article One") return null\n'
failingSyncHook += '  obj[data.options.to] = slugify(obj[data.options.from])\n'
failingSyncHook += '}\n'
var failingSyncFunction = eval(failingSyncHook)

var logHook = 'function writeToLog(obj, filename) {\n'
logHook += "  var fs = require('fs')\n"
logHook += "  var path = require('path')\n"
logHook += '  var file = path.resolve(path.join(__dirname, filename))\n'
logHook += "  fs.appendFileSync(file, JSON.stringify(obj) + '\\n')\n"
logHook += '}\n'
logHook += 'module.exports = function (obj, type, data) { \n'
logHook += '  writeToLog(obj, data.options.filename);\n'
logHook += '  return obj;\n'
logHook += '}\n'
var logFunction = eval(logHook)

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

  describe('`beforeCreate` hook', function () {
    beforeEach(help.cleanUpDB)

    it('should modify single documents before create', function (done) {
      var conn = connection()
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

      var mod = model('testModelName', schema, conn, settings)

      mod.create({fieldName: 'foo', title: 'Article One', slug: ''}, function (err, result) {
        if (err) return done(err)

        hook.Hook.prototype.load.restore()

        // find the obj we just created
        mod.find({fieldName: 'foo'}, function (err, doc) {
          if (err) return done(err)
          doc.results[0].slug.should.eql('article-one')
          done()
        })
      })
    })

    it('should modify an array of documents before create', function (done) {
      var conn = connection()
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

      var mod = model('testModelName', schema, conn, settings)

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

    it('should not insert documents that fail asynchronous beforeCreate processing', function (done) {
      var conn = connection()
      var schema = help.getModelSchema()
      schema.title = { type: 'String', required: false }

      schema.slug = { type: 'String', required: false }

      var settings = { storeRevisions: false, hooks: { beforeCreate: [{ hook: 'slug', options: { from: 'title', to: 'slug' } }] } }

      sinon.stub(hook.Hook.prototype, 'load').returns(failingAsyncFunction)

      var docs = [
        {fieldName: 'foo', title: 'Article One', slug: ''},
        {fieldName: 'foo', title: 'Article Two', slug: ''}
      ]

      var mod = model('testModelName', schema, conn, settings)

      mod.create(docs, function (err, result) {
        if (err) return done(err)

        hook.Hook.prototype.load.restore()

        // find the objs we just created
        mod.find({fieldName: 'foo'}, function (err, doc) {
          if (err) return done(err)
          doc.results.length.should.eql(1)
          doc.results[0].slug.should.eql('article-one')
          done()
        })
      })
    })

    it('should not insert documents that fail synchronous beforeCreate processing', function (done) {
      var conn = connection()
      var schema = help.getModelSchema()
      schema.title = { type: 'String', required: false }

      schema.slug = { type: 'String', required: false }

      var settings = { storeRevisions: false, hooks: { beforeCreate: [{ hook: 'slug', options: { from: 'title', to: 'slug' } }] } }

      sinon.stub(hook.Hook.prototype, 'load').returns(failingSyncFunction)

      var docs = [
        {fieldName: 'foo', title: 'Article One', slug: ''},
        {fieldName: 'foo', title: 'Article Two', slug: ''}
      ]

      var mod = model('testModelName', schema, conn, settings)

      mod.create(docs, function (err, result) {
        if (err) return done(err)

        hook.Hook.prototype.load.restore()

        // find the objs we just created
        mod.find({fieldName: 'foo'}, function (err, doc) {
          if (err) return done(err)
          doc.results.length.should.eql(1)
          doc.results[0].slug.should.eql('article-two')
          done()
        })
      })
    })
  })

  describe('`afterCreate` hook', function () {
    beforeEach(help.cleanUpDB)

    it('should modify single documents after create', function (done) {
      var conn = connection()
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

      var mod = model('testModelName', schema, conn, settings)

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
      var conn = connection()
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

      var mod = model('testModelName', schema, conn, settings)

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
            // console.log(logFileBody.toString())
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

    it('should modify documents before update', function (done) {
      var conn = connection()
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

      var mod = model('testModelName', schema, conn, settings)

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

    it('should modify documents after create', function (done) {
      var conn = connection()
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

      var mod = model('testModelName', schema, conn, settings)

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

            obj.results[0]._id.toString().should.eql(doc.results[0]._id.toString())
            fs.unlinkSync(file)
            done()
          })
        })
      })
    })
  })

  describe('`beforeDelete` hook', function () {
    beforeEach(help.cleanUpDB)

    // this one writes to a log file before deleting the document
    // see the logFunction declared at the top of this file
    it('should fire delete hook for documents before delete', function (done) {
      var conn = connection()
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

      var mod = model('testModelName', schema, conn, settings)

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
})
