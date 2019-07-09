const app = require('../../../../dadi/lib/')
const config = require('../../../../config')
const help = require('../../help')
const request = require('supertest')
const should = require('should')

const connectionString =
  'http://' + config.get('server.host') + ':' + config.get('server.port')
const configBackup = config.get()

let bearerToken

describe('Collections API – DELETE', function() {
  this.timeout(4000)

  before(done => {
    app.start(() => {
      help.dropDatabase('library', function(err) {
        if (err) return done(err)

        help
          .createSchemas([
            {
              name: 'book',
              fields: {
                title: {
                  type: 'String',
                  required: true
                }
              },
              property: 'library',
              settings: {
                cache: false,
                authenticate: true,
                count: 40
              },
              version: '1.0'
            }
          ])
          .then(() => {
            done()
          })
      })
    })
  })

  after(done => {
    help.dropSchemas().then(() => {
      app.stop(done)
    })
  })

  beforeEach(done => {
    help.dropDatabase('library', null, err => {
      if (err) return done(err)

      help.getBearerToken((err, token) => {
        if (err) return done(err)

        bearerToken = token

        done()
      })
    })
  })

  it('should remove a single document by ID', function(done) {
    const client = request(connectionString)

    client
      .post('/1.0/library/book')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send({title: 'doc to remove'})
      .expect(200)
      .end(function(err, res) {
        if (err) return done(err)

        const doc = res.body.results[0]

        should.exist(doc)
        doc.title.should.equal('doc to remove')

        client
          .delete('/1.0/library/book/' + doc._id)
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(204, done)
      })
  })

  it('should remove a specific document', function(done) {
    help
      .createDocument({
        version: '1.0',
        database: 'library',
        collection: 'book',
        document: {
          title: 'One'
        },
        token: bearerToken
      })
      .then(({results}) => {
        const doc1 = results[0]

        help
          .createDocument({
            version: '1.0',
            database: 'library',
            collection: 'book',
            document: {
              title: 'Two'
            },
            token: bearerToken
          })
          .then(({results}) => {
            const doc2 = results[0]
            const client = request(connectionString)

            client
              .delete('/1.0/library/book/' + doc1._id)
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(204)
              .end(function(err) {
                if (err) return done(err)

                const filter = encodeURIComponent(
                  JSON.stringify({
                    _id: doc2._id
                  })
                )

                client
                  .get('/1.0/library/book?filter=' + filter)
                  .set('Authorization', 'Bearer ' + bearerToken)
                  .expect(200)
                  .expect('content-type', 'application/json')
                  .end(function(err, res) {
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

  it('should remove all documents affected by the query property supplied in the request body', function(done) {
    help
      .createDocument({
        version: '1.0',
        database: 'library',
        collection: 'book',
        document: {
          title: 'One'
        },
        token: bearerToken
      })
      .then(({results}) => {
        const documentId = results[0]._id
        const client = request(connectionString)

        client
          .delete('/1.0/library/book')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({
            query: {
              _id: documentId
            }
          })
          .expect(204)
          .end(function(err) {
            if (err) return done(err)

            client
              .get('/1.0/library/book/' + documentId)
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect('content-type', 'application/json')
              .expect(404)
              .end(done)
          })
      })
  })

  it('should remove all documents affected by the query property supplied in the request body, translating any internal fields to the prefix defined in config', function(done) {
    config.set('internalFieldsPrefix', '$')

    help
      .createDocument({
        version: '1.0',
        database: 'library',
        collection: 'book',
        document: {
          title: 'One'
        },
        token: bearerToken
      })
      .then(({results}) => {
        const documentId = results[0].$id
        const client = request(connectionString)

        client
          .delete('/1.0/library/book')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({
            query: {
              $id: documentId
            }
          })
          .expect(204)
          .end(function(err) {
            if (err) return done(err)

            client
              .get('/1.0/library/book/' + documentId)
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(404)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                config.set(
                  'internalFieldsPrefix',
                  configBackup.internalFieldsPrefix
                )

                done(err)
              })
          })
      })
  })

  it('should delete documents matching an $in query', function(done) {
    help
      .createDocument({
        version: '1.0',
        database: 'library',
        collection: 'book',
        document: {
          title: 'One'
        },
        token: bearerToken
      })
      .then(({results}) => {
        const documentId = results[0]._id
        const body = {
          query: {
            _id: {
              $in: [documentId]
            }
          }
        }

        const client = request(connectionString)

        client
          .delete('/1.0/library/book/')
          .send(body)
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(204)
          .end(function(err) {
            if (err) return done(err)

            const filter = encodeURIComponent(
              JSON.stringify({
                _id: documentId
              })
            )

            client
              .get('/1.0/library/book?filter=' + filter)
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .expect('content-type', 'application/json')
              .end(function(err, res) {
                if (err) return done(err)

                res.body['results'].should.exist
                res.body['results'].should.be.Array
                res.body['results'].length.should.equal(0)

                done()
              })
          })
      })
  })

  it('should return deleted count if config.feedback is true', function(done) {
    config.set('feedback', true)

    const client = request(connectionString)

    client
      .post('/1.0/library/book')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send({title: 'doc to remove 2'})
      .expect(200)
      .end(function(err, res) {
        if (err) return done(err)

        const doc = res.body.results[0]

        client
          .post('/1.0/library/book')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({title: 'doc to remain'})
          .expect(200)
          .end(function(err, res) {
            if (err) return done(err)

            client
              .get('/1.0/library/book')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .end(function(err, res) {
                client
                  .delete('/1.0/library/book/' + doc._id)
                  .set('Authorization', 'Bearer ' + bearerToken)
                  .expect(200)
                  .end(function(err, res) {
                    config.set('feedback', configBackup.feedback)
                    if (err) return done(err)

                    res.body.status.should.equal('success')
                    res.body.deleted.should.equal(1)
                    res.body.totalCount.should.equal(1)
                    done()
                  })
              })
          })
      })
  })

  it('should return 404 when deleting a non-existing document by ID (RESTful)', function(done) {
    const client = request(connectionString)

    client
      .delete('/1.0/library/book/59f1b3e038ad765e669ac47f')
      .set('Authorization', 'Bearer ' + bearerToken)
      .expect(404)
      .end(function(err, res) {
        if (err) return done(err)

        res.body.statusCode.should.eql(404)

        done()
      })
  })

  it('should return 200 when deleting a non-existing document by ID, supplying the query in the request body', function(done) {
    const client = request(connectionString)

    client
      .delete('/1.0/library/book')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send({
        query: {
          _id: '59f1b3e038ad765e669ac47f'
        }
      })
      .expect(204)
      .end(function(err, res) {
        if (err) return done(err)

        res.body.should.eql('')

        done()
      })
  })
})
