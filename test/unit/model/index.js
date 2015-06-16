var should = require('should');
var sinon = require('sinon');
var model = require(__dirname + '/../../../bantam/lib/model');
var Validator = require(__dirname + '/../../../bantam/lib/model/validator');
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
        model('testModelName', help.getModelSchema()).should.be.an.instanceOf(model.Model);
        done();
    });

    it('should export function that gets instance of Model when not passed schema', function (done) {
        model('testModelName').should.be.an.instanceOf(model.Model);
        done();
    });

    it('should only create one instance of Model for a specific name', function (done) {
        model('testModelName').should.equal(model('testModelName'));
        done();
    });

    describe('initialization options', function () {
        it('should take model name and schema as arguments', function (done) {
            model('testModelName', help.getModelSchema()).name.should.equal('testModelName');
            done();
        });

        it('should accept database connection as third agrument', function (done) {
            var conn = connection();
            var mod = model('testModelName', help.getModelSchema(), conn)
            should.exist(mod.connection);
            mod.connection.host.should.equal('localhost');
            mod.connection.port.should.equal(27017);
            mod.connection.database.should.equal('serama');

            done();
        });

        it('should accept model settings as fourth argument', function (done) {
            var mod = model('testModelName', help.getModelSchema(), null, {
                cache: true,
                count: 25
            });
            should.exist(mod.settings);
            mod.settings.cache.should.be.true;
            mod.settings.count.should.equal(25);

            done();
        });

        it('should attach history collection by default if not specified and `storeRevisions` is not false', function (done) {
            var conn = connection();
            var mod = model('testModelName', help.getModelSchema(), conn)
            should.exist(mod.settings);
            mod.revisionCollection.should.equal('testModelNameHistory');

            done();
        });

        it('should attach history collection if specified', function (done) {
            var conn = connection();
            var mod = model('testModelName', help.getModelSchema(), conn, { revisionCollection : 'modelHistory' })
            mod.revisionCollection.should.equal('modelHistory');

            done();
        });

        it('should attach history collection if `storeRevisions` is true', function (done) {
            var conn = connection();
            var mod = model('testModelName', help.getModelSchema(), conn, { storeRevisions : true });
            should.exist(mod.revisionCollection);
            mod.revisionCollection.should.equal('testModelNameHistory');
            
            done();
        });

        it('should attach specified history collection if `storeRevisions` is true', function (done) {
            var conn = connection();
            var mod = model('testModelName', help.getModelSchema(), conn, { storeRevisions : true, revisionCollection : 'modelHistory' });
            should.exist(mod.revisionCollection);
            mod.revisionCollection.should.equal('modelHistory');
            
            done();
        });

        it('should accept collection indexing settings', function (done) {
            var mod = model('testModelName', help.getModelSchema(), null, {
                index: {
                    enabled: true,
                    keys: { orderDate: 1 }
                }
            });

            should.exist(mod.settings);
            JSON.parse(JSON.stringify(mod.settings.index)).enabled.should.be.true;
            JSON.stringify(mod.settings.index.keys).should.equal(JSON.stringify({ orderDate: 1 }));

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

        it('should attach `validationRule` definition to model', function (done) {
            var val = 'test validationRule';

            help.testModelProperty('validationRule', val);
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
            model('testModelName', help.getModelSchema()).find.should.be.Function;
            done();
        });

        it('should accept query object and callback', function (done) {
            model('testModelName', help.getModelSchema()).find({}, done);
        });

        it('should accept JSON array for aggregation queries and callback', function (done) {
            var query = [
                { $match: { status: "A" } }
            ];
            model('testModelName', help.getModelSchema()).find(query, done);
        });

        it('should', function (done) {
            var mod = model('testModelName', help.getModelSchema());
            var validator = sinon.stub(mod.validate, 'query').returns({ success: 'truex' });
            //var stub = sinon.stub(mod.validate, 'query');

            mod.find({$where : "a"}, {}, function(result) {
            //mod.find('a',{}, function(result) {
                //validator.callCount.should.equal(1);
                validator.restore();

                done();
            });
        });

        it('should pass error to callback when query uses `$` operators', function (done) {
            model('testModelName').find({$where: 'this.fieldName === "foo"'}, function (err) {
                should.exist(err);
                done();
            });
        });
    });

    describe('`revisions` method', function () {
        
        it('should be added to model', function (done) {
            model('testModelName', help.getModelSchema()).revisions.should.be.Function;
            done();
        });

        it('should accept id param and return history collection', function (done) {
            var conn = connection();
            var mod = model('testModelName', help.getModelSchema(), conn, { storeRevisions : true })
            
            mod.create({fieldName: 'foo'}, function (err, result) {
                if (err) return done(err);

                mod.find({fieldName: 'foo'}, function (err, doc) {
                    if (err) return done(err);

                    var doc_id = doc['results'][0]._id;
                    var revision_id = doc['results'][0].history[0]; // expected history object

                    model('testModelName', help.getModelSchema()).revisions(doc_id, function (err, result) {
                        if (err) return done(err);

                        result.should.be.Array;

                        if (result[0]) {
                            result[0]._id.toString().should.equal(revision_id.toString());
                        }

                    });

                    done();
                });

            });
        });
    });

    describe('`createIndex` method', function () {
        
        it('should be added to model', function (done) {
            model('testModelName', help.getModelSchema()).createIndex.should.be.Function;
            done();
        });

        it('should create index if indexing settings are supplied', function (done) {
            var conn = connection();
            var mod = model('testModelName',
                            help.getModelSchema(),
                            conn, 
                            { 
                                index: 
                                { 
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
                        );
            
            mod.create({fieldName: "ABCDEF"}, function (err, result) {
                if (err) return done(err);
                // Peform a query, with explain to show we hit the query
                mod.find({"fieldName":"ABC"}, {explain:true}, function(err, explanation) {
            
                    explanation['results'][0].indexBounds.fieldName.should.not.be.null;

                    done();
                });
            });
        });

        it('should support compound indexes', function (done) {
            var conn = connection();
            var fields = help.getModelSchema();
            var schema = {};
            schema.fields = fields;
            
            schema.fields.field2 = _.extend({}, schema.fields.fieldName, {
                type: 'Number',
                required: false
            });
            
            var mod = model('testModelName',
                            schema.fields,
                            conn, 
                            { 
                                index: 
                                { 
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
                        );
            
            mod.create({fieldName: "ABCDEF", field2: 2}, function (err, result) {
                if (err) return done(err);
                // Peform a query, with explain to show we hit the query
                mod.find({"fieldName":"ABC", "field2":1}, {explain:true}, function(err, explanation) {
                    explanation['results'][0].indexBounds.fieldName.should.not.be.null;
                    explanation['results'][0].indexBounds.field2.should.not.be.null;
                    done();
                });
            });
        });
    });

    describe('`create` method', function () {
        beforeEach(help.cleanUpDB);

        it('should be added to model', function (done) {
            model('testModelName', help.getModelSchema()).create.should.be.Function;
            done();
        });

        it('should accept and object and callback', function (done) {
            var mod = model('testModelName', help.getModelSchema());
            mod.create({fieldName: 'foo'}, done);
        });

        it('should save model to database', function (done) {
            var mod = model('testModelName', help.getModelSchema());
            mod.create({fieldName: 'foo'}, function (err) {
                if (err) return done(err);

                mod.find({fieldName: 'foo'}, function (err, doc) {
                    if (err) return done(err);

                    should.exist(doc['results']);
                    doc['results'][0].fieldName.should.equal('foo');
                    done();
                });
            });
        });

        it('should save model to history collection', function (done) {
            var mod = model('testModelName', help.getModelSchema());
            mod.create({fieldName: 'foo'}, function (err) {
                if (err) return done(err);

                mod.find({fieldName: 'foo'}, function (err, doc) {
                    if (err) return done(err);

                    should.exist(doc['results']);
                    doc['results'][0].history.should.be.Array;
                    doc['results'][0].history.length.should.equal(1);
                    done();
                });
            });
        });

        it('should pass error to callback if validation fails', function (done) {
            var schema = help.getModelSchema();
            _.extend(schema.fieldName, {limit: 5});
            var mod = model('testModelName', schema);
            mod.create({fieldName: '123456'}, function (err) {
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
                model('testModelName', help.getModelSchema()).create({
                    fieldName: 'foo'
                }, function (err, result) {
                    if (err) return done(err);

                    should.exist(result && result[0]);
                    result[0].fieldName.should.equal('foo');

                    done();
                });
            });
        });

        it('should be added to model', function (done) {
            model('testModelName').update.should.be.Function;
            done();
        });

        it('should accept query, update object, and callback', function (done) {
            var mod = model('testModelName');
            mod.update({fieldName: 'foo'}, {fieldName: 'bar'}, done);
        });

        it('should update an existing document', function (done) {
            var mod = model('testModelName');
            var updateDoc = {fieldName: 'bar'};

            mod.update({fieldName: 'foo'}, updateDoc, function (err, result) {
                if (err) return done(err);

                result.should.equal(updateDoc);

                // make sure document was updated
                mod.find({fieldName: 'bar'}, function (err, result) {
                    if (err) return done(err);

                    should.exist(result['results'] && result['results'][0]);
                    result['results'][0].fieldName.should.equal('bar');
                    done();
                })
            });
        });

        it('should create new history revision when updating an existing document and `storeRevisions` is true', function (done) {
            var conn = connection();
            var mod = model('testModelName', help.getModelSchema(), conn, { storeRevisions : true })
            var updateDoc = {fieldName: 'bar'};

            mod.update({fieldName: 'foo'}, updateDoc, function (err, result) {
                if (err) return done(err);

                result.should.equal(updateDoc);

                // make sure document was updated
                mod.find({fieldName: 'bar'}, function (err, result) {
                    if (err) return done(err);

                    should.exist(result && result[0]);
                    result['results'][0].fieldName.should.equal('bar');

                    should.exist(result['results'][0].history);
                    result['results'][0].history.length.should.equal(2); // two revisions, one from initial create and one from the update

                    done();
                })
            });
        });

        it('should pass error to callback if schema validation fails', function (done) {
            var schema = help.getModelSchema();
            _.extend(schema.fieldName, {limit: 5});
            var mod = model('testModelName', schema);
            mod.update({fieldName: 'foo'}, {fieldName: '123456'}, function (err) {
                should.exist(err);
                done();
            });
        });

        it('should pass error to callback when query uses `$` operators', function (done) {
            model('testModelName').update({$where: 'this.fieldName === "foo"'}, {fieldName: 'bar'}, function (err) {
                should.exist(err);
                done();
            });
        });
    });

    describe('`delete` method', function () {
        beforeEach(help.cleanUpDB);

        it('should be added to model', function (done) {
            model('testModelName', help.getModelSchema()).delete.should.be.Function;
            done();
        });

        it('should accept a query object and callback', function (done) {
            model('testModelName').delete({fieldName: 'foo'}, done);
        });

        it('should delete a document', function (done) {
            var mod = model('testModelName');
            mod.create({fieldName: 'foo'}, function (err, result) {
                if (err) return done(err);

                result[0].fieldName.should.equal('foo');
                mod.delete({fieldName: 'foo'}, function (err, numAffected) {
                    if (err) return done(err);

                    numAffected.should.equal(1);
                    mod.find({}, function (err, result) {
                        if (err) return done(err);

                        result['results'].length.should.equal(0);
                        done();
                    });
                });
            });
        });

        it('should pass error to callback when query uses `$` operators', function (done) {
            model('testModelName').delete({$where: 'this.fieldName === "foo"'}, function (err) {
                should.exist(err);
                done();
            });
        });
    });

    describe('validator', function () {
        it('should be attached to Model', function (done) {
            var mod = model('testModelName', help.getModelSchema());
            mod.validate.should.be.Object;
            mod.validate.query.should.be.Function;
            mod.validate.schema.should.be.Function;
            done();
        });

        describe('query', function () {
            it('should not allow the use of `$where` in queries', function (done) {
                var mod = model('testModelName');
                mod.validate.query({$where: 'throw new Error("Insertion Attack!")'}).success.should.be.false;
                done();
            });

            it('should allow querying with key values', function (done) {
                var mod = model('testModelName');
                mod.validate.query({fieldName: 'foo'}).success.should.be.true;
                done();
            });
        });

        describe('schema', function () {
            beforeEach(function (done) {
                model('schemaTest', help.getModelSchema());
                done();
            });

            it('should return true for object that matches schema', function (done) {
                var mod = model('schemaTest');
                mod.validate.schema({fieldName: 'foobar'}).success.should.be.true;
                done();
            });

            it('should return false for object that contains undefined field', function (done) {
                var mod = model('schemaTest');
                mod.validate.schema({nonSchemaField: 'foobar', fieldName: 'baz'}).success.should.be.false;
                done();
            });

            it('should check length limit for field', function (done) {
                var schema = help.getModelSchema();
                _.extend(schema.fieldName, {limit: 5});
                var mod = model('limitTest', schema);
                mod.validate.schema({fieldName: '123456'}).success.should.be.false;
                done();
            });

            it('should ensure all required fields are present', function (done) {
                var schema = help.getModelSchema();
                schema.requiredField = _.extend({}, schema.fieldName, {required: true});

                var mod = model('requiredTest', schema);
                mod.validate.schema({fieldName: 'foo'}).success.should.be.false;
                done();
            });

            it('should check `validationRule` if available', function (done) {
                var schema = help.getModelSchema();
                _.extend(schema.fieldName, {validationRule: '\\w+'});
                var mod = model('validationRuleTest', schema);
                mod.validate.schema({fieldName: '@#$%'}).success.should.be.false;
                mod.validate.schema({fieldName: 'qwerty'}).success.should.be.true;
                done();
            });
        });
    });
});
