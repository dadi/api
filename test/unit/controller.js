const should = require('should')
const sinon = require('sinon')
const controller = require(__dirname + '/../../dadi/lib/controller/collection')
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
    let mod = model(
      'testModel',
      help.getModelSchema(),
      null,
      { database: 'testdb' }
    )

    controller(mod).should.be.an.instanceOf(controller.Controller)
  })

  it('should attach a model to the controller', () => {
    let mod = model(
      'testModel',
      help.getModelSchema(),
      null,
      { database: 'testdb' }
    )

    controller(mod).model.should.equal(mod)
  })

  it('should throw if no model is passed to constructor', () => {
    controller.should.throw()
  })

  describe('instance', function () {
    describe('`get` method', function () {
      it('should be accessible', () => {
        let mod = model(
          'testModel',
          help.getModelSchema(),
          null,
          { database: 'testdb' }
        )

        controller(mod).get.should.be.Function
      })

      it('should call the Model\'s get method', () => {
        let mod = model(
          'testModel',
          help.getModelSchema(),
          null,
          { database: 'testdb' }
        )
        let stub = sinon.stub(mod, 'get').resolves({})
        let req = {
          url: '/foo/bar'
        }

        controller(mod).get(req)
        stub.callCount.should.equal(1)
        stub.restore()
      })

      it('should strip unknown params from the query', () => {
        let mod = model(
          'testModel',
          help.getModelSchema(),
          null,
          { database: 'testdb' }
        )
        let stub = sinon.stub(mod, 'get').resolves({})
        let req = {
          url: '/foo/bar?filter={"fieldName":"test", "busted":56488}'
        }

        controller(mod).get(req)
        stub.callCount.should.equal(1)

        let queryParameters = stub.returnsArg(0).args[0][0].query

        queryParameters.fieldName.should.equal('test')
        should.not.exist(queryParameters.busted)

        stub.restore()
      })

      it('should allow querying for "null"', () => {
        let mod = model(
          'testModel',
          help.getModelSchema(),
          null,
          { database: 'testdb' }
        )
        let stub = sinon.stub(mod, 'get').resolves({})
        let req = {
          url: '/foo/bar?filter={"fieldName": null}'
        }

        controller(mod).get(req)
        stub.callCount.should.equal(1)

        let queryParameters = stub.returnsArg(0).args[0][0].query

        should.equal(queryParameters.fieldName, null)

        stub.restore()
      })

      it('should allow querying for "null" and other fields', () => {
        let schema = Object.assign({}, help.getModelSchema(), {
          field2: {
            'type': 'String',
            'label': 'Title',
            'required': false
          }
        })
        let mod = model(
          'testModel',
          schema,
          null,
          { database: 'testdb' }
        )
        let stub = sinon.stub(mod, 'get').resolves({})
        let req = {
          url: '/foo/bar?filter={"fieldName": null, "field2": "xx"}'
        }

        controller(mod).get(req)
        stub.callCount.should.equal(1)

        let findArgs = stub.returnsArg(0).args[0][0]
        let queryParameters = stub.returnsArg(0).args[0][0].query

        should.equal(queryParameters.fieldName, null)
        queryParameters.field2.should.equal('xx')

        stub.restore()
      })

      it('should allow Mixed fields to be queried using `unknown` params', () => {
        let schema = Object.assign({}, help.getModelSchema(), {
          fieldMixed: {
            type: 'Mixed',
            label: 'Mixed Field',
            required: false,
            display: { index: true, edit: true }
          }
        })
        let mod = model('schemaTest', schema, null, { database: 'testdb' })
        let stub = sinon.stub(mod, 'get').resolves({})
        let req = {
          url: '/foo/bar?filter={"fieldMixed.innerProperty":"foo"}'
        }

        controller(mod).get(req)
        stub.callCount.should.equal(1)

        let queryParameters = stub.returnsArg(0).args[0][0].query
        queryParameters['fieldMixed.innerProperty'].should.equal('foo')

        stub.restore()
      })

      it('should not call find() if invalid skip option is provided', () => {
        let mod = model(
          'testModel',
          help.getModelSchema(),
          null,
          { database: 'testdb' }
        )
        let stub = sinon.stub(mod, 'get').resolves({})
        let req = {
          url: '/foo/bar?filter={"fieldName":"test"}&skip=-1'
        }
        let res = {
          setHeader: function setHeader (str1, str2) {
          },
          end: function end (body) {
            this.body = body
          }
        }

        res.body = ''
        res.statusCode = 200

        controller(mod).get(req, res, {})

        stub.restore()
        stub.callCount.should.equal(0)
        res.statusCode.should.eql(400)
      })

      it('should not call find() if invalid page option is provided', () => {
        let mod = model(
          'testModel',
          help.getModelSchema(),
          null,
          { database: 'testdb' }
        )
        let stub = sinon.stub(mod, 'get').resolves({})
        let req = {
          url: '/foo/bar?filter={"fieldName":"test"}&page=-1'
        }
        let res = {
          setHeader: function setHeader (str1, str2) {
          },
          end: function end (body) {
            this.body = body
          }
        }

        res.body = ''
        res.statusCode = 200

        controller(mod).get(req, res, {})

        stub.restore()
        stub.callCount.should.equal(0)
        res.statusCode.should.eql(400)
      })

      it('should not pass apiVersion in query if not configured', () => {
        const configCache = config.get('query.useVersionFilter')
        config.set('query.useVersionFilter', false)

        let settings = Object.assign({}, help.getModelSettings(), {
          database: 'testdb'
        })
        let mod = model(
          'testModel',
          help.getModelSchemaWithMultipleFields(),
          null,
          settings
        )
        let stub = sinon.stub(mod, 'get').resolves({})
        let req = {
          url: '/v1/bar'
        }

        controller(mod).get(req)
        stub.restore()
        config.set('query.useVersionFilter', configCache)

        stub.callCount.should.equal(1)

        let queryParameters = stub.returnsArg(0).args[0][0].query
        should.not.exist(queryParameters._apiVersion)
      })

      it('should pass apiVersion in query if configured', () => {
        const configCache = config.get('query.useVersionFilter')
        config.set('query.useVersionFilter', true)

        let settings = Object.assign({}, help.getModelSettings(), {
          database: 'testdb'
        })
        let mod = model(
          'testModel',
          help.getModelSchemaWithMultipleFields(),
          null,
          settings
        )
        let stub = sinon.stub(mod, 'get').resolves({})
        let req = {
          url: '/v1/bar'
        }

        controller(mod).get(req)
        stub.restore()
        config.set('query.useVersionFilter', configCache)

        stub.callCount.should.equal(1)

        let queryParameters = stub.returnsArg(0).args[0][0].query
        queryParameters._apiVersion.should.equal('v1')
      })

      it('should pass model\'s default filters to the find query', () => {
        let settings = Object.assign({}, help.getModelSettings(), {
          database: 'testdb',
          defaultFilters: { 'field1': 'xxx' }
        })
        let mod = model(
          'testModel',
          help.getModelSchemaWithMultipleFields(),
          null,
          settings
        )
        let stub = sinon.stub(mod, 'get').resolves({})
        let req = {
          url: '/foo/bar'
        }

        controller(mod).get(req)
        stub.callCount.should.equal(1)

        let queryParameters = stub.returnsArg(0).args[0][0].query
        queryParameters.field1.should.equal('xxx')

        stub.restore()
      })

      it('should pass model\'s default fields to the find query', () => {
        let settings = Object.assign({}, help.getModelSettings(), {
          database: 'testdb',
          fieldLimiters: { 'field1': 1 }
        })
        let mod = model(
          'testModel',
          help.getModelSchemaWithMultipleFields(),
          null,
          settings
        )
        let stub = sinon.stub(mod, 'get').resolves({})
        let req = {
          url: '/foo/bar'
        }

        controller(mod).get(req)

        stub.callCount.should.equal(1)

        let options = stub.returnsArg(0).args[0][0].options
        options.fields.field1.should.equal(1)

        stub.restore()
      })

      it('should send response', () => {
        let mod = model('testModel')
        let req = {
          url: '/foo/bar'
        }
        let res = {
          end: function (chunk) {
            done()
          },
          setHeader: function () {}
        }

        controller(mod).get(req, res)
      })
    })

    describe('`post` method', function () {
      it('should be accessible', () => {
        let mod = model(
          'testModel',
          help.getModelSchema(),
          null,
          { database: 'testdb' }
        )

        controller(mod).post.should.be.Function
      })

      it('should call the Model\'s create method', () => {
        let mod = model(
          'testModel',
          help.getModelSchema(),
          null,
          { database: 'testdb' }
        )
        let stub = sinon.stub(mod, 'create').resolves({})
        sinon.stub(libHelp, 'clearCache').callsFake((pathname, callback) => {
          return callback(null)
        })

        controller(mod).post({
          params: {},
          body: { field1: 'foo' },
          url: '/vtest/testdb/testcoll'
        })

        let count = stub.callCount
        libHelp.clearCache.restore()
        stub.restore()
        count.should.equal(1)
      })

      it('should add internally calculated fields during create', () => {
        let mod = model(
          'testModel',
          help.getModelSchema(),
          null,
          { database: 'testdb' }
        )
        let stub = sinon.stub(mod, 'create').resolves({})
        sinon.stub(libHelp, 'clearCache').callsFake((pathname, callback) => {
          return callback(null)
        })

        controller(mod).post({
          params: {},
          dadiApiClient: {clientId: 'clientTestId'},
          body: { field1: 'foo' },
          url: '/vtest/testdb/testcoll'
        })

        let count = stub.callCount
        let args = stub.getCall(0).args[0]

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
        let mod = model(
          'testModel',
          help.getModelSchema(),
          null,
          { database: 'testdb' }
        )

        controller(mod).put.should.be.Function
      })

      it('should call the Model\'s update method', () => {
        let mod = model(
          'testModel',
          help.getModelSchema(),
          null,
          { database: 'testdb' }
        )
        let stub = sinon.stub(mod, 'update').resolves({})
        sinon.stub(libHelp, 'clearCache').callsFake((pathname, callback) => {
          return callback(null)
        })

        controller(mod).put({
          params: { id: '1234567890'},
          body: { field1: 'foo' },
          url: '/vtest/testdb/testcoll'
        })

        let count = stub.callCount
        stub.restore()
        libHelp.clearCache.restore()

        count.should.equal(1)
      })

      it('should add internally calculated fields during update', () => {
        let mod = model(
          'testModel',
          help.getModelSchema(),
          null,
          { database: 'testdb' }
        )
        let stub = sinon.stub(mod, 'update').resolves({})
        sinon.stub(libHelp, 'clearCache').callsFake((pathname, callback) => {
          return callback(null)
        })

        controller(mod).put({
          params: {id: '1234567890'},
          dadiApiClient: {clientId: 'clientTestId'},
          body: { field1: 'bar' },
          url: '/vtest/testdb/testcoll/1234567890'
        })

        stub.callCount.should.equal(1)

        let args = stub.getCall(0).args[0]

        args.query._id.should.equal('1234567890')
        args.update.field1.should.equal('bar')
        args.internals._apiVersion.should.equal('vtest')
        args.internals._lastModifiedBy.should.equal('clientTestId')

        stub.restore()
        libHelp.clearCache.restore()
      })
    })

    describe('`delete` method', function () {
      it('should be accessible', () => {
        let mod = model(
          'testModel',
          help.getModelSchema(),
          null,
          { database: 'testdb' }
        )

        controller(mod).delete.should.be.Function
      })

      it('should call the Model\'s delete method', () => {
        let mod = model(
          'testModel',
          help.getModelSchema(),
          null,
          { database: 'testdb' }
        )
        let stub = sinon.stub(mod, 'delete').resolves({})

        sinon.stub(libHelp, 'clearCache').callsFake((pathname, callback) => {
          return callback(null)
        })

        let req = {
          url: '/vtest/testdb/testModel',
          params: { id: 'test123' }
        }

        controller(mod).delete(req)

        stub.callCount.should.equal(1)

        stub.restore()
        libHelp.clearCache.restore()
      })
    })

    describe('`stats` method', function () {
      it('should be accessible', () => {
        let mod = model(
          'testModel',
          help.getModelSchema(),
          null,
          { database: 'testdb' }
        )

        controller(mod).stats.should.be.Function
      })

      it('should call the Model\'s stats method', () => {
        let mod = model(
          'testModel',
          help.getModelSchema(),
          null,
          { database: 'testdb' }
        )
        let stub = sinon.stub(mod, 'getStats').resolves({})
        let req = {
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
