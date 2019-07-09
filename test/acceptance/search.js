const app = require('../../dadi/lib/')
const config = require('../../config')
const help = require('./help')
const search = require('../../dadi/lib/model/search')
const should = require('should')
const sinon = require('sinon')
const request = require('supertest')

describe('Search', function() {
  this.timeout(4000)

  const client = request(
    `http://${config.get('server.host')}:${config.get('server.port')}`
  )
  const configBackup = config.get()

  let bearerToken

  beforeEach(done => {
    help.dropDatabase('search', null, err => {
      if (err) return done(err)

      help.dropDatabase('testdb', null, err => {
        if (err) return done(err)

        config.set('search.enabled', true)
        config.set('search.minQueryLength', 3)
        config.set('search.wordCollection', 'words')
        config.set('search.datastore', './../../../test/test-connector')
        config.set('search.database', 'testdb')
        config.set('i18n.languages', ['fr', 'pt'])

        app.start(function() {
          help.getBearerTokenWithAccessType('admin', (err, token) => {
            if (err) return done(err)

            bearerToken = token

            const schema = {
              fields: {
                title: {
                  type: 'String',
                  search: {
                    weight: 2
                  }
                },
                author: {
                  type: 'String',
                  search: {
                    weight: 1
                  }
                },
                year: {
                  type: 'Number'
                }
              },
              settings: {
                count: 40
              }
            }

            help
              .createSchemas([
                Object.assign(
                  {
                    version: 'vtest',
                    property: 'testdb',
                    name: 'first-schema'
                  },
                  schema
                ),

                Object.assign(
                  {
                    version: 'vtest',
                    property: 'testdb',
                    name: 'second-schema'
                  },
                  schema
                )
              ])
              .then(() => {
                done()
              })
          })
        })
      })
    })
  })

  afterEach(done => {
    config.set('search', configBackup.search)
    config.set('i18n.languages', configBackup.i18n.languages)

    help.dropSchemas().then(() => {
      app.stop(() => {
        done()
      })
    })
  })

  describe('Single collection search', () => {
    it('should return 501 when search is disabled', done => {
      config.set('search.enabled', false)

      client
        .get('/vtest/testdb/first-schema/search?q=something')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(501)
        .end((err, res) => {
          config.set('search.enabled', true)
          done()
        })
    })

    it('should return 404 when searching a collection that does not exist', done => {
      client
        .get('/vtest/testdb/invalid-collection/search?q=quick%20brown')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(404, done)
    })

    it('should return 400 when searching with no query', done => {
      client
        .get('/vtest/testdb/first-schema/search')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(400)
        .end(done)
    })

    it('should return 400 when searching with a short query', done => {
      client
        .get('/vtest/testdb/first-schema/search?q=xx')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(400)
        .end((err, res) => {
          done(err)
        })
    })

    it('should return empty results when no documents match a query', done => {
      client
        .get('/vtest/testdb/first-schema/search?q=xxx')
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
        title: 'The quick brown fox jumps over the lazy dog'
      }

      client
        .post('/vtest/testdb/first-schema')
        .set('Authorization', 'Bearer ' + bearerToken)
        .set('content-type', 'application/json')
        .send(doc)
        .expect(200)
        .end((err, res) => {
          setTimeout(() => {
            client
              .get('/vtest/testdb/first-schema/search?q=quick%20brown')
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

    it('should update the index when documents are updated', done => {
      const doc = {
        author: 'Leo Tolstoy',
        title: 'War and Peace'
      }

      client
        .post('/vtest/testdb/first-schema')
        .set('Authorization', 'Bearer ' + bearerToken)
        .set('content-type', 'application/json')
        .send(doc)
        .expect(200)
        .end((err, res) => {
          const insertedDocument = res.body.results[0]

          setTimeout(() => {
            client
              .get('/vtest/testdb/first-schema/search?q=peace')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)
                should.exist(res.body.results)

                res.body.results.should.be.Array
                res.body.results.length.should.eql(1)

                doc.author = 'Gabriel García Márquez'
                doc.title = 'Love in the Time of Cholera'

                client
                  .put('/vtest/testdb/first-schema/' + insertedDocument._id)
                  .set('Authorization', 'Bearer ' + bearerToken)
                  .set('content-type', 'application/json')
                  .send(doc)
                  .expect(200)
                  .end((err, res) => {
                    setTimeout(() => {
                      client
                        .get('/vtest/testdb/first-schema/search?q=peace')
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .expect(200)
                        .end((err, res) => {
                          if (err) return done(err)
                          should.exist(res.body.results)

                          res.body.results.should.be.Array
                          res.body.results.length.should.eql(0)

                          client
                            .get('/vtest/testdb/first-schema/search?q=love')
                            .set('Authorization', 'Bearer ' + bearerToken)
                            .expect(200)
                            .end((err, res) => {
                              if (err) return done(err)
                              should.exist(res.body.results)

                              res.body.results.should.be.Array
                              res.body.results.length.should.eql(1)

                              res.body.results[0]._id.should.eql(
                                insertedDocument._id
                              )

                              done()
                            })
                        })
                    }, 800)
                  })
              })
          }, 800)
        })
    })

    it('should remove a document from search results when it is updated and its indexable field that would match the query has been unset', done => {
      const doc = {
        author: 'Leo Tolstoy',
        title: 'War and Peace'
      }

      client
        .post('/vtest/testdb/first-schema')
        .set('Authorization', 'Bearer ' + bearerToken)
        .set('content-type', 'application/json')
        .send(doc)
        .expect(200)
        .end((err, res) => {
          const insertedDocument = res.body.results[0]

          setTimeout(() => {
            client
              .get('/vtest/testdb/first-schema/search?q=peace')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)
                should.exist(res.body.results)

                res.body.results.should.be.Array
                res.body.results.length.should.eql(1)

                doc.author = 'Gabriel García Márquez'
                doc.title = 'Love in the Time of Cholera'

                client
                  .put('/vtest/testdb/first-schema/' + insertedDocument._id)
                  .set('Authorization', 'Bearer ' + bearerToken)
                  .set('content-type', 'application/json')
                  .send({title: null})
                  .expect(200)
                  .end((err, res) => {
                    setTimeout(() => {
                      client
                        .get('/vtest/testdb/first-schema/search?q=peace')
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .expect(200)
                        .end((err, res) => {
                          if (err) return done(err)
                          should.exist(res.body.results)

                          res.body.results.should.be.Array
                          res.body.results.length.should.eql(0)

                          done()
                        })
                    }, 800)
                  })
              })
          }, 800)
        })
    })

    it('should not update the index when only non-searchable fields are updated', done => {
      const doc = {
        author: 'Leo Tolstoy',
        title: 'War and Peace',
        year: 1869
      }
      const stub = sinon.spy(search, 'indexDocument')

      client
        .post('/vtest/testdb/first-schema')
        .set('Authorization', 'Bearer ' + bearerToken)
        .set('content-type', 'application/json')
        .send(doc)
        .expect(200)
        .end((err, res) => {
          const insertedDocument = res.body.results[0]

          setTimeout(() => {
            client
              .put('/vtest/testdb/first-schema/' + insertedDocument._id)
              .set('Authorization', 'Bearer ' + bearerToken)
              .set('content-type', 'application/json')
              .send({year: 2019})
              .expect(200)
              .end((err, res) => {
                setTimeout(() => {
                  client
                    .get('/vtest/testdb/first-schema/search?q=peace')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .end((err, res) => {
                      if (err) return done(err)
                      should.exist(res.body.results)

                      res.body.results.should.be.Array
                      res.body.results.length.should.eql(1)

                      res.body.results[0]._id.should.eql(insertedDocument._id)

                      stub.callCount.should.eql(1)

                      stub
                        .getCall(0)
                        .args[0].collection.should.eql('first-schema')
                      stub
                        .getCall(0)
                        .args[0].document.title.should.eql(doc.title)

                      stub.restore()

                      done(err)
                    })
                }, 800)
              })
          }, 800)
        })
    })

    it('should update the index when documents are deleted', done => {
      const doc = {
        author: 'Leo Tolstoy',
        title: 'War and Peace'
      }

      client
        .post('/vtest/testdb/first-schema')
        .set('Authorization', 'Bearer ' + bearerToken)
        .set('content-type', 'application/json')
        .send(doc)
        .expect(200)
        .end((err, res) => {
          const insertedDocument = res.body.results[0]

          setTimeout(() => {
            client
              .get('/vtest/testdb/first-schema/search?q=peace')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)

                should.exist(res.body.results)

                res.body.results.should.be.Array
                res.body.results.length.should.eql(1)

                doc.author = 'Gabriel García Márquez'
                doc.title = 'Love in the Time of Cholera'

                client
                  .delete('/vtest/testdb/first-schema/' + insertedDocument._id)
                  .set('Authorization', 'Bearer ' + bearerToken)
                  .set('content-type', 'application/json')
                  .expect(204)
                  .end((err, res) => {
                    if (err) return done(err)

                    setTimeout(() => {
                      client
                        .get('/vtest/testdb/first-schema/search?q=peace')
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .expect(200)
                        .end((err, res) => {
                          if (err) return done(err)
                          should.exist(res.body.results)

                          res.body.results.should.be.Array
                          res.body.results.length.should.eql(0)

                          done()
                        })
                    }, 800)
                  })
              })
          }, 800)
        })
    })

    it('should return metadata containing the search term', done => {
      const doc = {
        title: 'The quick brown fox jumps over the lazy dog'
      }

      client
        .post('/vtest/testdb/first-schema')
        .set('Authorization', 'Bearer ' + bearerToken)
        .set('content-type', 'application/json')
        .send(doc)
        .expect(200)
        .end((err, res) => {
          client
            .get('/vtest/testdb/first-schema/search?q=quick%20brown')
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

    describe('ACL', () => {
      it('should return 410 when searching a collection which the client has no read access to', done => {
        const doc = {
          title: 'The quick brown fox jumps over the lazy dog'
        }
        const testClient = {
          clientId: 'johndoe',
          secret: 'squirrel',
          resources: {}
        }

        client
          .post('/vtest/testdb/first-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .set('content-type', 'application/json')
          .send(doc)
          .expect(200)
          .end((err, res) => {
            setTimeout(() => {
              help.createACLClient(testClient).then(() => {
                client
                  .post(config.get('auth.tokenUrl'))
                  .set('content-type', 'application/json')
                  .send({
                    clientId: testClient.clientId,
                    secret: testClient.secret
                  })
                  .expect(200)
                  .expect('content-type', 'application/json')
                  .end((err, res) => {
                    if (err) return done(err)

                    const clientToken = res.body.accessToken

                    client
                      .get('/vtest/testdb/first-schema/search?q=quick%20brown')
                      .set('Authorization', 'Bearer ' + clientToken)
                      .expect(403)
                      .end((err, res) => {
                        if (err) return done(err)

                        res.body.code.should.eql('API-0006')
                        should.not.exist(res.body.results)
                        should.not.exist(res.body.metadata)

                        done()
                      })
                  })
              })
            }, 1000)
          })
      })

      it('should return results when a non-admin client has read access to the collection', done => {
        const doc = {
          title: 'Love in the Time of Cholera',
          year: 1985
        }
        const testClient = {
          clientId: 'johndoe',
          secret: 'squirrel',
          resources: {
            'collection:testdb_first-schema': {
              read: true
            }
          }
        }

        client
          .post('/vtest/testdb/first-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .set('content-type', 'application/json')
          .send(doc)
          .expect(200)
          .end((err, res) => {
            setTimeout(() => {
              help.createACLClient(testClient).then(() => {
                client
                  .post(config.get('auth.tokenUrl'))
                  .set('content-type', 'application/json')
                  .send({
                    clientId: testClient.clientId,
                    secret: testClient.secret
                  })
                  .expect(200)
                  .expect('content-type', 'application/json')
                  .end((err, res) => {
                    if (err) return done(err)

                    const clientToken = res.body.accessToken

                    client
                      .get('/vtest/testdb/first-schema/search?q=love')
                      .set('Authorization', 'Bearer ' + clientToken)
                      .expect(200)
                      .end((err, res) => {
                        if (err) return done(err)

                        should.exist(res.body.results)

                        res.body.results.should.be.Array
                        res.body.results.length.should.eql(1)
                        res.body.results[0].title.should.eql(doc.title)
                        res.body.results[0].year.should.eql(doc.year)

                        done()
                      })
                  })
              })
            }, 1000)
          })
      })

      it('should not show any fields which the client has no read access to ("includes" projection)', done => {
        const documents = [
          {
            author: 'Antoine de Saint-Exupéry',
            title: 'The Little Prince',
            year: 1943
          },
          {
            author: 'Hans Christian Andersen',
            title: 'The Little Mermaid',
            year: 1837
          },
          {
            author: 'Janny Wurts',
            title:
              'Fugitive Prince (Wars of Light & Shadow, #4; Arc 3 - Alliance of Light, #1)',
            year: 1997
          }
        ]
        const testClient = {
          clientId: 'johndoe',
          secret: 'squirrel',
          resources: {
            'collection:testdb_first-schema': {
              read: {
                fields: {
                  title: 1,
                  year: 1
                }
              }
            }
          }
        }

        client
          .post('/vtest/testdb/first-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .set('content-type', 'application/json')
          .send(documents)
          .expect(200)
          .end((err, res) => {
            setTimeout(() => {
              help.createACLClient(testClient).then(() => {
                client
                  .post(config.get('auth.tokenUrl'))
                  .set('content-type', 'application/json')
                  .send({
                    clientId: testClient.clientId,
                    secret: testClient.secret
                  })
                  .expect(200)
                  .expect('content-type', 'application/json')
                  .end((err, res) => {
                    if (err) return done(err)

                    const clientToken = res.body.accessToken

                    client
                      .get('/vtest/testdb/first-schema/search?q=prince')
                      .set('Authorization', 'Bearer ' + clientToken)
                      .expect(200)
                      .end((err, res) => {
                        if (err) return done(err)

                        should.exist(res.body.results)

                        res.body.results.should.be.Array
                        res.body.results.length.should.eql(2)

                        res.body.results[0].title.should.eql(documents[0].title)
                        res.body.results[0].year.should.eql(documents[0].year)
                        should.not.exist(res.body.results[0].author)

                        res.body.results[1].title.should.eql(documents[2].title)
                        res.body.results[1].year.should.eql(documents[2].year)
                        should.not.exist(res.body.results[1].author)

                        done()
                      })
                  })
              })
            }, 1000)
          })
      })

      it('should not show any fields which the client has no read access to ("excludes" projection)', done => {
        const documents = [
          {
            author: 'Antoine de Saint-Exupéry',
            title: 'The Little Prince',
            year: 1943
          },
          {
            author: 'Hans Christian Andersen',
            title: 'The Little Mermaid',
            year: 1837
          },
          {
            author: 'Janny Wurts',
            title:
              'Fugitive Prince (Wars of Light & Shadow, #4; Arc 3 - Alliance of Light, #1)',
            year: 1997
          }
        ]
        const testClient = {
          clientId: 'johndoe',
          secret: 'squirrel',
          resources: {
            'collection:testdb_first-schema': {
              read: {
                fields: {
                  author: 0
                }
              }
            }
          }
        }

        client
          .post('/vtest/testdb/first-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .set('content-type', 'application/json')
          .send(documents)
          .expect(200)
          .end((err, res) => {
            setTimeout(() => {
              help.createACLClient(testClient).then(() => {
                client
                  .post(config.get('auth.tokenUrl'))
                  .set('content-type', 'application/json')
                  .send({
                    clientId: testClient.clientId,
                    secret: testClient.secret
                  })
                  .expect(200)
                  .expect('content-type', 'application/json')
                  .end((err, res) => {
                    if (err) return done(err)

                    const clientToken = res.body.accessToken

                    client
                      .get('/vtest/testdb/first-schema/search?q=prince')
                      .set('Authorization', 'Bearer ' + clientToken)
                      .expect(200)
                      .end((err, res) => {
                        if (err) return done(err)

                        should.exist(res.body.results)

                        res.body.results.should.be.Array
                        res.body.results.length.should.eql(2)

                        res.body.results[0].title.should.eql(documents[0].title)
                        res.body.results[0].year.should.eql(documents[0].year)
                        should.not.exist(res.body.results[0].author)

                        res.body.results[1].title.should.eql(documents[2].title)
                        res.body.results[1].year.should.eql(documents[2].year)
                        should.not.exist(res.body.results[1].author)

                        done()
                      })
                  })
              })
            }, 1000)
          })
      })

      it('should not return results which the client has no read access to (1)', done => {
        const documents = [
          {
            author: 'Antoine de Saint-Exupéry',
            title: 'The Little Prince',
            year: 1943
          },
          {
            author: 'Hans Christian Andersen',
            title: 'The Little Mermaid',
            year: 1837
          },
          {
            author: 'Janny Wurts',
            title:
              'Fugitive Prince (Wars of Light & Shadow, #4; Arc 3 - Alliance of Light, #1)',
            year: 1997
          }
        ]
        const testClient = {
          clientId: 'johndoe',
          secret: 'squirrel',
          resources: {
            'collection:testdb_first-schema': {
              read: {
                filter: JSON.stringify({
                  year: {
                    $lt: 1990
                  }
                })
              }
            }
          }
        }

        client
          .post('/vtest/testdb/first-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .set('content-type', 'application/json')
          .send(documents)
          .expect(200)
          .end((err, res) => {
            setTimeout(() => {
              help.createACLClient(testClient).then(() => {
                client
                  .post(config.get('auth.tokenUrl'))
                  .set('content-type', 'application/json')
                  .send({
                    clientId: testClient.clientId,
                    secret: testClient.secret
                  })
                  .expect(200)
                  .expect('content-type', 'application/json')
                  .end((err, res) => {
                    if (err) return done(err)

                    const clientToken = res.body.accessToken

                    client
                      .get('/vtest/testdb/first-schema/search?q=prince')
                      .set('Authorization', 'Bearer ' + clientToken)
                      .expect(200)
                      .end((err, res) => {
                        if (err) return done(err)

                        res.body.results.should.be.Array
                        res.body.results.length.should.eql(1)

                        res.body.results[0].title.should.eql(documents[0].title)
                        res.body.results[0].year.should.eql(documents[0].year)
                        res.body.results[0].author.should.eql(
                          documents[0].author
                        )

                        done()
                      })
                  })
              })
            }, 1000)
          })
      })

      it('should not return results which the client has no read access to (2)', done => {
        const doc = {
          title: 'The quick brown fox jumps over the lazy dog'
        }
        const testClient = {
          clientId: 'johndoe',
          secret: 'squirrel',
          resources: {
            'collection:testdb_first-schema': {
              readOwn: true
            }
          }
        }

        client
          .post('/vtest/testdb/first-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .set('content-type', 'application/json')
          .send(doc)
          .expect(200)
          .end((err, res) => {
            setTimeout(() => {
              help.createACLClient(testClient).then(() => {
                client
                  .post(config.get('auth.tokenUrl'))
                  .set('content-type', 'application/json')
                  .send({
                    clientId: testClient.clientId,
                    secret: testClient.secret
                  })
                  .expect(200)
                  .expect('content-type', 'application/json')
                  .end((err, res) => {
                    if (err) return done(err)

                    const clientToken = res.body.accessToken

                    client
                      .get('/vtest/testdb/first-schema/search?q=quick%20brown')
                      .set('Authorization', 'Bearer ' + clientToken)
                      .expect(200)
                      .end((err, res) => {
                        if (err) return done(err)

                        should.exist(res.body.results)

                        res.body.results.should.be.Array
                        res.body.results.length.should.eql(0)

                        done()
                      })
                  })
              })
            }, 1000)
          })
      })
    })
  })

  describe('Multi collection search', () => {
    it('should return 501 when search is disabled', done => {
      config.set('search.enabled', false)

      client
        .get('/api/search?q=something')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(501)
        .end((err, res) => {
          config.set('search.enabled', true)

          done(err)
        })
    })

    it('should return 400 when searching with no query', done => {
      client
        .get('/api/search')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(400)
        .end(done)
    })

    it('should return 400 when searching with a short query', done => {
      client
        .get('/api/search?q=xx')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(400)
        .end((err, res) => {
          done(err)
        })
    })

    it('should return empty results when no documents match a query', done => {
      client
        .get('/api/search?q=abracadabra')
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

    it('should return results when documents match a query, adding a `_collection` property indicating the collection each result belongs to', done => {
      const documents = [
        {
          author: 'Antoine de Saint-Exupéry',
          title: 'The Little Prince',
          year: 1943
        },
        {
          author: 'Hans Christian Andersen',
          title: 'The Little Mermaid',
          year: 1837
        },
        {
          author: 'Janny Wurts',
          title:
            'Fugitive Prince (Wars of Light & Shadow, #4; Arc 3 - Alliance of Light, #1)',
          year: 1997
        }
      ]

      client
        .post('/vtest/testdb/first-schema')
        .set('Authorization', 'Bearer ' + bearerToken)
        .set('content-type', 'application/json')
        .send(documents[2])
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          client
            .post('/vtest/testdb/second-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .set('content-type', 'application/json')
            .send([documents[0], documents[1]])
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              setTimeout(() => {
                client
                  .get('/api/search?q=prince')
                  .set('Authorization', 'Bearer ' + bearerToken)
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done(err)

                    const {results} = res.body

                    results.should.be.Array
                    results.length.should.eql(2)

                    results[0].title.should.eql(documents[0].title)
                    results[0]._collection.should.eql('testdb/second-schema')

                    results[1].title.should.eql(documents[2].title)
                    results[1]._collection.should.eql('testdb/first-schema')

                    results[0]._searchRelevance.should.be.above(
                      results[1]._searchRelevance
                    )

                    done()
                  })
              }, 1000)
            })
        })
    })

    it('should only search in the collections specified in the `collections´ URL parameter, if one is present', done => {
      const documents = [
        {
          author: 'Antoine de Saint-Exupéry',
          title: 'The Little Prince',
          year: 1943
        },
        {
          author: 'Hans Christian Andersen',
          title: 'The Little Mermaid',
          year: 1837
        },
        {
          author: 'Janny Wurts',
          title:
            'Fugitive Prince (Wars of Light & Shadow, #4; Arc 3 - Alliance of Light, #1)',
          year: 1997
        }
      ]

      client
        .post('/vtest/testdb/first-schema')
        .set('Authorization', 'Bearer ' + bearerToken)
        .set('content-type', 'application/json')
        .send(documents[0])
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          client
            .post('/vtest/testdb/second-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .set('content-type', 'application/json')
            .send([documents[1], documents[2]])
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              setTimeout(() => {
                client
                  .get(
                    '/api/search?q=prince&collections=testdb_first-schema,testdb_second-schema'
                  )
                  .set('Authorization', 'Bearer ' + bearerToken)
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done(err)

                    const {results} = res.body

                    results.should.be.Array
                    results.length.should.eql(2)

                    results[0].title.should.eql(documents[0].title)
                    results[0]._collection.should.eql('testdb/first-schema')

                    results[1].title.should.eql(documents[2].title)
                    results[1]._collection.should.eql('testdb/second-schema')

                    client
                      .get(
                        '/api/search?q=prince&collections=testdb_first-schema'
                      )
                      .set('Authorization', 'Bearer ' + bearerToken)
                      .expect(200)
                      .end((err, res) => {
                        if (err) return done(err)

                        const {results} = res.body

                        results.should.be.Array
                        results.length.should.eql(1)

                        results[0].title.should.eql(documents[0].title)
                        results[0]._collection.should.eql('testdb/first-schema')

                        client
                          .get(
                            '/api/search?q=prince&collections=testdb_second-schema'
                          )
                          .set('Authorization', 'Bearer ' + bearerToken)
                          .expect(200)
                          .end((err, res) => {
                            if (err) return done(err)

                            const {results} = res.body

                            results.should.be.Array
                            results.length.should.eql(1)

                            results[0].title.should.eql(documents[2].title)
                            results[0]._collection.should.eql(
                              'testdb/second-schema'
                            )

                            done()
                          })
                      })
                  })
              }, 1000)
            })
        })
    })

    it('should return updated results after new documents are created', done => {
      const documents = [
        {
          author: 'Antoine de Saint-Exupéry',
          title: 'The Little Prince',
          year: 1943
        },
        {
          author: 'Hans Christian Andersen',
          title: 'The Little Mermaid',
          year: 1837
        },
        {
          author: 'Janny Wurts',
          title:
            'Fugitive Prince (Wars of Light & Shadow, #4; Arc 3 - Alliance of Light, #1)',
          year: 1997
        }
      ]

      client
        .post('/vtest/testdb/first-schema')
        .set('Authorization', 'Bearer ' + bearerToken)
        .set('content-type', 'application/json')
        .send(documents[0])
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          const documentId = res.body.results[0]._id

          setTimeout(() => {
            client
              .get('/api/search?q=prince')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)

                const {results} = res.body

                results.should.be.Array
                results.length.should.eql(1)

                results[0].title.should.eql(documents[0].title)
                results[0]._id.should.eql(documentId)
                results[0]._collection.should.eql('testdb/first-schema')

                client
                  .post('/vtest/testdb/second-schema')
                  .set('Authorization', 'Bearer ' + bearerToken)
                  .set('content-type', 'application/json')
                  .send(documents[2])
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done(err)

                    setTimeout(() => {
                      client
                        .get('/api/search?q=prince')
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .expect(200)
                        .end((err, res) => {
                          if (err) return done(err)

                          const {results} = res.body

                          results.should.be.Array
                          results.length.should.eql(2)

                          results[0].title.should.eql(documents[0].title)
                          results[0]._collection.should.eql(
                            'testdb/first-schema'
                          )

                          results[1].title.should.eql(documents[2].title)
                          results[1]._collection.should.eql(
                            'testdb/second-schema'
                          )

                          done(err)
                        })
                    }, 100)
                  })
              })
          }, 100)
        })
    })

    it('should return updated results after documents are updated', done => {
      const documents = [
        {
          author: 'Antoine de Saint-Exupéry',
          title: 'The Little Prince',
          year: 1943
        },
        {
          author: 'Hans Christian Andersen',
          title: 'The Little Mermaid',
          year: 1837
        },
        {
          author: 'Janny Wurts',
          title:
            'Fugitive Prince (Wars of Light & Shadow, #4; Arc 3 - Alliance of Light, #1)',
          year: 1997
        }
      ]
      const stub = sinon.spy(search, 'indexDocument')

      client
        .post('/vtest/testdb/first-schema')
        .set('Authorization', 'Bearer ' + bearerToken)
        .set('content-type', 'application/json')
        .send(documents)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          const createdDocuments = res.body.results

          setTimeout(() => {
            client
              .get('/api/search?q=prince')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)

                const {results} = res.body

                results.should.be.Array
                results.length.should.eql(2)

                results[0].title.should.eql(documents[0].title)
                results[0]._collection.should.eql('testdb/first-schema')

                results[1].title.should.eql(documents[2].title)
                results[1]._collection.should.eql('testdb/first-schema')

                const update = {
                  title: 'The Little Mermaid Prince'
                }

                client
                  .put(`/vtest/testdb/first-schema/${createdDocuments[1]._id}`)
                  .set('Authorization', 'Bearer ' + bearerToken)
                  .set('content-type', 'application/json')
                  .send(update)
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done(err)

                    setTimeout(() => {
                      client
                        .get('/api/search?q=prince')
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .expect(200)
                        .end((err, res) => {
                          if (err) return done(err)

                          const {results} = res.body

                          results.should.be.Array
                          results.length.should.eql(3)

                          results[0].title.should.eql(documents[0].title)
                          results[0]._collection.should.eql(
                            'testdb/first-schema'
                          )

                          results[1].title.should.eql(update.title)
                          results[1]._collection.should.eql(
                            'testdb/first-schema'
                          )

                          results[2].title.should.eql(documents[2].title)
                          results[2]._collection.should.eql(
                            'testdb/first-schema'
                          )

                          stub.callCount.should.eql(4)

                          stub
                            .getCall(0)
                            .args[0].collection.should.eql('first-schema')
                          stub
                            .getCall(0)
                            .args[0].document.title.should.eql(
                              documents[0].title
                            )

                          stub
                            .getCall(1)
                            .args[0].collection.should.eql('first-schema')
                          stub
                            .getCall(1)
                            .args[0].document.title.should.eql(
                              documents[1].title
                            )

                          stub
                            .getCall(2)
                            .args[0].collection.should.eql('first-schema')
                          stub
                            .getCall(2)
                            .args[0].document.title.should.eql(
                              documents[2].title
                            )

                          stub
                            .getCall(3)
                            .args[0].collection.should.eql('first-schema')
                          stub
                            .getCall(3)
                            .args[0].document.title.should.eql(update.title)

                          stub.restore()

                          done(err)
                        })
                    }, 100)
                  })
              })
          }, 100)
        })
    })

    it('should not re-index documents when only non-searchable fields are updated', done => {
      const documents = [
        {
          author: 'Antoine de Saint-Exupéry',
          title: 'The Little Prince',
          year: 1943
        },
        {
          author: 'Hans Christian Andersen',
          title: 'The Little Mermaid',
          year: 1837
        },
        {
          author: 'Janny Wurts',
          title:
            'Fugitive Prince (Wars of Light & Shadow, #4; Arc 3 - Alliance of Light, #1)',
          year: 1997
        }
      ]
      const stub = sinon.spy(search, 'indexDocument')

      client
        .post('/vtest/testdb/first-schema')
        .set('Authorization', 'Bearer ' + bearerToken)
        .set('content-type', 'application/json')
        .send(documents)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          const createdDocuments = res.body.results

          setTimeout(() => {
            client
              .put(`/vtest/testdb/first-schema/${createdDocuments[0]._id}`)
              .set('Authorization', 'Bearer ' + bearerToken)
              .set('content-type', 'application/json')
              .send({year: 2019})
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)

                setTimeout(() => {
                  stub.callCount.should.eql(3)

                  stub.getCall(0).args[0].collection.should.eql('first-schema')
                  stub
                    .getCall(0)
                    .args[0].document.title.should.eql(documents[0].title)

                  stub.getCall(1).args[0].collection.should.eql('first-schema')
                  stub
                    .getCall(1)
                    .args[0].document.title.should.eql(documents[1].title)

                  stub.getCall(2).args[0].collection.should.eql('first-schema')
                  stub
                    .getCall(2)
                    .args[0].document.title.should.eql(documents[2].title)

                  stub.restore()

                  done(err)
                })
              })
          })
        })
    })

    it('should return updated results after documents are deleted', done => {
      const documents = [
        {
          author: 'Antoine de Saint-Exupéry',
          title: 'The Little Prince',
          year: 1943
        },
        {
          author: 'Hans Christian Andersen',
          title: 'The Little Mermaid',
          year: 1837
        },
        {
          author: 'Janny Wurts',
          title:
            'Fugitive Prince (Wars of Light & Shadow, #4; Arc 3 - Alliance of Light, #1)',
          year: 1997
        }
      ]

      client
        .post('/vtest/testdb/first-schema')
        .set('Authorization', 'Bearer ' + bearerToken)
        .set('content-type', 'application/json')
        .send(documents)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          const createdDocuments = res.body.results

          setTimeout(() => {
            client
              .get('/api/search?q=prince')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)

                const {results} = res.body

                results.should.be.Array
                results.length.should.eql(2)

                results[0].title.should.eql(documents[0].title)
                results[0]._collection.should.eql('testdb/first-schema')

                results[1].title.should.eql(documents[2].title)
                results[1]._collection.should.eql('testdb/first-schema')

                client
                  .delete(
                    `/vtest/testdb/first-schema/${createdDocuments[2]._id}`
                  )
                  .set('Authorization', 'Bearer ' + bearerToken)
                  .set('content-type', 'application/json')
                  .expect(204)
                  .end((err, res) => {
                    if (err) return done(err)

                    setTimeout(() => {
                      client
                        .get('/api/search?q=prince')
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .expect(200)
                        .end((err, res) => {
                          if (err) return done(err)

                          const {results} = res.body

                          results.should.be.Array
                          results.length.should.eql(1)

                          results[0].title.should.eql(documents[0].title)
                          results[0]._collection.should.eql(
                            'testdb/first-schema'
                          )

                          done(err)
                        })
                    }, 100)
                  })
              })
          }, 100)
        })
    })

    it('should return metadata containing the search term', done => {
      const document = {
        title: 'The quick brown fox jumps over the lazy dog'
      }

      client
        .post('/vtest/testdb/first-schema')
        .set('Authorization', 'Bearer ' + bearerToken)
        .set('content-type', 'application/json')
        .send(document)
        .expect(200)
        .end((err, res) => {
          setTimeout(() => {
            client
              .get('/api/search?q=quick%20brown')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .end((err, res) => {
                res.body.metadata.search.should.eql('quick brown')

                done(err)
              })
          }, 100)
        })
    })

    describe('ACL', () => {
      it('should only return results from collections which the client has read access to (1)', done => {
        const documents = [
          {
            author: 'Antoine de Saint-Exupéry',
            title: 'The Little Prince',
            year: 1943
          },
          {
            author: 'Hans Christian Andersen',
            title: 'The Little Mermaid',
            year: 1837
          },
          {
            author: 'Janny Wurts',
            title:
              'Fugitive Prince (Wars of Light & Shadow, #4; Arc 3 - Alliance of Light, #1)',
            year: 1997
          }
        ]
        const testClient = {
          clientId: 'johndoe',
          secret: 'squirrel',
          resources: {}
        }

        client
          .post('/vtest/testdb/first-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .set('content-type', 'application/json')
          .send(documents[0])
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            client
              .post('/vtest/testdb/second-schema')
              .set('Authorization', 'Bearer ' + bearerToken)
              .set('content-type', 'application/json')
              .send([documents[1], documents[2]])
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)

                setTimeout(() => {
                  help.createACLClient(testClient).then(() => {
                    client
                      .post(config.get('auth.tokenUrl'))
                      .set('content-type', 'application/json')
                      .send({
                        clientId: testClient.clientId,
                        secret: testClient.secret
                      })
                      .expect(200)
                      .expect('content-type', 'application/json')
                      .end((err, res) => {
                        if (err) return done(err)

                        const clientToken = res.body.accessToken

                        client
                          .get('/api/search?q=prince')
                          .set('Authorization', 'Bearer ' + clientToken)
                          .expect(200)
                          .end((err, res) => {
                            if (err) return done(err)

                            const {results} = res.body

                            results.should.be.Array
                            results.length.should.eql(0)

                            done()
                          })
                      })
                  })
                }, 100)
              })
          })
      })

      it('should only return results from collections which the client has read access to (2)', done => {
        const documents = [
          {
            author: 'Antoine de Saint-Exupéry',
            title: 'The Little Prince',
            year: 1943
          },
          {
            author: 'Hans Christian Andersen',
            title: 'The Little Mermaid',
            year: 1837
          },
          {
            author: 'Janny Wurts',
            title:
              'Fugitive Prince (Wars of Light & Shadow, #4; Arc 3 - Alliance of Light, #1)',
            year: 1997
          }
        ]
        const testClient = {
          clientId: 'johndoe',
          secret: 'squirrel',
          resources: {
            'collection:testdb_second-schema': {
              read: true
            }
          }
        }

        client
          .post('/vtest/testdb/first-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .set('content-type', 'application/json')
          .send(documents[0])
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            client
              .post('/vtest/testdb/second-schema')
              .set('Authorization', 'Bearer ' + bearerToken)
              .set('content-type', 'application/json')
              .send([documents[1], documents[2]])
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)

                setTimeout(() => {
                  help.createACLClient(testClient).then(() => {
                    client
                      .post(config.get('auth.tokenUrl'))
                      .set('content-type', 'application/json')
                      .send({
                        clientId: testClient.clientId,
                        secret: testClient.secret
                      })
                      .expect(200)
                      .expect('content-type', 'application/json')
                      .end((err, res) => {
                        if (err) return done(err)

                        const clientToken = res.body.accessToken

                        client
                          .get('/api/search?q=prince')
                          .set('Authorization', 'Bearer ' + clientToken)
                          .expect(200)
                          .end((err, res) => {
                            if (err) return done(err)

                            const {results} = res.body

                            results.should.be.Array
                            results.length.should.eql(1)
                            results[0].title.should.eql(documents[2].title)

                            done()
                          })
                      })
                  })
                }, 100)
              })
          })
      })

      it('should only return results from collections which the client has read access to (3)', done => {
        const documents = [
          {
            author: 'Antoine de Saint-Exupéry',
            title: 'The Little Prince',
            year: 1943
          },
          {
            author: 'Hans Christian Andersen',
            title: 'The Little Mermaid',
            year: 1837
          },
          {
            author: 'Janny Wurts',
            title:
              'Fugitive Prince (Wars of Light & Shadow, #4; Arc 3 - Alliance of Light, #1)',
            year: 1997
          }
        ]
        const testClient = {
          clientId: 'johndoe',
          secret: 'squirrel',
          resources: {
            'collection:testdb_second-schema': {
              read: true
            }
          }
        }

        client
          .post('/vtest/testdb/first-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .set('content-type', 'application/json')
          .send(documents[0])
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            client
              .post('/vtest/testdb/second-schema')
              .set('Authorization', 'Bearer ' + bearerToken)
              .set('content-type', 'application/json')
              .send([documents[1], documents[2]])
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)

                setTimeout(() => {
                  help.createACLClient(testClient).then(() => {
                    client
                      .post(config.get('auth.tokenUrl'))
                      .set('content-type', 'application/json')
                      .send({
                        clientId: testClient.clientId,
                        secret: testClient.secret
                      })
                      .expect(200)
                      .expect('content-type', 'application/json')
                      .end((err, res) => {
                        if (err) return done(err)

                        const clientToken = res.body.accessToken

                        client
                          .get(
                            '/api/search?q=prince&collections=testdb_first-schema'
                          )
                          .set('Authorization', 'Bearer ' + clientToken)
                          .expect(200)
                          .end((err, res) => {
                            if (err) return done(err)

                            const {results} = res.body

                            results.should.be.Array
                            results.length.should.eql(0)

                            client
                              .get(
                                '/api/search?q=prince&collections=testdb_second-schema'
                              )
                              .set('Authorization', 'Bearer ' + clientToken)
                              .expect(200)
                              .end((err, res) => {
                                if (err) return done(err)

                                const {results} = res.body

                                results.should.be.Array
                                results.length.should.eql(1)
                                results[0].title.should.eql(documents[2].title)

                                done()
                              })
                          })
                      })
                  })
                }, 100)
              })
          })
      })
    })
  })

  describe('Batch indexing', function() {
    it('should return 404 when calling the batch index endpoint when search is disabled', done => {
      config.set('search.enabled', false)

      client
        .post('/api/index')
        .set('Authorization', 'Bearer ' + bearerToken)
        .set('content-type', 'application/json')
        .expect(404)
        .end(err => {
          config.set('search.enabled', true)

          done(err)
        })
    })

    it('should return 204 when calling the index endpoint', done => {
      const stub = sinon.spy(search, 'batchIndexCollections')

      client
        .post('/api/index')
        .set('Authorization', 'Bearer ' + bearerToken)
        .set('content-type', 'application/json')
        .expect(204)
        .end(err => {
          stub.called.should.be.true
          stub.restore()

          done(err)
        })
    })
  })

  describe('Multi-language', function() {
    it('should retrieve all language variations if no `lang` parameter is supplied', done => {
      const document = {
        title: 'The Little Prince',
        'title:pt': 'O Principezinho',
        'title:fr': 'Le Petit Prince'
      }

      client
        .post('/vtest/testdb/first-schema')
        .set('Authorization', `Bearer ${bearerToken}`)
        .send(document)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          setTimeout(() => {
            client
              .get(`/vtest/testdb/first-schema/search?q=Prince`)
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
          }, 800)
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
        .post(`/vtest/testdb/first-schema`)
        .set('Authorization', `Bearer ${bearerToken}`)
        .send(documents)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          setTimeout(() => {
            client
              .get('/vtest/testdb/first-schema/search?q=little')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)

                res.body.results.length.should.eql(1)

                const {results} = res.body

                results[0].title.should.eql(documents[0].title)
                should.not.exist(results[0]._i18n)

                client
                  .get('/vtest/testdb/first-schema/search?q=petit')
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
        .post(`/vtest/testdb/first-schema`)
        .set('Authorization', `Bearer ${bearerToken}`)
        .send(documents)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          setTimeout(() => {
            client
              .get('/vtest/testdb/first-schema/search?q=petit&lang=fr')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)

                res.body.results.length.should.eql(1)

                const {results} = res.body

                results[0].title.should.eql(documents[0]['title:fr'])
                results[0]._i18n.title.should.eql('fr')

                client
                  .get(
                    '/vtest/testdb/first-schema/search?q=principezinho&lang=pt'
                  )
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
        author: 'Antoine de Saint-Exupéry'
      }
    ]

    client
      .post(`/vtest/testdb/first-schema`)
      .set('Authorization', `Bearer ${bearerToken}`)
      .send(documents)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        const {_id: documentId} = res.body.results[0]

        setTimeout(() => {
          client
            .get(
              '/vtest/testdb/first-schema/search?q=little&fields={"title":0}'
            )
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              res.body.results.length.should.eql(1)

              const {results} = res.body

              results[0]._id.should.eql(documentId)
              should.not.exist(results[0].title)
              results[0].author.should.eql(documents[0].author)

              client
                .get(
                  '/vtest/testdb/first-schema/search?q=little&fields={"title":1}'
                )
                .set('Authorization', `Bearer ${bearerToken}`)
                .expect(200)
                .end((err, res) => {
                  res.body.results.length.should.eql(1)

                  const {results} = res.body

                  results[0]._id.should.eql(documentId)
                  results[0].title.should.eql(documents[0].title)
                  should.not.exist(results[0].author)

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
      .post(`/vtest/testdb/first-schema`)
      .set('Authorization', `Bearer ${bearerToken}`)
      .send(documents)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        const {_id: documentId} = res.body.results[0]

        setTimeout(() => {
          client
            .get(
              '/vtest/testdb/first-schema/search?q=petit&lang=fr&fields={"title":0}'
            )
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              res.body.results.length.should.eql(1)

              const {results} = res.body

              results[0]._id.should.eql(documentId)
              should.not.exist(results[0].title)

              client
                .get(
                  '/vtest/testdb/first-schema/search?q=little&fields={"_id":1}'
                )
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
