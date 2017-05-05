var should = require('should')
var sinon = require('sinon')
var model = require(__dirname + '/../../../dadi/lib/model')
var queryUtils = require(__dirname + '/../../../dadi/lib/model/utils')
var apiHelp = require(__dirname + '/../../../dadi/lib/help')
var Validator = require(__dirname + '/../../../dadi/lib/model/validator')
var connection = require(__dirname + '/../../../dadi/lib/model/connection')
var _ = require('underscore')
var help = require(__dirname + '/../help')
var acceptanceHelper = require(__dirname + '/../../acceptance/help')
var config = require(__dirname + '/../../../config')

describe('Model', function () {
  describe('Composer', function () {
    it('should be attached to Model', function (done) {
      var mod = model('testModelName', help.getModelSchema(), null, { database: 'testdb' })
      mod.composer.should.be.Object
      mod.composer.compose.should.be.Function
      done()
    })

    describe('compose', function () {
      // some defaults
      var bookSchema = {
        'title': {
          'type': 'String',
          'required': true
        },
        'author': {
          'type': 'Reference',
          'settings': {
            'collection': 'person',
            'fields': ['name', 'spouse']
          }
        },
        'booksInSeries': {
          'type': 'Reference',
          'settings': {
            'collection': 'book',
            'multiple': true
          }
        }
      }

      var personSchema = {
        'name': {
          'type': 'String',
          'required': true
        },
        'occupation': {
          'type': 'String',
          'required': false
        },
        'nationality': {
          'type': 'String',
          'required': false
        },
        'education': {
          'type': 'String',
          'required': false
        },
        'spouse': {
          'type': 'Reference'
        }
      }

      var schema = help.getModelSchema()

      var refField = {
        'refField': {
          'type': 'Reference',
          'settings': {
            // "database": "library2", // leave out to default to the same
            // "collection": "authors", // leave out to default to the same
            // "fields": ["firstName", "lastName"]
          }
        }
      }

      var nameFields = {
        'firstName': {
          'type': 'String',
          'required': false
        },
        'lastName': {
          'type': 'String',
          'required': false
        }
      }

      _.extend(schema, refField)
      _.extend(schema, nameFields)

      var mod = model('testModelName', schema, null, { database: 'testdb'})

      beforeEach(function (done) {
        acceptanceHelper.dropDatabase('testdb', err => {
          // create some docs
          for (var i = 0; i < 5; i++) {
            mod.create({fieldName: 'foo_' + i, firstName: 'Foo', lastName: i.toString()}, (err, result) => {
              if (err) return done(err)
            })

            if (i === 4) {
              return done()
            }
          }
        })
      })

      it('should populate a reference field containing an ObjectID', function (done) {
        // find a doc
        mod.find({ fieldName: 'foo_3' } , {}, function (err, result) {
          var anotherDoc = result.results[0]

          // add the id to another doc
          mod.update({ fieldName: 'foo_1' }, { refField: anotherDoc._id.toString() }, function (err, result) {
            // doc1 should now have anotherDoc == doc3
            mod.find({fieldName: 'foo_1'}, { 'compose': true }, function (err, result) {

              var doc = result.results[0]
              should.exist(doc.refField.fieldName)
              doc.refField.fieldName.should.equal('foo_3')

              // composed property
              should.exist(doc.composed)
              should.exist(doc.composed.refField)

              doc.composed.refField.toString().should.eql(doc.refField._id.toString())

              done()
            })
          })
        })
      })

      it('should populate a reference field with specified fields only', function (done) {
        schema.refField.settings['fields'] = ['firstName', 'lastName']

        // find a doc
        mod.find({ fieldName: 'foo_3' } , {}, function (err, result) {
          var anotherDoc = result.results[0]

          // add the id to another doc
          mod.update({ fieldName: 'foo_1' }, { refField: anotherDoc._id }, function (err, result) {
            // doc1 should now have anotherDoc == doc3
            mod.find({fieldName: 'foo_1'}, { 'compose': true }, function (err, result) {
              var doc = result.results[0]
              should.not.exist(doc.refField.fieldName)
              should.exist(doc.refField.firstName)
              should.exist(doc.refField.lastName)
              doc.refField.firstName.should.equal('Foo')
              doc.refField.lastName.should.equal('3')

              // composed property
              should.exist(doc.composed)
              should.exist(doc.composed.refField)
              doc.composed.refField.toString().should.eql(doc.refField._id.toString())

              done()
            })
          })
        })
      })

      it('should reference a document in the specified collection', function (done) {
        // create two models
        var book = model('book', bookSchema, null, { database: 'testdb' })
        var person = model('person', personSchema, null, { database: 'testdb' })

        person.create({name: 'Neil Murray'}, function (err, result) {
          var id = result.results[0]._id

          person.create({name: 'J K Rowling', spouse: id}, function (err, result) {
            var id = result.results[0]._id

            book.create({title: 'Harry Potter 1', author: id}, function (err, result) {
              var bookid = result.results[0]._id
              var books = []
              books.push(bookid)

              book.create({title: 'Harry Potter 2', author: id, booksInSeries: books}, function (err, result) {
                // find a book
                book.find({ title: 'Harry Potter 2' } , { 'compose': true }, function (err, result) {
                  var doc = result.results[0]
                  should.exist(doc.author.name)
                  doc.author.name.should.equal('J K Rowling')

                  done()
                })
              })
            })
          })
        })
      })

      it('should allow specifying to not resolve the references via the model settings', function (done) {
        // create two models
        var book = model('book', bookSchema, null, { database: 'testdb', 'compose': false })
        var person = model('person', personSchema, null, { database: 'testdb', 'compose': false })

        person.create({name: 'Neil Murray'}, function (err, result) {
          var id = result.results[0]._id

          person.create({name: 'J K Rowling', spouse: id}, function (err, result) {
            var id = result.results[0]._id

            book.create({title: 'Harry Potter 1', author: id}, function (err, result) {
              var bookid = result.results[0]._id
              var books = []
              books.push(bookid)

              book.create({title: 'Harry Potter 2', author: id, booksInSeries: books}, function (err, result) {
                // find a book
                book.find({ title: 'Harry Potter 2' } , { 'compose': true }, function (err, result) {
                  // console.log(JSON.stringify(result, null, 2))

                  var doc = result.results[0]
                  should.exist(doc.author.name)
                  should.not.exist(doc.author.spouse.name)

                  done()
                })
              })
            })
          })
        })
      })

      it('should allow specifying to resolve the references via the model settings', function (done) {
        // create two models
        var book = model('book', bookSchema, null, { database: 'testdb', 'compose': true })
        var person = model('person', personSchema, null, { database: 'testdb', 'compose': true })

        person.create({name: 'Neil Murray'}, function (err, result) {
          var id = result.results[0]._id

          person.create({name: 'J K Rowling', spouse: id}, function (err, result) {
            var id = result.results[0]._id

            book.create({title: 'Harry Potter 1', author: id}, function (err, result) {
              var bookid = result.results[0]._id
              var books = []
              books.push(bookid)

              book.create({title: 'Harry Potter 2', author: id, booksInSeries: books}, function (err, result) {
                // find a book
                book.find({ title: 'Harry Potter 2' } , { 'compose': true }, function (err, result) {
                  // console.log(JSON.stringify(result, null, 2))

                  var doc = result.results[0]
                  should.exist(doc.author.name)
                  should.exist(doc.author.spouse.name)

                  done()
                })
              })
            })
          })
        })
      })

      it('should populate a reference field containing an array of ObjectIDs', function (done) {
        // find a doc
        mod.find({ fieldName: { '$regex': 'foo' } } , {}, function (err, result) {
          // remove foo_1 from the results so we can add the remaining docs
          // to it as a reference
          var foo1 = _.findWhere(result.results, { fieldName: 'foo_1' })
          result.results.splice(result.results.indexOf(foo1), 1)

          var anotherDoc = _.map(_.pluck(result.results, '_id'), function(id) {
            return id.toString()
          })

          // console.log(result)
          // console.log(anotherDoc)

          // add the id to another doc
          mod.update({ fieldName: 'foo_1' }, { refField: anotherDoc }, function (err, result) {
            // doc1 should now have refField as array of docs
            //console.log(result)
            mod.find({fieldName: 'foo_1'}, { 'compose': true }, function (err, result) {
              var doc = result.results[0]
              doc.refField.length.should.eql(4)

              // composed property
              should.exist(doc.composed)
              should.exist(doc.composed.refField)
              doc.composed.refField.length.should.eql(4)

              done()
            })
          })
        })
      })

      describe('Reference field nested query', function () {
        it('should allow querying nested Reference field properties', function (done) {
          // add a setting & replace "author" with "person" for this test
          bookSchema.author.settings.multiple = false
          var bookSchemaString = JSON.stringify(bookSchema)
          bookSchemaString = bookSchemaString.replace('author','person')

          var book = model('book', JSON.parse(bookSchemaString), null, {database: 'testdb'})
          var person = model('person', personSchema, null, {database: 'testdb'})

          person.create({name: 'Neil Murray'}, function (err, result) {
            var neil = result.results[0]._id

            person.create({name: 'J K Rowling', spouse: neil}, function (err, result) {
              var rowling = result.results[0]._id.toString()

              book.create({title: 'Harry Potter 1', person: rowling}, function (err, result) {
                var bookid = result.results[0]._id
                var books = []
                books.push(bookid)

                book.create({title: 'Neil\'s Autobiography', person: neil}, function (err, result) {
                  // find book where person.name = J K Rowling
                  book.find({ 'person.name': 'J K Rowling' }, { compose: true }, function (err, result) {
                    result.results.length.should.eql(1)
                    var doc = result.results[0]
                    should.exist(doc.person.name)
                    doc.person.name.should.equal('J K Rowling')

                    done()
                  })
                })
              })
            })
          })
        })

        it('should allow querying second level nested Reference field properties', function (done) {
          // add a setting & replace "author" with "person" for this test
          bookSchema.author.settings.multiple = false
          bookSchema.author.settings.compose = true
          bookSchema.settings = {
            compose: true
          }

          var bookSchemaString = JSON.stringify(bookSchema)
          bookSchemaString = bookSchemaString.replace('author','person')

          personSchema.spouse.settings = {
            compose: true
          }

          var book = model('book', JSON.parse(bookSchemaString), null, {database: 'testdb'})
          var person = model('person', personSchema, null, {database: 'testdb'})

          // console.log(JSON.stringify(book, null, 2))
          // console.log(JSON.stringify(person, null, 2))

          person.create({name: 'Neil Murray'}, function (err, result) {
            var neil = result.results[0]._id

            person.create({name: 'J K Rowling', spouse: neil}, function (err, result) {
              var rowling = result.results[0]._id.toString()

              book.create({title: 'Harry Potter 1', person: rowling}, function (err, result) {
                var bookid = result.results[0]._id
                var books = []
                books.push(bookid)

                book.find({ "person.spouse.name": "Neil Murray" }, { compose: true }, function (err, result) {

                  result.results.length.should.eql(1)
                  var doc = result.results[0]
                  should.exist(doc.person.spouse)
                  doc.person.name.should.equal('J K Rowling')

                  done()
                })
              })
            })
          })
        })

        it('should return results when multiple documents match a nested query', function (done) {
          var categoriesSchema = {
            fields: {
              parent: {
                type: "Reference",
                settings: {
                  collection: "categories",
                  compose: true
                },
                required: false
              },
              name: {
                type: "String",
                label: "Name",
                required: false
              },
              furl: {
                type: "String",
                label: "Friendly URL",
                required: false
              }
            },
            settings: {
              compose: true
            }
          }

          var articleSchema = {
            fields: {
              title: {
                type: 'String',
                required: true
              },
              categories: {
                type: 'Reference',
                settings: {
                  collection: "categories",
                  multiple: true
                }
              }
            },
            settings: {
              compose: true
            }
          }

          var category = model('categories', categoriesSchema.fields, null, {database: 'testdb', compose: true})
          category.compose = true

          var article = model('articles', articleSchema.fields, null, {database: 'testdb'})
          article.compose = true

          // parent categories
          category.create({name: 'Sports', furl: 'sports'}, function (err, result) {
            var sports = result.results[0]._id

            category.create({name: 'Music', furl: 'music'}, function (err, result) {
              var music = result.results[0]._id

              // child categories
              category.create({name: 'Music News', furl: 'news', parent: music.toString()}, function (err, result) {
                var musicNews = result.results[0]._id
                category.create({name: 'Sports News', furl: 'news', parent: sports.toString()}, function (err, result) {
                  var sportsNews = result.results[0]._id

                  category.create({name: 'Sports Events', furl: 'events', parent: sports.toString()}, function (err, result) {

                    // add an article
                    article.create({title: 'A Day at the Opera', categories: [musicNews.toString()]}, function (err, result) {

                      // add an article
                      article.create({title: 'A Day at the Races', categories: [sportsNews.toString()]}, function (err, result) {

                        article.find({ "categories.furl": "news", "categories.parent.furl": "sports" }, { compose: true }, function (err, result) {
                          result.results.length.should.eql(1)
                          var doc = result.results[0]

                          doc.categories[0].name.should.equal('Sports News')
                          doc.categories[0].parent.name.should.equal('Sports')
                          done()
                        })
                      })
                    })
                  })
                })
              })
            })
          })
        })

        it('should allow querying nested Reference fields with a different property name', function (done) {
          // add a setting & replace "author" with "person" for this test
          bookSchema.author.settings.multiple = false

          var book = model('book', bookSchema, null, {database: 'testdb'})
          var person = model('person', personSchema, null, {database: 'testdb'})

          person.create({name: 'Neil Murray'}, function (err, result) {
            var neil = result.results[0]._id

            person.create({name: 'J K Rowling', spouse: neil}, function (err, result) {
              var rowling = result.results[0]._id.toString()

              book.create({title: 'Harry Potter 1', author: rowling}, function (err, result) {
                var bookid = result.results[0]._id
                var books = []
                books.push(bookid)

                book.create({title: 'Neil\'s Autobiography', author: neil}, function (err, result) {

                  // find book where author.name = J K Rowling

                  book.find({ 'author.name': 'J K Rowling' }, { compose: true }, function (err, result) {
                    //console.log(JSON.stringify(result, null, 2))

                    result.results.length.should.eql(1)
                    var doc = result.results[0]
                    should.exist(doc.author.name)
                    doc.author.name.should.equal('J K Rowling')

                    done()
                  })
                })
              })
            })
          })
        })

        it('should only return specified fields when querying nested Reference field properties', function (done) {
          bookSchema.author.settings.multiple = false

          // create two models
          var book = model('book', bookSchema, null, {database: 'testdb'})
          var person = model('person', personSchema, null, {database: 'testdb'})

          person.create({name: 'Neil Murray'}, function (err, result) {
            var neil = result.results[0]._id

            person.create({name: 'J K Rowling', spouse: neil}, function (err, result) {
              var rowling = result.results[0]._id.toString()

              book.create({title: 'Harry Potter 1', author: rowling}, function (err, result) {
                var bookid = result.results[0]._id
                var books = []
                books.push(bookid)

                book.create({title: 'Neil\'s Autobiography', author: neil}, function (err, result) {

                  // find book where author.name = J K Rowling

                  book.find({ 'author.name': 'J K Rowling' }, { compose: true, fields: { 'title': 1, 'author': 1 }}, function (err, result) {

                    result.results.length.should.eql(1)
                    var doc = result.results[0]
                    should.exist(doc._id)
                    should.exist(doc.title)
                    should.exist(doc.author.name)
                    should.exist(doc.composed)
                    should.not.exist(doc.history)

                    done()
                  })
                })
              })
            })
          })
        })

        it('should allow querying normal fields and nested Reference field properties', function (done) {
          bookSchema.author.settings.multiple = false

          // create two models
          var book = model('book', bookSchema, null, {database: 'testdb'})
          var person = model('person', personSchema, null, {database: 'testdb'})

          person.create({name: 'Neil Murray'}, function (err, result) {
            var neil = result.results[0]._id

            person.create({name: 'J K Rowling', spouse: neil}, function (err, result) {
              var rowling = result.results[0]._id.toString()

              book.create({title: 'Harry Potter 1', author: rowling}, function (err, result) {

                book.create({title: 'Harry Potter 2', author: rowling}, function (err, result) {

                  book.create({title: 'Neil\'s Autobiography', author: neil}, function (err, result) {

                    // find book where author.name = J K Rowling

                    book.find({ title: 'Harry Potter 1', 'author.name': 'J K Rowling' }, {compose: true}, function (err, result) {

                      result.results.length.should.eql(1)
                      var doc = result.results[0]
                      should.exist(doc.author.name)
                      doc.author.name.should.equal('J K Rowling')
                      done()
                    })
                  })
                })
              })
            })
          })
        })

        it('should only return matching results when querying nested Reference field properties', function (done) {
          bookSchema.author.settings.multiple = false

          // create two models
          var book = model('book', bookSchema, null, {database: 'testdb'})
          var person = model('person', personSchema, null, {database: 'testdb'})
          person.create({name: 'Neil Murray'}, function (err, result) {
            var neil = result.results[0]._id
            person.create({name: 'J K Rowling', spouse: neil}, function (err, result) {
              var rowling = result.results[0]._id.toString()
              book.create({title: 'Harry Potter 1', author: rowling}, function (err, result) {
                book.create({title: 'Harry Potter 2', author: rowling}, function (err, result) {
                  book.create({title: 'Neil\'s Autobiography', author: neil}, function (err, result) {

                    // find book where author.name = J K Rowling
                    book.find({ title: 'Harry Potter 1', 'author.name': 'A B Cowling' }, {compose: true}, function (err, result) {
                      result.results.length.should.eql(0)
                      done()
                    })
                  })
                })
              })
            })
          })
        })
      })
    })
  })
})
