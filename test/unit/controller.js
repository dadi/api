var should = require('should');
var sinon = require('sinon');
var _ = require('underscore');
var controller = require(__dirname + '/../../dadi/lib/controller');
var model = require(__dirname + '/../../dadi/lib/model');
var cache = require(__dirname + '/../../dadi/lib/cache');
var help = require(__dirname + '/help');

describe('Controller', function (done) {

  before(function(done) {
    cache.reset();
    done();
  });

    it('should export constructor', function (done) {
        controller.Controller.should.be.Function;
        done();
    });

    it('should export function that returns an instance', function (done) {
        controller.should.be.Function;
        var mod = model('testModel', help.getModelSchema());
        controller(mod).should.be.an.instanceOf(controller.Controller);
        done();
    });

    it('should attach a model to the controller', function (done) {
        var mod = model('testModel', help.getModelSchema());
        controller(mod).model.should.equal(mod);
        done();
    });

    it('should throw if no model is passed to constructor', function (done) {
        controller.should.throw();
        done();
    });

    describe('instance', function () {
        describe('`get` method', function () {
            it('should be accessible', function (done) {
                var mod = model('testModel', help.getModelSchema());
                controller(mod).get.should.be.Function;
                done();
            });

            it('should call the Model\'s find method', function (done) {
                var mod = model('testModel', help.getModelSchema());
                var stub = sinon.stub(mod, 'find');

                var req = {
                    url: '/foo/bar'
                };

                controller(mod).get(req);
                stub.callCount.should.equal(1);
                stub.restore();
                done();
            });

            it('should strip unknown params from the query', function (done) {
                var mod = model('testModel', help.getModelSchema());
                var stub = sinon.stub(mod, 'find');

                var req = {
                    url: '/foo/bar?filter={"fieldName":"test", "busted":56488}'
                };

                controller(mod).get(req);
                stub.callCount.should.equal(1);
                var findArgs = stub.returnsArg(0).args[0][0];
                findArgs.hasOwnProperty('busted').should.be.false;
                stub.restore();
                done();
            });

            it('should allow Mixed fields to be queried using `unknown` params', function (done) {
                var schema = help.getModelSchema();
                schema = _.extend(schema, {
                                            fieldMixed:
                                             {
                                               type: 'Mixed',
                                               label: 'Mixed Field',
                                               required: false,
                                               display: { index: true, edit: true }
                                             }
                                           }
                )

                var mod = model('schemaTest', schema);
                var stub = sinon.stub(mod, 'find');

                var req = {
                    url: '/foo/bar?filter={"fieldMixed.innerProperty":"foo"}'
                };

                controller(mod).get(req);
                stub.callCount.should.equal(1);
                var findArgs = stub.returnsArg(0).args[0][0];
                findArgs.hasOwnProperty('fieldMixed.innerProperty').should.be.true;
                stub.restore();
                done();
            });

            it('should not call find() if invalid skip option is provided', function (done) {
                var mod = model('testModel', help.getModelSchema());
                var stub = sinon.stub(mod, 'find');

                var req = {
                    url: '/foo/bar?filter={"fieldName":"test"}&skip=-1'
                };

                var res = {
                  setHeader: function setHeader(string, string) {
                  },
                  end: function end(body) {
                    this.body = body;
                  }
                }

                res.body = '';
                res.statusCode = 200;

                controller(mod).get(req, res, {});
                stub.restore();
                stub.callCount.should.equal(0);

                res.statusCode.should.eql(400);
                done();
            });

            it('should not call find() if invalid page option is provided', function (done) {
                var mod = model('testModel', help.getModelSchema());
                var stub = sinon.stub(mod, 'find');

                var req = {
                    url: '/foo/bar?filter={"fieldName":"test"}&page=-1'
                };

                var res = {
                  setHeader: function setHeader(string, string) {
                  },
                  end: function end(body) {
                    this.body = body;
                  }
                }

                res.body = '';
                res.statusCode = 200;

                controller(mod).get(req, res, {});

                stub.restore();
                stub.callCount.should.equal(0);
                res.statusCode.should.eql(400);
                done();
            });

            it('should pass model\'s default filters to the find query', function (done) {
                var mod = model('testModel', null, help.getModelSchemaWithMultipleFields(), help.getModelSettings());
                var stub = sinon.stub(mod, 'find');

                var req = {
                    url: '/foo/bar'
                };

                // update defaultFilters
                mod.settings.defaultFilters = { "field1": "xxx" };

                controller(mod).get(req);
                stub.callCount.should.equal(1);
                var findArgs = stub.returnsArg(0).args[0][0];
                findArgs.hasOwnProperty('field1').should.be.true;
                stub.restore();
                done();
            });

            it('should pass model\'s default fields to the find query', function (done) {
                var mod = model('testModel', null, help.getModelSchemaWithMultipleFields(), help.getModelSettings());
                var stub = sinon.stub(mod, 'find');

                var req = {
                    url: '/foo/bar'
                };

                // update defaultFilters
                mod.settings.fieldLimiters = { "field1": 1 };

                controller(mod).get(req);

                stub.callCount.should.equal(1);
                var findArgs = stub.returnsArg(0).args[0][1];

                findArgs.hasOwnProperty('fields').should.be.true;
                findArgs.fields.hasOwnProperty('field1').should.be.true;
                stub.restore();

                done();
            });

            it('should send response', function (done) {
                var mod = model('testModel');

                var req = {
                    url: '/foo/bar'
                };

                var res = {
                    end: function (chunk) {
                        done();
                    },
                    setHeader: function () {}
                };

                controller(mod).get(req, res);
            });
        });

        describe('`post` method', function () {
            it('should be accessible', function (done) {
                var mod = model('testModel', help.getModelSchema());
                controller(mod).post.should.be.Function;
                done();
            });

            it('should call the Model\'s create method', function (done) {
                var mod = model('testModel');
                var stub = sinon.stub(mod, 'create');
                controller(mod).post({
                    params: {},
                    body: { field1: 'foo' },
                    url: '/vtest/testdb/testcoll'
                });
                var count = stub.callCount;
                stub.restore();
                count.should.equal(1);
                done();
            });

            it('should add internally calculated fields during create', function (done) {
                var mod = model('testModel');
                var stub = sinon.stub(mod, 'create');
                controller(mod).post({
                    params: {},
                    client: {clientId: 'clientTestId'},
                    body: { field1: 'foo' },
                    url: '/vtest/testdb/testcoll'
                });
                var count = stub.callCount;
                var args = stub.getCall(0).args;
                stub.restore();
                count.should.equal(1);
                args[0].field1.should.equal('foo');
                args[1].apiVersion.should.equal('vtest');
                args[1].createdAt.should.be.Number;
                args[1].createdBy.should.equal('clientTestId');

                done();
            });
          });

          describe('`put` method', function () {
            it('should be accessible', function (done) {
                var mod = model('testModel', help.getModelSchema());
                controller(mod).put.should.be.Function;
                done();
            });

            it('should call the Model\'s update method', function (done) {
                var mod = model('testModel');
                var stub = sinon.stub(mod, 'update');
                controller(mod).put({
                    params: { id: '1234567890'},
                    body: { field1: 'foo' },
                    url: '/vtest/testdb/testcoll'
                });
                var count = stub.callCount;
                stub.restore();
                count.should.equal(1);
                done();
            });

            it('should add internally calculated fields during update', function (done) {
                var mod = model('testModel');
                var stub = sinon.stub(mod, 'update');
                controller(mod).put({
                    params: {id: '1234567890'},
                    client: {clientId: 'clientTestId'},
                    body: { field1: 'bar' },
                    url: '/vtest/testdb/testcoll/1234567890'
                });
                stub.callCount.should.equal(1);
                var args = stub.getCall(0).args;
                args[1].field1.should.equal('bar');
                args[2].apiVersion.should.equal('vtest');
                args[2].lastModifiedAt.should.be.Number;
                args[2].lastModifiedBy.should.equal('clientTestId');
                should.not.exist(args[2].createdAt);

                stub.restore();
                done();
            });
        });

        describe('`delete` method', function () {
            it('should be accessible', function (done) {
                var mod = model('testModel', help.getModelSchema());
                controller(mod).delete.should.be.Function;
                done();
            });

            it('should call the Model\'s delete method', function (done) {
                var mod = model('testModel');
                var stub = sinon.stub(mod, 'delete');
                var req = {
                url: '/vtest/testdb/testModel',
                    params: { id: 'test123' }
                };

                controller(mod).delete(req);
                stub.callCount.should.equal(1);
                stub.restore();
                done();
            });
        });

        describe('`stats` method', function () {
          it('should be accessible', function (done) {
            var mod = model('testModel', help.getModelSchema());
            controller(mod).stats.should.be.Function;
            done();
          });

          it('should call the Model\'s stats method', function (done) {
            var mod = model('testModel', help.getModelSchema());
            var stub = sinon.stub(mod, 'stats');

            var req = {
              url: '/foo/bar'
            };

            controller(mod).stats(req);
            stub.callCount.should.equal(1);
            stub.restore();
            done();
          });
        });
    });
});
