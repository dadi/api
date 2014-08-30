var should = require('should');
var model = require(__dirname + '/../../../bantam/lib/model');
var connection = require(__dirname + '/../../../bantam/lib/model/connection');
var _ = require('underscore');
var help = require(__dirname + '/../help');

describe('Model', function () {
    it('should export a function', function (done) {
        model.should.be.Function;
        done();
    });

    it('should export a constructor', function (done) {
        model.Model.should.be.Function;
        done();
    });

    it('should export function that creates an instance of Model when passed schema', function (done) {
        model('test_model_name', help.getModelSchema()).should.be.an.instanceOf(model.Model);
        done();
    });

    it('should export function that gets instance of Model when not passed schema', function (done) {
        model('test_model_name').should.be.an.instanceOf(model.Model);
        done();
    });

    it('should only create one instance of Model for a specific name', function (done) {
        model('test_model_name').should.equal(model('test_model_name'));
        done();
    });

    describe('initialization options', function () {
        it('should take model name and schema as arguments', function (done) {
            model('test_model_name', help.getModelSchema()).name.should.equal('test_model_name');
            done();
        });

        it('should accept database connection as third agrument', function (done) {
            var conn = connection();
            var mod = model('test_model_name', help.getModelSchema(), conn)
            should.exist(mod.connection);
            mod.connection.host.should.equal('localhost');
            mod.connection.port.should.equal(27017);
            mod.connection.database.should.equal('serama');

            done();
        });

        it('should accept model settings as fourth argument', function (done) {
            var mod = model('test_model_name', help.getModelSchema(), null, {
                cache: true,
                count: 25
            });
            should.exist(mod.settings);
            mod.settings.cache.should.be.true;
            mod.settings.count.should.equal(25);

            done();
        });

        it('should attach `type` definition to model', function (done) {
            var val = 'test type';

            help.testModelProperty('type', val);
            done();
        });

        it('should attach `label` definition to model', function (done) {
            var val = 'test label';

            help.testModelProperty('label', val);
            done();
        });

        it('should attach `comments` definition to model', function (done) {
            var val = 'test comments';

            help.testModelProperty('comments', val);
            done();
        });

        it('should attach `limit` definition to model', function (done) {
            var val = 'test limit';

            help.testModelProperty('limit', val);
            done();
        });

        it('should attach `placement` definition to model', function (done) {
            var val = 'test placement';

            help.testModelProperty('placement', val);
            done();
        });

        it('should attach `validation_rule` definition to model', function (done) {
            var val = 'test validation_rule';

            help.testModelProperty('validation_rule', val);
            done();
        });

        it('should attach `required` definition to model', function (done) {
            var val = true;

            help.testModelProperty('required', val);
            done();
        });

        it('should attach `message` definition to model', function (done) {
            var val = 'test message';

            help.testModelProperty('message', val);
            done();
        });

        it('should attach `display` definition to model', function (done) {
            var val = {
                index: true,
                edit: true
            };

            help.testModelProperty('display', val);
            done();
        });
    });

    describe('`find` method', function () {
        it('should be added to model', function (done) {
            model('test_model_name', help.getModelSchema()).find.should.be.Function;
            done();
        });

        it('should accept query object and callback', function (done) {
            model('test_model_name', help.getModelSchema()).find({}, done);
        });

        it('should pass error to callback when query uses `$` operators', function (done) {
            model('test_model_name').find({$where: 'this.field_name === "foo"'}, function (err) {
                should.exist(err);
                done();
            });
        });
    });

    describe('`create` method', function () {
        beforeEach(help.cleanUpDB);

        it('should be added to model', function (done) {
            model('test_model_name', help.getModelSchema()).create.should.be.Function;
            done();
        });

        it('should accept and object and callback', function (done) {
            var mod = model('test_model_name', help.getModelSchema());
            mod.create({field_name: 'foo'}, done);
        });

        it('should save model to database', function (done) {
            var mod = model('test_model_name', help.getModelSchema());
            mod.create({field_name: 'foo'}, function (err) {
                if (err) return done(err);

                mod.find({field_name: 'foo'}, function (err, doc) {
                    if (err) return done(err);

                    should.exist(doc);
                    doc[0].field_name.should.equal('foo');
                    done();
                });
            });
        });

        it('should pass error to callback if validation fails', function (done) {
            var schema = help.getModelSchema();
            _.extend(schema.field_name, {limit: 5});
            var mod = model('test_model_name', schema);
            mod.create({field_name: '123456'}, function (err) {
                should.exist(err);
                done();
            });
        });
    });

    describe('`update` method', function () {
        beforeEach(function (done) {
            help.cleanUpDB(function (err) {
                if (err) return done(err);

                // create model to be updated by tests
                model('test_model_name', help.getModelSchema()).create({
                    field_name: 'foo'
                }, function (err, result) {
                    if (err) return done(err);

                    should.exist(result && result[0]);
                    result[0].field_name.should.equal('foo');

                    done();
                });
            });
        });

        it('should be added to model', function (done) {
            model('test_model_name').update.should.be.Function;
            done();
        });

        it('should accept query, update object, and callback', function (done) {
            var mod = model('test_model_name');
            mod.update({field_name: 'foo'}, {field_name: 'bar'}, done);
        });

        it('should update an existing document', function (done) {
            var mod = model('test_model_name');
            var updateDoc = {field_name: 'bar'};

            mod.update({field_name: 'foo'}, updateDoc, function (err, result) {
                if (err) return done(err);

                result.should.equal(updateDoc);

                // make sure document was updated
                mod.find({field_name: 'bar'}, function (err, result) {
                    if (err) return done(err);

                    should.exist(result && result[0]);
                    result[0].field_name.should.equal('bar');
                    done();
                })
            });
        });

        it('should pass error to callback if schema validation fails', function (done) {
            var schema = help.getModelSchema();
            _.extend(schema.field_name, {limit: 5});
            var mod = model('test_model_name', schema);
            mod.update({field_name: 'foo'}, {field_name: '123456'}, function (err) {
                should.exist(err);
                done();
            });
        });

        it('should pass error to callback when query uses `$` operators', function (done) {
            model('test_model_name').update({$where: 'this.field_name === "foo"'}, {field_name: 'bar'}, function (err) {
                should.exist(err);
                done();
            });
        });
    });

    describe('`delete` method', function () {
        beforeEach(help.cleanUpDB);

        it('should be added to model', function (done) {
            model('test_model_name', help.getModelSchema()).delete.should.be.Function;
            done();
        });

        it('should accept a query object and callback', function (done) {
            model('test_model_name').delete({field_name: 'foo'}, done);
        });

        it('should delete a document', function (done) {
            var mod = model('test_model_name');
            mod.create({field_name: 'foo'}, function (err, result) {
                if (err) return done(err);

                result[0].field_name.should.equal('foo');
                mod.delete({field_name: 'foo'}, function (err, numAffected) {
                    if (err) return done(err);

                    numAffected.should.equal(1);
                    mod.find({}, function (err, result) {
                        if (err) return done(err);

                        result.length.should.equal(0);
                        done();
                    });
                });
            });
        });

        it('should pass error to callback when query uses `$` operators', function (done) {
            model('test_model_name').delete({$where: 'this.field_name === "foo"'}, function (err) {
                should.exist(err);
                done();
            });
        });
    });

    describe('validator', function () {
        it('should be attached to Model', function (done) {
            var mod = model('test_model_name', help.getModelSchema());
            mod.validate.should.be.Object;
            mod.validate.query.should.be.Function;
            mod.validate.schema.should.be.Function;
            done();
        });

        describe('query', function () {
            it('should not allow the use of `$where` in queries', function (done) {
                var mod = model('test_model_name');
                mod.validate.query({$where: 'throw new Error("Insertion Attack!")'}).success.should.be.false;
                done();
            });

            it('should allow querying with key values', function (done) {
                var mod = model('test_model_name');
                mod.validate.query({field_name: 'foo'}).success.should.be.true;
                done();
            });
        });

        describe('schema', function () {
            beforeEach(function (done) {
                model('schema_test', help.getModelSchema());
                done();
            });

            it('should return true for object that matches schema', function (done) {
                var mod = model('schema_test');
                mod.validate.schema({field_name: 'foobar'}).success.should.be.true;
                done();
            });

            it('should return false for object that contains undefined field', function (done) {
                var mod = model('schema_test');
                mod.validate.schema({non_schema_field: 'foobar', field_name: 'baz'}).success.should.be.false;
                done();
            });

            it('should check length limit for field', function (done) {
                var schema = help.getModelSchema();
                _.extend(schema.field_name, {limit: 5});
                var mod = model('limit_test', schema);
                mod.validate.schema({field_name: '123456'}).success.should.be.false;
                done();
            });

            it('should ensure all required fields are present', function (done) {
                var schema = help.getModelSchema();
                schema.required_field = _.extend({}, schema.field_name, {required: true});

                var mod = model('required_test', schema);
                mod.validate.schema({field_name: 'foo'}).success.should.be.false;
                done();
            });

            it('should check `validation_rule` if available', function (done) {
                var schema = help.getModelSchema();
                _.extend(schema.field_name, {validation_rule: '\\w+'});
                var mod = model('validation_rule_test', schema);
                mod.validate.schema({field_name: '@#$%'}).success.should.be.false;
                mod.validate.schema({field_name: 'qwerty'}).success.should.be.true;
                done();
            });
        });
    });
});
