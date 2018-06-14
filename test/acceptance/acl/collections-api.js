const app = require('./../../../dadi/lib')
const config = require('./../../../config')
const help = require('./../help')
const request = require('supertest')
const should = require('should')

const PERMISSIONS = {
  ALL: { create: true, read: true, update: true, delete: true },
  NO_READ: { read: false },
  CREATE: { create: true, read: false, update: false, delete: false },
  READ: { create: false, read: true, update: false, delete: false },
  UPDATE: { create: false, read: false, update: true, delete: false },
  DELETE: { create: false, read: false, update: false, delete: true },
  READ_EXCLUDE_FIELDS: { read: { fields: { title: 0 } } },
  NO_FILTER: { filter: { } },
  FILTER: { read: { filter: { title: 'very long title' } } }
}

let client = request(`http://${config.get('server.host')}:${config.get('server.port')}`)
let docs

describe('Collections API', () => {
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
        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(creatingClient)
        .end((err, res) => {
          help.dropDatabase('testdb', 'test-schema', () => {
            help.createDocWithParams(res.body.accessToken, { 'field1': '7', 'title': 'test doc' }, (err, doc1) => {
              help.createDocWithParams(res.body.accessToken, { 'field1': '11', 'title': 'very long title' }, (err, doc2) => {
                docs = [doc1._id, doc2._id]

                help.removeACLData(done)
              })
            })
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

  describe('GET', function () {
    it('should return 403 with no permissions', function (done) {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: { 'collection:testdb_test-schema': {} }
      }

      help.createACLClient(testClient).then(() => {
        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(testClient)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          let bearerToken = res.body.accessToken

          client
          .get(`/vtest/testdb/test-schema`)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .end((err, res) => {
            if (err) return done(err)
            res.statusCode.should.eql(403)
            done()
          })
        })
      })
    })

    it('should return 403 with no read permission', function (done) {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: { 'collection:testdb_test-schema': PERMISSIONS.NO_READ }
      }

      help.createACLClient(testClient).then(() => {
        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(testClient)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          let bearerToken = res.body.accessToken

          client
          .get(`/vtest/testdb/test-schema`)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .end((err, res) => {
            if (err) return done(err)
            res.statusCode.should.eql(403)
            done()
          })
        })
      })
    })

    it('should return 200 with read permission', function (done) {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: { 'collection:testdb_test-schema': PERMISSIONS.READ }
      }

      help.createACLClient(testClient).then(() => {
        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(testClient)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          let bearerToken = res.body.accessToken

          client
          .get(`/vtest/testdb/test-schema`)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .end((err, res) => {
            if (err) return done(err)
            res.statusCode.should.eql(200)
            done()
          })
        })
      })
    })

    it('should return 200 with create,read,update,delete permission', function (done) {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: { 'collection:testdb_test-schema': PERMISSIONS.ALL }
      }

      help.createACLClient(testClient).then(() => {
        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(testClient)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          let bearerToken = res.body.accessToken

          client
          .get(`/vtest/testdb/test-schema`)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .end((err, res) => {
            if (err) return done(err)
            res.statusCode.should.eql(200)
            done()
          })
        })
      })
    })

    it('should return 200 with read permission and a field excluded', function (done) {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: { 'collection:testdb_test-schema': PERMISSIONS.READ_EXCLUDE_FIELDS }
      }

      let params = {
        fields: JSON.stringify({ field1: 1, title: 1 })
      }

      help.createACLClient(testClient).then(() => {
        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(testClient)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          let bearerToken = res.body.accessToken
          let query = require('querystring').stringify(params)

          client
          .get(`/vtest/testdb/test-schema/?${query}`)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .end((err, res) => {
            if (err) return done(err)
            res.statusCode.should.eql(200)

            let type = typeof res.body.results[0].title
            type.should.eql('undefined')

            done()
          })
        })
      })
    })

    it('should return 403 with an empty filter permission', function (done) {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: { 'collection:testdb_test-schema': PERMISSIONS.NO_FILTER }
      }

      let params = {
        filter: JSON.stringify({ title: { '$ne': 'xyz' } })
      }

      help.createACLClient(testClient).then(() => {
        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(testClient)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          let bearerToken = res.body.accessToken
          let query = require('querystring').stringify(params)

          client
          .get(`/vtest/testdb/test-schema/?${query}`)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .end((err, res) => {
            if (err) return done(err)
            res.statusCode.should.eql(403)

            done()
          })
        })
      })
    })

    it('should return 200 with a filter permission', function (done) {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: { 'collection:testdb_test-schema': PERMISSIONS.FILTER }
      }

      let params = {
        filter: JSON.stringify({ title: 'very long title' })
      }

      help.createACLClient(testClient).then(() => {
        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(testClient)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          let bearerToken = res.body.accessToken
          let query = require('querystring').stringify(params)

          client
          .get(`/vtest/testdb/test-schema/?${query}`)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .end((err, res) => {
            if (err) return done(err)
            res.statusCode.should.eql(200)

            let allCorrect = res.body.results.every(record => {
              return record.title === 'very long title'
            })

            allCorrect.should.eql(true)

            done()
          })
        })
      })
    })

    it('should return 200 with a result set with results from the filter permission, even when no query is supplied', function (done) {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: { 'collection:testdb_test-schema': PERMISSIONS.FILTER }
      }

      let params = {
        filter: JSON.stringify({})
      }

      help.createACLClient(testClient).then(() => {
        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(testClient)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          let bearerToken = res.body.accessToken
          let query = require('querystring').stringify(params)

          client
          .get(`/vtest/testdb/test-schema/?${query}`)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .end((err, res) => {
            if (err) return done(err)
            res.statusCode.should.eql(200)

            res.body.results.length.should.be.above(0)

            let allCorrect = res.body.results.every(record => {
              return record.title === 'very long title'
            })

            allCorrect.should.eql(true)

            done()
          })
        })
      })
    })

    it('should return 200 with an empty result set when the query differs from the filter permission', function (done) {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: { 'collection:testdb_test-schema': PERMISSIONS.FILTER }
      }

      let params = {
        filter: JSON.stringify({ title: 'test doc' })
      }

      help.createACLClient(testClient).then(() => {
        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(testClient)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          let bearerToken = res.body.accessToken
          let query = require('querystring').stringify(params)

          client
          .get(`/vtest/testdb/test-schema/?${query}`)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .end((err, res) => {
            if (err) return done(err)
            res.statusCode.should.eql(200)

            res.body.results.length.should.eql(0)

            done()
          })
        })
      })
    })
  })

  describe('POST', function () {
    it('should return 400 with invalid payload', function (done) {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: { 'collection:testdb_test-schema': PERMISSIONS.CREATE }
      }

      let payload = { fieldOne: 'fieldValue', title: 'title' }

      help.createACLClient(testClient).then(() => {
        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(testClient)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          let bearerToken = res.body.accessToken

          client
          .post(`/vtest/testdb/test-schema/`)
          .send(payload)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .end((err, res) => {
            if (err) return done(err)
            res.statusCode.should.eql(400)
            done()
          })
        })
      })
    })

    it('should return 403 with no create permission', function (done) {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: { 'collection:testdb_test-schema': PERMISSIONS.READ }
      }

      let payload = { field1: 'fieldValue', title: 'title' }

      help.createACLClient(testClient).then(() => {
        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(testClient)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          let bearerToken = res.body.accessToken

          client
          .post(`/vtest/testdb/test-schema/`)
          .send(payload)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .end((err, res) => {
            if (err) return done(err)
            res.statusCode.should.eql(403)
            done()
          })
        })
      })
    })

    it('should return 200 with create permission', function (done) {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: { 'collection:testdb_test-schema': PERMISSIONS.CREATE }
      }

      let payload = { field1: 'fieldValue', title: 'title' }

      help.createACLClient(testClient).then(() => {
        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(testClient)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          let bearerToken = res.body.accessToken

          client
          .post(`/vtest/testdb/test-schema/`)
          .send(payload)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .end((err, res) => {
            if (err) return done(err)
            res.statusCode.should.eql(200)
            done()
          })
        })
      })
    })
  })

  describe('PUT', function () {
    it('should return 403 with no update permission (query in body)', function (done) {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: { 'collection:testdb_test-schema': PERMISSIONS.READ }
      }

      let payload = { query: { field1: '7' }, update: { title: 'updated title' } }

      help.createACLClient(testClient).then(() => {
        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(testClient)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          let bearerToken = res.body.accessToken

          client
          .put(`/vtest/testdb/test-schema/`)
          .send(payload)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .end((err, res) => {
            if (err) return done(err)
            res.statusCode.should.eql(403)
            done()
          })
        })
      })
    })

    it('should return 403 with no update permission (querying by ID)', function (done) {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: { 'collection:testdb_test-schema': PERMISSIONS.READ }
      }

      let update = { title: 'updated title' }

      help.createACLClient(testClient).then(() => {
        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(testClient)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          let bearerToken = res.body.accessToken

          client
          .put(`/vtest/testdb/test-schema/${docs[0]}`)
          .send(update)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .end((err, res) => {
            if (err) return done(err)
            res.statusCode.should.eql(403)
            done()
          })
        })
      })
    })    

    it('should return 200 with all permissions (query in body)', function (done) {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: { 'collection:testdb_test-schema': PERMISSIONS.ALL }
      }

      let payload = { query: { field1: '7' }, update: { title: 'updated title' } }

      help.createACLClient(testClient).then(() => {
        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(testClient)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          let bearerToken = res.body.accessToken

          client
          .put(`/vtest/testdb/test-schema/`)
          .send(payload)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .end((err, res) => {
            if (err) return done(err)
            res.statusCode.should.eql(200)
            done()
          })
        })
      })
    })

    it('should return 200 with all permissions (query by ID)', function (done) {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: { 'collection:testdb_test-schema': PERMISSIONS.ALL }
      }

      let update = { title: 'updated title' }

      help.createACLClient(testClient).then(() => {
        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(testClient)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          let bearerToken = res.body.accessToken

          client
          .put(`/vtest/testdb/test-schema/${docs[0]}`)
          .send(update)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .end((err, res) => {
            if (err) return done(err)

            res.statusCode.should.eql(200)
            res.body.results.length.should.eql(1)
            res.body.results[0].title.should.eql(update.title)

            done()
          })
        })
      })
    })    

    it('should return 200 with update permissions (query in body)', function (done) {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: { 'collection:testdb_test-schema': PERMISSIONS.UPDATE }
      }

      let payload = { query: { field1: '7' }, update: { title: 'updated title' } }

      help.createACLClient(testClient).then(() => {
        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(testClient)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          let bearerToken = res.body.accessToken

          client
          .put(`/vtest/testdb/test-schema/`)
          .send(payload)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .end((err, res) => {
            if (err) return done(err)
            res.statusCode.should.eql(200)
            done()
          })
        })
      })
    })

    it('should return 200 with update permissions (query by ID)', function (done) {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: { 'collection:testdb_test-schema': PERMISSIONS.UPDATE }
      }

      let update = { title: 'updated title' }

      help.createACLClient(testClient).then(() => {
        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(testClient)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          let bearerToken = res.body.accessToken

          client
          .put(`/vtest/testdb/test-schema/${docs[0]}`)
          .send(update)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .end((err, res) => {
            if (err) return done(err)

            res.statusCode.should.eql(200)
            res.body.results.length.should.eql(1)
            res.body.results[0].title.should.eql(update.title)

            done()
          })
        })
      })
    })    

    it('should return 200 and not update any documents when the query differs from the filter permission', function (done) {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          'collection:testdb_test-schema': {
            read: true,
            update: {
              filter: {
                title: 'some title'
              }
            }
          }
        }
      }

      help.createACLClient(testClient).then(() => {
        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(testClient)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          let bearerToken = res.body.accessToken

          client
          .put(`/vtest/testdb/test-schema`)
          .send({
            query: {
              title: 'test doc'
            },
            update: {
              field1: 'updated'
            }
          })
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .end((err, res) => {
            if (err) return done(err)

            res.statusCode.should.eql(200)
            res.body.results.length.should.eql(0)

            client
            .get(`/vtest/testdb/test-schema?filter={"title":"test doc"}`)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .end((err, res) => {
              if (err) return done(err)

              res.statusCode.should.eql(200)
              res.body.results.length.should.eql(1)

              res.body.results[0].field1.should.eql('7')

              done()
            })
          })
        })
      })
    })    
  })

  describe('DELETE', function () {
    it('should return 403 with no delete permission (query in body)', function (done) {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: { 'collection:testdb_test-schema': PERMISSIONS.READ }
      }

      let payload = { query: { field1: 'fieldValue' } }

      help.createACLClient(testClient).then(() => {
        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(testClient)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          let bearerToken = res.body.accessToken

          client
          .delete(`/vtest/testdb/test-schema/`)
          .send(payload)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .end((err, res) => {
            if (err) return done(err)
            res.statusCode.should.eql(403)
            done()
          })
        })
      })
    })

    it('should return 403 with no delete permission (query by ID)', function (done) {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: { 'collection:testdb_test-schema': PERMISSIONS.READ }
      }

      help.createACLClient(testClient).then(() => {
        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(testClient)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          let bearerToken = res.body.accessToken

          client
          .delete(`/vtest/testdb/test-schema/${docs[0]}`)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .end((err, res) => {
            if (err) return done(err)
            res.statusCode.should.eql(403)
            done()
          })
        })
      })
    })    

    it('should return 204 with delete permission (query in body)', function (done) {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          'collection:testdb_test-schema': {
            read: true,
            delete: true
          }
        }
      }

      let payload = { query: { field1: 'fieldValue' } }

      help.createACLClient(testClient).then(() => {
        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(testClient)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          let bearerToken = res.body.accessToken

          client
          .delete(`/vtest/testdb/test-schema/`)
          .send(payload)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .end((err, res) => {
            if (err) return done(err)
            res.statusCode.should.eql(204)

            client
            .get(`/vtest/testdb/test-schema?filter={"field1":"fieldValue"}`)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .end((err, res) => {
              if (err) return done(err)
              res.statusCode.should.eql(200)
              res.body.results.should.be.Array
              res.body.results.length.should.eql(0)

              done()
            })
          })
        })
      })
    })

    it('should return 204 with delete permission (query by ID)', function (done) {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          'collection:testdb_test-schema': {
            read: true,
            delete: true
          }
        }
      }

      help.createACLClient(testClient).then(() => {
        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(testClient)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          let bearerToken = res.body.accessToken

          client
          .delete(`/vtest/testdb/test-schema/${docs[0]}`)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .end((err, res) => {
            if (err) return done(err)
            res.statusCode.should.eql(204)

            client
            .get(`/vtest/testdb/test-schema/${docs[0]}`)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .end((err, res) => {
              if (err) return done(err)
              res.statusCode.should.eql(404)

              done()
            })
          })
        })
      })
    })    

    it('should return 204 and not delete any documents when the query differs from the filter permission', function (done) {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          'collection:testdb_test-schema': {
            read: true,
            delete: {
              filter: {
                title: 'some title'
              }
            }
          }
        }
      }

      help.createACLClient(testClient).then(() => {
        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send(testClient)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          let bearerToken = res.body.accessToken

          client
          .delete(`/vtest/testdb/test-schema`)
          .send({
            query: {
              title: 'test doc'
            }
          })
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .end((err, res) => {
            if (err) return done(err)

            res.statusCode.should.eql(204)

            client
            .get(`/vtest/testdb/test-schema?filter={"title":"test doc"}`)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .end((err, res) => {
              if (err) return done(err)

              res.statusCode.should.eql(200)
              res.body.results.length.should.eql(1)

              res.body.results[0].field1.should.eql('7')

              done()
            })
          })
        })
      })
    })    
  })
})
