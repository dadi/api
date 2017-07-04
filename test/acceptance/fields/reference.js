var should = require('should');
var fs = require('fs');
var path = require('path');
var request = require('supertest');
var _ = require('underscore');
var config = require(__dirname + '/../../../config');
var help = require(__dirname + '/../help');
var app = require(__dirname + '/../../../dadi/lib/');

// variables scoped for use throughout tests
var bearerToken;
var connectionString = 'http://' + config.get('server.host') + ':' + config.get('server.port');

describe('Reference Field', function () {
  beforeEach(function (done) {
    config.set('paths.collections', 'test/acceptance/workspace/collections')

    help.dropDatabase('testdb', function (err) {
      if (err) return done(err)

      app.start(function() {
        help.getBearerToken(function (err, token) {
          if (err) return done(err)
          bearerToken = token;
          done();
        })
      })
    })
  })

  afterEach(function (done) {
    config.set('paths.collections', 'workspace/collections')
    app.stop(done)
  });

  describe('insert', function () {
    it('should create reference documents that don\'t have _id fields', function (done) {
      var book = {
        title: 'For Whom The Bell Tolls',
        author: {
          name: 'Ernest Hemingway'
        }
      }

      config.set('query.useVersionFilter', true)

      var client = request(connectionString)
      client
      .post('/v1/library/book')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(book)
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err)
        should.exist(res.body.results)
        var newDoc = res.body.results[0]
        should.exist(newDoc.author._id)
        should.exist(newDoc.author.apiVersion)
        done()
      })
    })

    it('should allow an empty array of reference documents', function (done) {
      var book = {
        title: 'The Sun Also Rises',
        author: []
      }

      config.set('query.useVersionFilter', true)

      var client = request(connectionString)
      client
      .post('/v1/library/book')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(book)
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err)
        should.exist(res.body.results)
        var newDoc = res.body.results[0]

        should.exist(newDoc.author)
        newDoc.author.should.be.Array
        newDoc.author.should.eql([])
        done()
      })
    })

    it('should create array of reference documents that don\'t have _id fields', function (done) {
      var book = {
        title: 'Dash & Lily\'s Book of Dares',
        author: [
          {
            name: 'Rachel Cohn'
          },
          {
            name: 'David Levithan'
          },
        ]
      }

      config.set('query.useVersionFilter', true)

      var client = request(connectionString)
      client
      .post('/v1/library/book')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(book)
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err)
        should.exist(res.body.results)
        var newDoc = res.body.results[0]

        should.exist(newDoc.author)
        newDoc.author.should.be.Array

        newDoc.author[0].name.should.eql('Rachel Cohn')
        newDoc.author[1].name.should.eql('David Levithan')
        done()
      })
    })

    it('should create multiple reference documents that don\'t have _id fields', function (done) {
      var data = {
        "word": "animals",
        "children": [
          {
            "word": "dogs",
            "children": [
              {
                "word": "guide_dogs",
                "children": []
              },
              {
                "word": "puppies",
                "children": []
              }
            ]
          },
          {
            "word": "foxes",
            "children": []
          },
          {
            "word": "pandas",
            "children": []
          }
        ]
      }

      config.set('query.useVersionFilter', true)

      var client = request(connectionString)
      client
      .post('/v1/library/taxonomy')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(data)
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err)

        should.exist(res.body.results)
        var newDoc = res.body.results[0]

        should.exist(newDoc.word)
        newDoc.word.should.eql('animals')

        newDoc.children.length.should.eql(3)
        newDoc.children[0].word.should.eql('dogs')
        newDoc.children[1].word.should.eql('foxes')
        newDoc.children[2].word.should.eql('pandas')
        done()
      })
    })

    it('should update reference documents that already have _id fields', function (done) {
      var person = {
        name: 'Ernest Hemingway'
      }

      var client = request(connectionString);
      client
      .post('/v1/library/person')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(person)
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err)

        var author = res.body.results[0]
        author.name += ', Jnr.'

        var book = {
          title: 'For Whom The Bell Tolls',
          author: author
        }

        config.set('query.useVersionFilter', true)

        setTimeout(function() {
          var client = request(connectionString)
          client
          .post('/v1/library/book')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send(book)
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err)
            should.exist(res.body.results)
            var newDoc = res.body.results[0]

            newDoc.author._id.should.eql(author._id)
            newDoc.author.name.should.eql(author.name)
            done()
          })
        }, 800)
      })
    })
  })

  describe('update', function () {
    it('should compose updated document and return when history is on', function (done) {
      help.getBearerTokenWithAccessType('admin', function (err, token) {
        // modify schema settings
        var jsSchemaString = fs.readFileSync(__dirname + '/../workspace/collections/v1/library/collection.book.json', {encoding: 'utf8'})
        var schema = JSON.parse(jsSchemaString)
        schema.settings.storeRevisions = true

        config.set('query.useVersionFilter', true)

        var book

        var client = request(connectionString)
        client
          .post('/v1/library/book/config')
          .send(JSON.stringify(schema, null, 2))
          .set('content-type', 'text/plain')
          .set('Authorization', 'Bearer ' + token)
          .expect(200)
          .expect('content-type', 'application/json')
          .end(function (err, res) {
            setTimeout(function () {
              client
                .post('/v1/library/book')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({title: 'For Whom The Bell Tolls'})
                .end(function (err, res) {
                  if (err) return done(err)

                  book = res.body.results[0]

                  client
                    .post('/v1/library/person')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .send({name: 'Ernest H.'})
                    .expect(200)
                    .end(function (err, res) {
                      if (err) return done(err)

                      var doc = res.body.results[0]
                      should.exist(doc)

                      var body = {
                        query: { _id: book._id },
                        update: { author: doc._id.toString() }
                      }

                      client
                        .put('/v1/library/book/')
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .send(body)
                        .expect(200)
                        .end(function (err, res) {
                          if (err) return done(err)

                          var results = res.body['results']
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

    it('should compose updated document and return when history is off', function (done) {
      help.getBearerTokenWithAccessType('admin', function (err, token) {
        // modify schema settings
        var jsSchemaString = fs.readFileSync(__dirname + '/../workspace/collections/v1/library/collection.book.json', {encoding: 'utf8'})
        var schema = JSON.parse(jsSchemaString)
        schema.settings.storeRevisions = false

        config.set('query.useVersionFilter', true)

        var book

        var client = request(connectionString)
        client
          .post('/v1/library/book/config')
          .send(JSON.stringify(schema, null, 2))
          .set('content-type', 'text/plain')
          .set('Authorization', 'Bearer ' + token)
          .expect(200)
          .expect('content-type', 'application/json')
          .end(function (err, res) {
            setTimeout(function () {
              client
                .post('/v1/library/book')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({title: 'For Whom The Bell Tolls'})
                .end(function (err, res) {
                  if (err) return done(err)

                  book = res.body.results[0]

                  client
                    .post('/v1/library/person')
                    .set('Authorization', 'Bearer ' + bearerToken)
                    .send({name: 'Ernest H.'})
                    .expect(200)
                    .end(function (err, res) {
                      if (err) return done(err)

                      var doc = res.body.results[0]
                      should.exist(doc)

                      var body = {
                        query: { _id: book._id },
                        update: { author: doc._id.toString() }
                      }

                      client
                        .put('/v1/library/book/')
                        .set('Authorization', 'Bearer ' + bearerToken)
                        .send(body)
                        .expect(200)
                        .end(function (err, res) {
                          if (err) return done(err)

                          var results = res.body['results']
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
  })

  describe('find', function () {
    it('should populate a reference field containing an ObjectID', function (done) {
      var person = { name: 'Ernest Hemingway' };
      var book = { title: 'For Whom The Bell Tolls', author: null };

      config.set('query.useVersionFilter', true)

      var client = request(connectionString);
      client
      .post('/v1/library/person')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(person)
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);

        should.exist(res.body.results);

        var personId = res.body.results[0]._id
        book.author = personId

        client
        .post('/v1/library/book')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(book)
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);

          client
          .get('/v1/library/book?compose=true')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err);
            should.exist(res.body.results)
            var bookResult = res.body.results[0]
            should.exist(bookResult.author)
            should.exist(bookResult.author.name)

            done();
          })
        })
      });
    });

    it('should populate a reference field containing a String', function (done) {
      var person = { name: 'Ernest Hemingway' };
      var book = { title: 'For Whom The Bell Tolls', author: null };

      config.set('query.useVersionFilter', true)

      var client = request(connectionString);
      client
      .post('/v1/library/person')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(person)
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);

        should.exist(res.body.results);

        var personId = res.body.results[0]._id
        book.author = personId.toString()

        client
        .post('/v1/library/book')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(book)
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);

          client
          .get('/v1/library/book?compose=true')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err);

            should.exist(res.body.results)
            var bookResult = res.body.results[0]
            //console.log(bookResult)
            should.exist(bookResult.author)
            should.exist(bookResult.author.name)

            done();
          })
        })
      });
    });

    it('should populate all reference fields that aren\'t null', function (done) {
      // first person
      var gertrude = { name: 'Gertrude Stein' }

      config.set('query.useVersionFilter', true)

      var client = request(connectionString);
      client
      .post('/v1/library/person')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(gertrude)
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);

        var personId = res.body.results[0]._id

        var ernest = {
          name: 'Ernest Hemingway',
          spouse: null,
          friend: personId.toString()
        }

        client
        .post('/v1/library/person')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(ernest)
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err)

          client
          .get('/v1/library/person?filter={"name":"Ernest Hemingway", "friend":{"$ne":null}}&compose=true')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err);

            should.exist(res.body.results)
            var result = res.body.results[0]

            should.exist(result.friend)
            result.friend.name.should.eql('Gertrude Stein')

            done();
          })
        })
      });
    });

    it('should return results for a reference field containing an Array of Strings', function (done) {
      var person = { name: 'Ernest Hemingway' };
      var book = { title: 'For Whom The Bell Tolls', author: null };

      config.set('query.useVersionFilter', true)

      var client = request(connectionString);
      client
      .post('/v1/library/person')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(person)
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);

        should.exist(res.body.results);

        var personId = res.body.results[0]._id
        book.author = [personId.toString()]

        client
        .post('/v1/library/book')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(book)
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);

          client
          .get('/v1/library/book?filter={"book.author":{"$in":' + [personId.toString()] + '}}&compose=true')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err);

            should.exist(res.body.results)
            var bookResult = res.body.results[0]

            should.exist(bookResult.author)
            should.exist(bookResult.author[0].name)

            done();
          })
        })
      });
    });

    it('should return results in the same order as the original Array', function (done) {
      var book = { title: 'Death in the Afternoon', author: null };
      book.author = []

      config.set('query.useVersionFilter', true)

      var client = request(connectionString);
      client
      .post('/v1/library/person')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send({ name: 'Ernest Hemingway' })
      .expect(200)
      .end(function (err, res) {

        var personId = res.body.results[0]._id
        book.author.push(personId.toString())

        var client = request(connectionString);
        client
        .post('/v1/library/person')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send({ name: 'A.N. Other' })
        .expect(200)
        .end(function (err, res) {

          personId = res.body.results[0]._id
          book.author.unshift(personId.toString())

          var client = request(connectionString);
          client
          .post('/v1/library/person')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({ name: 'Michael Jackson' })
          .expect(200)
          .end(function (err, res) {

            personId = res.body.results[0]._id
            book.author.push(personId.toString())

            client
            .post('/v1/library/book')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send(book)
            .expect(200)
            .end(function (err, res) {
              if (err) return done(err);

              client
              .get('/v1/library/book?filter={"title":"Death in the Afternoon"}&compose=true')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .end(function (err, res) {

                should.exist(res.body.results)
                var bookResult = res.body.results[0]

                should.exist(bookResult.author)

                for (var i = 0; i < bookResult.author.length; i++) {
                  var author = bookResult.author[i]
                  author._id.toString().should.eql(bookResult.composed.author[i].toString())
                }

                done();
              })
            })
          })
        })
      })
    })
  })
})
