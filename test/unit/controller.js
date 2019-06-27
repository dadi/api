const should = require('should')
const sinon = require('sinon')
const controller = require(__dirname + '/../../dadi/lib/controller/documents')
const model = require(__dirname + '/../../dadi/lib/model')
const cache = require(__dirname + '/../../dadi/lib/cache')
const help = require(__dirname + '/help')
const libHelp = require(__dirname + '/../../dadi/lib/help')
const config = require(__dirname + '/../../config')

describe('Controller', () => {
  before(() => {
    cache.reset()
  })

  it('should export constructor', () => {
    controller.Controller.should.be.Function
  })

  it('should export function that returns an instance', () => {
    controller.should.be.Function
    const mod = model('testModel', help.getModelSchema(), null, {
      database: 'testdb'
    })

    controller(mod).should.be.an.instanceOf(controller.Controller)
  })

  it('should attach a model to the controller', () => {
    const mod = model('testModel', help.getModelSchema(), null, {
      database: 'testdb'
    })

    controller(mod).model.should.equal(mod)
  })

  it('should throw if no model is passed to constructor', () => {
    controller.should.throw()
  })

  describe('instance', function() {
    describe('`get` method', function() {
      it('should be accessible', () => {
        const mod = model('testModel', help.getModelSchema(), null, {
          database: 'testdb'
        })

        controller(mod).get.should.be.Function
      })

      it("should call the Model's get method", () => {
        const mod = model('testModel', help.getModelSchema(), null, {
          database: 'testdb'
        })
        const stub = sinon.stub(mod, 'get').resolves({})
        const req = {
          params: {},
          url: '/foo/bar'
        }

        controller(mod).get(req)
        stub.callCount.should.equal(1)
        stub.restore()
      })

      it('should not strip unknown params from the query', () => {
        const mod = model('testModel', help.getModelSchema(), null, {
          database: 'testdb'
        })
        const stub = sinon.stub(mod, 'get').resolves({})
        const req = {
          params: {},
          url: '/foo/bar?filter={"fieldName":"test", "busted":56488}'
        }

        controller(mod).get(req)
        stub.callCount.should.equal(1)

        const queryParameters = stub.returnsArg(0).args[0][0].query

        queryParameters.fieldName.should.equal('test')
        should.exist(queryParameters.busted)

        stub.restore()
      })

      it('should allow querying for "null"', () => {
        const mod = model('testModel', help.getModelSchema(), null, {
          database: 'testdb'
        })
        const stub = sinon.stub(mod, 'get').resolves({})
        const req = {
          params: {},
          url: '/foo/bar?filter={"fieldName": null}'
        }

        controller(mod).get(req)
        stub.callCount.should.equal(1)

        const queryParameters = stub.returnsArg(0).args[0][0].query

        should.equal(queryParameters.fieldName, null)

        stub.restore()
      })

      it('should allow querying for "null" and other fields', () => {
        const schema = Object.assign({}, help.getModelSchema(), {
          field2: {
            type: 'String',
            label: 'Title',
            required: false
          }
        })
        const mod = model('testModel', schema, null, {database: 'testdb'})
        const stub = sinon.stub(mod, 'get').resolves({})
        const req = {
          params: {},
          url: '/foo/bar?filter={"fieldName": null, "field2": "xx"}'
        }

        controller(mod).get(req)
        stub.callCount.should.equal(1)

        const findArgs = stub.returnsArg(0).args[0][0]
        const queryParameters = stub.returnsArg(0).args[0][0].query

        should.equal(queryParameters.fieldName, null)
        queryParameters.field2.should.equal('xx')

        stub.restore()
      })

      it('should allow Mixed fields to be queried using `unknown` params', () => {
        const schema = Object.assign({}, help.getModelSchema(), {
          fieldMixed: {
            type: 'Mixed',
            label: 'Mixed Field',
            required: false,
            display: {index: true, edit: true}
          }
        })
        const mod = model('schemaTest', schema, null, {database: 'testdb'})
        const stub = sinon.stub(mod, 'get').resolves({})
        const req = {
          params: {},
          url: '/foo/bar?filter={"fieldMixed.innerProperty":"foo"}'
        }

        controller(mod).get(req)
        stub.callCount.should.equal(1)

        const queryParameters = stub.returnsArg(0).args[0][0].query

        queryParameters['fieldMixed.innerProperty'].should.equal('foo')

        stub.restore()
      })

      it('should not call find() if invalid skip option is provided', done => {
        const mod = model('testModel', help.getModelSchema(), null, {
          database: 'testdb'
        })
        const stub = sinon.stub(mod, 'get').resolves({})
        const req = {
          url: '/foo/bar?filter={"fieldName":"test"}&skip=-1',
          headers: {
            'accept-encoding': 'identity'
          }
        }
        const res = {
          setHeader: function setHeader(str1, str2) {},
          end: function end(body) {
            stub.restore()
            stub.callCount.should.equal(0)
            this.statusCode.should.eql(400)
            done()
          }
        }

        controller(mod).get(req, res, function() {})
      })

      it('should not call find() if invalid page option is provided', done => {
        const mod = model('testModel', help.getModelSchema(), null, {
          database: 'testdb'
        })
        const stub = sinon.stub(mod, 'get').resolves({})
        const req = {
          url: '/foo/bar?filter={"fieldName":"test"}&page=-1',
          headers: {
            'accept-encoding': 'identity'
          }
        }
        const res = {
          setHeader: function setHeader(str1, str2) {},
          end: function end(body) {
            stub.restore()
            stub.callCount.should.equal(0)
            this.statusCode.should.eql(400)
            done()
          }
        }

        controller(mod).get(req, res, function() {})
      })

      it('should not pass apiVersion in query if not configured', () => {
        const configCache = config.get('query.useVersionFilter')

        config.set('query.useVersionFilter', false)

        const settings = Object.assign({}, help.getModelSettings(), {
          database: 'testdb'
        })
        const mod = model(
          'testModel',
          help.getModelSchemaWithMultipleFields(),
          null,
          settings
        )
        const stub = sinon.stub(mod, 'get').resolves({})
        const req = {
          params: {},
          url: '/v1/bar'
        }

        controller(mod).get(req)
        stub.restore()
        config.set('query.useVersionFilter', configCache)

        stub.callCount.should.equal(1)

        const queryParameters = stub.returnsArg(0).args[0][0].query

        should.not.exist(queryParameters._apiVersion)
      })

      it('should pass apiVersion in query if configured', () => {
        const configCache = config.get('query.useVersionFilter')

        config.set('query.useVersionFilter', true)

        const settings = Object.assign({}, help.getModelSettings(), {
          database: 'testdb'
        })
        const mod = model(
          'testModel',
          help.getModelSchemaWithMultipleFields(),
          null,
          settings
        )
        const stub = sinon.stub(mod, 'get').resolves({})
        const req = {
          params: {},
          url: '/v1/bar'
        }

        controller(mod).get(req)
        stub.restore()
        config.set('query.useVersionFilter', configCache)

        stub.callCount.should.equal(1)

        const queryParameters = stub.returnsArg(0).args[0][0].query

        queryParameters._apiVersion.should.equal('v1')
      })

      it("should pass model's default filters to the find query", () => {
        const settings = Object.assign({}, help.getModelSettings(), {
          database: 'testdb',
          defaultFilters: {field1: 'xxx'}
        })
        const mod = model(
          'testModel',
          help.getModelSchemaWithMultipleFields(),
          null,
          settings
        )
        const stub = sinon.stub(mod, 'get').resolves({})
        const req = {
          params: {},
          url: '/foo/bar'
        }

        controller(mod).get(req)
        stub.callCount.should.equal(1)

        const queryParameters = stub.returnsArg(0).args[0][0].query

        queryParameters.field1.should.equal('xxx')

        stub.restore()
      })

      it("should pass model's default fields to the find query", () => {
        const settings = Object.assign({}, help.getModelSettings(), {
          database: 'testdb',
          fieldLimiters: {field1: 1}
        })
        const mod = model(
          'testModel',
          help.getModelSchemaWithMultipleFields(),
          null,
          settings
        )
        const stub = sinon.stub(mod, 'get').resolves({})
        const req = {
          params: {},
          url: '/foo/bar'
        }

        controller(mod).get(req)

        stub.callCount.should.equal(1)

        const options = stub.returnsArg(0).args[0][0].options

        options.fields.field1.should.equal(1)

        stub.restore()
      })

      it('should send response', done => {
        const mod = model('testModel')
        const req = {
          params: {},
          url: '/foo/bar'
        }
        const res = {
          end(chunk) {
            done()
          },
          setHeader() {}
        }

        controller(mod).get(req, res, function() {})
      })
    })

    describe('`post` method', function() {
      it('should be accessible', () => {
        const mod = model('testModel', help.getModelSchema(), null, {
          database: 'testdb'
        })

        controller(mod).post.should.be.Function
      })

      it("should call the Model's create method", () => {
        const mod = model('testModel', help.getModelSchema(), null, {
          database: 'testdb'
        })
        const stub = sinon.stub(mod, 'create').resolves({})

        sinon.stub(libHelp, 'clearCache').callsFake(pathname => {
          pathname.should.be.String
        })

        controller(mod).post({
          params: {},
          body: {field1: 'foo'},
          url: '/vtest/testdb/testcoll'
        })

        const count = stub.callCount

        libHelp.clearCache.restore()
        stub.restore()
        count.should.equal(1)
      })

      it('should add internally calculated fields during create', () => {
        const mod = model('testModel', help.getModelSchema(), null, {
          database: 'testdb'
        })
        const stub = sinon.stub(mod, 'create').resolves({})

        sinon.stub(libHelp, 'clearCache').callsFake(pathname => {
          pathname.should.be.String
        })

        controller(mod).post({
          params: {},
          dadiApiClient: {clientId: 'clientTestId'},
          body: {field1: 'foo'},
          url: '/vtest/testdb/testcoll'
        })

        const count = stub.callCount
        const args = stub.getCall(0).args[0]

        stub.restore()
        libHelp.clearCache.restore()

        count.should.equal(1)
        args.documents.field1.should.equal('foo')
        args.internals._apiVersion.should.equal('vtest')
        args.internals._createdBy.should.equal('clientTestId')
      })
    })

    describe('`put` method', () => {
      it('should be accessible', () => {
        const mod = model('testModel', help.getModelSchema(), null, {
          database: 'testdb'
        })

        controller(mod).put.should.be.Function
      })

      it("should call the Model's update method", () => {
        const mod = model('testModel', help.getModelSchema(), null, {
          database: 'testdb'
        })
        const stub = sinon.stub(mod, 'update').resolves({})

        sinon.stub(libHelp, 'clearCache').callsFake(pathname => {
          pathname.should.be.String
        })

        controller(mod).put({
          params: {id: '1234567890'},
          body: {field1: 'foo'},
          url: '/vtest/testdb/testcoll'
        })

        const count = stub.callCount

        stub.restore()
        libHelp.clearCache.restore()

        count.should.equal(1)
      })

      it('should add internally calculated fields during update', () => {
        const mod = model('testModel', help.getModelSchema(), null, {
          database: 'testdb'
        })
        const stub = sinon.stub(mod, 'update').resolves({})

        sinon.stub(libHelp, 'clearCache').callsFake(pathname => {
          pathname.should.be.String
        })

        controller(mod).put({
          params: {id: '1234567890'},
          dadiApiClient: {clientId: 'clientTestId'},
          body: {field1: 'bar'},
          url: '/vtest/testdb/testcoll/1234567890'
        })

        stub.callCount.should.equal(1)

        const args = stub.getCall(0).args[0]

        args.query._id.should.equal('1234567890')
        args.update.field1.should.equal('bar')
        args.internals._apiVersion.should.equal('vtest')
        args.internals._lastModifiedBy.should.equal('clientTestId')

        stub.restore()
        libHelp.clearCache.restore()
      })
    })

    describe('`delete` method', function() {
      it('should be accessible', () => {
        const mod = model('testModel', help.getModelSchema(), null, {
          database: 'testdb'
        })

        controller(mod).delete.should.be.Function
      })

      it("should call the Model's delete method", () => {
        const mod = model('testModel', help.getModelSchema(), null, {
          database: 'testdb'
        })
        const stub = sinon.stub(mod, 'delete').resolves({})

        const req = {
          url: '/vtest/testdb/testModel',
          params: {id: 'test123'}
        }

        sinon.stub(libHelp, 'clearCache').callsFake(pathname => {
          pathname.should.eql(req.url)
        })

        controller(mod).delete(req)

        stub.callCount.should.equal(1)

        stub.restore()
        libHelp.clearCache.restore()
      })
    })

    describe('`stats` method', function() {
      it('should be accessible', () => {
        const mod = model('testModel', help.getModelSchema(), null, {
          database: 'testdb'
        })

        controller(mod).stats.should.be.Function
      })

      it("should call the Model's stats method", () => {
        const mod = model('testModel', help.getModelSchema(), null, {
          database: 'testdb'
        })
        const stub = sinon.stub(mod, 'getStats').resolves({})
        const req = {
          method: 'get',
          url: '/foo/bar'
        }

        controller(mod).stats(req)
        stub.callCount.should.equal(1)
        stub.restore()
      })
    })
  })
})
