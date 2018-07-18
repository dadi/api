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
  FILTER: { read: { filter: '{"title":"very long title"}' } }
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
          help.dropDatabase('library', 'person', () => {
            help.dropDatabase('library', 'book', () => {
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
          .get('/vtest/testdb/test-schema/?fields={"field1":1,"title":1}')
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

    it('should return 200 and compose a Reference field if the client read permissions on both the parent and referenced collections', function (done) {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          'collection:library_book': PERMISSIONS.READ,
          'collection:library_person': PERMISSIONS.READ
        }
      }

      let authorId

      help.getBearerTokenWithPermissions({
        accessType: 'admin'
      }).then(adminToken => {
        return help.createDocument({
          version: 'v1',
          database: 'library',
          collection: 'person',
          document: {
            name: 'James Lambie'
          },
          token: adminToken
        }).then(response => {
          authorId = response.results[0]._id

          return help.createDocument({
            version: 'v1',
            database: 'library',
            collection: 'book',
            document: {
              title: 'A Kiwi\'s guide to DADI API',
              author: authorId
            },
            token: adminToken
          })
        })
      }).then(response => {
        return help.createACLClient(testClient).then(() => {
          client
          .post(config.get('auth.tokenUrl'))
          .set('content-type', 'application/json')
          .send(testClient)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            let bearerToken = res.body.accessToken

            client
            .get(`/v1/library/book/${response.results[0]._id}?compose=true`)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .end((err, res) => {
              if (err) return done(err)

              res.statusCode.should.eql(200)
              res.body.results.length.should.eql(1)
              res.body.results[0].author.name.should.eql('James Lambie')

              done()
            })
          })
        })        
      })
    })

    it('should return 200 if the client has read permission on the given collection, but not compose a Reference field if they do not have read permissions on the referenced collection', function (done) {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          'collection:library_book': PERMISSIONS.READ,
          'collection:library_person': PERMISSIONS.NO_READ
        }
      }

      let authorId

      help.getBearerTokenWithPermissions({
        accessType: 'admin'
      }).then(adminToken => {
        return help.createDocument({
          version: 'v1',
          database: 'library',
          collection: 'person',
          document: {
            name: 'James Lambie'
          },
          token: adminToken
        }).then(response => {
          authorId = response.results[0]._id

          return help.createDocument({
            version: 'v1',
            database: 'library',
            collection: 'book',
            document: {
              title: 'A Kiwi\'s guide to DADI API',
              author: authorId
            },
            token: adminToken
          })
        })
      }).then(response => {
        return help.createACLClient(testClient).then(() => {
          client
          .post(config.get('auth.tokenUrl'))
          .set('content-type', 'application/json')
          .send(testClient)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            let bearerToken = res.body.accessToken

            client
            .get(`/v1/library/book/${response.results[0]._id}?compose=true`)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .end((err, res) => {
              if (err) return done(err)

              res.statusCode.should.eql(200)
              res.body.results.length.should.eql(1)
              res.body.results[0].author.should.eql(authorId)
              should.not.exist(res.body.results[0]._composed)

              done()
            })
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

    it('should return 200 without bearer token if `settings.authenticate` is `false`', function (done) {
      let modelSettings = Object.assign({}, app.components['/vtest/testdb/test-schema'].model.settings)

      app.components['/vtest/testdb/test-schema'].model.settings.authenticate = false

      client
      .get(`/vtest/testdb/test-schema`)
      .set('content-type', 'application/json')
      .end((err, res) => {
        if (err) return done(err)
        res.statusCode.should.eql(200)

        app.components['/vtest/testdb/test-schema'].model.settings = modelSettings

        done()
      })
    })

    it('should return 200 without bearer token if `settings.authenticate` is set to an array that does not include `GET`', function (done) {
      let modelSettings = Object.assign({}, app.components['/vtest/testdb/test-schema'].model.settings)

      app.components['/vtest/testdb/test-schema'].model.settings.authenticate = [
        "POST",
        "PUT",
        "DELETE"
      ]

      client
      .get(`/vtest/testdb/test-schema`)
      .set('content-type', 'application/json')
      .end((err, res) => {
        if (err) return done(err)
        res.statusCode.should.eql(200)

        app.components['/vtest/testdb/test-schema'].model.settings = modelSettings

        done()
      })
    })

    it('should return 401 without bearer token if `settings.authenticate` is set to an array that includes `GET`', function (done) {
      let modelSettings = Object.assign({}, app.components['/vtest/testdb/test-schema'].model.settings)

      app.components['/vtest/testdb/test-schema'].model.settings.authenticate = [
        "GET",
        "POST",
        "PUT",
        "DELETE"
      ]

      client
      .get(`/vtest/testdb/test-schema`)
      .set('content-type', 'application/json')
      .end((err, res) => {
        if (err) return done(err)

        res.statusCode.should.eql(401)

        app.components['/vtest/testdb/test-schema'].model.settings = modelSettings

        done()
      })
    })
  })

  describe('COUNT', function () {
    it('should return 400 for an invalid query', function (done) {
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
          .get(`/vtest/testdb/test-schema/count?filter={"$where":{"title":"xxx"}}`)
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
          .get(`/vtest/testdb/test-schema/count`)
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
          .get(`/vtest/testdb/test-schema/count`)
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
          .get(`/vtest/testdb/test-schema/count`)
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

    it('should only count the documents that match the ACL filter, if one is set', function (done) {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          'collection:testdb_test-schema': {
            read: {
              filter: JSON.stringify({
                field1: 'Value one'
              })
            }
          }
        }
      }

      let documents = [
        { field1: 'Value one' },
        { field1: 'Value one' },
        { field1: 'Value one' },
        { field1: 'Value two' },
        { field1: 'Value three' }
      ]      

      help.getBearerTokenWithPermissions({
        accessType: 'admin'
      }).then(adminToken => {
        client
        .post(`/vtest/testdb/test-schema`)
        .send(documents)
        .set('content-type', 'application/json')
        .set('Authorization', `Bearer ${adminToken}`)
        .end((err, res) => {
          if (err) return done(err)

          res.body.results.length.should.eql(documents.length)

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
              .get(`/vtest/testdb/test-schema/count`)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                if (err) return done(err)

                res.statusCode.should.eql(200)
                res.body.metadata.totalCount.should.eql(
                  documents.filter(doc => doc.field1 === 'Value one').length
                )

                done()
              })
            })
          })
        })
      })
    })

    it('should return a count of zero if there is an ACL filter set that does not match any document in the collection', function (done) {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          'collection:testdb_test-schema': {
            read: {
              filter: JSON.stringify({
                field1: 'Value one'
              })
            }
          }
        }
      }

      let documents = [
        { field1: 'Value two' },
        { field1: 'Value three' },
        { field1: 'Value four' }
      ]      

      help.getBearerTokenWithPermissions({
        accessType: 'admin'
      }).then(adminToken => {
        client
        .post(`/vtest/testdb/test-schema`)
        .send(documents)
        .set('content-type', 'application/json')
        .set('Authorization', `Bearer ${adminToken}`)
        .end((err, res) => {
          if (err) return done(err)

          res.body.results.length.should.eql(documents.length)

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
              .get(`/vtest/testdb/test-schema/count`)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                if (err) return done(err)

                res.statusCode.should.eql(200)
                res.body.metadata.totalCount.should.eql(0)

                done()
              })
            })
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

    it('should return 200 without bearer token if `settings.authenticate` is `false`', function (done) {
      let modelSettings = Object.assign({}, app.components['/vtest/testdb/test-schema'].model.settings)

      app.components['/vtest/testdb/test-schema'].model.settings.authenticate = false

      client
      .post(`/vtest/testdb/test-schema`)
      .send({
        field1: 'fieldValue',
        title: 'title'
      })
      .set('content-type', 'application/json')
      .end((err, res) => {
        if (err) return done(err)
        res.statusCode.should.eql(200)

        app.components['/vtest/testdb/test-schema'].model.settings = modelSettings

        done()
      })
    })

    it('should return 200 without bearer token if `settings.authenticate` is set to an array that does not include `POST`', function (done) {
      let modelSettings = Object.assign({}, app.components['/vtest/testdb/test-schema'].model.settings)

      app.components['/vtest/testdb/test-schema'].model.settings.authenticate = [
        "GET",
        "PUT",
        "DELETE"
      ]

      client
      .post(`/vtest/testdb/test-schema`)
      .send({
        field1: 'fieldValue',
        title: 'title'
      })
      .end((err, res) => {
        if (err) return done(err)
        res.statusCode.should.eql(200)

        app.components['/vtest/testdb/test-schema'].model.settings = modelSettings

        done()
      })
    })

    it('should return 401 without bearer token if `settings.authenticate` is set to an array that includes `POST`', function (done) {
      let modelSettings = Object.assign({}, app.components['/vtest/testdb/test-schema'].model.settings)

      app.components['/vtest/testdb/test-schema'].model.settings.authenticate = [
        "GET",
        "POST",
        "PUT",
        "DELETE"
      ]

      client
      .post(`/vtest/testdb/test-schema`)
      .send({
        field1: 'fieldValue',
        title: 'title'
      })
      .set('content-type', 'application/json')
      .end((err, res) => {
        if (err) return done(err)

        res.statusCode.should.eql(401)

        app.components['/vtest/testdb/test-schema'].model.settings = modelSettings

        done()
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

    it('should return 200 with update permissions after they have been updated', function (done) {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        resources: {
          'collection:testdb_test-schema': {
            create: true,
            deleteOwn: true,
            readOwn: true,
            updateOwn: true
          }
        }
      }

      help.getBearerTokenWithPermissions({
        accessType: 'admin'
      }).then(adminToken => {
        help.createDoc(adminToken, (err, document) => {
          help.createACLClient(testClient).then(() => {
            client
            .post(config.get('auth.tokenUrl'))
            .set('content-type', 'application/json')
            .send(testClient)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              let userToken = res.body.accessToken

              client
              .put(`/vtest/testdb/test-schema/${document._id}`)
              .send({
                field1: 'something new'
              })
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${userToken}`)
              .end((err, res) => {
                if (err) return done(err)

                res.statusCode.should.eql(404)

                client
                .put(`/api/clients/${testClient.clientId}/resources/collection:testdb_test-schema`)
                .send({
                  read: true,
                  update: true
                })
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${adminToken}`)
                .end((err, res) => {
                  if (err) return done(err)

                  setTimeout(() => {
                    client
                    .put(`/vtest/testdb/test-schema/${document._id}`)
                    .send({
                      field1: 'something new'
                    })
                    .set('content-type', 'application/json')
                    .set('Authorization', `Bearer ${userToken}`)
                    .end((err, res) => {
                      if (err) return done(err)

                      res.statusCode.should.eql(200)
                      res.body.results.length.should.eql(1)
                      res.body.results[0].field1.should.eql('something new')

                      done()
                    })
                  }, 1000)
                })
              })
            })
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
              filter: JSON.stringify({
                title: 'some title'
              })
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

    it('should return 200 without bearer token if `settings.authenticate` is `false`', function (done) {
      let modelSettings = Object.assign({}, app.components['/vtest/testdb/test-schema'].model.settings)

      app.components['/vtest/testdb/test-schema'].model.settings.authenticate = false

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
      .end((err, res) => {
        if (err) return done(err)
        res.statusCode.should.eql(200)

        app.components['/vtest/testdb/test-schema'].model.settings = modelSettings

        done()
      })
    })

    it('should return 200 without bearer token if `settings.authenticate` is set to an array that does not include `PUT`', function (done) {
      let modelSettings = Object.assign({}, app.components['/vtest/testdb/test-schema'].model.settings)

      app.components['/vtest/testdb/test-schema'].model.settings.authenticate = [
        "GET",
        "POST",
        "DELETE"
      ]

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
      .end((err, res) => {
        if (err) return done(err)
        res.statusCode.should.eql(200)

        app.components['/vtest/testdb/test-schema'].model.settings = modelSettings

        done()
      })
    })

    it('should return 401 without bearer token if `settings.authenticate` is set to an array that includes `PUT`', function (done) {
      let modelSettings = Object.assign({}, app.components['/vtest/testdb/test-schema'].model.settings)

      app.components['/vtest/testdb/test-schema'].model.settings.authenticate = [
        "GET",
        "POST",
        "PUT",
        "DELETE"
      ]

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
      .end((err, res) => {
        if (err) return done(err)

        res.statusCode.should.eql(401)

        app.components['/vtest/testdb/test-schema'].model.settings = modelSettings

        done()
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
              filter: JSON.stringify({
                title: 'some title'
              })
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

    it('should return 204 without bearer token if `settings.authenticate` is `false`', function (done) {
      let modelSettings = Object.assign({}, app.components['/vtest/testdb/test-schema'].model.settings)

      app.components['/vtest/testdb/test-schema'].model.settings.authenticate = false

      client
      .delete(`/vtest/testdb/test-schema/${docs[0]}`)
      .set('content-type', 'application/json')
      .end((err, res) => {
        if (err) return done(err)
        res.statusCode.should.eql(204)

        app.components['/vtest/testdb/test-schema'].model.settings = modelSettings

        done()
      })
    })

    it('should return 204 without bearer token if `settings.authenticate` is set to an array that does not include `DELETE`', function (done) {
      let modelSettings = Object.assign({}, app.components['/vtest/testdb/test-schema'].model.settings)

      app.components['/vtest/testdb/test-schema'].model.settings.authenticate = [
        "GET",
        "POST",
        "PUT"
      ]

      client
      .delete(`/vtest/testdb/test-schema/${docs[0]}`)
      .send({
        query: {
          title: 'test doc'
        },
        update: {
          field1: 'updated'
        }
      })
      .end((err, res) => {
        if (err) return done(err)
        res.statusCode.should.eql(204)

        app.components['/vtest/testdb/test-schema'].model.settings = modelSettings

        done()
      })
    })

    it('should return 401 without bearer token if `settings.authenticate` is set to an array that includes `DELETE`', function (done) {
      let modelSettings = Object.assign({}, app.components['/vtest/testdb/test-schema'].model.settings)

      app.components['/vtest/testdb/test-schema'].model.settings.authenticate = [
        "GET",
        "POST",
        "PUT",
        "DELETE"
      ]

      client
      .delete(`/vtest/testdb/test-schema/${docs[0]}`)
      .send({
        query: {
          title: 'test doc'
        },
        update: {
          field1: 'updated'
        }
      })
      .set('content-type', 'application/json')
      .end((err, res) => {
        if (err) return done(err)

        res.statusCode.should.eql(401)

        app.components['/vtest/testdb/test-schema'].model.settings = modelSettings

        done()
      })
    })    
  })
})
