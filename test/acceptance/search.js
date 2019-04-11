const app = require('../../dadi/lib/')
const config = require('../../config')
const help = require('./help')
const model = require('../../dadi/lib/model/')
const should = require('should')
const sinon = require('sinon')
const request = require('supertest')

// variables scoped for use throughout tests
let bearerToken
let connectionString = 'http://' + config.get('server.host') + ':' + config.get('server.port')
let configBackup = config.get()

describe('Search', function () {
  this.timeout(4000)

  let cleanupFn

  before(function (done) {
    help.dropDatabase('testdb', function (err) {
      if (err) return done(err)

      config.set('search', {
        'enabled': true,
        'minQueryLength': 3,
        'wordCollection': 'words',
        'datastore': './../../../test/test-connector',
        'database': 'testdb'
      })

      config.set('i18n.languages', ['fr', 'pt'])

      app.start(function () {
        help.getBearerTokenWithAccessType('admin', function (err, token) {
          if (err) return done(err)

          bearerToken = token

          let schema = {
            'fields': {
              'field1': {
                'type': 'String',
                'required': false
              },
              'title': {
                'type': 'String',
                'required': false,
                'search': {
                  'weight': 2
                }
              },
              'field2': {
                'type': 'Number',
                'required': false
              },
              'field3': {
                'type': 'ObjectID',
                'required': false
              },
              '_fieldWithUnderscore': {
                'type': 'Object',
                'required': false
              }
            },
            'settings': {
              'count': 40
            }
          }

          help.writeTempFile(
            'temp-workspace/collections/vtest/testdb/collection.test-schema.json',
            schema,
            callback1 => {
              help.writeTempFile(
                'temp-workspace/collections/v1/testdb/collection.test-schema.json',
                schema,
                callback2 => {
                  cleanupFn = () => {
                    callback1()
                    callback2()
                  }

                  done()
                }
              )
            }
          )
        })
      })
    })
  })

  after(function (done) {
    config.set('search', {
      'enabled': false
    })

    config.set('i18n.languages', configBackup.i18n.languages)

    app.stop(() => {
      cleanupFn()
      done()
    })
  })

  describe('Disabled', function () {
    it('should return 501 when calling a /search endpoint', function (done) {
      config.set('search.enabled', false)

      var client = request(connectionString)
      client
      .get('/vtest/testdb/test-schema/search')
      .set('Authorization', 'Bearer ' + bearerToken)
      .expect(501)
      .end((err, res) => {
        config.set('search.enabled', true)
        done()
      })
    })

    describe('Indexing', function () {
      it('should return 404 when calling the index endpoint', function (done) {
        config.set('search.enabled', false)
        let client = request(connectionString)

        client
        .post('/api/index')
        .set('Authorization', 'Bearer ' + bearerToken)
        .set('content-type', 'application/json')
        .expect(404)
        .end((err, res) => {
          config.set('search.enabled', true)
          done()
        })
      })
    })
  })

  describe('Enabled', function () {
    it('should return 400 when calling a /search endpoint with no query', function (done) {
      let searchModel = model('test-schema')

      var client = request(connectionString)
      client
      .get('/vtest/testdb/test-schema/search')
      .set('Authorization', 'Bearer ' + bearerToken)
      .expect(400)
      .end(done)
    })

    it('should return 400 when calling a /search endpoint with a short query', function (done) {
      let searchModel = model('test-schema')

      var client = request(connectionString)
      client
      .get('/vtest/testdb/test-schema/search?q=xx')
      .set('Authorization', 'Bearer ' + bearerToken)
      .expect(400)
      .end((err, res) => {
        if (err) return done(err)
        done()
      })
    })

    it('should return empty results when no documents match a query', function (done) {
      let searchModel = model('test-schema')

      var client = request(connectionString)
      client
      .get('/vtest/testdb/test-schema/search?q=xxx')
      .set('Authorization', 'Bearer ' + bearerToken)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)
        should.exist(res.body.results)
        res.body.results.should.be.Array
        res.body.results.length.should.eql(0)
        done()
      })
    })

    it('should return results when documents match a query', function (done) {
      let searchModel = model('test-schema')

      var client = request(connectionString)

      var doc = {
        field1: 'The quick brown fox jumps',
        title: 'The quick brown fox jumps over the lazy dog'
      }

      client
      .post('/vtest/testdb/test-schema')
      .set('Authorization', 'Bearer ' + bearerToken)
      .set('content-type', 'application/json')
      .send(doc)
      .expect(200)
      .end((err, res) => {
        setTimeout(() => {
          client
          .get('/vtest/testdb/test-schema/search?q=quick%20brown')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            should.exist(res.body.results)
  
            res.body.results.should.be.Array
            res.body.results.length.should.eql(1)
  
            done()
          })
        }, 1000)
      })
    })

    it('should update the index on update of documents', function (done) {
      let searchModel = model('test-schema')

      var client = request(connectionString)

      var doc = {
        field1: 'Tycho - Elsewhere',
        title: 'Burning Man Sunrise Set 2015'
      }

      client
      .post('/vtest/testdb/test-schema')
      .set('Authorization', 'Bearer ' + bearerToken)
      .set('content-type', 'application/json')
      .send(doc)
      .expect(200)
      .end((err, res) => {
        let insertedDocument = res.body.results[0]

        setTimeout(() => {
          client
          .get('/vtest/testdb/test-schema/search?q=sunrise')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            should.exist(res.body.results)
  
            res.body.results.should.be.Array
            res.body.results.length.should.eql(1)
  
            // update the document
            doc.field1 = 'The Big Friendly Giant'
            doc.title = 'You Never Saw Such a Thing'
  
            client
            .put('/vtest/testdb/test-schema/' + insertedDocument._id)
            .set('Authorization', 'Bearer ' + bearerToken)
            .set('content-type', 'application/json')
            .send(doc)
            .expect(200)
            .end((err, res) => {
              setTimeout(() => {
                client
                .get('/vtest/testdb/test-schema/search?q=sunrise')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .end((err, res) => {
                  if (err) return done(err)
                  should.exist(res.body.results)
    
                  res.body.results.should.be.Array
                  res.body.results.length.should.eql(0)
    
                  client
                  .get('/vtest/testdb/test-schema/search?q=thing')
                  .set('Authorization', 'Bearer ' + bearerToken)
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done(err)
                    should.exist(res.body.results)
    
                    res.body.results.should.be.Array
                    res.body.results.length.should.eql(1)
    
                    res.body.results[0]._id.should.eql(insertedDocument._id)
    
                    done()
                  })
                })
              }, 800)
            })
          })
        }, 800)
      })
    })

    it('should return metadata containing the search term', function (done) {
      let searchModel = model('test-schema')

      var client = request(connectionString)

      var doc = {
        field1: 'The quick brown fox jumps',
        title: 'The quick brown fox jumps over the lazy dog'
      }

      client
      .post('/vtest/testdb/test-schema')
      .set('Authorization', 'Bearer ' + bearerToken)
      .set('content-type', 'application/json')
      .send(doc)
      .expect(200)
      .end((err, res) => {
        client
        .get('/vtest/testdb/test-schema/search?q=quick%20brown')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          should.exist(res.body.metadata)
          should.exist(res.body.metadata.search)
          res.body.metadata.search.should.eql('quick brown')

          done()
        })
      })
    })
  })

  describe.skip('Indexing', function () {
    it('should return 204 when calling the index endpoint', function (done) {
      let searchModel = model('test-schema')

      let client = request(connectionString)
      let stub = sinon.spy(searchModel.searchHandler, 'batchIndex')

      client
      .post('/api/index')
      .set('Authorization', 'Bearer ' + bearerToken)
      .set('content-type', 'application/json')
      .expect(204)
      .end((err, res) => {
        stub.called.should.be.true
        stub.restore()
        done()
      })
    })
  })

  describe.skip('Multi-language', function () {
    it('should retrieve all language variations if no `lang` parameter is supplied', done => {
      let document = {
        title: 'The Little Prince',
        'title:pt': 'O Principezinho',
        'title:fr': 'Le Petit Prince'
      }

      var client = request(connectionString)

      client
      .post('/vtest/testdb/test-schema')
      .set('Authorization', `Bearer ${bearerToken}`)
      .send(document)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        client
        .get(`/vtest/testdb/test-schema/search?q=Prince`)
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(200)
        .end((err, res) => {
          res.body.results.length.should.eql(1)

          let result = res.body.results[0]

          result.title.should.eql(document.title)
          result['title:pt'].should.eql(document['title:pt'])
          result['title:fr'].should.eql(document['title:fr'])

          should.not.exist(result._i18n)

          done()
        })
      })
    })

    it('should return the translation version of a field when there is one set for the language in the `lang` parameter, falling back to the default language', done => {
      config.set('i18n.languages', ['pt', 'fr'])

      let documents = [
        {
          title: 'The Little Prince',
          'title:pt': 'O Principezinho',
          'title:fr': 'Le Petit Prince'
        },
        {
          title: 'The Untranslatable'
        }
      ]

      var client = request(connectionString)

      client
      .post(`/vtest/testdb/test-schema`)
      .set('Authorization', `Bearer ${bearerToken}`)
      .send(documents)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        client
        .get('/vtest/testdb/test-schema/search?q=Principezinho&lang=pt')
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(200)
        .end((err, res) => {
          res.body.results.length.should.eql(2)

          let results = res.body.results

          results[0].title.should.eql(documents[0]['title:pt'])
          results[0]._i18n.title.should.eql('pt')
          should.not.exist(results[0]['title:pt'])
          should.not.exist(results[0]['title:fr'])

          // results[1].title.should.eql(documents[1].title)
          // results[1]._i18n.title.should.eql(
          //   config.get('i18n.defaultLanguage')
          // )
          // should.not.exist(results[1]['title:pt'])
          // should.not.exist(results[1]['title:fr'])

          config.set('i18n.languages', configBackup.i18n.languages)

          done()
        })
      })
    })

    it('should return the translation version of a field when the fields projection is set to include the field in question', done => {
      config.set('i18n.languages', ['pt', 'fr'])

      let documents = [
        {
          title: 'The Little Prince',
          'title:pt': 'O Principezinho',
          'title:fr': 'Le Petit Prince'
        },
        {
          title: 'The Untranslatable'
        }
      ]

      var client = request(connectionString)

      client
      .post('/vtest/testdb/test-schema')
      .set('Authorization', `Bearer ${bearerToken}`)
      .send(documents)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        client
        .get(`/vtest/testdb/test-schema/search?q=Principezinho&fields={"title":1}&lang=pt`)
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(200)
        .end((err, res) => {
          let results = res.body.results

          results[0].title.should.eql(documents[0]['title:pt'])
          results[0]._i18n.title.should.eql('pt')
          should.not.exist(results[0]['title:pt'])
          should.not.exist(results[0]['title:fr'])

          // results[1].title.should.eql(documents[1].title)
          // results[1]._i18n.title.should.eql(
          //   config.get('i18n.defaultLanguage')
          // )
          // should.not.exist(results[1]['title:pt'])
          // should.not.exist(results[1]['title:fr'])

          config.set('i18n.languages', configBackup.i18n.languages)

          done()
        })
      })
    })

    it('should return the original version of a field when the requested language is not part of `i18n.languages`', done => {
      config.set('i18n.languages', ['fr'])

      let document = {
        title: 'The Little Prince',
        'title:pt': 'O Principezinho',
        'title:fr': 'Le Petit Prince'
      }

      var client = request(connectionString)

      client
      .post('/vtest/testdb/test-schema')
      .set('Authorization', `Bearer ${bearerToken}`)
      .send(document)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        client
        .get(`/vtest/testdb/test-schema/search?q=Prince&fields={"title":1}&lang=pt`)
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(200)
        .end((err, res) => {
          // res.body.results.length.should.eql(1)

          let results = res.body.results

          results[0].title.should.eql(document.title)
          results[0]._i18n.title.should.eql('en')
          should.not.exist(results[0]['title:pt'])
          should.not.exist(results[0]['title:fr'])

          config.set('i18n.languages', configBackup.i18n.languages)

          done()
        })
      })
    })
  })
})
