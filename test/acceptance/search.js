const app = require('../../dadi/lib/')
const config = require('../../config')
const help = require('./help')
const search = require('../../dadi/lib/model/search')
const should = require('should')
const sinon = require('sinon')
const request = require('supertest')

describe.only('Search', function () {
  this.timeout(4000)

  const client = request(`http://${config.get('server.host')}:${config.get('server.port')}`)
  const configBackup = config.get()

  let bearerToken
  let cleanupFn

  beforeEach(done => {
    help.dropDatabase('search', err => {
      if (err) return done(err)

      help.dropDatabase('testdb', err => {
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
          help.getBearerTokenWithAccessType('admin', (err, token) => {
            if (err) return done(err)
  
            bearerToken = token
  
            const schema = {
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
                  'type': 'Object',
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
  })

  afterEach(done => {
    config.set('search', configBackup.search)
    config.set('i18n.languages', configBackup.i18n.languages)

    app.stop(() => {
      cleanupFn()
      done()
    })
  })

  describe('when search is disabled', function () {
    it('should return 501 when calling a /search endpoint', done => {
      config.set('search.enabled', false)

      client
      .get('/vtest/testdb/test-schema/search')
      .set('Authorization', 'Bearer ' + bearerToken)
      .expect(501)
      .end((err, res) => {
        config.set('search.enabled', true)
        done()
      })
    })

    it('should return 404 when calling the batch index endpoint', done => {
      config.set('search.enabled', false)

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

  describe('when search is enabled', function () {
    describe('single collection search', () => {
      it('should return 400 when searching with no query', done => {
        client
        .get('/vtest/testdb/test-schema/search')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(400)
        .end(done)
      })
  
      it('should return 400 when searching with a short query', done => {
        client
        .get('/vtest/testdb/test-schema/search?q=xx')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(400)
        .end((err, res) => {
          done(err)
        })
      })
  
      it('should return empty results when no documents match a query', done => {
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
  
      it('should return results when documents match a query', done => {
        const doc = {
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
  
      it('should update the index on update of documents', done => {
        const doc = {
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
  
      it('should return metadata containing the search term', done => {
        const doc = {
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
  })

  describe('Batch indexing', function () {
    it('should return 204 when calling the index endpoint', done => {
      const stub = sinon.spy(search, 'batchIndexCollections')

      client
      .post('/api/index')
      .set('Authorization', 'Bearer ' + bearerToken)
      .set('content-type', 'application/json')
      .expect(204)
      .end((err, res) => {
        stub.called.should.be.true
        stub.restore()

        done(err)
      })
    })
  })

  describe('Multi-language', function () {
    it('should retrieve all language variations if no `lang` parameter is supplied', done => {
      const document = {
        title: 'The Little Prince',
        'title:pt': 'O Principezinho',
        'title:fr': 'Le Petit Prince'
      }

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

          const result = res.body.results[0]

          result.title.should.eql(document.title)
          result['title:pt'].should.eql(document['title:pt'])
          result['title:fr'].should.eql(document['title:fr'])

          should.not.exist(result._i18n)

          done()
        })
      })
    })

    it('should only search on main language fields if no `lang` parameter was supplied', done => {
      config.set('i18n.languages', ['pt', 'fr'])

      const documents = [
        {
          title: 'The Little Prince',
          'title:pt': 'O Principezinho',
          'title:fr': 'Le Petit Prince'
        }
      ]

      client
      .post(`/vtest/testdb/test-schema`)
      .set('Authorization', `Bearer ${bearerToken}`)
      .send(documents)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        setTimeout(() => {
          client
          .get('/vtest/testdb/test-schema/search?q=little')
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            res.body.results.length.should.eql(1)
  
            const {results} = res.body
  
            results[0].title.should.eql(documents[0].title)
            should.not.exist(results[0]._i18n)
  
            client
            .get('/vtest/testdb/test-schema/search?q=petit')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect(200)
            .end((err, res) => {
              res.body.results.length.should.eql(0)
    
              done(err)
            })            
          })
        }, 20)
      })
    })

    it('should only search on the language specified by the `lang` parameter, if one is supplied', done => {
      config.set('i18n.languages', ['pt', 'fr'])

      const documents = [
        {
          title: 'The Little Prince',
          'title:pt': 'O Principezinho',
          'title:fr': 'Le Petit Prince'
        }
      ]

      client
      .post(`/vtest/testdb/test-schema`)
      .set('Authorization', `Bearer ${bearerToken}`)
      .send(documents)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        setTimeout(() => {
          client
          .get('/vtest/testdb/test-schema/search?q=petit&lang=fr')
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            res.body.results.length.should.eql(1)
  
            const {results} = res.body
  
            results[0].title.should.eql(documents[0]['title:fr'])
            results[0]._i18n.title.should.eql('fr')
  
            client
            .get('/vtest/testdb/test-schema/search?q=principezinho&lang=pt')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect(200)
            .end((err, res) => {
              res.body.results.length.should.eql(1)
  
              const {results} = res.body
    
              results[0].title.should.eql(documents[0]['title:pt'])
              results[0]._i18n.title.should.eql('pt')
    
              done(err)
            })            
          })
        }, 20)
      })
    })
  })

  it('should respect a fields projection supplied via the `fields` parameter', done => {
    config.set('i18n.languages', ['pt', 'fr'])

    const documents = [
      {
        title: 'The Little Prince',
        field2: 123,
        field3: {
          author: 'Antoine de Saint-Exupéry'
        }
      }
    ]

    client
    .post(`/vtest/testdb/test-schema`)
    .set('Authorization', `Bearer ${bearerToken}`)
    .send(documents)
    .expect(200)
    .end((err, res) => {
      if (err) return done(err)

      const {_id: documentId} = res.body.results[0]

      setTimeout(() => {
        client
        .get('/vtest/testdb/test-schema/search?q=little&fields={"title":0}')
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          res.body.results.length.should.eql(1)

          const {results} = res.body

          results[0]._id.should.eql(documentId)
          should.not.exist(results[0].title)
          results[0].field2.should.eql(documents[0].field2)
          results[0].field3.should.eql(documents[0].field3)

          client
          .get('/vtest/testdb/test-schema/search?q=little&fields={"title":1}')
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect(200)
          .end((err, res) => {
            res.body.results.length.should.eql(1)

            const {results} = res.body
  
            results[0]._id.should.eql(documentId)
            results[0].title.should.eql(documents[0].title)
            should.not.exist(results[0].field2)
            should.not.exist(results[0].field3)
  
            done(err)
          })            
        })
      }, 20)
    })
  })

  it('should search a field even if it is excluded by a fields projection', done => {
    config.set('i18n.languages', ['pt', 'fr'])

    const documents = [
      {
        title: 'The Little Prince',
        'title:pt': 'O Principezinho',
        'title:fr': 'Le Petit Prince'
      }
    ]

    client
    .post(`/vtest/testdb/test-schema`)
    .set('Authorization', `Bearer ${bearerToken}`)
    .send(documents)
    .expect(200)
    .end((err, res) => {
      if (err) return done(err)

      const {_id: documentId} = res.body.results[0]

      setTimeout(() => {
        client
        .get('/vtest/testdb/test-schema/search?q=petit&lang=fr&fields={"title":0}')
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          res.body.results.length.should.eql(1)

          const {results} = res.body

          results[0]._id.should.eql(documentId)
          should.not.exist(results[0].title)

          client
          .get('/vtest/testdb/test-schema/search?q=little&fields={"_id":1}')
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect(200)
          .end((err, res) => {
            res.body.results.length.should.eql(1)

            const {results} = res.body
  
            results[0]._id.should.eql(documentId)
  
            done(err)
          })            
        })
      }, 20)
    })
  })  
})
