const should = require('should')
const fs = require('fs')
const path = require('path')
const request = require('supertest')
const config = require(__dirname + '/../../../config')
const help = require(__dirname + '/../help')
const app = require(__dirname + '/../../../dadi/lib/')

let bearerToken
let connectionString = 'http://' + config.get('server.host') + ':' + config.get('server.port')

describe('Reference Field', () => {
  beforeEach(done => {
    config.set('paths.collections', 'test/acceptance/workspace/collections')

    help.dropDatabase('library', 'book', err => {
      if (err) return done(err)
      help.dropDatabase('library', 'person', err => {
        if (err) return done(err)
        help.dropDatabase('library', 'event', err => {
          app.start(() => {
            help.getBearerToken(function (err, token) {
              if (err) return done(err)
              bearerToken = token
              done()
            })
          })
        })
      })
    })
  })

  afterEach(done => {
    config.set('paths.collections', 'workspace/collections')
    app.stop(done)
  })

  describe('insert', () => {
    it('should create reference documents that don\'t have _id fields', done => {
      let book = {
        title: 'For Whom The Bell Tolls',
        author: {
          name: 'Ernest Hemingway'
        }
      }

      config.set('query.useVersionFilter', true)

      let client = request(connectionString)
      client
      .post('/v1/library/book')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(book)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)
        should.exist(res.body.results)
        let newDoc = res.body.results[0]

        should.exist(newDoc.author._id)
        should.exist(newDoc.author._apiVersion)
        done()
      })
    })

    it('should create reference documents recursively', done => {
      let event = {
        type: 'Book signing',
        book: {
          title: 'For Whom The Bell Tolls',
          author: {
            name: 'Ernest Hemingway'
          }
        }
      }

      config.set('query.useVersionFilter', true)

      let client = request(connectionString)
      client
      .post('/v1/library/event')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(event)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        let eventId = res.body.results[0]._id
        let bookId = res.body.results[0].book._id
        let authorId = res.body.results[0].book.author._id
        let doneIndex = 0

        client
        .get('/v1/library/event/' + eventId)
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .end((err, res) => {
          res.body.results[0].type.should.eql(event.type)

          if (++doneIndex === 3) done()
        })

        client
        .get('/v1/library/book/' + bookId)
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .end((err, res) => {
          res.body.results[0].title.should.eql(event.book.title)

          if (++doneIndex === 3) done()
        })

        client
        .get('/v1/library/person/' + authorId)
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .end((err, res) => {
          res.body.results[0].name.should.eql(event.book.author.name)

          if (++doneIndex === 3) done()
        })
      })
    })

    it('should allow an empty array of reference documents', done => {
      let book = {
        title: 'The Sun Also Rises',
        author: []
      }

      config.set('query.useVersionFilter', true)

      let client = request(connectionString)
      client
      .post('/v1/library/book')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(book)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)
        should.exist(res.body.results)
        let newDoc = res.body.results[0]

        should.exist(newDoc.author)
        newDoc.author.should.be.Array
        newDoc.author.should.eql([])
        done()
      })
    })

    it('should create array of reference documents that don\'t have _id fields', done => {
      let book = {
        title: 'Dash & Lily\'s Book of Dares',
        author: [
          {
            name: 'Rachel Cohn'
          },
          {
            name: 'David Levithan'
          }
        ]
      }

      config.set('query.useVersionFilter', true)

      let client = request(connectionString)
      client
      .post('/v1/library/book')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(book)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)
        should.exist(res.body.results)
        let newDoc = res.body.results[0]

        should.exist(newDoc.author)
        newDoc.author.should.be.Array

        newDoc.author[0].name.should.eql('Rachel Cohn')
        newDoc.author[1].name.should.eql('David Levithan')
        done()
      })
    })

    it('should create multiple reference documents that don\'t have _id fields', done => {
      let data = {
        'word': 'animals',
        'children': [
          {
            'word': 'dogs',
            'children': [
              {
                'word': 'guide_dogs',
                'children': []
              },
              {
                'word': 'puppies',
                'children': []
              }
            ]
          },
          {
            'word': 'foxes',
            'children': []
          },
          {
            'word': 'pandas',
            'children': []
          }
        ]
      }

      config.set('query.useVersionFilter', true)

      let client = request(connectionString)
      client
      .post('/v1/library/taxonomy')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(data)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        should.exist(res.body.results)
        let newDoc = res.body.results[0]

        should.exist(newDoc.word)
        newDoc.word.should.eql('animals')

        newDoc.children.length.should.eql(3)
        newDoc.children[0].word.should.eql('dogs')
        newDoc.children[1].word.should.eql('foxes')
        newDoc.children[2].word.should.eql('pandas')
        done()
      })
    })

    it('should update reference documents that already have _id fields', done => {
      let person = {
        name: 'Ernest Hemingway'
      }

      let client = request(connectionString)
      client
      .post('/v1/library/person')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(person)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        let author = res.body.results[0]
        author.name += ', Jnr.'

        let book = {
          title: 'For Whom The Bell Tolls',
          author: author
        }

        config.set('query.useVersionFilter', true)

        setTimeout(() => {
          let client = request(connectionString)
          client
          .post('/v1/library/book')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send(book)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            should.exist(res.body.results)
            let newDoc = res.body.results[0]

            newDoc.author._id.should.eql(author._id)
            newDoc.author.name.should.eql(author.name)
            done()
          })
        }, 800)
      })
    })

    it('should update reference documents that already have _id fields, translating any internal fields in the referenced documents to the prefix defined in config', done => {
      let originalPrefix = config.get('internalFieldsPrefix')

      config.set('internalFieldsPrefix', '$')

      let person = {
        name: 'Ernest Hemingway'
      }

      let client = request(connectionString)
      client
      .post('/v1/library/person')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(person)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        let author = res.body.results[0]
        author.name += ', Jnr.'

        let book = {
          title: 'For Whom The Bell Tolls',
          author: author
        }

        config.set('query.useVersionFilter', true)

        setTimeout(() => {
          let client = request(connectionString)
          client
          .post('/v1/library/book')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send(book)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            // console.log(res)
            should.exist(res.body.results)
            let newDoc = res.body.results[0]

            newDoc.author.$id.should.eql(author.$id)
            newDoc.author.name.should.eql(author.name)

            config.set('internalFieldsPrefix', originalPrefix)

            done()
          })
        }, 800)
      })
    })
  })

  describe('update', () => {
    it('should compose updated document and return when history is on', done => {
      help.getBearerTokenWithAccessType('admin', function (err, token) {
        // modify schema settings
        let jsSchemaString = fs.readFileSync(__dirname + '/../workspace/collections/v1/library/collection.book.json', {encoding: 'utf8'})
        let schema = JSON.parse(jsSchemaString)
        schema.settings.storeRevisions = true

        config.set('query.useVersionFilter', true)

        let book

        let client = request(connectionString)
        client
          .post('/v1/library/book/config')
          .send(JSON.stringify(schema, null, 2))
          .set('content-type', 'text/plain')
          .set('Authorization', 'Bearer ' + token)
          .expect(200)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            setTimeout(() => {
              client
                .post('/v1/library/book')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({title: 'For Whom The Bell Tolls'})
                .end((err, res) => {
                  if (err) return done(err)

                  book = res.body.results[0]

                  client
                    .post('/v1/library/person')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .send({name: 'Ernest H.'})
                    .expect(200)
                    .end((err, res) => {
                      if (err) return done(err)

                      let doc = res.body.results[0]
                      should.exist(doc)

                      let body = {
                        query: { _id: book._id },
                        update: { author: doc._id.toString() }
                      }

                      client
                        .put('/v1/library/book/')
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .send(body)
                        .expect(200)
                        .end((err, res) => {
                          if (err) return done(err)

                          let results = res.body['results']
                          results.should.be.Array
                          results.length.should.equal(1)

                          should.exist(results[0].author.name)

                          config.set('query.useVersionFilter', false)

                          done()
                        })
                    })
                })
            }, 1000)
          })
      })
    })

    it('should compose updated document and return when history is off', done => {
      help.getBearerTokenWithAccessType('admin', function (err, token) {
        // modify schema settings
        let jsSchemaString = fs.readFileSync(__dirname + '/../workspace/collections/v1/library/collection.book.json', {encoding: 'utf8'})
        let schema = JSON.parse(jsSchemaString)
        schema.settings.storeRevisions = false

        config.set('query.useVersionFilter', true)

        let book

        let client = request(connectionString)
        client
          .post('/v1/library/book/config')
          .send(JSON.stringify(schema, null, 2))
          .set('content-type', 'text/plain')
          .set('Authorization', 'Bearer ' + token)
          .expect(200)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            setTimeout(() => {
              client
                .post('/v1/library/book')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({title: 'For Whom The Bell Tolls'})
                .end((err, res) => {
                  if (err) return done(err)

                  book = res.body.results[0]

                  client
                    .post('/v1/library/person')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .send({name: 'Ernest H.'})
                    .expect(200)
                    .end((err, res) => {
                      if (err) return done(err)

                      let doc = res.body.results[0]
                      should.exist(doc)

                      let body = {
                        query: { _id: book._id },
                        update: { author: doc._id.toString() }
                      }

                      client
                        .put('/v1/library/book/')
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .send(body)
                        .expect(200)
                        .end((err, res) => {
                          if (err) return done(err)

                          let results = res.body['results']
                          results.should.be.Array
                          results.length.should.equal(1)
                          should.exist(results[0].author.name)

                          config.set('query.useVersionFilter', false)

                          done()
                        })
                    })
                })
            }, 1000)
          })
      })
    })

    it('should create reference documents that don\'t have _id fields', done => {
      let book = {
        title: 'Thérèse Raquin'
      }

      config.set('query.useVersionFilter', true)

      let client = request(connectionString)
      client
      .post('/v1/library/book')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(book)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)
        should.exist(res.body.results)
        let newDoc = res.body.results[0]

        let update = {
          author: {
            name: 'Émile Zola'
          }
        }

        client
        .put('/v1/library/book/' + newDoc._id)
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(update)
        .expect(200)
        .end((err, res) => {
          should.exist(res.body.results)
          let newDoc = res.body.results[0]

          should.exist(newDoc.author._id)
          should.exist(newDoc.author._apiVersion)
          done()
        })
      })
    })

    it('should allow an empty array of reference documents', done => {
      let book = {
        title: 'The Sun Also Rises (2nd Edition)'
      }

      config.set('query.useVersionFilter', true)

      let client = request(connectionString)
      client
      .post('/v1/library/book')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(book)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)
        should.exist(res.body.results)
        let newDoc = res.body.results[0]

        let update = {
          author: []
        }

        client
        .put('/v1/library/book/' + newDoc._id)
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(update)
        .expect(200)
        .end((err, res) => {
          should.exist(res.body.results)
          let newDoc = res.body.results[0]

          should.exist(newDoc.author)
          newDoc.author.should.be.Array
          newDoc.author.should.eql([])
          done()
        })
      })
    })

    it('should create new reference documents that don\'t have _id fields', done => {
      let person = {
        name: 'Gustave Flaubert'
      }

      let client = request(connectionString)
      client
      .post('/v1/library/person')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(person)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        let author = res.body.results[0]

        let book = {
          title: 'Madame Bolety',
          author: [author._id.toString()]
        }

        config.set('query.useVersionFilter', true)

        client
        .post('/v1/library/book')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(book)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          should.exist(res.body.results)
          let newDoc = res.body.results[0]

          should.exist(newDoc.author)
          newDoc.author.should.be.Array

          let update = {
            author: [
              {
                _id: newDoc.author[0]._id
              },
              {
                name: 'Gustave Flaubert II'
              }
            ]
          }

          client
          .put('/v1/library/book/' + newDoc._id)
          .set('Authorization', 'Bearer ' + bearerToken)
          .send(update)
          .expect(200)
          .end((err, res) => {
            newDoc = res.body.results[0]
            newDoc.author.should.be.Array
            newDoc.author.length.should.eql(2)
            newDoc.author[0].name.should.eql('Gustave Flaubert')
            newDoc.author[1].name.should.eql('Gustave Flaubert II')
            done()
          })
        })
      })
    })
  })

  describe('delete', () => {
    it('should delete documents matching a reference field query', done => {
      let book = {
        title: 'For Whom The Bell Tolls',
        author: {
          name: 'Ernest Hemingway'
        }
      }

      config.set('query.useVersionFilter', true)

      let client = request(connectionString)
      client
      .post('/v1/library/book')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(book)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        should.exist(res.body.results)
        let newDoc = res.body.results[0]

        let query = {
          'query': {
            'author': newDoc.author._id.toString()
          }
        }

        client
        .delete('/v1/library/book')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(query)
        .end((err, res) => {
          if (err) return done(err)

          client
          .get('/v1/library/book')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            should.exist(res.body.results)
            let results = res.body.results

            results.length.should.eql(0)

            done()
          })
        })
      })
    })
  })

  describe('find', () => {
    it('should populate a reference field containing an ObjectID', done => {
      let person = { name: 'Ernest Hemingway' }
      let book = { title: 'For Whom The Bell Tolls', author: null }

      config.set('query.useVersionFilter', true)

      let client = request(connectionString)
      client
      .post('/v1/library/person')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(person)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)
        should.exist(res.body.results)

        let personId = res.body.results[0]._id
        book.author = personId

        client
        .post('/v1/library/book')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(book)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          client
          .get('/v1/library/book?filter={"title":"For Whom The Bell Tolls"}&compose=true')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            should.exist(res.body.results)
            let bookResult = res.body.results[0]
            should.exist(bookResult.author)
            should.exist(bookResult.author.name)

            done()
          })
        })
      })
    })

    it('should populate a reference field containing a String', done => {
      let person = { name: 'Ernest Hemingway' }
      let book = { title: 'For Whom The Bell Tolls', author: null }

      config.set('query.useVersionFilter', true)

      let client = request(connectionString)
      client
      .post('/v1/library/person')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(person)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        should.exist(res.body.results)

        let personId = res.body.results[0]._id
        book.author = personId.toString()

        client
        .post('/v1/library/book')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(book)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          client
          .get('/v1/library/book?filter={"title":"For Whom The Bell Tolls"}&compose=true')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            should.exist(res.body.results)
            let bookResult = res.body.results[0]
            // console.log(bookResult)
            should.exist(bookResult.author)
            should.exist(bookResult.author.name)

            done()
          })
        })
      })
    })

    it('should populate all reference fields that aren\'t null', done => {
      // first person
      let gertrude = { name: 'Gertrude Stein' }

      config.set('query.useVersionFilter', true)

      let client = request(connectionString)
      client
      .post('/v1/library/person')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(gertrude)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        let personId = res.body.results[0]._id

        let ernest = {
          name: 'Ernest Hemingway',
          spouse: null,
          friend: personId.toString()
        }

        client
        .post('/v1/library/person')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(ernest)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          client
          .get('/v1/library/person?filter={"name":"Ernest Hemingway", "friend":{"$ne":null}}&compose=true')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            should.exist(res.body.results)
            let result = res.body.results[0]

            should.exist(result.friend)
            result.friend.name.should.eql('Gertrude Stein')

            done()
          })
        })
      })
    })

    it('should return results for a reference field containing an Array of Strings', done => {
      let person = { name: 'Ernest Hemingway' }
      let book = { title: 'For Whom The Bell Tolls', author: null }

      config.set('query.useVersionFilter', true)

      let client = request(connectionString)
      client
      .post('/v1/library/person')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(person)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        should.exist(res.body.results)

        let personId = res.body.results[0]._id
        book.author = [personId.toString()]

        client
        .post('/v1/library/book')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(book)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          client
          .get('/v1/library/book?filter={"book.author":{"$in":' + [personId.toString()] + '}}&compose=true')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            should.exist(res.body.results)
            let bookResult = res.body.results[0]

            should.exist(bookResult.author)
            should.exist(bookResult.author[0].name)

            done()
          })
        })
      })
    })

    describe('when `settings.strictCompose` is not enabled', () => {
      it('should return unique results for a reference field containing an Array of Strings', done => {
        let book = { title: 'For Whom The Bell Tolls', author: null }
        let author = { name: 'Ernest Hemingway' }

        config.set('query.useVersionFilter', true)

        let client = request(connectionString)
        client
        .post('/v1/library/person')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(author)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          should.exist(res.body.results)

          let personId = res.body.results[0]._id

          // add author multiple times
          book.author = []
          book.author.push(personId.toString())
          book.author.push(personId.toString())
          book.author.push(personId.toString())

          client
          .post('/v1/library/book')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send(book)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            client
            .get('/v1/library/book?filter={"book.author":{"$in":' + [personId.toString()] + '}}&compose=true')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              should.exist(res.body.results)
              let bookResult = res.body.results[0]

              should.exist(bookResult.author)
              bookResult.author.length.should.eql(1)

              done()
            })
          })
        })
      })

      it('should return unique results for a reference field when it contains an Array of Strings and Nulls', done => {
        let book = { title: 'For Whom The Bell Tolls', author: null }

        config.set('query.useVersionFilter', true)

        let client = request(connectionString)
        client
        .post('/v1/library/person')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send({ name: 'Ernest Hemingway' })
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          should.exist(res.body.results)

          let personId = res.body.results[0]._id

          // add author multiple times
          book.author = []
          book.author.push(personId.toString())
          book.author.push(null)
          book.author.push(personId.toString())

          client
          .post('/v1/library/book')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send(book)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            client
            .get('/v1/library/book?filter={"book.author":{"$in":' + [personId.toString()] + '}}&compose=true')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              should.exist(res.body.results)
              let bookResult = res.body.results[0]

              should.exist(bookResult.author)
              bookResult.author.length.should.eql(1)
              should.exist(bookResult.author[0].name)

              done()
            })
          })
        })
      })

      it('should show the raw ID for reference fields where the single referenced ID does not correspond to an existing document', done => {
        let book = { title: 'For Whom The Bell Tolls', author: 'id-that-does-not-exist' }

        config.set('query.useVersionFilter', true)

        let client = request(connectionString)
        client
        .post('/v1/library/book')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(book)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          should.exist(res.body.results)

          let bookId = res.body.results[0]._id

          client
          .get(`/v1/library/book/${bookId}?compose=true`)
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            res.body.results[0].author.should.eql(book.author)

            done()
          })
        })
      })

      it('should show an array of raw values + composed values for reference fields where some of the referenced IDs do not correspond to existing documents', done => {
        let book = {
          title: 'For Whom The Bell Tolls',
          author: [
            'id-that-does-not-exist',
            { name: 'Ernest Hemingway' },
            'another-id-that-does-not-exist'
          ]
        }

        config.set('query.useVersionFilter', true)

        let client = request(connectionString)
        client
        .post('/v1/library/book')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(book)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          should.exist(res.body.results)

          let bookId = res.body.results[0]._id

          client
          .get(`/v1/library/book/${bookId}?compose=true`)
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            let authorResults = res.body.results[0].author

            authorResults.length.should.eql(3)
            authorResults[0].should.eql(book.author[0])
            authorResults[1].name.should.eql(book.author[1].name)
            authorResults[2].should.eql(book.author[2])

            done()
          })
        })
      })

      it('should show an array of raw values for reference fields where none of the referenced IDs do not correspond to existing documents', done => {
        let book = {
          title: 'For Whom The Bell Tolls',
          author: [
            'id-that-does-not-exist',
            'another-id-that-does-not-exist'
          ]
        }

        config.set('query.useVersionFilter', true)

        let client = request(connectionString)
        client
        .post('/v1/library/book')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(book)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          should.exist(res.body.results)

          let bookId = res.body.results[0]._id

          client
          .get(`/v1/library/book/${bookId}?compose=true`)
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            let authorResults = res.body.results[0].author

            authorResults.length.should.eql(2)
            authorResults[0].should.eql(book.author[0])
            authorResults[1].should.eql(book.author[1])

            done()
          })
        })
      })
    })

    describe('when `settings.strictCompose` is enabled', () => {
      it('should return duplicate results for a reference field containing an Array of Strings', done => {
        let book = { title: 'For Whom The Bell Tolls', author: null }
        let author = { name: 'Ernest Hemingway' }

        config.set('query.useVersionFilter', true)

        let client = request(connectionString)
        client
        .post('/v1/library/person')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(author)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          should.exist(res.body.results)

          let personId = res.body.results[0]._id

          // add author multiple times
          book.authorStrict = []
          book.authorStrict.push(personId.toString())
          book.authorStrict.push(personId.toString())
          book.authorStrict.push(personId.toString())

          client
          .post('/v1/library/book')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send(book)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            client
            .get('/v1/library/book?filter={"book.authorStrict":{"$in":' + [personId.toString()] + '}}&compose=true')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              should.exist(res.body.results)
              let bookResult = res.body.results[0]

              should.exist(bookResult.authorStrict)
              bookResult.authorStrict.length.should.eql(3)
              bookResult.authorStrict[0].name.should.eql(author.name)
              bookResult.authorStrict[1].name.should.eql(author.name)
              bookResult.authorStrict[2].name.should.eql(author.name)

              done()
            })
          })
        })
      })

      it('should return duplicate results for a reference field when it contains an Array of Strings and Nulls', done => {
        let book = { title: 'For Whom The Bell Tolls', author: null }
        let author = { name: 'Ernest Hemingway' }

        config.set('query.useVersionFilter', true)

        let client = request(connectionString)
        client
        .post('/v1/library/person')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(author)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          should.exist(res.body.results)

          let personId = res.body.results[0]._id

          // add author multiple times
          book.authorStrict = []
          book.authorStrict.push(personId.toString())
          book.authorStrict.push(null)
          book.authorStrict.push(personId.toString())

          client
          .post('/v1/library/book')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send(book)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            client
            .get('/v1/library/book?filter={"book.authorStrict":{"$in":' + [personId.toString()] + '}}&compose=true')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              should.exist(res.body.results)
              let bookResult = res.body.results[0]

              should.exist(bookResult.authorStrict)
              bookResult.authorStrict.length.should.eql(3)
              bookResult.authorStrict[0].name.should.eql(author.name)
              should.equal(bookResult.authorStrict[1], null)
              bookResult.authorStrict[2].name.should.eql(author.name)

              done()
            })
          })
        })
      })

      it('should omit reference fields where the single referenced ID does not correspond to an existing document', done => {
        let book = { title: 'For Whom The Bell Tolls', authorStrict: 'id-that-does-not-exist' }

        config.set('query.useVersionFilter', true)

        let client = request(connectionString)
        client
        .post('/v1/library/book')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(book)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          should.exist(res.body.results)

          let bookId = res.body.results[0]._id

          client
          .get(`/v1/library/book/${bookId}?compose=true`)
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            should.not.exist(res.body.results[0].authorStrict)

            done()
          })
        })
      })

      it('should show an array of null + composed values for reference fields where some of the referenced IDs do not correspond to existing documents', done => {
        let book = {
          title: 'For Whom The Bell Tolls',
          authorStrict: [
            'id-that-does-not-exist',
            { name: 'Ernest Hemingway' },
            'another-id-that-does-not-exist'
          ]
        }

        config.set('query.useVersionFilter', true)

        let client = request(connectionString)
        client
        .post('/v1/library/book')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(book)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          should.exist(res.body.results)

          let bookId = res.body.results[0]._id

          client
          .get(`/v1/library/book/${bookId}?compose=true`)
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            let authorResults = res.body.results[0].authorStrict

            authorResults.length.should.eql(3)
            should.equal(authorResults[0], null)
            authorResults[1].name.should.eql(book.authorStrict[1].name)
            should.equal(authorResults[2], null)

            done()
          })
        })
      })

      it('should show an array of null for reference fields where none of the referenced IDs do not correspond to existing documents', done => {
        let book = {
          title: 'For Whom The Bell Tolls',
          authorStrict: [
            'id-that-does-not-exist',
            'another-id-that-does-not-exist'
          ]
        }

        config.set('query.useVersionFilter', true)

        let client = request(connectionString)
        client
        .post('/v1/library/book')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(book)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          should.exist(res.body.results)

          let bookId = res.body.results[0]._id

          client
          .get(`/v1/library/book/${bookId}?compose=true`)
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            let authorResults = res.body.results[0].authorStrict

            authorResults.length.should.eql(2)
            should.equal(authorResults[0], null)
            should.equal(authorResults[1], null)

            done()
          })
        })
      })
    })

    it('should return results in the same order as the original Array', done => {
      let book = { title: 'Death in the Afternoon', author: null }
      book.author = []

      config.set('query.useVersionFilter', true)

      let client = request(connectionString)
      client
      .post('/v1/library/person')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send({ name: 'Ernest Hemingway' })
      .expect(200)
      .end((err, res) => {
        let personId = res.body.results[0]._id
        book.author.push(personId.toString())

        let client = request(connectionString)
        client
        .post('/v1/library/person')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send({ name: 'A.N. Other' })
        .expect(200)
        .end((err, res) => {
          personId = res.body.results[0]._id
          book.author.unshift(personId.toString())

          let client = request(connectionString)
          client
          .post('/v1/library/person')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({ name: 'Michael Jackson' })
          .expect(200)
          .end((err, res) => {
            personId = res.body.results[0]._id
            book.author.push(personId.toString())

            client
            .post('/v1/library/book')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send(book)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              client
              .get('/v1/library/book?filter={"title":"Death in the Afternoon"}&compose=true')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .end((err, res) => {
                should.exist(res.body.results)
                let bookResult = res.body.results[0]

                should.exist(bookResult.author)

                for (let i = 0; i < bookResult.author.length; i++) {
                  let author = bookResult.author[i]
                  author._id.toString().should.eql(bookResult._composed.author[i].toString())
                }

                done()
              })
            })
          })
        })
      })
    })

    it('should compose as many levels of references as the value of `compose`, with `true` being 1 and `all` being infinite', done => {
      let event = {
        type: 'Book signing',
        book: {
          title: 'For Whom The Bell Tolls',
          author: {
            name: 'Ernest Hemingway',
            spouse: {
              name: 'Mary Welsh Hemingway'
            }
          }
        }
      }

      config.set('query.useVersionFilter', true)

      let client = request(connectionString)
      client
      .post('/v1/library/event')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(event)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        let eventId = res.body.results[0]._id
        let doneCount = 0
        let doneFn = () => {
          if (++doneCount === 4) done()
        }

        client
        .get(`/v1/library/event/${eventId}?compose=true`)
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .end((err, res) => {
          res.body.results[0].type.should.eql(event.type)
          res.body.results[0].book.title.should.eql(event.book.title)
          res.body.results[0].book.author.should.be.String

          doneFn()
        })

        client
        .get(`/v1/library/event/${eventId}?compose=2`)
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .end((err, res) => {
          res.body.results[0].type.should.eql(event.type)
          res.body.results[0].book.title.should.eql(event.book.title)
          res.body.results[0].book.author.name.should.eql(event.book.author.name)
          res.body.results[0].book.author.spouse.should.be.String

          doneFn()
        })

        client
        .get(`/v1/library/event/${eventId}?compose=3`)
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .end((err, res) => {
          res.body.results[0].type.should.eql(event.type)
          res.body.results[0].book.title.should.eql(event.book.title)
          res.body.results[0].book.author.name.should.eql(event.book.author.name)
          res.body.results[0].book.author.spouse.name.should.eql(event.book.author.spouse.name)

          doneFn()
        })

        client
        .get(`/v1/library/event/${eventId}?compose=all`)
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .end((err, res) => {
          res.body.results[0].type.should.eql(event.type)
          res.body.results[0].book.title.should.eql(event.book.title)
          res.body.results[0].book.author.name.should.eql(event.book.author.name)
          res.body.results[0].book.author.spouse.name.should.eql(event.book.author.spouse.name)

          doneFn()
        })
      })
    })
  })

  describe('with configured prefix', () => {
    it('should create reference documents that don\'t have identifier fields', done => {
      let book = {
        title: 'For Whom The Bell Tolls',
        author: {
          name: 'Ernest Hemingway'
        }
      }

      let originalPrefix = config.get('internalFieldsPrefix')

      config.set('internalFieldsPrefix', '$')
      config.set('query.useVersionFilter', true)

      let client = request(connectionString)
      client
      .post('/v1/library/book')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(book)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)
        config.set('internalFieldsPrefix', originalPrefix)

        should.exist(res.body.results)
        let newDoc = res.body.results[0]

        should.exist(newDoc.author.$id)
        should.exist(newDoc.author.$apiVersion)
        done()
      })
    })

    it('should update reference documents that already have _id fields', done => {
      let person = {
        name: 'Ernest Hemingway'
      }

      let originalPrefix = config.get('internalFieldsPrefix')

      config.set('internalFieldsPrefix', '$')
      config.set('query.useVersionFilter', true)

      let client = request(connectionString)
      client
    .post('/v1/library/person')
    .set('Authorization', 'Bearer ' + bearerToken)
    .send(person)
    .expect(200)
    .end((err, res) => {
      if (err) return done(err)

      let author = res.body.results[0]
      author.name += ', Jnr.'

      let book = {
        title: 'For Whom The Bell Tolls',
        author: author
      }

      config.set('query.useVersionFilter', true)

      setTimeout(() => {
        let client = request(connectionString)
        client
        .post('/v1/library/book')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(book)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          config.set('internalFieldsPrefix', originalPrefix)

          should.exist(res.body.results)
          let newDoc = res.body.results[0]

          newDoc.author.$id.should.eql(author.$id)
          newDoc.author.name.should.eql(author.name)
          done()
        })
      }, 800)
    })
    })
  })
})
