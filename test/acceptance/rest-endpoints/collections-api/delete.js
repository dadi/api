const should = require('should')
const sinon = require('sinon')
const fs = require('fs')
const path = require('path')
const request = require('supertest')
const config = require(__dirname + '/../../../../config')
const help = require(__dirname + '/../../help')
const app = require(__dirname + '/../../../../dadi/lib/')

// variables scoped for use throughout tests
const connectionString = 'http://' + config.get('server.host') + ':' + config.get('server.port')
const configBackup = config.get()
let bearerToken
const lastModifiedAt = 0

describe('Collections API – DELETE', function () {
  this.timeout(4000)

  before(done => {
    app.start(done)
  })

  after(done => {
    app.stop(done)
  })

  beforeEach(function (done) {
    help.dropDatabase('testdb', null, function (err) {
      if (err) return done(err)

      help.getBearerToken(function (err, token) {
        if (err) return done(err)

        bearerToken = token

        done()
      })
    })
  })

  it('should remove a single document by ID', function (done) {
    const client = request(connectionString)

    client
      .post('/vtest/testdb/test-schema')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send({field1: 'doc to remove'})
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err)

        const doc = res.body.results[0]

        should.exist(doc)
        doc.field1.should.equal('doc to remove')

        client
          .delete('/vtest/testdb/test-schema/' + doc._id)
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(204, done)
      })
  })

  it('should remove a specific document', function (done) {
    help.createDoc(bearerToken, function (err, doc1) {
      if (err) return done(err)
      help.createDoc(bearerToken, function (err, doc2) {
        if (err) return done(err)

        const client = request(connectionString)

        client
          .delete('/vtest/testdb/test-schema/' + doc1._id)
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(204)
          .end(function (err) {
            if (err) return done(err)

            const filter = encodeURIComponent(JSON.stringify({
              _id: doc2._id
            }))

            client
              .get('/vtest/testdb/test-schema?filter=' + filter)
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .expect('content-type', 'application/json')
              .end(function (err, res) {
                if (err) return done(err)

                res.body['results'].should.exist
                res.body['results'].should.be.Array
                res.body['results'].length.should.equal(1)
                res.body['results'][0]._id.should.equal(doc2._id)

                done()
              })
          })
      })
    })
  })

  it('should remove all documents affected by the query property supplied in the request body', function (done) {
    help.createDoc(bearerToken, function (err, doc) {
      if (err) return done(err)

      const client = request(connectionString)

      client
        .delete('/vtest/testdb/test-schema')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send({
          query: {
            _id: doc._id
          }
        })
        .expect(204)
        .end(function (err) {
          if (err) return done(err)

          client
            .get('/vtest/testdb/test-schema/' + doc._id)
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect('content-type', 'application/json')
            .expect(404)
            .end(done)
        })
    })
  })

  it('should remove all documents affected by the query property supplied in the request body, translating any internal fields to the prefix defined in config', function (done) {
    const originalPrefix = config.get('internalFieldsPrefix')

    config.set('internalFieldsPrefix', '$')

    help.createDoc(bearerToken, function (err, doc) {
      if (err) return done(err)

      const client = request(connectionString)

      client
        .delete('/vtest/testdb/test-schema')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send({
          query: {
            $id: doc.$id
          }
        })
        .expect(204)
        .end(function (err) {
          if (err) return done(err)

          client
            .get('/vtest/testdb/test-schema/' + doc.$id)
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(404)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              config.set('internalFieldsPrefix', configBackup.internalFieldsPrefix)

              done()
            })
        })
    })
  })

  it('should delete documents matching an $in query', function (done) {
    help.createDoc(bearerToken, function (err, doc1) {
      if (err) return done(err)
      help.createDoc(bearerToken, function (err, doc2) {
        if (err) return done(err)

        const body = {
          query: {
            _id: {
              '$in': [doc1._id.toString()]
            }
          }
        }

        const client = request(connectionString)

        client
          .delete('/vtest/testdb/test-schema/')
          .send(body)
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(204)
          .end(function (err) {
            if (err) return done(err)

            const filter = encodeURIComponent(JSON.stringify({
              _id: doc1._id
            }))

            client
              .get('/vtest/testdb/test-schema?filter=' + filter)
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .expect('content-type', 'application/json')
              .end(function (err, res) {
                if (err) return done(err)

                res.body['results'].should.exist
                res.body['results'].should.be.Array
                res.body['results'].length.should.equal(0)

                done()
              })
          })
      })
    })
  })

  it('should return deleted count if config.feedback is true', function (done) {
    const originalFeedback = config.get('feedback')

    config.set('feedback', true)

    const client = request(connectionString)

    client
      .post('/vtest/testdb/test-schema')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send({field1: 'doc to remove 2'})
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err)

        const doc = res.body.results[0]

        client
        .post('/vtest/testdb/test-schema')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send({field1: 'doc to remain'})
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err)

          client
            .delete('/vtest/testdb/test-schema/' + doc._id)
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            // .expect('content-type', 'application/json')
            .end(function (err, res) {
              config.set('feedback', originalFeedback)
              if (err) return done(err)

              res.body.status.should.equal('success')
              res.body.deleted.should.equal(1)
              res.body.totalCount.should.equal(1)
              done()
            })
        })
      })
  })

  it('should return 404 when deleting a non-existing document by ID (RESTful)', function (done) {
    const client = request(connectionString)

    client
      .delete('/vtest/testdb/test-schema/59f1b3e038ad765e669ac47f')
      .set('Authorization', 'Bearer ' + bearerToken)
      .expect(404)
      .end(function (err, res) {
        if (err) return done(err)

        res.body.statusCode.should.eql(404)

        done()
      })
  })

  it('should return 200 when deleting a non-existing document by ID, supplying the query in the request body', function (done) {
    const client = request(connectionString)

    client
      .delete('/vtest/testdb/test-schema')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send({
        query: {
          _id: '59f1b3e038ad765e669ac47f'
        }
      })
      .expect(204)
      .end(function (err, res) {
        if (err) return done(err)

        res.body.should.eql('')

        done()
      })
  })
})
