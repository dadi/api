const app = require('../../../../dadi/lib/')
const config = require('../../../../config')
const EventEmitter = require('events').EventEmitter
const help = require('../../help')
const path = require('path')
const request = require('supertest')
const sinon = require('sinon')
const should = require('should')

const connectionString =
  'http://' + config.get('server.host') + ':' + config.get('server.port')

let bearerToken

describe('Collections API – GET', function() {
  this.timeout(4000)

  beforeEach(done => {
    help.dropDatabase('testdb', null, function(err) {
      if (err) return done(err)

      help.dropDatabase('library', null, function(err) {
        return done(err)
      })
    })
  })

  before(function(done) {
    app.start(function() {
      help.getBearerTokenWithAccessType('admin', function(err, token) {
        if (err) return done(err)

        bearerToken = token

        help
          .createSchemas([
            {
              version: 'vtest',
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
              fields: {
                title: {
                  type: 'String',
                  required: true
                },
                author: {
                  type: 'Reference',
                  settings: {
                    collection: 'person',
                    fields: ['name', 'spouse']
                  }
                },
                booksInSeries: {
                  type: 'Reference',
                  settings: {
                    collection: 'book',
                    multiple: true
                  }
                }
              },
              name: 'book',
              property: 'library',
              settings: {
                cache: false,
                authenticate: true,
                count: 40
              },
              version: '1.0'
            },

            {
              fields: {
                name: {
                  type: 'String',
                  required: true
                },
                occupation: {
                  type: 'String',
                  required: false
                },
                nationality: {
                  type: 'String',
                  required: false
                },
                education: {
                  type: 'String',
                  required: false
                },
                spouse: {
                  type: 'Reference'
                }
              },
              name: 'person',
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

  after(function(done) {
    help.dropSchemas().then(() => {
      app.stop(() => {
        done()
      })
    })
  })

  it('should get documents', function(done) {
    const doc = {
      field1: 'something'
    }

    help.createDocWithParams(bearerToken, doc, function(err, doc) {
      if (err) return done(err)

      const client = request(connectionString)

      client
        .get('/testdb/test-schema?cache=false')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function(err, res) {
          if (err) return done(err)

          res.body.results.should.exist
          res.body.results.should.be.Array
          res.body.results.length.should.be.above(0)
          done()
        })
    })
  })

  it('should get documents with the internal fields prefixed with the character defined in config', function(done) {
    const originalPrefix = config.get('internalFieldsPrefix')

    help.createDoc(bearerToken, function(err, doc) {
      if (err) return done(err)

      config.set('internalFieldsPrefix', '$')

      const client = request(connectionString)

      client
        .get('/testdb/test-schema/' + doc._id)
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function(err, res) {
          if (err) return done(err)

          res.body.results[0].$id.should.exist
          should.not.exist(res.body.results[0]._id)
          res.body.results[0].$id.should.eql(doc._id)

          config.set('internalFieldsPrefix', originalPrefix)

          done()
        })
    })
  })

  it('should allow case insensitive query', function(done) {
    const doc = {field1: 'Test', field2: null}

    help.createDocWithParams(bearerToken, doc, function(err) {
      if (err) return done(err)

      const client = request(connectionString)
      let query = {
        field1: 'test'
      }

      query = encodeURIComponent(JSON.stringify(query))

      client
        .get('/testdb/test-schema?cache=false&filter=' + query)
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function(err, res) {
          if (err) return done(err)

          res.body.results.should.exist
          res.body.results.should.be.Array
          res.body.results.length.should.equal(1)
          res.body.results[0].field1.should.equal('Test')
          done()
        })
    })
  })

  it('should allow case insensitive regex query', function(done) {
    const doc = {field1: 'Test', field2: null}

    help.createDocWithParams(bearerToken, doc, function(err) {
      if (err) return done(err)

      const client = request(connectionString)
      let query = {
        field1: {$regex: 'tes'}
      }

      query = encodeURIComponent(JSON.stringify(query))

      client
        .get('/testdb/test-schema?cache=false&filter=' + query)
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function(err, res) {
          if (err) return done(err)

          let found = false

          res.body.results.should.exist
          res.body.results.should.be.Array

          res.body.results.forEach((value, key) => {
            if (value.field1 === 'Test') found = true
          })

          found.should.be.true

          done()
        })
    })
  })

  it('should allow null values in query when converting to case insensitive', function(done) {
    const doc = {field1: 'Test', field2: null}

    help.createDocWithParams(bearerToken, doc, function(err) {
      if (err) return done(err)

      const client = request(connectionString)
      let query = {
        field2: null
      }

      query = encodeURIComponent(JSON.stringify(query))

      client
        .get('/testdb/test-schema?cache=false&filter=' + query)
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function(err, res) {
          if (err) return done(err)

          let found = false

          res.body.results.should.exist
          res.body.results.should.be.Array

          res.body.results.forEach((value, key) => {
            if (value.field1 === 'Test') found = true
          })

          found.should.be.true

          done()
        })
    })
  })

  it('should not display fields with null values', function(done) {
    const doc = {field1: null}

    help.createDocWithParams(bearerToken, doc, function(err, doc) {
      if (err) return done(err)

      const client = request(connectionString)

      client
        .get('/testdb/test-schema/' + doc._id)
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function(err, res) {
          if (err) return done(err)

          res.body.results.should.exist
          res.body.results.should.be.Array
          res.body.results[0].should.exist
          res.body.results[0]._id.should.exist
          should.not.exist(res.body.results[0].field1)

          done()
        })
    })
  })

  it('should return specified fields only when supplying `fields` param', function(done) {
    const doc = {field1: 'Test', field2: null}

    help.createDocWithParams(bearerToken, doc, function(err) {
      if (err) return done(err)

      const client = request(connectionString)

      const fields = {
        field1: 1
      }

      const query = encodeURIComponent(JSON.stringify(fields))

      client
        .get('/testdb/test-schema?cache=false&fields=' + query)
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function(err, res) {
          if (err) return done(err)

          const {results} = res.body

          results.should.exist
          results.should.be.Array
          results.length.should.eql(1)
          results[0]._id.should.exist
          Object.keys(results[0]).length.should.eql(2)

          done()
        })
    })
  })

  it('should allow specifying fields with underscores (issue #140)', function(done) {
    const doc = {
      field1: 'Test',
      field2: null,
      _fieldWithUnderscore: {first: 'Ernest', last: 'Hemingway'}
    }

    help.createDocWithParams(bearerToken, doc, function(err) {
      if (err) return done(err)

      const client = request(connectionString)

      const fields = {
        _fieldWithUnderscore: 1
      }

      const query = encodeURIComponent(JSON.stringify(fields))

      client
        .get('/testdb/test-schema?cache=false&fields=' + query)
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function(err, res) {
          if (err) return done(err)

          const {results} = res.body

          results.should.exist
          results.should.be.Array
          Object.keys(results[0]).length.should.eql(2)
          results[0]._id.should.exist
          results[0]._fieldWithUnderscore.should.exist

          done()
        })
    })
  })

  it('should return empty results when using unknown filter params', function(done) {
    help.createDoc(bearerToken, function(err, doc1) {
      if (err) return done(err)
      help.createDoc(bearerToken, function(err, doc2) {
        if (err) return done(err)

        const client = request(connectionString)

        let query = {
          uncle: 'bob'
        }

        query = encodeURIComponent(JSON.stringify(query))

        client
          .get('/testdb/test-schema?filter=' + query)
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .expect('content-type', 'application/json')
          .end(function(err, res) {
            if (err) return done(err)

            res.body.results.should.exist
            res.body.results.should.be.Array
            res.body.results.length.should.equal(0)
            done()
          })
      })
    })
  })

  it('should find specific document using filter param', function(done) {
    help.createDoc(bearerToken, function(err, doc1) {
      if (err) return done(err)
      help.createDoc(bearerToken, function(err, doc2) {
        if (err) return done(err)

        const client = request(connectionString)
        const docId = doc2._id
        let query = {
          _id: doc2._id
        }

        query = encodeURIComponent(JSON.stringify(query))
        client
          .get('/testdb/test-schema?filter=' + query)
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .expect('content-type', 'application/json')
          .end(function(err, res) {
            if (err) return done(err)

            res.body.results.should.exist
            res.body.results.should.be.Array
            res.body.results.length.should.equal(1)
            res.body.results[0]._id.should.equal(docId)
            done()
          })
      })
    })
  })

  it('should apply configured prefix to any internal fields present in the filter param', function(done) {
    const originalPrefix = config.get('internalFieldsPrefix')

    help.createDoc(bearerToken, function(err, doc) {
      if (err) return done(err)

      config.set('internalFieldsPrefix', '$')

      const client = request(connectionString)
      let query = {
        $id: doc._id
      }

      query = encodeURIComponent(JSON.stringify(query))

      client
        .get('/testdb/test-schema?filter=' + query)
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function(err, res) {
          if (err) return done(err)

          res.body.results.should.exist
          res.body.results.should.be.Array
          res.body.results.length.should.equal(1)
          res.body.results[0].$id.should.eql(doc._id)
          should.not.exist(res.body.results[0]._id)

          config.set('internalFieldsPrefix', originalPrefix)

          done()
        })
    })
  })

  it('should find specific document using request param', function(done) {
    help.createDoc(bearerToken, function(err, doc1) {
      if (err) return done(err)
      help.createDoc(bearerToken, function(err, doc2) {
        if (err) return done(err)

        const client = request(connectionString)
        const docId = doc2._id

        client
          .get('/testdb/test-schema/' + doc2._id)
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .expect('content-type', 'application/json')
          .end(function(err, res) {
            if (err) return done(err)

            res.body.results.should.exist
            res.body.results.should.be.Array
            res.body.results.length.should.equal(1)
            res.body.results[0]._id.should.equal(docId)
            done()
          })
      })
    })
  })

  it('should find documents when using request param and filter', function(done) {
    help.createDoc(bearerToken, function(err, doc1) {
      if (err) return done(err)
      help.createDoc(
        bearerToken,
        function(err, doc2) {
          if (err) return done(err)

          setTimeout(function() {
            const client = request(connectionString)
            const docId = doc2._id
            let query = {
              field1: {$gt: '0'}
            }

            query = encodeURIComponent(JSON.stringify(query))

            client
              .get(
                '/testdb/test-schema/' +
                  doc2._id +
                  '?cache=false&filter=' +
                  query
              )
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .expect('content-type', 'application/json')
              .end(function(err, res) {
                if (err) return done(err)

                res.body.results.should.exist
                res.body.results.should.be.Array
                res.body.results.length.should.equal(1)
                res.body.results[0]._id.should.equal(docId)
                done()
              })
          })
        },
        1000
      )
    })
  })

  it('should find specific documents using a standard query', function(done) {
    help.createDoc(bearerToken, function(err, doc1) {
      if (err) return done(err)
      help.createDoc(bearerToken, function(err, doc2) {
        if (err) return done(err)

        const client = request(connectionString)
        const docId = doc2._id
        let query = {
          _id: doc2._id
        }

        query = encodeURIComponent(JSON.stringify(query))
        client
          .get('/testdb/test-schema?filter=' + query)
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .expect('content-type', 'application/json')
          .end(function(err, res) {
            if (err) return done(err)

            res.body.results.should.exist
            res.body.results.should.be.Array
            res.body.results.length.should.equal(1)
            res.body.results[0]._id.should.equal(docId)
            done()
          })
      })
    })
  })

  it('should find all documents using a standard query', function(done) {
    help.createDoc(bearerToken, function(err, doc1) {
      if (err) return done(err)
      help.createDoc(bearerToken, function(err, doc2) {
        if (err) return done(err)

        const client = request(connectionString)
        let query = {}

        query = encodeURIComponent(JSON.stringify(query))
        client
          .get('/testdb/test-schema?filter=' + query)
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .expect('content-type', 'application/json')
          .end(function(err, res) {
            if (err) return done(err)

            res.body.results.should.exist
            res.body.results.should.be.Array
            res.body.results.length.should.be.above(1)
            done()
          })
      })
    })
  })

  it('should find one document using a standard query with count=1', function(done) {
    help.createDoc(bearerToken, function(err, doc1) {
      if (err) return done(err)
      help.createDoc(bearerToken, function(err, doc2) {
        if (err) return done(err)

        const client = request(connectionString)

        client
          .get('/testdb/test-schema?count=1&cache=false')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .expect('content-type', 'application/json')
          .end(function(err, res) {
            if (err) return done(err)

            res.body.results.should.exist
            res.body.results.should.be.Array
            res.body.results.length.should.equal(1)
            done()
          })
      })
    })
  })

  it('should return single document when querystring param count=1', function(done) {
    // create a bunch of docs
    const ac = new EventEmitter()
    let count = 0

    for (let i = 0; i < 10; ++i) {
      const doc = {
        field1: ((Math.random() * 10) | 0).toString(),
        field2: (Math.random() * 10) | 0
      }

      help.createDocWithParams(bearerToken, doc, function(err) {
        if (err) return ac.emit('error', err)
        count += 1
        if (count > 9) ac.emit('ready')
      })
    }

    ac.on('ready', function() {
      // documents are loaded and test can start
      const client = request(connectionString)

      client
        .get('/testdb/test-schema?count=1')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function(err, res) {
          if (err) return done(err)

          res.body.results.should.exist
          res.body.results.should.be.Array
          res.body.results.length.should.equal(1)
          done()
        })
    })
  })

  describe('query string params', function() {
    beforeEach(() => {
      const total = 46
      const data = []

      for (let i = 0; i < total; ++i) {
        const number = i % 2 === 0 ? i : total - i
        const doc = {
          field1: (number < 10 ? '0' : '') + number.toString()
        }

        data.push(doc)
      }

      return help.createDocument({
        database: 'testdb',
        document: data,
        collection: 'test-schema',
        token: bearerToken,
        version: 'vtest'
      })
    })

    it('should paginate results', function(done) {
      const client = request(connectionString)
      const docCount = 20

      client
        .get('/testdb/test-schema?page=1&count=' + docCount)
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function(err, res) {
          if (err) return done(err)

          res.body.results.should.exist
          res.body.results.should.be.Array
          res.body.results.length.should.equal(docCount)

          done()
        })
    })

    it('should return pagination metadata', function(done) {
      const client = request(connectionString)
      const docCount = 20

      client
        .get('/testdb/test-schema?page=1&count=' + docCount)
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function(err, res) {
          if (err) return done(err)

          res.body.metadata.should.exist
          res.body.metadata.page.should.equal(1)
          res.body.metadata.limit.should.equal(docCount)
          res.body.metadata.totalPages.should.be.above(1) // Math.ceil(# documents/20 per page)
          res.body.metadata.nextPage.should.equal(2)
          res.body.metadata.nextPageUrl.should.eql(
            '/testdb/test-schema?page=2&count=' + docCount
          )

          done()
        })
    })

    it('should return correct pagination nextPage value', function(done) {
      const client = request(connectionString)
      const docCount = 20

      client
        .get('/testdb/test-schema?page=2&count=' + docCount)
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function(err, res) {
          if (err) return done(err)

          res.body.metadata.should.exist
          res.body.metadata.page.should.equal(2)
          res.body.metadata.nextPage.should.equal(3)
          res.body.metadata.nextPageUrl.should.eql(
            '/testdb/test-schema?page=3&count=' + docCount
          )
          res.body.metadata.prevPage.should.equal(1)
          res.body.metadata.prevPageUrl.should.eql(
            '/testdb/test-schema?page=1&count=' + docCount
          )

          done()
        })
    })

    it('should use schema defaults if not provided', function(done) {
      const client = request(connectionString)

      client
        .get('/testdb/test-schema?cache=false') // make sure not hitting cache
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function(err, res) {
          if (err) return done(err)

          res.body.results.should.exist
          res.body.results.should.be.Array
          res.body.results.length.should.equal(40)
          done()
        })
    })

    it('should show later pages', function(done) {
      const client = request(connectionString)

      client
        .get('/testdb/test-schema?count=20&page=1')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function(err, res) {
          if (err) return done(err)

          res.body.results.should.exist
          res.body.results.should.be.Array
          res.body.results.length.should.equal(20)

          const eleventhDoc = res.body.results[10]

          client
            .get('/testdb/test-schema?count=10&page=2')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .expect('content-type', 'application/json')
            .end(function(err, res) {
              if (err) return done(err)

              res.body.results.should.exist
              res.body.results.should.be.Array
              res.body.results.length.should.equal(10)

              // make sure second page starts in correct position
              res.body.results[0]._id.should.equal(eleventhDoc._id)

              done()
            })
        })
    })

    it('should allow sorting results', function(done) {
      const client = request(connectionString)

      client
        .get('/testdb/test-schema?sort=field1')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function(err, res) {
          if (err) return done(err)

          res.body.results.should.exist
          res.body.results.should.be.Array
          res.body.results.length.should.equal(40)

          let max = ''

          res.body.results.forEach(function(doc) {
            if (doc.field1) {
              doc.field1.should.not.be.below(max)
              max = doc.field1
            }
          })

          done()
        })
    })

    it('should allow specifying descending sort order', function(done) {
      const client = request(connectionString)

      client
        .get('/testdb/test-schema?sort=field1&sortOrder=desc')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function(err, res) {
          if (err) return done(err)

          res.body.results.should.exist
          res.body.results.should.be.Array
          res.body.results.length.should.equal(40)

          let last = ''

          res.body.results.forEach(function(doc) {
            if (last) doc.field1.should.not.be.above(last)
            last = doc.field1
          })

          done()
        })
    })

    it('should allow specifying ascending sort order', function(done) {
      const client = request(connectionString)

      client
        .get('/testdb/test-schema?sort=field1&sortOrder=asc')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function(err, res) {
          if (err) return done(err)

          res.body.results.should.exist
          res.body.results.should.be.Array
          res.body.results.length.should.equal(40)

          let last = ''

          res.body.results.forEach(function(doc) {
            if (last) doc.field1.should.not.be.below(last)
            last = doc.field1
          })

          done()
        })
    })

    it('should return 400 if invalid skip option is provided', function(done) {
      const client = request(connectionString)

      client
        .get('/testdb/test-schema?skip=-1')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(400)
        .expect('content-type', 'application/json')
        .end(function(err, res) {
          if (err) return done(err)

          res.body['errors'].should.exist
          res.body['errors'][0].title.should.eql(
            'Invalid Skip Parameter Provided'
          )

          done()
        })
    })

    it('should return 400 if skip option is alphabetical', function(done) {
      const client = request(connectionString)

      client
        .get('/testdb/test-schema?skip=a')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(400)
        .expect('content-type', 'application/json')
        .end(function(err, res) {
          if (err) return done(err)

          res.body['errors'].should.exist
          res.body['errors'][0].title.should.eql(
            'Invalid Skip Parameter Provided'
          )

          done()
        })
    })

    it('should return 400 if invalid page option is provided', function(done) {
      const client = request(connectionString)

      client
        .get('/testdb/test-schema?page=-1')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(400)
        .expect('content-type', 'application/json')
        .end(function(err, res) {
          if (err) return done(err)

          res.body['errors'].should.exist
          res.body['errors'][0].title.should.eql(
            'Invalid Page Parameter Provided'
          )

          done()
        })
    })

    it('should return multiple errors if invalid page and skip options are provided', function(done) {
      const client = request(connectionString)

      client
        .get('/testdb/test-schema?page=-1&skip=-8')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(400)
        .expect('content-type', 'application/json')
        .end(function(err, res) {
          if (err) return done(err)

          res.body['errors'].should.exist
          res.body['errors'].length.should.eql(2)

          done()
        })
    })

    it('should return javascript if `callback` is provided', function(done) {
      const client = request(connectionString)
      const callbackName = 'testCallback'

      client
        .get('/testdb/test-schema?callback=' + callbackName)
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .expect('content-type', 'text/javascript')
        .end(function(err, res) {
          if (err) return done(err)

          res.text.slice(0, callbackName.length).should.equal(callbackName)
          res.text.slice(-2).should.equal(');')
          done()
        })
    })

    it('should include correct Content-Encoding header for gzipped responses', function(done) {
      help.createDoc(bearerToken, function(err, doc1) {
        if (err) return done(err)
        help.createDoc(bearerToken, function(err, doc2) {
          if (err) return done(err)

          const client = request(connectionString)

          client
            .get('/testdb/test-schema')
            .set('Accept-Encoding', 'gzip, deflate')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              if (err) return done(err)

              res.headers['content-encoding'].should.exist
              res.headers['content-encoding'].should.eql('gzip')

              done()
            })
        })
      })
    })

    it('should not include Content-Encoding header for uncompressed responses', function(done) {
      help.createDoc(bearerToken, function(err, doc1) {
        if (err) return done(err)
        help.createDoc(bearerToken, function(err, doc2) {
          if (err) return done(err)

          const client = request(connectionString)

          client
            .get('/testdb/test-schema')
            .set('Accept-Encoding', 'identity')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              if (err) return done(err)

              should.not.exist(res.headers['content-encoding'])
              done()
            })
        })
      })
    })

    it('should respond with 304 if etag matches If-None-Match header', function(done) {
      help.createDoc(bearerToken, function(err, doc1) {
        if (err) return done(err)
        help.createDoc(bearerToken, function(err, doc2) {
          if (err) return done(err)

          const client = request(connectionString)

          client
            .get('/testdb/test-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              if (err) return done(err)

              const etag = res.headers['etag']

              client
                .get('/testdb/test-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .set('If-None-Match', etag)
                .expect(304, done)
            })
        })
      })
    })
  })
})
