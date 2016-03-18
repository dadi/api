var sinon = require('sinon');
var should = require('should');
var _ = require('underscore');

var model = require(__dirname + '/../../../dadi/lib/model');
var hook = require(__dirname + '/../../../dadi/lib/model/hook');
var connection = require(__dirname + '/../../../dadi/lib/model/connection');
var help = require(__dirname + '/../help');

var simpleSlugifyHook = "function slugify(text) {\n"
simpleSlugifyHook += "  return text.toString().toLowerCase().replace(/ /g, '-')\n";
simpleSlugifyHook += "}\n"
simpleSlugifyHook += "module.exports = function (obj, type, data) { \n"
simpleSlugifyHook += "  return slugify(obj);\n"
simpleSlugifyHook += "}\n"
var simpleFunction = eval(simpleSlugifyHook);

var optionsSlugifyHook = "function slugify(text) {\n"
optionsSlugifyHook += "  return text.toString().toLowerCase().replace(/ /g, '-')\n";
optionsSlugifyHook += "}\n"
optionsSlugifyHook += "module.exports = function (obj, type, data) { \n"
optionsSlugifyHook += "  obj[data.options.to] = slugify(obj[data.options.from]);\n"
optionsSlugifyHook += "  return obj;\n"
optionsSlugifyHook += "}\n"
var optionsFunction = eval(optionsSlugifyHook);

var logHook = "function writeToLog(obj) {\n"
logHook += "  var fs = require('fs')\n"
logHook += "  var path = require('path')\n"
logHook += "  var file = path.resolve(path.join(__dirname, 'testDeleteHook.log'))\n"
logHook += "  fs.writeFileSync(file, JSON.stringify(obj))\n"
logHook += "}\n"
logHook += "module.exports = function (obj, type, data) { \n"
logHook += "  writeToLog(obj);\n"
logHook += "  return obj;\n"
logHook += "}\n"
var logFunction = eval(logHook);

describe('Hook', function () {
  it('should export a constructor', function (done) {
      hook.should.be.Function;
      done();
  });

  describe('initialization', function () {
    it('should take a name and a type as arguments', function (done) {
      sinon.stub(hook.Hook.prototype, 'load').returns('x');
      var h = new hook('test', 0);
      hook.Hook.prototype.load.restore();

      h.name.should.equal('test');
      h.type.should.equal(0);
      done();
    });

    it('should take an object as an argument', function (done) {
      sinon.stub(hook.Hook.prototype, 'load').returns(simpleFunction);

      var data = {
        hook: 'test',
        options: { x: 1}
      }

      var h = new hook(data, 0);
      hook.Hook.prototype.load.restore();

      h.name.should.equal('test');
      h.options.x.should.eql(1)
      h.type.should.equal(0);
      done();
    });

    it('should load the hook as a function', function(done) {
      sinon.stub(hook.Hook.prototype, 'load').returns(simpleFunction);
      var h = new hook('test', 0);
      hook.Hook.prototype.load.restore();
      h.hook.should.be.Function;
      done();
    })
  });

  describe('`apply` method', function(done) {
    it('should modify the passed argument', function(done) {
      sinon.stub(hook.Hook.prototype, 'load').returns(simpleFunction);

      var h = new hook('test', 0);
      var title = "Title Of The Article";
      var slug = h.apply(title);

      hook.Hook.prototype.load.restore();

      slug.should.equal('title-of-the-article');
      done();
    })

    it('should modify the passed document with options', function(done) {
      sinon.stub(hook.Hook.prototype, 'load').returns(optionsFunction);

      var data = {
        hook: 'test',
        options: {
          "from": "title",
          "to": "slug"
        }
      }

      var h = new hook(data, 0);
      var obj = {
        title: "Title Of The Article",
        slug: ''
      }
      var modifiedObj = h.apply(obj);

      hook.Hook.prototype.load.restore();

      modifiedObj.slug.should.equal('title-of-the-article');
      done();
    })
  })

  describe('`create` hook', function () {
    beforeEach(help.cleanUpDB);

    it('should modify documents before create', function (done) {
      var conn = connection();
      var schema = help.getModelSchema();
      schema.title = {
          type: 'String',
          required: false
      }

      schema.slug = {
          type: 'String',
          required: false
      }

      var settings = {
        storeRevisions : false,
        hooks: {
          create: [{
            hook: "slug",
            options: {
              from: "title",
              to: "slug"
            }
          }]
        }
      }

      sinon.stub(hook.Hook.prototype, 'load').returns(optionsFunction);

      var mod = model('testModelName', schema, conn, settings);

      mod.create({fieldName: 'foo', title: 'Article One', slug: ''}, function (err, result) {
        if (err) return done(err);

        hook.Hook.prototype.load.restore();

        // find the obj we just created
        mod.find({fieldName: 'foo'}, function (err, doc) {
          if (err) return done(err);
          doc.results[0].slug.should.eql('article-one');
          done();
        });
      });
    });
  });

  describe('`update` hook', function () {
    beforeEach(help.cleanUpDB);

    it('should modify documents before update', function (done) {
      var conn = connection();
      var schema = help.getModelSchema();
      schema.title = {
          type: 'String',
          required: false
      }

      schema.slug = {
          type: 'String',
          required: false
      }

      var settings = {
        storeRevisions : false,
        hooks: {
          update: [{
            hook: "slug",
            options: {
              from: "title",
              to: "slug"
            }
          }]
        }
      }

      sinon.stub(hook.Hook.prototype, 'load').returns(optionsFunction);

      var mod = model('testModelName', schema, conn, settings);

      mod.create({fieldName: 'foo', title: 'Article One', slug: ''}, function (err, result) {
        if (err) return done(err);

        var id = result.results[0]._id.toString();

        // update the obj we just created
        mod.update({ _id: id }, {title: 'Article Two'}, function (err, doc) {
          if (err) return done(err);

          hook.Hook.prototype.load.restore();

          setTimeout(function() {
            // find the obj
            mod.find({ _id: id }, function (err, doc) {
              if (err) return done(err);
              doc.results[0].slug.should.eql('article-two');
              done();
            });
          }, 500)
        });
      });
    });
  });

  describe('`delete` hook', function () {
    beforeEach(help.cleanUpDB);

    // this one writes to a log file before deleting the document
    // see the logFunction declared at the top of this file
    it('should fire delete hook for documents before delete', function (done) {
      var conn = connection();
      var schema = help.getModelSchema();
      schema.title = {
          type: 'String',
          required: false
      }

      schema.slug = {
          type: 'String',
          required: false
      }

      var settings = {
        storeRevisions : false,
        hooks: {
          delete: [{
            hook: "writeToLog"
          }]
        }
      }

      sinon.stub(hook.Hook.prototype, 'load').returns(logFunction);

      var mod = model('testModelName', schema, conn, settings);

      mod.create({fieldName: 'foo', title: 'Article One', slug: ''}, function (err, result) {
        if (err) return done(err);

        var id = result.results[0]._id.toString();

        // delete the obj we just created
        mod.delete({ _id: id }, function (err, doc) {
          if (err) return done(err);

          hook.Hook.prototype.load.restore();

          setTimeout(function() {
            // try to find the obj
            mod.find({ _id: id }, function (err, doc) {
              if (err) return done(err);

              var fs = require('fs')
              var path = require('path')
              var file = path.resolve(path.join(__dirname, 'testDeleteHook.log'))
              fs.stat(file, function(err, stats) {
                (err === null).should.eql(true)
                fs.unlinkSync(file)
                done();
              })
            });
          }, 500)
        });
      });
    });
  });
});
