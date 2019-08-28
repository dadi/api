const app = require('../../../../dadi/lib/')
const config = require('../../../../config')
const help = require('../../help')
const request = require('supertest')
const should = require('should')

const connectionString =
  'http://' + config.get('server.host') + ':' + config.get('server.port')
const client = request(connectionString)

let bearerToken

describe('Collections API – PUT', function() {
  this.timeout(4000)

  before(function(done) {
    help.dropDatabase('testdb', function(err) {
      if (err) return done(err)

      const baseSchema = {
        property: 'testdb',
        name: 'put-test-schema',
        fields: {
          field1: {
            type: 'String',
            required: false
          },
          field2: {
            type: 'Number',
            required: false
          },
          field3: {
            type: 'ObjectID',
            required: false
          },
          _fieldWithUnderscore: {
            type: 'Object',
            required: false
          }
        },
        settings: {}
      }

      help
        .createSchemas([
          Object.assign({}, baseSchema, {name: 'put-test-schema-two'}),
          Object.assign({}, baseSchema, {version: 'v1'}),
          Object.assign({}, baseSchema, {version: 'v2'}),
          Object.assign({}, baseSchema, {
            version: 'v1',
            name: 'put-test-schema-no-history',
            settings: {
              storeRevisions: false
            }
          }),
          Object.assign({}, baseSchema, {
            version: 'v2',
            name: 'put-test-schema-no-history',
            settings: {
              storeRevisions: false
            }
          })
        ])
        .then(() => {
          app.start(function() {
            help.getBearerTokenWithAccessType('admin', function(err, token) {
              if (err) return done(err)

              bearerToken = token

              done()
            })
          })
        })
    })
  })

  after(function(done) {
    help.dropSchemas().then(() => {
      app.stop(() => {
        done()
      })
    })
  })

  describe('Access keys', () => {
    const testClient = {
      clientId: 'testClient123',
      secret: 'someSecret',
      resources: {
        'collection:testdb_put-test-schema': {
          read: true,
          create: true,
          update: true,
          delete: true
        },
        'collection:testdb_put-test-schema-two': {
          read: true,
          create: true,
          update: false,
          delete: true
        }
      }
    }

    before(() => {
      return help.createACLClient(testClient)
    })

    after(() => {
      return help.removeACLData()
    })

    it('should return 403 when updating documents with an access key associated with a client record without sufficient privileges', function(done) {
      const client = request(connectionString)

      help
        .createACLKey({
          client: testClient.clientId
        })
        .then(key => {
          client
            .post('/testdb/put-test-schema-two')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({field1: 'doc to update'})
            .expect(200)
            .end(function(err, res) {
              if (err) return done(err)

              const doc = res.body.results[0]

              client
                .put(`/testdb/put-test-schema-two/${doc._id}`)
                .set('Authorization', 'Bearer ' + key.token)
                .send({field1: 'foo!'})
                .expect(403)
                .end(function(err, res) {
                  setTimeout(() => {
                    done(err)
                  }, 1000)
                })
            })
        })
    })

    it('should return 403 when updating documents with a top-level access key associated without sufficient privileges', function(done) {
      const client = request(connectionString)

      help
        .createACLKey({
          _createdBy: testClient.clientId,
          resources: testClient.resources
        })
        .then(key => {
          client
            .post('/testdb/put-test-schema-two')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({field1: 'doc to update'})
            .expect(200)
            .end(function(err, res) {
              if (err) return done(err)

              const doc = res.body.results[0]

              client
                .put(`/testdb/put-test-schema-two/${doc._id}`)
                .set('Authorization', 'Bearer ' + key.token)
                .send({field1: 'foo!'})
                .expect(403)
                .end(function(err, res) {
                  setTimeout(() => {
                    done(err)
                  }, 1000)
                })
            })
        })
    })

    it('should update documents with an access key associated with a client record', function(done) {
      const client = request(connectionString)
      const update = {field1: 'foo!'}

      help
        .createACLKey({
          client: testClient.clientId
        })
        .then(key => {
          client
            .post('/testdb/put-test-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({field1: 'doc to update'})
            .expect(200)
            .end(function(err, res) {
              if (err) return done(err)

              const doc = res.body.results[0]

              client
                .put(`/testdb/put-test-schema/${doc._id}`)
                .set('Authorization', 'Bearer ' + key.token)
                .send(update)
                .expect(200)
                .end(function(err, res) {
                  const {results} = res.body

                  results.length.should.eql(1)
                  results[0]._id.should.eql(doc._id)
                  results[0].field1.should.eql(update.field1)
                  results[0]._lastModifiedBy.should.eql(testClient.clientId)

                  setTimeout(() => {
                    done(err)
                  }, 1000)
                })
            })
        })
    })

    it('should update documents with a top-level access key', function(done) {
      const client = request(connectionString)
      const update = {field1: 'bar!'}

      help
        .createACLKey({
          _createdBy: testClient.clientId,
          resources: testClient.resources
        })
        .then(key => {
          client
            .post('/testdb/put-test-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({field1: 'doc to update'})
            .expect(200)
            .end(function(err, res) {
              if (err) return done(err)

              const doc = res.body.results[0]

              client
                .put(`/testdb/put-test-schema/${doc._id}`)
                .set('Authorization', 'Bearer ' + key.token)
                .send(update)
                .expect(200)
                .end(function(err, res) {
                  const {results} = res.body

                  results.length.should.eql(1)
                  results[0]._id.should.eql(doc._id)
                  results[0].field1.should.eql(update.field1)
                  results[0]._lastModifiedByKey.should.eql(key._id)

                  setTimeout(() => {
                    done(err)
                  }, 1000)
                })
            })
        })
    })
  })

  it('should update existing documents when passing ID', function(done) {
    client
      .post('/testdb/put-test-schema')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send({field1: 'doc to update'})
      .expect(200)
      .end(function(err, res) {
        if (err) return done(err)

        const doc = res.body.results[0]

        should.exist(doc)
        doc.field1.should.equal('doc to update')

        const puturl = '/testdb/put-test-schema/' + doc._id

        client
          .put(puturl)
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({field1: 'updated doc'})
          .expect(200)
          .end(function(err, res) {
            if (err) return done(err)
            res.body.results[0]._id.should.equal(doc._id)
            res.body.results[0].field1.should.equal('updated doc')

            client
              .get('/testdb/put-test-schema?filter={"_id": "' + doc._id + '"}')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .expect('content-type', 'application/json')
              .end(function(err, res) {
                if (err) return done(err)

                res.body['results'].should.exist
                res.body['results'].should.be.Array
                res.body['results'].length.should.equal(1)
                res.body['results'][0].field1.should.equal('updated doc')

                done()
              })
          })
      })
  })

  it('should return 404 when updating a non-existing document by ID (RESTful)', function(done) {
    client
      .put('/testdb/put-test-schema/59f1b3e038ad765e669ac47f')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send({field1: 'updated doc'})
      .expect(404)
      .end(function(err, res) {
        if (err) return done(err)

        res.body.statusCode.should.eql(404)

        done()
      })
  })

  it('should return 200 when updating a non-existing document by ID, supplying the query in the request body', function(done) {
    client
      .put('/testdb/put-test-schema')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send({
        query: {
          _id: '59f1b3e038ad765e669ac47f'
        },
        update: {
          field1: 'updated doc'
        }
      })
      .expect(200)
      .end(function(err, res) {
        if (err) return done(err)

        res.body.results.should.eql([])

        done()
      })
  })

  it('should update existing documents when passing ID, giving back the updated document with internal fields prefixed with the character defined in config', function(done) {
    const client = request(connectionString)
    const originalPrefix = config.get('internalFieldsPrefix')

    config.set('internalFieldsPrefix', '$')

    client
      .post('/testdb/put-test-schema')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send({field1: 'doc to update'})
      .expect(200)
      .end(function(err, res) {
        if (err) return done(err)

        const doc = res.body.results[0]

        should.exist(doc)
        doc.field1.should.equal('doc to update')

        const puturl = '/testdb/put-test-schema/' + doc.$id

        client
          .put(puturl)
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({field1: 'updated doc'})
          .expect(200)
          .end(function(err, res) {
            if (err) return done(err)

            res.body.results[0].$id.should.equal(doc.$id)

            config.set('internalFieldsPrefix', originalPrefix)

            done()
          })
      })
  })

  it('should update existing document by ID when passing a query', function(done) {
    client
      .post('/testdb/put-test-schema')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send({field1: 'doc to update'})
      .expect(200)
      .end(function(err, res) {
        if (err) return done(err)

        const doc = res.body.results[0]

        should.exist(doc)
        doc.field1.should.equal('doc to update')

        const body = {
          query: {_id: doc._id},
          update: {field1: 'updated doc'}
        }

        client
          .put('/testdb/put-test-schema/')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send(body)
          .expect(200)
          .end(function(err, res) {
            if (err) return done(err)

            // console.log(res.body)
            res.body.results[0]._id.should.equal(doc._id)
            res.body.results[0].field1.should.equal('updated doc')

            client
              .get('/testdb/put-test-schema?filter={"_id": "' + doc._id + '"}')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .expect('content-type', 'application/json')
              .end(function(err, res) {
                if (err) return done(err)

                res.body['results'].should.exist
                res.body['results'].should.be.Array
                res.body['results'].length.should.equal(1)
                res.body['results'][0].field1.should.equal('updated doc')

                done()
              })
          })
      })
  })

  it('should update existing document by ID when passing a query, translating any internal field to the prefix defined in config', function(done) {
    const client = request(connectionString)
    const originalPrefix = config.get('internalFieldsPrefix')

    config.set('internalFieldsPrefix', '$')

    client
      .post('/testdb/put-test-schema')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send({field1: 'doc to update'})
      .expect(200)
      .end(function(err, res) {
        if (err) return done(err)

        const doc = res.body.results[0]

        should.exist(doc)
        doc.field1.should.equal('doc to update')

        const body = {
          query: {$id: doc.$id},
          update: {field1: 'updated doc'}
        }

        client
          .put('/testdb/put-test-schema/')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send(body)
          .expect(200)
          .end(function(err, res) {
            if (err) return done(err)

            res.body.results[0].$id.should.equal(doc.$id)
            res.body.results[0].field1.should.equal('updated doc')

            client
              .get('/testdb/put-test-schema?filter={"$id": "' + doc.$id + '"}')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .expect('content-type', 'application/json')
              .end(function(err, res) {
                if (err) return done(err)

                res.body['results'].should.exist
                res.body['results'].should.be.Array
                res.body['results'].length.should.equal(1)
                res.body['results'][0].field1.should.equal('updated doc')

                config.set('internalFieldsPrefix', originalPrefix)

                done()
              })
          })
      })
  })

  it('should update all existing documents when passing a query with a filter', function(done) {
    // add three docs
    client
      .post('/testdb/put-test-schema')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send({field1: 'draft'})
      .expect(200)
      .end(function(err, res) {
        if (err) return done(err)

        client
          .post('/testdb/put-test-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({field1: 'draft'})
          .expect(200)
          .end(function(err, res) {
            if (err) return done(err)

            client
              .post('/testdb/put-test-schema')
              .set('Authorization', 'Bearer ' + bearerToken)
              .send({field1: 'draft'})
              .expect(200)
              .end(function(err, res) {
                if (err) return done(err)

                // update query
                const body = {
                  query: {field1: 'draft'},
                  update: {field1: 'published'}
                }

                client
                  .put('/testdb/put-test-schema/')
                  .set('Authorization', 'Bearer ' + bearerToken)
                  .send(body)
                  .expect(200)
                  .end(function(err, res) {
                    if (err) return done(err)

                    res.body['results'].should.exist
                    res.body['results'].should.be.Array
                    res.body['results'].length.should.equal(3)
                    res.body['results'][0].field1.should.equal('published')
                    res.body['results'][1].field1.should.equal('published')
                    res.body['results'][2].field1.should.equal('published')

                    done()
                  })
              })
          })
      })
  })

  it('should update documents when passing a query with a filter, translating any internal field to the prefix defined in config', function(done) {
    const client = request(connectionString)
    const originalPrefix = config.get('internalFieldsPrefix')

    config.set('internalFieldsPrefix', '$')

    client
      .post('/testdb/put-test-schema')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send({field1: 'some value'})
      .expect(200)
      .end(function(err, res) {
        if (err) return done(err)

        const doc = res.body.results[0]
        const body = {
          query: {
            $id: doc.$id
          },
          update: {
            field1: 'Updated value'
          }
        }

        client
          .put('/testdb/put-test-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send(body)
          .expect(200)
          .expect('content-type', 'application/json')
          .end(function(err, res) {
            if (err) return done(err)

            res.body.results.should.be.Array
            res.body.results[0].$id.should.eql(doc.$id)
            res.body.results[0].field1.should.eql(body.update.field1)

            client
              .get('/testdb/put-test-schema/' + doc.$id)
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .expect('content-type', 'application/json')
              .end(function(err, res) {
                if (err) return done(err)

                res.body.results.should.be.Array
                res.body.results[0].$id.should.eql(doc.$id)
                res.body.results[0].field1.should.eql(body.update.field1)

                config.set('internalFieldsPrefix', originalPrefix)

                done()
              })
          })
      })
  })

  it('should add internal fields to updated documents', function(done) {
    client
      .post('/testdb/put-test-schema')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send({field1: 'doc to update'})
      .expect(200)
      .end(function(err, res) {
        if (err) return done(err)

        const doc = res.body.results[0]

        should.exist(doc)
        doc.field1.should.equal('doc to update')

        client
          .put('/testdb/put-test-schema/' + doc._id)
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({field1: 'updated doc'})
          .expect(200)
          .end(function(err, res) {
            if (err) return done(err)

            res.body.results[0]._id.should.equal(doc._id)
            res.body.results[0].field1.should.equal('updated doc')

            client
              .get('/testdb/put-test-schema?filter={"_id": "' + doc._id + '"}')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .expect('content-type', 'application/json')
              .end(function(err, res) {
                if (err) return done(err)

                res.body['results'].should.exist
                res.body['results'].should.be.Array
                res.body['results'].length.should.equal(1)
                res.body['results'][0]._lastModifiedBy.should.equal('test123')
                res.body['results'][0]._lastModifiedAt.should.be.Number
                res.body['results'][0]._lastModifiedAt.should.not.be.above(
                  Date.now()
                )

                done()
              })
          })
      })
  })

  it('should ignore any internal properties supplied by the client when updating a document', function(done) {
    const initial = {
      field1: 'initial'
    }
    const update = {
      _id: 12345,
      _createdBy: 'johndoe',
      _createdAt: 1010101,
      _version: 10,
      field1: 'modified'
    }

    client
      .post('/testdb/put-test-schema')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(initial)
      .expect(200)
      .end(function(err, res) {
        if (err) return done(err)

        const doc = res.body.results[0]

        should.exist(doc)
        doc.field1.should.equal(initial.field1)

        client
          .put('/testdb/put-test-schema/' + doc._id)
          .set('Authorization', 'Bearer ' + bearerToken)
          .send(update)
          .expect(200)
          .end(function(err, res) {
            if (err) return done(err)

            res.body.results[0]._id.should.equal(doc._id)
            res.body.results[0].field1.should.equal(update.field1)

            should.exist(res.body.results[0]._createdBy)
            res.body.results[0]._createdBy.should.not.eql(update._createdBy)

            should.exist(res.body.results[0]._createdAt)
            res.body.results[0]._createdAt.should.not.eql(update._createdAt)

            should.exist(res.body.results[0]._id)
            res.body.results[0]._id.should.not.eql(update._id)

            should.not.exist(res.body.results[0]._version)

            client
              .get('/testdb/put-test-schema?filter={"_id": "' + doc._id + '"}')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .expect('content-type', 'application/json')
              .end(function(err, res) {
                if (err) return done(err)

                res.body['results'].should.exist
                res.body['results'].should.be.Array
                res.body['results'].length.should.equal(1)
                res.body['results'][0]._lastModifiedBy.should.equal('test123')
                res.body['results'][0]._lastModifiedAt.should.be.Number
                res.body['results'][0]._lastModifiedAt.should.not.be.above(
                  Date.now()
                )

                should.exist(res.body.results[0]._createdBy)
                res.body.results[0]._createdBy.should.not.eql(update._createdBy)

                should.exist(res.body.results[0]._createdAt)
                res.body.results[0]._createdAt.should.not.eql(update._createdAt)

                should.exist(res.body.results[0]._id)
                res.body.results[0]._id.should.not.eql(update._id)

                should.not.exist(res.body.results[0]._version)

                done()
              })
          })
      })
  })
})
