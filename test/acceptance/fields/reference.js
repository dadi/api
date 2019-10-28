const app = require('../../../dadi/lib/')
const config = require('../../../config')
const help = require('../help')
const request = require('supertest')
const should = require('should')

const connectionString =
  'http://' + config.get('server.host') + ':' + config.get('server.port')

let bearerToken

describe('Reference Field', () => {
  beforeEach(done => {
    const ops = [
      help.dropDatabase('library', 'book'),
      help.dropDatabase('library', 'person'),
      help.dropDatabase('library', 'event'),
      help.dropDatabase('library', 'misc'),
      help.dropDatabase('library', 'taxonomy')
    ]

    Promise.all(ops).then(() => {
      app.start(async () => {
        await help.createSchemas([
          {
            fields: {
              title: {
                type: 'String',
                required: true
              },
              author: {
                type: 'Reference',
                settings: {
                  collection: 'person'
                }
              },
              authorStrict: {
                type: 'Reference',
                settings: {
                  collection: 'person',
                  strictCompose: true
                }
              },
              booksInSeries: {
                type: 'Reference',
                settings: {
                  collection: 'book',
                  multiple: true
                }
              },
              publishStatus: {
                type: 'Object'
              }
            },
            name: 'book',
            property: 'library',
            settings: {
              cache: false,
              authenticate: true,
              count: 40,
              storeRevisions: false
            },
            version: 'v1'
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
              },
              friend: {
                type: 'Reference'
              },
              agent: {
                type: 'Reference'
              },
              allFriends: {
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
            version: 'v1'
          },

          {
            version: 'v1',
            property: 'library',
            name: 'event',
            fields: {
              type: {
                type: 'String',
                required: true
              },
              book: {
                type: 'Reference',
                settings: {
                  collection: 'book'
                }
              },
              organiser: {
                type: 'Reference',
                settings: {
                  collection: 'person'
                }
              },
              datetime: {
                type: 'DateTime'
              }
            },
            settings: {
              cache: true,
              authenticate: false,
              count: 40,
              sort: 'datetime',
              sortOrder: 1,
              storeRevisions: false
            }
          },

          {
            version: 'v1',
            property: 'library',
            name: 'misc',
            fields: {
              boolean: {
                type: 'Boolean'
              },
              string: {
                type: 'String'
              },
              mixed: {
                type: 'Mixed'
              },
              object: {
                type: 'Object'
              },
              multiReference: {
                type: 'Reference'
              }
            },
            settings: {
              cache: false,
              authenticate: false,
              count: 40,
              sort: 'string',
              sortOrder: 1,
              storeRevisions: false
            }
          },

          {
            version: 'v1',
            property: 'library',
            name: 'taxonomy',
            fields: {
              word: {
                type: 'String',
                label: 'Word',
                comments: 'Taxanomic word',
                validation: {},
                required: true,
                message: "can't be empty"
              },
              children: {
                type: 'Reference',
                label: 'Children',
                required: false,
                settings: {
                  collection: 'taxonomy',
                  multiple: true
                }
              }
            },
            settings: {
              compose: true,
              cache: false,
              authenticate: true,
              count: 40,
              sort: 'createdAt',
              sortOrder: 1,
              storeRevisions: true,
              description: 'Taxonomy',
              displayName: 'Taxonomy'
            }
          }
        ])

        help.getBearerToken(function(err, token) {
          bearerToken = token

          done(err)
        })
      })
    })
  })

  afterEach(done => {
    help.dropSchemas().then(() => {
      app.stop(done)
    })
  })

  describe('insert', () => {
    it('should accept reference documents as an ID string', done => {
      const author = {
        name: 'Author one'
      }
      const client = request(connectionString)

      client
        .post('/library/person')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(author)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          const book = {
            title: 'Book one',
            author: res.body.results[0]._id
          }

          client
            .post('/library/book')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send(book)
            .expect(200)
            .end((err, res) => {
              res.body.results[0].author.name.should.eql(author.name)

              done()
            })
        })
    })

    it('should accept reference documents as an array of IDs', done => {
      const authors = [
        {name: 'Author one'},
        {name: 'Author two'},
        {name: 'Author three'}
      ]
      const client = request(connectionString)

      client
        .post('/library/person')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(authors)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          const book = {
            title: 'Book one',
            author: res.body.results.map(result => result._id)
          }

          client
            .post('/library/book')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send(book)
            .expect(200)
            .end((err, res) => {
              res.body.results[0].author.length.should.eql(3)
              res.body.results[0].author[0].name.should.eql(authors[0].name)
              res.body.results[0].author[1].name.should.eql(authors[1].name)
              res.body.results[0].author[2].name.should.eql(authors[2].name)

              done()
            })
        })
    })

    it('should accept reference documents as an array of _collection/_data objects containing document IDs in the _data property', done => {
      const authors = [{name: 'Author one'}, {name: 'Author two'}]
      const books = [{title: 'Book one'}, {title: 'Book two'}]
      const client = request(connectionString)

      client
        .post('/library/person')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(authors)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          const authorIds = res.body.results.map(result => result._id)

          client
            .post('/library/book')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send(books)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              const bookIds = res.body.results.map(result => result._id)
              const multiReference = [
                {
                  _collection: 'person',
                  _data: authorIds[0]
                },
                {
                  _collection: 'book',
                  _data: bookIds[0]
                },
                {
                  _collection: 'book',
                  _data: bookIds[1]
                },
                {
                  _collection: 'person',
                  _data: authorIds[1]
                }
              ]

              client
                .post('/library/misc')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({multiReference})
                .expect(200)
                .end((err, res) => {
                  if (err) return done(err)

                  const doc = res.body.results[0]

                  doc.multiReference.length.should.eql(4)
                  doc.multiReference[0].name.should.eql(authors[0].name)
                  doc.multiReference[1].title.should.eql(books[0].title)
                  doc.multiReference[2].title.should.eql(books[1].title)
                  doc.multiReference[3].name.should.eql(authors[1].name)

                  doc._composed.should.eql({
                    multiReference: multiReference.map(item => item._data)
                  })

                  doc._refMultiReference[authorIds[0]].should.eql('person')
                  doc._refMultiReference[authorIds[1]].should.eql('person')
                  doc._refMultiReference[bookIds[0]].should.eql('book')
                  doc._refMultiReference[bookIds[1]].should.eql('book')

                  done()
                })
            })
        })
    })

    it("should create reference documents that don't have _id fields", done => {
      const book = {
        title: 'For Whom The Bell Tolls',
        author: {
          name: 'Ernest Hemingway'
        }
      }

      const client = request(connectionString)

      client
        .post('/library/book')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(book)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          should.exist(res.body.results)
          const newDoc = res.body.results[0]

          should.exist(newDoc.author._id)
          newDoc.author.name.should.eql(book.author.name)
          done()
        })
    })

    it('should respond with 400 and an appropriate error message when the creation of a nested document fails (level 1)', done => {
      const book = {
        title: 'For Whom The Bell Tolls',
        author: {
          name: 'Ernest Hemingway',
          invalidField: 123
        }
      }

      const client = request(connectionString)

      client
        .post('/library/book')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(book)
        .expect(400)
        .end((err, res) => {
          if (err) return done(err)

          const {errors, success} = res.body

          success.should.eql(false)
          errors.length.should.eql(1)
          errors[0].code.should.eql('ERROR_NOT_IN_SCHEMA')
          errors[0].message.should.be.String
          errors[0].field.should.eql('author.invalidField')

          done()
        })
    })

    it('should respond with 400 and an appropriate error message when the creation of some of the nested documents fails (level 1)', done => {
      const book = {
        title: 'For Whom The Bell Tolls',
        author: [
          {
            name: 'Eduardo Hemingway',
            invalidField: 123
          },
          {
            name: 'Ernest Hemingway'
          },
          {
            invalidField: 321
          }
        ]
      }

      const client = request(connectionString)

      client
        .post('/library/book')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(book)
        .expect(400)
        .end((err, res) => {
          if (err) return done(err)

          const {errors, success} = res.body

          success.should.eql(false)
          errors.length.should.eql(3)
          errors[0].code.should.eql('ERROR_NOT_IN_SCHEMA')
          errors[0].message.should.be.String
          errors[0].field.should.eql('author.0.invalidField')

          errors[1].code.should.eql('ERROR_NOT_IN_SCHEMA')
          errors[1].message.should.be.String
          errors[1].field.should.eql('author.2.invalidField')

          errors[2].code.should.eql('ERROR_REQUIRED')
          errors[2].message.should.be.String
          errors[2].field.should.eql('author.2.name')

          done()
        })
    })

    it('should create reference documents recursively', done => {
      const event = {
        type: 'Book release',
        book: {
          title: 'For Whom The Bell Tolls',
          author: {
            name: 'Ernest Hemingway'
          }
        }
      }

      const client = request(connectionString)

      client
        .post('/library/event')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(event)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          const eventId = res.body.results[0]._id
          const bookId = res.body.results[0].book._id
          const authorId = res.body.results[0].book.author
          let doneIndex = 0

          client
            .get('/library/event/' + eventId)
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end((err, res) => {
              res.body.results[0].type.should.eql(event.type)

              if (++doneIndex === 3) done()
            })

          client
            .get('/library/book/' + bookId)
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end((err, res) => {
              res.body.results[0].title.should.eql(event.book.title)

              if (++doneIndex === 3) done()
            })

          client
            .get('/library/person/' + authorId)
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end((err, res) => {
              res.body.results[0].name.should.eql(event.book.author.name)

              if (++doneIndex === 3) done()
            })
        })
    })

    it('should respond with 400 and an appropriate error message when the creation of a nested document fails (level 2)', done => {
      const event = {
        type: 'Book release',
        book: {
          title: 'For Whom The Bell Tolls',
          author: {
            name: 'Ernest Hemingway',
            invalidField: 123
          }
        }
      }

      const client = request(connectionString)

      client
        .post('/library/event')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(event)
        .expect(400)
        .end((err, res) => {
          if (err) return done(err)

          const {errors, success} = res.body

          success.should.eql(false)
          errors.length.should.eql(1)
          errors[0].code.should.eql('ERROR_NOT_IN_SCHEMA')
          errors[0].message.should.be.String
          errors[0].field.should.eql('book.author.invalidField')

          done()
        })
    })

    it('should respond with 400 and an appropriate error message when the creation of some of the nested documents fails (level 2)', done => {
      const event = {
        type: 'Book release',
        book: [
          {
            title: 'Blindness',
            author: 'José Saramago'
          },
          {
            title: 'For Whom The Bell Tolls',
            author: [
              {
                name: 'Eduardo Hemingway',
                invalidField: 123
              },
              {
                name: 'Ernest Hemingway'
              },
              {
                invalidField: 321
              }
            ]
          }
        ]
      }

      const client = request(connectionString)

      client
        .post('/library/event')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(event)
        .expect(400)
        .end((err, res) => {
          if (err) return done(err)

          const {errors, success} = res.body

          success.should.eql(false)
          errors.length.should.eql(3)

          errors[0].code.should.eql('ERROR_NOT_IN_SCHEMA')
          errors[0].message.should.be.String
          errors[0].field.should.eql('book.1.author.0.invalidField')

          errors[1].code.should.eql('ERROR_NOT_IN_SCHEMA')
          errors[1].message.should.be.String
          errors[1].field.should.eql('book.1.author.2.invalidField')

          errors[2].code.should.eql('ERROR_REQUIRED')
          errors[2].message.should.be.String
          errors[2].field.should.eql('book.1.author.2.name')

          done()
        })
    })

    it('should respect the value of the `compose` URL parameter when returning results after insertion', done => {
      const event = {
        type: 'Book release',
        book: {
          title: 'For Whom The Bell Tolls',
          author: {
            name: 'Ernest Hemingway'
          }
        }
      }
      const client = request(connectionString)

      client
        .post('/library/event')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(event)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          res.body.results[0]._id.should.be.String
          res.body.results[0].type.should.eql(event.type)
          res.body.results[0].book.title.should.eql(event.book.title)
          res.body.results[0].book.author.should.be.String

          client
            .post('/library/event?compose=false')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send(event)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              res.body.results[0]._id.should.be.String
              res.body.results[0].type.should.eql(event.type)
              res.body.results[0].book.should.be.String

              client
                .post('/library/event?compose=all')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send(event)
                .expect(200)
                .end((err, res) => {
                  if (err) return done(err)

                  res.body.results[0]._id.should.be.String
                  res.body.results[0].type.should.eql(event.type)
                  res.body.results[0].book.title.should.eql(event.book.title)
                  res.body.results[0].book.author.name.should.eql(
                    event.book.author.name
                  )

                  done()
                })
            })
        })
    })

    it('should create reference documents recursively in the collections specified by the `_collection` field', done => {
      const item = {
        string: 'Item one',
        multiReference: [
          {
            _collection: 'book',
            _data: {
              title: 'Book one',
              author: {
                name: 'Person one'
              }
            }
          },
          {
            _collection: 'person',
            _data: {
              name: 'Person two'
            }
          }
        ]
      }
      const client = request(connectionString)

      client
        .post('/library/misc')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(item)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          const result = res.body.results[0]

          result.string.should.eql(item.string)
          result.multiReference.length.should.eql(2)
          result.multiReference[0].title.should.eql(
            item.multiReference[0]._data.title
          )
          result.multiReference[1].name.should.eql(
            item.multiReference[1]._data.name
          )
          result._refMultiReference[result.multiReference[0]._id].should.eql(
            item.multiReference[0]._collection
          )
          result._refMultiReference[result.multiReference[1]._id].should.eql(
            item.multiReference[1]._collection
          )

          client
            .get('/library/book/' + result.multiReference[0]._id)
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              res.body.results.length.should.eql(1)
              res.body.results[0].title.should.eql(
                item.multiReference[0]._data.title
              )

              client
                .get('/library/person/' + result.multiReference[1]._id)
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .end((err, res) => {
                  if (err) return done(err)

                  res.body.results.length.should.eql(1)
                  res.body.results[0].name.should.eql(
                    item.multiReference[1]._data.name
                  )

                  client
                    .get(
                      '/library/person/?filter={"name": "' +
                        item.multiReference[0]._data.author.name +
                        '"}'
                    )
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .end((err, res) => {
                      if (err) return done(err)

                      res.body.results.length.should.eql(1)
                      res.body.results[0].name.should.eql(
                        item.multiReference[0]._data.author.name
                      )

                      done()
                    })
                })
            })
        })
    })

    it('should allow an empty array of reference documents', done => {
      const book = {
        title: 'The Sun Also Rises',
        author: []
      }
      const client = request(connectionString)

      client
        .post('/library/book')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(book)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          should.exist(res.body.results)
          const newDoc = res.body.results[0]

          should.exist(newDoc.author)
          newDoc.author.should.be.Array
          newDoc.author.should.eql([])
          done()
        })
    })

    it("should create array of reference documents that don't have _id fields", done => {
      const book = {
        title: "Dash & Lily's Book of Dares",
        author: [
          {
            name: 'Rachel Cohn'
          },
          {
            name: 'David Levithan'
          }
        ]
      }
      const client = request(connectionString)

      client
        .post('/library/book')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(book)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          should.exist(res.body.results)
          const newDoc = res.body.results[0]

          should.exist(newDoc.author)
          newDoc.author.should.be.Array

          newDoc.author[0].name.should.eql('Rachel Cohn')
          newDoc.author[1].name.should.eql('David Levithan')
          done()
        })
    })

    it("should create multiple reference documents that don't have _id fields", done => {
      const data = {
        word: 'animals',
        children: [
          {
            word: 'dogs',
            children: [
              {
                word: 'guide_dogs',
                children: []
              },
              {
                word: 'puppies',
                children: []
              }
            ]
          },
          {
            word: 'foxes',
            children: []
          },
          {
            word: 'pandas',
            children: []
          }
        ]
      }
      const client = request(connectionString)

      client
        .post('/library/taxonomy')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(data)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          should.exist(res.body.results)
          const newDoc = res.body.results[0]

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
      const person = {
        name: 'Ernest Hemingway'
      }

      const client = request(connectionString)

      client
        .post('/library/person')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(person)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          const author = res.body.results[0]

          author.name += ', Jnr.'

          const book = {
            title: 'For Whom The Bell Tolls',
            author
          }

          setTimeout(() => {
            const client = request(connectionString)

            client
              .post('/library/book')
              .set('Authorization', 'Bearer ' + bearerToken)
              .send(book)
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)
                should.exist(res.body.results)
                const newDoc = res.body.results[0]

                newDoc.author._id.should.eql(author._id)
                newDoc.author.name.should.eql(author.name)
                done()
              })
          }, 800)
        })
    })

    it('should update reference documents that already have _id fields when supplied using the _collection/_data format', done => {
      const person = {
        name: 'John Doe'
      }

      const client = request(connectionString)

      client
        .post('/library/person')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(person)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          const authorId = res.body.results[0]._id

          const book = {
            title: 'For Whom The Bell Tolls',
            author: {
              _collection: 'person',
              _data: {
                _id: authorId,
                name: 'Ernest Hemingway'
              }
            }
          }
          const client = request(connectionString)

          client
            .post('/library/book')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send(book)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              should.exist(res.body.results)
              const newDoc = res.body.results[0]

              newDoc.author._id.should.eql(authorId)
              newDoc.author.name.should.eql('Ernest Hemingway')

              client
                .get('/library/person/' + authorId)
                .set('Authorization', 'Bearer ' + bearerToken)
                .send(book)
                .expect(200)
                .end((err, res) => {
                  if (err) return done(err)

                  res.body.results.length.should.eql(1)
                  res.body.results[0].name.should.eql('Ernest Hemingway')

                  done()
                })
            })
        })
    })

    it('should update reference documents that already have _id fields, translating any internal fields in the referenced documents to the prefix defined in config', done => {
      const originalPrefix = config.get('internalFieldsPrefix')

      config.set('internalFieldsPrefix', '$')

      const person = {
        name: 'Ernest Hemingway'
      }

      const client = request(connectionString)

      client
        .post('/library/person')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(person)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          const author = res.body.results[0]

          author.name += ', Jnr.'

          const book = {
            title: 'For Whom The Bell Tolls',
            author
          }

          setTimeout(() => {
            const client = request(connectionString)

            client
              .post('/library/book')
              .set('Authorization', 'Bearer ' + bearerToken)
              .send(book)
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)

                should.exist(res.body.results)
                const newDoc = res.body.results[0]

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
      help.getBearerTokenWithAccessType('admin', function(err, token) {
        let parent

        setTimeout(() => {
          request(connectionString)
            .post('/library/taxonomy')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({word: 'parent'})
            .end((err, res) => {
              if (err) return done(err)

              parent = res.body.results[0]

              request(connectionString)
                .post('/library/taxonomy')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({word: 'child'})
                .expect(200)
                .end((err, res) => {
                  if (err) return done(err)

                  const doc = res.body.results[0]

                  should.exist(doc)

                  const body = {
                    query: {_id: parent._id},
                    update: {children: doc._id.toString()}
                  }

                  request(connectionString)
                    .put('/library/taxonomy/')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .send(body)
                    .expect(200)
                    .end((err, res) => {
                      if (err) return done(err)

                      const results = res.body['results']

                      results.should.be.Array
                      results.length.should.equal(1)

                      should.exist(results[0].children.word)

                      done()
                    })
                })
            })
        }, 1000)
      })
    })

    it('should compose updated document and return when history is off', done => {
      help.getBearerTokenWithAccessType('admin', function(err, token) {
        let book

        const client = request(connectionString)

        client
          .post('/library/book')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({title: 'For Whom The Bell Tolls'})
          .end((err, res) => {
            if (err) return done(err)

            book = res.body.results[0]

            client
              .post('/library/person')
              .set('Authorization', 'Bearer ' + bearerToken)
              .send({name: 'Ernest H.'})
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)

                const doc = res.body.results[0]

                should.exist(doc)

                const body = {
                  query: {_id: book._id},
                  update: {author: doc._id.toString()}
                }

                client
                  .put('/library/book/')
                  .set('Authorization', 'Bearer ' + bearerToken)
                  .send(body)
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done(err)

                    const results = res.body['results']

                    results.should.be.Array
                    results.length.should.equal(1)
                    should.exist(results[0].author.name)

                    done()
                  })
              })
          })
      })
    })

    it("should create reference documents that don't have _id fields", done => {
      const book = {
        title: 'Thérèse Raquin'
      }

      const client = request(connectionString)

      client
        .post('/library/book')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(book)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          should.exist(res.body.results)
          const newDoc = res.body.results[0]

          const update = {
            author: {
              name: 'Émile Zola'
            }
          }

          client
            .put('/library/book/' + newDoc._id)
            .set('Authorization', 'Bearer ' + bearerToken)
            .send(update)
            .expect(200)
            .end((err, res) => {
              should.exist(res.body.results)
              const newDoc = res.body.results[0]

              should.exist(newDoc.author._id)
              newDoc.author.name.should.eql(update.author.name)
              done()
            })
        })
    })

    it('should allow an empty array of reference documents', done => {
      const book = {
        title: 'The Sun Also Rises (2nd Edition)'
      }

      const client = request(connectionString)

      client
        .post('/library/book')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(book)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          should.exist(res.body.results)
          const newDoc = res.body.results[0]

          const update = {
            author: []
          }

          client
            .put('/library/book/' + newDoc._id)
            .set('Authorization', 'Bearer ' + bearerToken)
            .send(update)
            .expect(200)
            .end((err, res) => {
              should.exist(res.body.results)
              const newDoc = res.body.results[0]

              should.exist(newDoc.author)
              newDoc.author.should.be.Array
              newDoc.author.should.eql([])
              done()
            })
        })
    })

    it("should create new reference documents that don't have _id fields", done => {
      const person = {
        name: 'Gustave Flaubert'
      }

      const client = request(connectionString)

      client
        .post('/library/person')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(person)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          const author = res.body.results[0]

          const book = {
            title: 'Madame Bolety',
            author: [author._id.toString()]
          }

          client
            .post('/library/book')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send(book)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              should.exist(res.body.results)
              let newDoc = res.body.results[0]

              should.exist(newDoc.author)
              newDoc.author.should.be.Array

              const update = {
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
                .put('/library/book/' + newDoc._id)
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

    it('should respect the value of the `compose` URL parameter when returning results after update', done => {
      const event = {
        type: 'Book release',
        book: {
          title: 'For Whom The Bell Tolls',
          author: {
            name: 'Ernest Hemingway'
          }
        }
      }
      const client = request(connectionString)

      client
        .post('/library/event')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(event)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          const eventId = res.body.results[0]._id

          client
            .put(`/library/event/${eventId}`)
            .set('Authorization', 'Bearer ' + bearerToken)
            .send(event)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              res.body.results[0]._id.should.be.String
              res.body.results[0].type.should.eql(event.type)
              res.body.results[0].book.title.should.eql(event.book.title)
              res.body.results[0].book.author.should.be.String

              client
                .put(`/library/event/${eventId}?compose=false`)
                .set('Authorization', 'Bearer ' + bearerToken)
                .send(event)
                .expect(200)
                .end((err, res) => {
                  if (err) return done(err)

                  res.body.results[0]._id.should.be.String
                  res.body.results[0].type.should.eql(event.type)
                  res.body.results[0].book.should.be.String

                  client
                    .put(`/library/event/${eventId}?compose=all`)
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .send(event)
                    .expect(200)
                    .end((err, res) => {
                      if (err) return done(err)

                      res.body.results[0]._id.should.be.String
                      res.body.results[0].type.should.eql(event.type)
                      res.body.results[0].book.title.should.eql(
                        event.book.title
                      )
                      res.body.results[0].book.author.name.should.eql(
                        event.book.author.name
                      )

                      done()
                    })
                })
            })
        })
    })
  })

  describe('delete', () => {
    it('should delete documents matching a reference field query', done => {
      const book = {
        title: 'For Whom The Bell Tolls',
        author: {
          name: 'Ernest Hemingway'
        }
      }
      const client = request(connectionString)

      client
        .post('/library/book')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(book)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          should.exist(res.body.results)
          const newDoc = res.body.results[0]

          const query = {
            query: {
              author: newDoc.author._id.toString()
            }
          }

          client
            .delete('/library/book')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send(query)
            .end((err, res) => {
              if (err) return done(err)

              client
                .get('/library/book')
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .end((err, res) => {
                  if (err) return done(err)

                  should.exist(res.body.results)
                  const results = res.body.results

                  results.length.should.eql(0)

                  done()
                })
            })
        })
    })
  })

  describe('find', () => {
    it('should populate a reference field containing a String', done => {
      const person = {name: 'Ernest Hemingway'}
      const book = {title: 'For Whom The Bell Tolls', author: null}
      const client = request(connectionString)

      client
        .post('/library/person')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(person)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          should.exist(res.body.results)

          const personId = res.body.results[0]._id

          book.author = personId.toString()

          client
            .post('/library/book')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send(book)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              client
                .get(
                  '/library/book?filter={"title":"For Whom The Bell Tolls"}&compose=true'
                )
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .end((err, res) => {
                  if (err) return done(err)

                  should.exist(res.body.results)
                  const bookResult = res.body.results[0]

                  should.exist(bookResult.author)
                  should.exist(bookResult.author.name)

                  done()
                })
            })
        })
    })

    it("should populate all reference fields that aren't null", done => {
      // first person
      const gertrude = {name: 'Gertrude Stein'}
      const client = request(connectionString)

      client
        .post('/library/person')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(gertrude)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          const personId = res.body.results[0]._id
          const ernest = {
            name: 'Ernest Hemingway',
            spouse: null,
            friend: personId.toString()
          }

          client
            .post('/library/person')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send(ernest)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              client
                .get(
                  '/library/person?filter={"name":"Ernest Hemingway", "friend":{"$ne":null}}&compose=true'
                )
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .end((err, res) => {
                  if (err) return done(err)

                  should.exist(res.body.results)
                  const result = res.body.results[0]

                  should.exist(result.friend)
                  result.friend.name.should.eql('Gertrude Stein')

                  done()
                })
            })
        })
    })

    it("should populate all reference fields when optional ones aren't defined", done => {
      // first person
      const gertrude = {name: 'Gertrude Stein'}
      const client = request(connectionString)

      client
        .post('/library/person')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(gertrude)
        .expect(200)
        .end(function(err, res) {
          if (err) return done(err)

          const personId = res.body.results[0]._id

          const ernest = {
            name: 'Ernest Hemingway',
            friend: personId.toString(),
            agent: []
          }

          client
            .post('/library/person')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send(ernest)
            .expect(200)
            .end(function(err, res) {
              if (err) return done(err)

              ernest.name = 'Half Brother'
              ernest.spouse = ernest.friend
              ernest.allFriends = []

              client
                .post('/library/person')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send(ernest)
                .expect(200)
                .end(function(err, res) {
                  if (err) return done(err)

                  client
                    .get(
                      '/library/person?compose=true&filter={"name":"Half Brother"}'
                    )
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .end(function(err, res) {
                      if (err) return done(err)

                      should.exist(res.body.results)

                      const result = res.body.results[0]

                      should.exist(result.friend)
                      result.friend.name.should.eql('Gertrude Stein')

                      done()
                    })
                })
            })
        })
    })

    it('should return results for a reference field containing an Array of Strings', done => {
      const person = {name: 'Ernest Hemingway'}
      const book = {title: 'For Whom The Bell Tolls', author: null}
      const client = request(connectionString)

      client
        .post('/library/person')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(person)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          should.exist(res.body.results)

          const personId = res.body.results[0]._id

          book.author = [personId.toString()]

          client
            .post('/library/book')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send(book)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              client
                .get(
                  '/library/book?filter={"book.author":{"$in":' +
                    [personId.toString()] +
                    '}}&compose=true'
                )
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .end((err, res) => {
                  if (err) return done(err)

                  should.exist(res.body.results)
                  const bookResult = res.body.results[0]

                  should.exist(bookResult.author)
                  should.exist(bookResult.author[0].name)

                  done()
                })
            })
        })
    })

    it('should filter documents by nested properties', done => {
      const event = {
        type: 'Book release',
        book: {
          title: 'For Whom The Bell Tolls',
          author: {
            name: 'Ernest Hemingway'
          }
        }
      }
      const client = request(connectionString)

      client
        .post('/library/event')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(event)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          client
            .get('/library/event?filter={"book.author.name":"Some dude"}')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              res.body.results.length.should.eql(0)

              client
                .get(
                  '/library/event?filter={"book.author.name":"Ernest Hemingway"}'
                )
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .end((err, res) => {
                  if (err) return done(err)

                  res.body.results.length.should.eql(1)
                  res.body.results[0].type.should.eql(event.type)

                  done()
                })
            })
        })
    })

    it('should filter documents by nested properties including escaped characters', done => {
      const event = {
        type: 'Book release',
        book: {
          title: 'A book written by an email address. Odd, right?',
          author: {
            name: 'email+address@gmail.com'
          }
        }
      }
      const client = request(connectionString)

      client
        .post('/library/event')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(event)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          client
            .get('/library/event?filter={"book.author.name":"Some dude"}')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              res.body.results.length.should.eql(0)

              client
                .get(
                  '/library/event?filter={"book.author.name":"email%2Baddress@gmail.com"}'
                )
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .end((err, res) => {
                  if (err) return done(err)

                  res.body.results.length.should.eql(1)
                  res.body.results[0].type.should.eql(event.type)

                  done()
                })
            })
        })
    })

    it('should filter documents by nested objects properties', done => {
      const event = {
        type: 'Book status',
        book: {
          title: 'For Whom The Bell Tolls',
          publishStatus: {
            status: 'published',
            rights: 'public domain'
          },
          author: {
            name: 'Ernest Hemingway'
          }
        }
      }
      const client = request(connectionString)

      client
        .post('/library/event')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(event)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          client
            .get('/library/event?filter={"book.publishStatus.status":"draft"}')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              res.body.results.length.should.eql(0)

              client
                .get(
                  '/library/event?filter={"book.publishStatus.status":"published"}&compose=true'
                )
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .end((err, res) => {
                  if (err) return done(err)

                  res.body.results.length.should.eql(1)
                  res.body.results[0].type.should.eql(event.type)

                  should.exist(res.body.results[0].book.publishStatus)
                  res.body.results[0].book.publishStatus.status.should.eql(
                    'published'
                  )

                  done()
                })
            })
        })
    })

    it('should filter documents by nested objects properties', done => {
      const event = {
        type: 'Book status',
        book: {
          title: 'For Whom The Bell Tolls',
          publishStatus: {
            status: 'published',
            rights: 'public domain'
          },
          author: {
            name: 'Ernest Hemingway'
          }
        }
      }
      const client = request(connectionString)

      client
        .post('/library/event')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(event)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          client
            .get('/library/event?filter={"book.publishStatus.status":"draft"}')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              res.body.results.length.should.eql(0)

              client
                .get(
                  '/library/event?filter={"book.publishStatus.status":"published"}'
                )
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .end((err, res) => {
                  if (err) return done(err)

                  res.body.results.length.should.eql(1)
                  res.body.results[0].type.should.eql(event.type)

                  done()
                })
            })
        })
    })

    it('should filter documents by nested properties in multi-collection references', done => {
      const miscItem = {
        string: 'Some string',
        multiReference: [
          {
            _collection: 'book',
            _data: {
              title: 'Book one',
              author: {
                name: 'Author one'
              }
            }
          },
          {
            _collection: 'person',
            _data: {
              name: 'Author two'
            }
          }
        ]
      }
      const client = request(connectionString)

      client
        .post('/library/misc')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(miscItem)
        .expect(200)
        .end((err, res) => {
          client
            .get(
              '/library/misc?filter={"multiReference.title@book":"Book one"}'
            )
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end((err, res) => {
              res.body.results.length.should.eql(1)
              res.body.results[0].string.should.eql(miscItem.string)

              client
                .get(
                  '/library/misc?filter={"multiReference.title@book":"Book seven"}'
                )
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .end((err, res) => {
                  res.body.results.length.should.eql(0)

                  client
                    .get(
                      '/library/misc?filter={"multiReference.name@person":"Author two"}'
                    )
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .end((err, res) => {
                      res.body.results.length.should.eql(1)
                      res.body.results[0].string.should.eql(miscItem.string)

                      client
                        .get(
                          '/library/misc?filter={"multiReference.name@person":"Author seven"}'
                        )
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .expect(200)
                        .end((err, res) => {
                          res.body.results.length.should.eql(0)

                          client
                            .get(
                              '/library/misc?filter={"multiReference.author@book.name":"Author seven"}'
                            )
                            .set('Authorization', 'Bearer ' + bearerToken)
                            .expect(200)
                            .end((err, res) => {
                              res.body.results.length.should.eql(0)

                              client
                                .get(
                                  '/library/misc?filter={"multiReference.author@book.name":"Author one"}'
                                )
                                .set('Authorization', 'Bearer ' + bearerToken)
                                .expect(200)
                                .end((err, res) => {
                                  res.body.results.length.should.eql(1)
                                  res.body.results[0].string.should.eql(
                                    miscItem.string
                                  )

                                  done()
                                })
                            })
                        })
                    })
                })
            })
        })
    })

    it('should return results for a reference field containing an Array of multi-collection references', done => {
      const person = {name: 'Ernest Hemingway'}
      const book = {title: 'For Whom The Bell Tolls'}
      const multiReference = [
        {
          _collection: 'person',
          _data: person
        },
        {
          _collection: 'book',
          _data: book
        }
      ]
      const client = request(connectionString)

      client
        .post('/library/misc')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send({multiReference})
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          should.exist(res.body.results)

          client
            .get(`/library/misc/${res.body.results[0]._id}?compose=all`)
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              res.body.results.length.should.eql(1)

              const item = res.body.results[0]

              item.multiReference[0].name.should.eql(person.name)
              item.multiReference[1].title.should.eql(book.title)

              done()
            })
        })
    })

    it('should return referenced documents with the specified fields only', done => {
      const event = {
        type: 'Book release',
        datetime: 1522791512197,
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
      const client = request(connectionString)

      client
        .post('/library/event')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(event)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          client
            .get(
              '/library/event?filter={"book.author.name":"Ernest Hemingway"}&fields={"type":1,"book.author.spouse":1}&compose=all'
            )
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              const eventResult = res.body.results[0]

              eventResult.type.should.eql(event.type)
              should.not.exist(eventResult.datetime)
              should.not.exist(eventResult.book.title)
              should.not.exist(eventResult.book.author.name)
              eventResult.book.author.spouse.name.should.eql(
                event.book.author.spouse.name
              )

              done()
            })
        })
    })

    it('should return multi-collection referenced documents with the specified fields only', done => {
      const item = {
        string: 'Some string',
        mixed: 1234,
        multiReference: [
          {
            _collection: 'person',
            _data: {
              name: 'Ernest Hemingway',
              spouse: {
                name: 'Mary Welsh Hemingway'
              }
            }
          },
          {
            _collection: 'book',
            _data: {
              title: 'War and Peace',
              author: {
                name: 'Leo Tolstoy'
              }
            }
          }
        ]
      }
      const client = request(connectionString)

      client
        .post('/library/misc')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(item)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          client
            .get(
              '/library/misc?filter={"string":"Some string"}&fields={"mixed":1,"multiReference.spouse@person":1,"multiReference.author@book":1}&compose=all'
            )
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              const itemResult = res.body.results[0]

              should.not.exist(itemResult.string)
              itemResult.mixed.should.eql(item.mixed)
              should.not.exist(itemResult.multiReference[0].name)
              itemResult.multiReference[0].spouse.name.should.eql(
                item.multiReference[0]._data.spouse.name
              )
              should.not.exist(itemResult.multiReference[1].title)
              itemResult.multiReference[1].author.name.should.eql(
                item.multiReference[1]._data.author.name
              )

              done()
            })
        })
    })

    it('should populate a `_composed` field with IDs for the composed fields only', done => {
      const books = [
        {
          title: 'For Whom The Bell Tolls',
          author: {
            name: 'Ernest Hemingway'
          }
        },
        {
          title: 'War and Peace',
          author: {
            name: 'Leo Tolstoy'
          }
        },
        {
          title: 'A Tale of Two APIs',
          author: 'id-that-does-not-exist'
        }
      ]
      const client = request(connectionString)

      client
        .post('/library/book')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(books)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          should.exist(res.body.results)

          client
            .get('/library/book?compose=false')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              res.body.results.length.should.eql(3)
              res.body.results[0]._id.should.be.String
              should.not.exist(res.body.results[0]._composed)
              res.body.results[1]._id.should.be.String
              should.not.exist(res.body.results[1]._composed)
              res.body.results[2]._id.should.be.String
              should.not.exist(res.body.results[2]._composed)

              client
                .get(
                  `/library/book?filter={"title":"${books[0].title}"}&compose=true`
                )
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .end((err, res) => {
                  if (err) return done(err)

                  res.body.results[0]._composed.author.should.eql(
                    res.body.results[0].author._id
                  )
                  res.body.results[0].author.name.should.eql(
                    books[0].author.name
                  )

                  client
                    .get(
                      `/library/book?filter={"title":"${books[1].title}"}&compose=true`
                    )
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .expect(200)
                    .end((err, res) => {
                      if (err) return done(err)

                      res.body.results[0]._composed.author.should.eql(
                        res.body.results[0].author._id
                      )
                      res.body.results[0].author.name.should.eql(
                        books[1].author.name
                      )

                      client
                        .get(
                          `/library/book?filter={"title":"${books[2].title}"}&compose=true`
                        )
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .expect(200)
                        .end((err, res) => {
                          if (err) return done(err)

                          should.not.exist(res.body.results[0]._composed)
                          res.body.results[0].author.should.eql(books[2].author)

                          done()
                        })
                    })
                })
            })
        })
    })

    it('should populate a `_composed` field with IDs for composed documents of multiple fields', done => {
      const event = {
        type: 'Book release',
        book: {
          title: 'For Whom The Bell Tolls'
        },
        organiser: {
          name: 'Justin Case'
        }
      }
      const client = request(connectionString)

      client
        .post('/library/event')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(event)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          should.exist(res.body.results)

          client
            .get(`/library/event/${res.body.results[0]._id}?compose=true`)
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              res.body.results[0]._composed.book.should.eql(
                res.body.results[0].book._id
              )
              res.body.results[0]._composed.organiser.should.eql(
                res.body.results[0].organiser._id
              )

              done()
            })
        })
    })

    describe('when `settings.strictCompose` is not enabled', () => {
      it('should return unique results for a reference field containing an Array of Strings', done => {
        const book = {title: 'For Whom The Bell Tolls', author: null}
        const author = {name: 'Ernest Hemingway'}
        const client = request(connectionString)

        client
          .post('/library/person')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send(author)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            should.exist(res.body.results)

            const personId = res.body.results[0]._id

            // add author multiple times
            book.author = []
            book.author.push(personId.toString())
            book.author.push(personId.toString())
            book.author.push(personId.toString())

            client
              .post('/library/book')
              .set('Authorization', 'Bearer ' + bearerToken)
              .send(book)
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)

                client
                  .get(
                    '/library/book?filter={"book.author":{"$in":' +
                      [personId.toString()] +
                      '}}&compose=true'
                  )
                  .set('Authorization', 'Bearer ' + bearerToken)
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done(err)

                    should.exist(res.body.results)
                    const bookResult = res.body.results[0]

                    should.exist(bookResult.author)
                    bookResult.author.length.should.eql(1)

                    done()
                  })
              })
          })
      })

      it('should return unique results for a reference field when it contains an Array of Strings and Nulls', done => {
        const book = {title: 'For Whom The Bell Tolls', author: null}
        const client = request(connectionString)

        client
          .post('/library/person')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({name: 'Ernest Hemingway'})
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            should.exist(res.body.results)

            const personId = res.body.results[0]._id

            // add author multiple times
            book.author = []
            book.author.push(personId.toString())
            book.author.push(null)
            book.author.push(personId.toString())

            client
              .post('/library/book')
              .set('Authorization', 'Bearer ' + bearerToken)
              .send(book)
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)

                client
                  .get(
                    '/library/book?filter={"book.author":{"$in":' +
                      [personId.toString()] +
                      '}}&compose=true'
                  )
                  .set('Authorization', 'Bearer ' + bearerToken)
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done(err)

                    should.exist(res.body.results)
                    const bookResult = res.body.results[0]

                    should.exist(bookResult.author)
                    bookResult.author.length.should.eql(1)
                    should.exist(bookResult.author[0].name)

                    done()
                  })
              })
          })
      })

      it('should show the raw ID for reference fields where the single referenced ID does not correspond to an existing document', done => {
        const book = {
          title: 'For Whom The Bell Tolls',
          author: 'id-that-does-not-exist'
        }
        const client = request(connectionString)

        client
          .post('/library/book')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send(book)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            should.exist(res.body.results)

            const bookId = res.body.results[0]._id

            client
              .get(`/library/book/${bookId}?compose=true`)
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
        const book = {
          title: 'For Whom The Bell Tolls',
          author: [
            'id-that-does-not-exist',
            {name: 'Ernest Hemingway'},
            'another-id-that-does-not-exist'
          ]
        }
        const client = request(connectionString)

        client
          .post('/library/book')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send(book)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            should.exist(res.body.results)

            const bookId = res.body.results[0]._id

            client
              .get(`/library/book/${bookId}?compose=true`)
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)

                const authorResults = res.body.results[0].author

                authorResults.length.should.eql(3)
                authorResults[0].should.eql(book.author[0])
                authorResults[1].name.should.eql(book.author[1].name)
                authorResults[2].should.eql(book.author[2])

                done()
              })
          })
      })

      it('should show an array of raw values for reference fields where none of the referenced IDs do not correspond to existing documents', done => {
        const book = {
          title: 'For Whom The Bell Tolls',
          author: ['id-that-does-not-exist', 'another-id-that-does-not-exist']
        }
        const client = request(connectionString)

        client
          .post('/library/book')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send(book)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            should.exist(res.body.results)

            const bookId = res.body.results[0]._id

            client
              .get(`/library/book/${bookId}?compose=true`)
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)

                const authorResults = res.body.results[0].author

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
        const book = {title: 'For Whom The Bell Tolls', author: null}
        const author = {name: 'Ernest Hemingway'}
        const client = request(connectionString)

        client
          .post('/library/person')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send(author)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            should.exist(res.body.results)

            const personId = res.body.results[0]._id

            // add author multiple times
            book.authorStrict = []
            book.authorStrict.push(personId.toString())
            book.authorStrict.push(personId.toString())
            book.authorStrict.push(personId.toString())

            client
              .post('/library/book')
              .set('Authorization', 'Bearer ' + bearerToken)
              .send(book)
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)

                client
                  .get(
                    '/library/book?filter={"book.authorStrict":{"$in":' +
                      [personId.toString()] +
                      '}}&compose=true'
                  )
                  .set('Authorization', 'Bearer ' + bearerToken)
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done(err)

                    should.exist(res.body.results)
                    const bookResult = res.body.results[0]

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
        const book = {title: 'For Whom The Bell Tolls', author: null}
        const author = {name: 'Ernest Hemingway'}
        const client = request(connectionString)

        client
          .post('/library/person')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send(author)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            should.exist(res.body.results)

            const personId = res.body.results[0]._id

            // add author multiple times
            book.authorStrict = []
            book.authorStrict.push(personId.toString())
            book.authorStrict.push(null)
            book.authorStrict.push(personId.toString())

            client
              .post('/library/book')
              .set('Authorization', 'Bearer ' + bearerToken)
              .send(book)
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)

                client
                  .get(
                    '/library/book?filter={"book.authorStrict":{"$in":' +
                      [personId.toString()] +
                      '}}&compose=true'
                  )
                  .set('Authorization', 'Bearer ' + bearerToken)
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done(err)

                    should.exist(res.body.results)
                    const bookResult = res.body.results[0]

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
        const book = {
          title: 'For Whom The Bell Tolls',
          authorStrict: 'id-that-does-not-exist'
        }
        const client = request(connectionString)

        client
          .post('/library/book')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send(book)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            should.exist(res.body.results)

            const bookId = res.body.results[0]._id

            client
              .get(`/library/book/${bookId}?compose=true`)
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
        const book = {
          title: 'For Whom The Bell Tolls',
          authorStrict: [
            'id-that-does-not-exist',
            {name: 'Ernest Hemingway'},
            'another-id-that-does-not-exist'
          ]
        }
        const client = request(connectionString)

        client
          .post('/library/book')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send(book)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            should.exist(res.body.results)

            const bookId = res.body.results[0]._id

            client
              .get(`/library/book/${bookId}?compose=true`)
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)

                const authorResults = res.body.results[0].authorStrict

                authorResults.length.should.eql(3)
                should.equal(authorResults[0], null)
                authorResults[1].name.should.eql(book.authorStrict[1].name)
                should.equal(authorResults[2], null)

                done()
              })
          })
      })

      it('should show an array of null for reference fields where none of the referenced IDs do not correspond to existing documents', done => {
        const book = {
          title: 'For Whom The Bell Tolls',
          authorStrict: [
            'id-that-does-not-exist',
            'another-id-that-does-not-exist'
          ]
        }
        const client = request(connectionString)

        client
          .post('/library/book')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send(book)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            should.exist(res.body.results)

            const bookId = res.body.results[0]._id

            client
              .get(`/library/book/${bookId}?compose=true`)
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)

                const authorResults = res.body.results[0].authorStrict

                authorResults.length.should.eql(2)
                should.equal(authorResults[0], null)
                should.equal(authorResults[1], null)

                done()
              })
          })
      })
    })

    it('should return results in the same order as the original Array', done => {
      const book = {title: 'Death in the Afternoon', author: null}

      book.author = []

      const client = request(connectionString)

      client
        .post('/library/person')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send({name: 'Ernest Hemingway'})
        .expect(200)
        .end((err, res) => {
          let personId = res.body.results[0]._id

          book.author.push(personId.toString())

          const client = request(connectionString)

          client
            .post('/library/person')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({name: 'A.N. Other'})
            .expect(200)
            .end((err, res) => {
              personId = res.body.results[0]._id
              book.author.unshift(personId.toString())

              const client = request(connectionString)

              client
                .post('/library/person')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({name: 'Michael Jackson'})
                .expect(200)
                .end((err, res) => {
                  personId = res.body.results[0]._id
                  book.author.push(personId.toString())

                  client
                    .post('/library/book')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .send(book)
                    .expect(200)
                    .end((err, res) => {
                      if (err) return done(err)

                      client
                        .get(
                          '/library/book?filter={"title":"Death in the Afternoon"}&compose=true'
                        )
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .expect(200)
                        .end((err, res) => {
                          should.exist(res.body.results)
                          const bookResult = res.body.results[0]

                          should.exist(bookResult.author)

                          for (let i = 0; i < bookResult.author.length; i++) {
                            const author = bookResult.author[i]

                            author._id
                              .toString()
                              .should.eql(
                                bookResult._composed.author[i].toString()
                              )
                          }

                          done()
                        })
                    })
                })
            })
        })
    })

    it('should compose as many levels of references as the value of `compose`, with `true` being 1 and `all` being infinite', done => {
      const event = {
        type: 'Book release',
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
      const client = request(connectionString)

      client
        .post('/library/event')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(event)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          const eventId = res.body.results[0]._id
          let doneCount = 0
          const doneFn = () => {
            if (++doneCount === 4) done()
          }

          client
            .get(`/library/event/${eventId}?compose=true`)
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end((err, res) => {
              res.body.results[0].type.should.eql(event.type)
              res.body.results[0].book.title.should.eql(event.book.title)
              res.body.results[0].book.author.should.be.String

              doneFn()
            })

          client
            .get(`/library/event/${eventId}?compose=2`)
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end((err, res) => {
              res.body.results[0].type.should.eql(event.type)
              res.body.results[0].book.title.should.eql(event.book.title)
              res.body.results[0].book.author.name.should.eql(
                event.book.author.name
              )
              res.body.results[0].book.author.spouse.should.be.String

              doneFn()
            })

          client
            .get(`/library/event/${eventId}?compose=3`)
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end((err, res) => {
              res.body.results[0].type.should.eql(event.type)
              res.body.results[0].book.title.should.eql(event.book.title)
              res.body.results[0].book.author.name.should.eql(
                event.book.author.name
              )
              res.body.results[0].book.author.spouse.name.should.eql(
                event.book.author.spouse.name
              )

              doneFn()
            })

          client
            .get(`/library/event/${eventId}?compose=all`)
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end((err, res) => {
              res.body.results[0].type.should.eql(event.type)
              res.body.results[0].book.title.should.eql(event.book.title)
              res.body.results[0].book.author.name.should.eql(
                event.book.author.name
              )
              res.body.results[0].book.author.spouse.name.should.eql(
                event.book.author.spouse.name
              )

              doneFn()
            })
        })
    })
  })

  describe('with configured prefix', () => {
    it("should create reference documents that don't have identifier fields", done => {
      const book = {
        title: 'For Whom The Bell Tolls',
        author: {
          name: 'Ernest Hemingway'
        }
      }

      const originalPrefix = config.get('internalFieldsPrefix')

      config.set('internalFieldsPrefix', '$')

      const client = request(connectionString)

      client
        .post('/library/book')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(book)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          config.set('internalFieldsPrefix', originalPrefix)

          should.exist(res.body.results)
          const newDoc = res.body.results[0]

          should.exist(newDoc.author.$id)
          done()
        })
    })

    it('should update reference documents that already have _id fields', done => {
      const person = {
        name: 'Ernest Hemingway'
      }

      const originalPrefix = config.get('internalFieldsPrefix')

      config.set('internalFieldsPrefix', '$')

      const client = request(connectionString)

      client
        .post('/library/person')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(person)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          const author = res.body.results[0]

          author.name += ', Jnr.'

          const book = {
            title: 'For Whom The Bell Tolls',
            author
          }

          setTimeout(() => {
            const client = request(connectionString)

            client
              .post('/library/book')
              .set('Authorization', 'Bearer ' + bearerToken)
              .send(book)
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)
                config.set('internalFieldsPrefix', originalPrefix)

                should.exist(res.body.results)
                const newDoc = res.body.results[0]

                newDoc.author.$id.should.eql(author.$id)
                newDoc.author.name.should.eql(author.name)
                done()
              })
          }, 800)
        })
    })
  })
})
