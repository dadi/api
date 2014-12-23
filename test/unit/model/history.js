var should = require('should');
var model = require(__dirname + '/../../../bantam/lib/model');
var History = require(__dirname + '/../../../bantam/lib/model/history');
var connection = require(__dirname + '/../../../bantam/lib/model/connection');
var _ = require('underscore');
var help = require(__dirname + '/../help');

describe('History', function () {

    it('should export a constructor', function (done) {
        History.should.be.Function;
        done();
    });

    describe('initialization options', function () {
        it('should take a model name as an argument', function (done) {
            var mod = model('testModelName', help.getModelSchema());
            var h = new History(mod).model.name.should.equal('testModelName');
            done();
        });

        it('should attach specified history collection if `storeRevisions` is true', function (done) {
            var conn = connection();
            var mod = model('testModelName', help.getModelSchema(), conn, { storeRevisions : true, revisionCollection : 'modelHistory' });
            should.exist(mod.revisionCollection);
            mod.revisionCollection.should.equal('modelHistory');
            
            done();
        });

    });

    describe('`create` method', function () {
        beforeEach(help.cleanUpDB);

        it('should be added to history', function (done) {
            var conn = connection();
            var mod = model('testModelName', help.getModelSchema(), conn, { storeRevisions : true });
            var h = new History(mod).model.history.create.should.be.Function;
            done();
        });

        it('should save model to database', function (done) {
            var conn = connection();
            var mod = model('testModelName', help.getModelSchema(), conn, { storeRevisions : true });
            
            should.exist(mod.revisionCollection);

            mod.history.create(mod, mod, function (err, res) {
                if (err) return done(err);

                mod.find({fieldName: 'foo'}, function (err, doc) {
                    if (err) return done(err);

                    should.exist(doc);
                    doc[0].history.length.should.equal(2);
                    done();
                });
            });
        });

    });

    describe('`createEach` method', function () {
        beforeEach(help.cleanUpDB);

        it('should be added to history', function (done) {
            var mod = model('testModelName', help.getModelSchema());
            var h = new History(mod).model.history.createEach.should.be.Function;
            done();
        });

    });

    describe('`create` method', function () {

        it('should save model to history collection', function (done) {
            var mod = null;//model('testModelName', help.getModelSchema());
            mod.create({fieldName: 'foo'}, function (err) {
                if (err) return done(err);

                mod.find({fieldName: 'foo'}, function (err, doc) {
                    if (err) return done(err);

                    should.exist(doc);
                    doc[0].history.should.be.Array;
                    doc[0].history.length.should.equal(1);
                    done();
                });
            });
        });

        it('should pass error to callback if validation fails', function (done) {
            var schema = help.getModelSchema();
            _.extend(schema.fieldName, {limit: 5});
            var mod = null;//model('testModelName', schema);
            mod.create({fieldName: '123456'}, function (err) {
                should.exist(err);
                done();
            });
        });
    });

});
