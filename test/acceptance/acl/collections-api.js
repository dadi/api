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
  READ_EXCLUDE_FIELDS: { read: { fields: { title: 0 } } }
}

let client = request(`http://${config.get('server.host')}:${config.get('server.port')}`)

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
    it('should return 403 with no update permission', function (done) {
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

    it('should return 200 with all permissions', function (done) {
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

    it('should return 200 with update permissions', function (done) {
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
  })

  describe('DELETE', function () {
    it('should return 403 with no delete permission', function (done) {
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

    it('should return 204 with delete permission', function (done) {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: { 'collection:testdb_test-schema': PERMISSIONS.DELETE }
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
            done()
          })
        })
      })
    })
  })
})
