var should = require('should');
var sinon = require('sinon');
var controller = require(__dirname + '/../../bantam/lib/controller');
var model = require(__dirname + '/../../bantam/lib/model');
var help = require(__dirname + '/help');

describe('Controller', function (done) {
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
                stub.callCount.should.equal(1);
                stub.restore();
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
                stub.callCount.should.equal(1);
                var args = stub.getCall(0).args;
                args[0].field1.should.equal('foo');
                args[1].apiVersion.should.equal('vtest');
                args[1].createdAt.should.be.Number;
                args[1].createdBy.should.equal('clientTestId');

                stub.restore();
                done();
            });

            it('should add internally calculated fields during update', function (done) {
                var mod = model('testModel');
                var stub = sinon.stub(mod, 'update');
                controller(mod).post({
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
    });
});
