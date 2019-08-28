const app = require('../../../../dadi/lib/')
const config = require('../../../../config')
const help = require('../../help')
const request = require('supertest')
const should = require('should')

const connectionString =
  'http://' + config.get('server.host') + ':' + config.get('server.port')
let bearerToken

describe('Collections API – POST', function() {
  this.timeout(4000)

  before(function(done) {
    help.dropDatabase('testdb', function(err) {
      if (err) return done(err)

      app.start(function() {
        help.getBearerTokenWithAccessType('admin', function(err, token) {
          if (err) return done(err)

          bearerToken = token

          help
            .createSchemas([
              {
                property: 'testdb',
                name: 'test-schema',
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
                settings: {
                  count: 40
                }
              },
              {
                property: 'testdb',
                name: 'test-schema-two',
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
                settings: {
                  count: 40
                }
              }
            ])
            .then(() => {
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
        'collection:testdb_test-schema': {
          read: true,
          create: true,
          update: true,
          delete: true
        },
        'collection:testdb_test-schema-two': {
          read: true,
          create: false,
          update: true,
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

    it('should return 403 when creating new documents with an access key associated with a client record without sufficient privileges', function(done) {
      const client = request(connectionString)

      help
        .createACLKey({
          client: testClient.clientId
        })
        .then(key => {
          client
            .post('/testdb/test-schema-two')
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

    it('should return 403 when creating new documents with a top-level access key associated without sufficient privileges', function(done) {
      const client = request(connectionString)

      help
        .createACLKey({
          _createdBy: testClient.clientId,
          resources: testClient.resources
        })
        .then(key => {
          client
            .post('/testdb/test-schema-two')
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

    it('should create new documents with an access key associated with a client record', function(done) {
      const client = request(connectionString)

      help
        .createACLKey({
          client: testClient.clientId
        })
        .then(key => {
          client
            .post('/testdb/test-schema')
            .set('Authorization', 'Bearer ' + key.token)
            .send({field1: 'foo!'})
            .expect(200)
            .end(function(err, res) {
              if (err) return done(err)

              should.exist(res.body.results)
              res.body.results.should.be.Array
              res.body.results.length.should.equal(1)
              should.exist(res.body.results[0]._id)
              res.body.results[0].field1.should.equal('foo!')
              res.body.results[0]._createdBy.should.eql(testClient.clientId)

              setTimeout(() => {
                done(err)
              }, 1000)
            })
        })
    })

    it('should create new documents with a top-level access key', function(done) {
      const client = request(connectionString)

      help
        .createACLKey({
          _createdBy: testClient.clientId,
          resources: {
            'collection:testdb_test-schema': {
              read: true,
              create: true,
              update: true,
              delete: true
            }
          }
        })
        .then(key => {
          client
            .post('/testdb/test-schema')
            .set('Authorization', 'Bearer ' + key.token)
            .send({field1: 'foo!'})
            .expect(200)
            .end(function(err, res) {
              if (err) return done(err)

              should.exist(res.body.results)
              res.body.results.should.be.Array
              res.body.results.length.should.equal(1)
              should.exist(res.body.results[0]._id)
              res.body.results[0].field1.should.equal('foo!')
              res.body.results[0]._createdByKey.should.eql(key._id)

              setTimeout(() => {
                done(err)
              }, 1000)
            })
        })
    })
  })

  it('should create new documents', function(done) {
    const client = request(connectionString)

    client
      .post('/testdb/test-schema')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send({field1: 'foo!'})
      .expect(200)
      .end(function(err, res) {
        if (err) return done(err)

        should.exist(res.body.results)
        res.body.results.should.be.Array
        res.body.results.length.should.equal(1)
        should.exist(res.body.results[0]._id)
        res.body.results[0].field1.should.equal('foo!')
        done()
      })
  })

  it('should create new documents and return its representation containing the internal fields prefixed with the character defined in config', function(done) {
    const originalPrefix = config.get('internalFieldsPrefix')

    config.set('internalFieldsPrefix', '$')

    const client = request(connectionString)

    client
      .post('/testdb/test-schema')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send({field1: 'foo!'})
      .expect(200)
      .end(function(err, res) {
        if (err) return done(err)

        res.body.results.should.be.Array
        res.body.results.length.should.equal(1)
        should.not.exist(res.body.results[0]._id)
        should.exist(res.body.results[0].$id)
        should.exist(res.body.results[0].$createdAt)
        should.exist(res.body.results[0].$createdBy)
        res.body.results[0].field1.should.equal('foo!')

        config.set('internalFieldsPrefix', originalPrefix)

        done()
      })
  })

  it('should create new documents when body is urlencoded', function(done) {
    const body = 'field1=foo!'
    const client = request(connectionString)

    client
      .post('/testdb/test-schema')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(body)
      .expect(200)
      .end(function(err, res) {
        if (err) return done(err)

        should.exist(res.body.results)

        res.body.results.should.be.Array
        res.body.results.length.should.equal(1)
        should.exist(res.body.results[0]._id)
        should.exist(res.body.results[0].field1)
        res.body.results[0].field1.should.equal('foo!')
        done()
      })
  })

  it('should create new documents when content-type is text/plain', function(done) {
    const body = JSON.stringify({
      field1: 'foo!'
    })

    const client = request(connectionString)

    client
      .post('/testdb/test-schema')
      .set('Authorization', 'Bearer ' + bearerToken)
      .set('content-type', 'text/plain')
      .send(body)
      .expect(200)
      .end(function(err, res) {
        if (err) return done(err)

        should.exist(res.body.results)

        res.body.results.should.be.Array
        res.body.results.length.should.equal(1)
        should.exist(res.body.results[0]._id)
        should.exist(res.body.results[0].field1)
        res.body.results[0].field1.should.equal('foo!')
        done()
      })
  })

  it('should create new documents when content-type includes a charset', function(done) {
    const body = JSON.stringify({
      field1: 'foo!'
    })

    const client = request(connectionString)

    client
      .post('/testdb/test-schema')
      .set('Authorization', 'Bearer ' + bearerToken)
      .set('content-type', 'application/json; charset=UTF-8')
      .send(body)
      .expect(200)
      .end(function(err, res) {
        if (err) return done(err)

        should.exist(res.body.results)

        res.body.results.should.be.Array
        res.body.results.length.should.equal(1)
        should.exist(res.body.results[0]._id)
        should.exist(res.body.results[0].field1)
        res.body.results[0].field1.should.equal('foo!')
        done()
      })
  })

  it('should create new documents with ObjectIDs from single value', function(done) {
    const body = {
      field1: 'foo!',
      field2: 1278,
      field3: '55cb1658341a0a804d4dadcc'
    }
    const client = request(connectionString)

    client
      .post('/testdb/test-schema')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(body)
      .expect(200)
      .end(function(err, res) {
        if (err) return done(err)

        should.exist(res.body.results)

        res.body.results.should.be.Array
        res.body.results.length.should.equal(1)
        should.exist(res.body.results[0]._id)
        should.exist(res.body.results[0].field3)

        done()
      })
  })

  it('should create new documents with ObjectIDs from array', function(done) {
    const body = {
      field1: 'foo!',
      field2: 1278,
      field3: ['55cb1658341a0a804d4dadcc', '55cb1658341a0a804d4dadff']
    }
    const client = request(connectionString)

    client
      .post('/testdb/test-schema')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(body)
      .expect(200)
      .end(function(err, res) {
        if (err) return done(err)

        should.exist(res.body.results)

        res.body.results.should.be.Array
        res.body.results.length.should.equal(1)
        should.exist(res.body.results[0]._id)
        should.exist(res.body.results[0].field3)

        done()
      })
  })

  it('should add internal fields to new documents', function(done) {
    const client = request(connectionString)

    client
      .post('/testdb/test-schema')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send({field1: 'foo!'})
      .expect(200)
      .end(function(err, res) {
        if (err) return done(err)

        should.exist(res.body.results)

        res.body.results.should.be.Array
        res.body.results.length.should.equal(1)
        res.body.results[0]._createdBy.should.equal('test123')
        res.body.results[0]._createdAt.should.be.Number
        res.body.results[0]._createdAt.should.not.be.above(Date.now())
        done()
      })
  })

  it('should ignore any internal properties supplied by the client when creating a new document', function(done) {
    const client = request(connectionString)

    const input = {
      _id: 12345,
      _createdBy: 'johndoe',
      _createdAt: 1010101,
      _version: 10,
      field1: 'foo!'
    }

    client
      .post('/testdb/test-schema')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(input)
      .expect(200)
      .end(function(err, res) {
        if (err) return done(err)

        should.exist(res.body.results)
        res.body.results.should.be.Array
        res.body.results.length.should.equal(1)

        res.body.results[0].field1.should.equal(input.field1)

        should.exist(res.body.results[0]._createdBy)
        res.body.results[0]._createdBy.should.not.eql(input._createdBy)

        should.exist(res.body.results[0]._createdAt)
        res.body.results[0]._createdAt.should.not.eql(input._createdAt)

        should.exist(res.body.results[0]._id)
        res.body.results[0]._id.should.not.eql(input._id)

        should.not.exist(res.body.results[0]._version)

        done()
      })
  })

  it('should return 404 when updating a non-existing document by ID (RESTful)', function(done) {
    const client = request(connectionString)

    client
      .post('/testdb/test-schema/59f1b3e038ad765e669ac47f')
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
    const client = request(connectionString)

    client
      .post('/testdb/test-schema')
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
})
