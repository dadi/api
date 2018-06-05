const app = require('./../../../dadi/lib')
const config = require('./../../../config')
const help = require('./../help')
const request = require('supertest')
const should = require('should')

require('it-each')({ testPerIteration: true })

function getClient () {
  return request(`http://${config.get('server.host')}:${config.get('server.port')}`)
}

describe('Collections API', () => {
  let configBackup = config.get()

  before(done => {
    app.start(err => {
      if (err) return done(err)

      setTimeout(done, 300)
    })
  })

  beforeEach(done => {
    // Before each test, clear ACL, create a dummy document, clear ACL
    help.removeACLData(() => {
      let creatingClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: { 'collection:testdb_test-schema': PERMISSIONS.CREATE }
      }

      help.createACLClient(creatingClient).then(() => {
        let client = getClient()
        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(creatingClient)
        .end((err, res) => {
          help.createDocWithParams(res.body.accessToken, { 'field1': '7', 'title': 'test doc' }, (err, doc) => {
            help.removeACLData(done)
          })
        })
      })
    })
  })

  after(done => {
    help.removeACLData(() => {
      app.stop(done)
    })
  })

  let PERMISSIONS = {
    ALL: { create: true, read: true, update: true, delete: true },
    NO_READ: { read: false },
    CREATE: { create: true, read: false, update: false, delete: false },
    READ: { create: false, read: true, update: false, delete: false },
    UPDATE: { create: false, read: false, update: true, delete: false },
    DELETE: { create: false, read: false, update: false, delete: true },
    READ_EXCLUDE_FIELDS: { read: { fields: { title: 0 } } }
  }

  let tests = [
    {
      method: 'GET',
      description: 'should return 403 with no permissions',
      expectedStatusCode: 403,
      resources: { 'collection:testdb_test-schema': {} }
    },
    {
      method: 'GET',
      description: 'should return 403 with no read permission',
      expectedStatusCode: 403,
      resources: { 'collection:testdb_test-schema': PERMISSIONS.NO_READ }
    },
    {
      method: 'GET',
      description: 'should return 200 with read permission',
      expectedStatusCode: 200,
      resources: { 'collection:testdb_test-schema': PERMISSIONS.READ }
    },
    {
      method: 'GET',
      description: 'should return 200 with create,read,update,delete permission',
      expectedStatusCode: 200,
      resources: { 'collection:testdb_test-schema': PERMISSIONS.ALL }
    },
    {
      method: 'GET',
      description: 'should return 200 with read permission and a field excluded',
      expectedStatusCode: 200,
      params: {
        fields: JSON.stringify({ field1: 1, title: 1 })
      },
      resources: {
        'collection:testdb_test-schema': PERMISSIONS.READ_EXCLUDE_FIELDS
      },
      testFn: function (data) {
        return typeof data[0].title === 'undefined'
      }
    },
    {
      method: 'POST',
      description: 'should return 400 with invalid payload',
      payload: { fieldOne: 'fieldValue', title: 'title' },
      expectedStatusCode: 400,
      resources: { 'collection:testdb_test-schema': PERMISSIONS.CREATE }
    },
    {
      method: 'POST',
      description: 'should return 403 with no create permission',
      payload: { field1: 'fieldValue', title: 'title' },
      expectedStatusCode: 403,
      resources: { 'collection:testdb_test-schema': PERMISSIONS.READ }
    },
    {
      method: 'POST',
      description: 'should return 200 with create permission',
      payload: { field1: 'fieldValue', title: 'title' },
      expectedStatusCode: 200,
      resources: { 'collection:testdb_test-schema': PERMISSIONS.CREATE }
    },
    {
      method: 'PUT',
      description: 'should return 403 with no update permission',
      payload: { field1: 'fieldValue', title: 'title' },
      expectedStatusCode: 403,
      resources: { 'collection:testdb_test-schema': PERMISSIONS.READ }
    },
    {
      method: 'PUT',
      description: 'should return 200 with all permissions',
      payload: { query: { field1: '7' }, update: { title: 'updated title' } },
      expectedStatusCode: 200,
      resources: { 'collection:testdb_test-schema': PERMISSIONS.ALL }
    },
    {
      method: 'PUT',
      description: 'should return 200 with update permissions',
      payload: { query: { field1: '7' }, update: { title: 'updated title' } },
      expectedStatusCode: 200,
      resources: { 'collection:testdb_test-schema': PERMISSIONS.UPDATE }
    },
    {
      method: 'DELETE',
      description: 'should return 403 with no delete permission',
      payload: { query: { field1: 'fieldValue' } },
      expectedStatusCode: 403,
      resources: { 'collection:testdb_test-schema': PERMISSIONS.READ }
    },
    {
      method: 'DELETE',
      description: 'should return 204 with delete permission',
      payload: { query: { field1: '7' } },
      expectedStatusCode: 204,
      resources: { 'collection:testdb_test-schema': PERMISSIONS.DELETE }
    }
  ]

  it.each(tests, '', ['method', 'description'], function (element, next) {
    performTest(element)
    .then(() => {
      next()
    })
    .catch(err => {
      next(err)
    })
  })

  function performTest (test) {
    return new Promise((resolve, reject) => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: test.resources
      }

      return help.createACLClient(testClient).then(() => {
        let client = getClient()

        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(testClient)
        .expect(200)
        .end((err, res) => {
          if (err) return reject(err)

          let bearerToken = res.body.accessToken

          if (test.method === 'GET') {
            let params = Object.assign({}, { cache: false }, test.params ? test.params : {})
            params = require('querystring').stringify(params)

            client = getClient().get(`${(test.endpoint || '/vtest/testdb/test-schema/')}?${params}`)
          } else if (test.method === 'POST') {
            client = getClient()
            .post((test.endpoint || '/vtest/testdb/test-schema/'))
            .send(test.payload)
          } else if (test.method === 'PUT') {
            client = getClient()
            .put((test.endpoint || '/vtest/testdb/test-schema/'))
            .send(test.payload)
          } else if (test.method === 'DELETE') {
            client = getClient()
            .delete((test.endpoint || '/vtest/testdb/test-schema/'))
            .send(test.payload)
          }

          client
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .end((err, res) => {
            if (err) return reject(err)

            res.statusCode.should.eql(test.expectedStatusCode)

            if (test.testFn) {
              let result = test.testFn(res.body.results)
              result.should.eql(true)
            }

            return resolve()
          })
        })
      })
    })
  }
})
