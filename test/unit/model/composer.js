const should = require('should')
const model = require(__dirname + '/../../../dadi/lib/model')
const help = require(__dirname + '/../help')
const acceptanceHelper = require(__dirname + '/../../acceptance/help')

describe('Model composer', function() {
  // some defaults
  const bookSchema = {
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
  }
  const personSchema = {
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
  }
  const refField = {
    refField: {
      type: 'Reference',
      settings: {
        // "database": "library2", // leave out to default to the same
        // "collection": "authors", // leave out to default to the same
        // "fields": ["firstName", "lastName"]
      }
    }
  }
  const nameFields = {
    firstName: {
      type: 'String',
      required: false
    },
    lastName: {
      type: 'String',
      required: false
    }
  }
  const schema = Object.assign(help.getModelSchema(), refField, nameFields)
  let mod

  beforeEach(done => {
    let insertedDocuments = 0

    mod = model({name: 'testModelName', schema, property: 'testdb'})

    help.whenModelsConnect([mod]).then(() => {
      acceptanceHelper.dropDatabase('testdb', null, err => {
        // create some docs
        for (let i = 0; i <= 4; i++) {
          mod
            .create({
              documents: {
                fieldName: 'foo_' + i,
                firstName: 'Foo',
                lastName: i.toString()
              }
            })
            .then(response => {
              if (++insertedDocuments === 5) {
                model.unloadAll()

                return done()
              }
            })
            .catch(done)
        }
      })
    })
  })

  it('should populate a reference field containing an ObjectID', () => {
    return help
      .whenModelsConnect([mod])
      .then(() => {
        return mod.get({
          query: {fieldName: 'foo_3'}
        })
      })
      .then(({metadata, results}) => {
        const anotherDoc = results[0]

        return mod.update({
          query: {fieldName: 'foo_1'},
          update: {
            refField: anotherDoc._id.toString()
          }
        })
      })
      .then(({updatedCount}) => {
        return mod.get({
          options: {compose: true},
          query: {fieldName: 'foo_1'}
        })
      })
      .then(({metadata, results}) => {
        const doc = results[0]

        should.exist(doc.refField.fieldName)
        doc.refField.fieldName.should.equal('foo_3')

        // composed property
        should.exist(doc._composed)
        should.exist(doc._composed.refField)

        doc._composed.refField
          .toString()
          .should.eql(doc.refField._id.toString())
      })
  })

  it('should populate a reference field with specified fields only', () => {
    schema.refField.settings['fields'] = ['firstName', 'lastName']

    return help
      .whenModelsConnect([mod])
      .then(() => {
        return mod.find({
          query: {fieldName: 'foo_3'}
        })
      })
      .then(({metadata, results}) => {
        const anotherDoc = results[0]

        return mod.update({
          query: {fieldName: 'foo_1'},
          update: {refField: anotherDoc._id}
        })
      })
      .then(response => {
        return mod.get({
          options: {compose: true},
          query: {fieldName: 'foo_1'}
        })
      })
      .then(({metadata, results}) => {
        const doc = results[0]

        should.not.exist(doc.refField.fieldName)
        should.exist(doc.refField.firstName)
        should.exist(doc.refField.lastName)
        doc.refField.firstName.should.equal('Foo')
        doc.refField.lastName.should.equal('3')

        // composed property
        should.exist(doc._composed)
        should.exist(doc._composed.refField)
        doc._composed.refField
          .toString()
          .should.eql(doc.refField._id.toString())
      })
  })

  it('should reference a document in the specified collection', () => {
    // create two models
    const book = model({name: 'book', schema: bookSchema, property: 'testdb'})
    const person = model({
      name: 'person',
      schema: personSchema,
      property: 'testdb'
    })

    return help
      .whenModelsConnect([book, person])
      .then(() => {
        return person.create({
          documents: {name: 'Neil Murray'}
        })
      })
      .then(({results}) => {
        return person
          .create({
            documents: {name: 'J K Rowling', spouse: results[0]._id}
          })
          .then(({results}) => {
            const authorId = results[0]._id

            return book
              .create({
                documents: {title: 'Harry Potter 1', author: authorId}
              })
              .then(({results}) => {
                const bookId = results[0]._id
                const books = [bookId]

                return book.create({
                  documents: {
                    title: 'Harry Potter 2',
                    author: authorId,
                    booksInSeries: books
                  }
                })
              })
          })
      })
      .then(({results}) => {
        return book.get({
          documents: {title: 'Harry Potter 2'},
          options: {compose: true}
        })
      })
      .then(({results}) => {
        const doc = results[0]

        should.exist(doc.author.name)
        doc.author.name.should.equal('J K Rowling')
      })
  })

  it('should allow specifying to not resolve the references via the model settings', () => {
    // create two models
    const book = model({
      name: 'book',
      schema: bookSchema,
      property: 'testdb',
      settings: {
        compose: false
      }
    })
    const person = model({
      name: 'person',
      schema: personSchema,
      property: 'testdb',
      settings: {
        compose: false
      }
    })

    return help
      .whenModelsConnect([book, person])
      .then(() => {
        return person.create({
          documents: {name: 'Neil Murray'}
        })
      })
      .then(({results}) => {
        return person.create({
          documents: {name: 'J K Rowling', spouse: results[0]._id}
        })
      })
      .then(({results}) => {
        const authorId = results[0]._id

        return book
          .create({
            documents: {title: 'Harry Potter 1', author: authorId}
          })
          .then(({results}) => {
            const bookId = results[0]._id
            const books = [bookId]

            return book.create({
              documents: {
                title: 'Harry Potter 2',
                author: authorId,
                booksInSeries: books
              }
            })
          })
          .then(({results}) => {
            return book.get({
              options: {compose: true},
              query: {title: 'Harry Potter 2'}
            })
          })
          .then(({results}) => {
            const doc = results[0]

            should.exist(doc.author.name)
            should.not.exist(doc.author.spouse.name)
          })
      })
  })

  it('should allow specifying to resolve the references via the model settings', () => {
    // create two models
    const book = model({
      name: 'book',
      schema: bookSchema,
      property: 'testdb',
      settings: {
        compose: true
      }
    })
    const person = model({
      name: 'person',
      schema: personSchema,
      property: 'testdb',
      settings: {
        compose: true
      }
    })

    return person
      .create({
        documents: {name: 'Neil Murray'}
      })
      .then(({results}) => {
        return person.create({
          documents: {name: 'J K Rowling', spouse: results[0]._id}
        })
      })
      .then(({results}) => {
        const authorId = results[0]._id

        return book
          .create({
            documents: {title: 'Harry Potter 1', author: authorId}
          })
          .then(({results}) => {
            const bookId = results[0]._id
            const books = [bookId]

            return book.create({
              documents: {
                title: 'Harry Potter 2',
                author: authorId,
                booksInSeries: books
              }
            })
          })
      })
      .then(({results}) => {
        return book.get({
          options: {compose: true},
          query: {title: 'Harry Potter 2'}
        })
      })
      .then(({results}) => {
        const doc = results[0]

        should.exist(doc.author.name)
        should.exist(doc.author.spouse.name)
      })
  })

  it('should populate a reference field containing an array of ObjectIDs', () => {
    return mod
      .get({
        query: {fieldName: {$regex: 'foo'}}
      })
      .then(({results}) => {
        const firstDoc = results[0]
        const remainingDocs = results.slice(1)

        return mod
          .update({
            query: {_id: firstDoc._id.toString()},
            update: {refField: remainingDocs.map(doc => doc._id.toString())}
          })
          .then(() => {
            return mod.get({
              options: {compose: true},
              query: {_id: firstDoc._id.toString()}
            })
          })
          .then(({results}) => {
            const doc = results[0]

            doc.refField.length.should.eql(4)
            doc.refField[0].lastName.should.eql(remainingDocs[0].lastName)
            doc.refField[1].lastName.should.eql(remainingDocs[1].lastName)
            doc.refField[2].lastName.should.eql(remainingDocs[2].lastName)
            doc.refField[3].lastName.should.eql(remainingDocs[3].lastName)

            // composed property
            should.exist(doc._composed.refField)
            doc._composed.refField.length.should.eql(4)
          })
      })
  })

  describe('Reference field nested query', () => {
    it('should allow querying nested Reference field properties', () => {
      let bookSchemaString = JSON.stringify(bookSchema)

      bookSchemaString = bookSchemaString.replace('author', 'person')

      const book = model({
        name: 'book',
        schema: JSON.parse(bookSchemaString),
        property: 'testdb'
      })
      const person = model({
        name: 'person',
        schema: personSchema,
        property: 'testdb'
      })

      let neil
      let rowling

      return help
        .whenModelsConnect([book, person])
        .then(() => {
          return person.create({
            documents: {name: 'Neil Murray'}
          })
        })
        .then(({results}) => {
          neil = results[0]._id

          return person.create({
            documents: {name: 'J K Rowling', spouse: neil}
          })
        })
        .then(({results}) => {
          rowling = results[0]._id

          return book.create({
            documents: {
              title: 'Harry Potter 1',
              person: rowling
            }
          })
        })
        .then(({results}) => {
          return book.create({
            documents: {
              title: "Neil's Autobiography",
              person: neil
            }
          })
        })
        .then(({results}) => {
          return book.get({
            options: {
              compose: true
            },
            query: {
              'person.name': 'J K Rowling'
            }
          })
        })
        .then(({results}) => {
          results.length.should.eql(1)

          const doc = results[0]

          should.exist(doc.person.name)
          doc.person.name.should.equal('J K Rowling')
        })
    })

    it('should allow querying second level nested Reference field properties', () => {
      let bookSchemaString = JSON.stringify(bookSchema)

      bookSchemaString = bookSchemaString.replace('author', 'person')

      const book = model({
        name: 'book',
        schema: JSON.parse(bookSchemaString),
        property: 'testdb'
      })
      const person = model({
        name: 'person',
        schema: personSchema,
        property: 'testdb'
      })

      return help
        .whenModelsConnect([book, person])
        .then(() => {
          return person.create({
            documents: {name: 'Neil Murray'}
          })
        })
        .then(({results}) => {
          return person.create({
            documents: {name: 'J K Rowling', spouse: results[0]._id}
          })
        })
        .then(({results}) => {
          return book.create({
            documents: {title: 'Harry Potter 1', person: results[0]._id}
          })
        })
        .then(({results}) => {
          return book.get({
            options: {compose: true},
            query: {
              'person.spouse.name': 'Neil Murray'
            }
          })
        })
        .then(({results}) => {
          results.length.should.eql(1)

          const doc = results[0]

          should.exist(doc.person.spouse)
          doc.person.name.should.equal('J K Rowling')
        })
    })

    it('should return results when multiple documents match a nested query', () => {
      const categoriesSchema = {
        fields: {
          parent: {
            type: 'Reference',
            settings: {
              collection: 'categories',
              compose: true
            },
            required: false
          },
          name: {
            type: 'String',
            label: 'Name',
            required: false
          },
          furl: {
            type: 'String',
            label: 'Friendly URL',
            required: false
          }
        },
        settings: {
          compose: true
        }
      }

      const articleSchema = {
        fields: {
          title: {
            type: 'String',
            required: true
          },
          categories: {
            type: 'Reference',
            settings: {
              collection: 'categories',
              multiple: true
            }
          }
        },
        settings: {
          compose: true
        }
      }

      const category = model({
        name: 'categories',
        schema: categoriesSchema.fields,
        property: 'testdb',
        settings: {
          compose: true
        }
      })
      const article = model({
        name: 'person',
        schema: articleSchema.fields,
        property: 'testdb',
        settings: {
          compose: true
        }
      })

      const ids = {}

      return help
        .whenModelsConnect([category, article])
        .then(() => {
          return category.create({
            documents: {
              name: 'Sports',
              furl: 'sports'
            }
          })
        })
        .then(({results}) => {
          ids.sports = results[0]._id.toString()

          return category.create({
            documents: {
              name: 'Music',
              furl: 'music'
            }
          })
        })
        .then(({results}) => {
          ids.music = results[0]._id.toString()

          return category.create({
            documents: {
              name: 'Music News',
              furl: 'news',
              parent: ids.music
            }
          })
        })
        .then(({results}) => {
          ids.musicNews = results[0]._id.toString()

          return category.create({
            documents: {
              name: 'Sports News',
              furl: 'news',
              parent: ids.sports
            }
          })
        })
        .then(({results}) => {
          ids.sportsNews = results[0]._id.toString()

          return article.create({
            documents: {
              title: 'A Day at the Opera',
              categories: [ids.musicNews]
            }
          })
        })
        .then(({results}) => {
          return article.create({
            documents: {
              title: 'A Day at the Races',
              categories: [ids.sportsNews]
            }
          })
        })
        .then(({results}) => {
          return article.get({
            options: {compose: 'all'},
            query: {
              'categories.furl': 'news',
              'categories.parent.furl': 'sports'
            }
          })
        })
        .then(({results}) => {
          results.length.should.eql(1)

          const doc = results[0]

          doc.categories[0].name.should.equal('Sports News')
          doc.categories[0].parent.name.should.equal('Sports')
        })
    })

    it('should allow querying nested Reference fields with a different property name', () => {
      const book = model({
        name: 'book',
        schema: bookSchema,
        property: 'testdb'
      })
      const person = model({
        name: 'person',
        schema: personSchema,
        property: 'testdb'
      })

      let neil
      let rowling

      return help
        .whenModelsConnect([book, person])
        .then(() => {
          return person.create({
            documents: {name: 'Neil Murray'}
          })
        })
        .then(({results}) => {
          neil = results[0]._id

          return person.create({
            documents: {name: 'J K Rowling', spouse: neil}
          })
        })
        .then(({results}) => {
          rowling = results[0]._id

          return book.create({
            documents: {
              title: 'Harry Potter 1',
              author: rowling
            }
          })
        })
        .then(({results}) => {
          return book.create({
            documents: {
              title: "Neil's Autobiography",
              author: neil
            }
          })
        })
        .then(({results}) => {
          return book.get({
            options: {
              compose: true
            },
            query: {
              'author.name': 'J K Rowling'
            }
          })
        })
        .then(({results}) => {
          results.length.should.eql(1)

          const doc = results[0]

          should.exist(doc.author.name)
          doc.author.name.should.equal('J K Rowling')
        })
    })

    it('should only return specified fields when querying nested Reference field properties', () => {
      const book = model({
        name: 'book',
        schema: bookSchema,
        property: 'testdb'
      })
      const person = model({
        name: 'person',
        schema: personSchema,
        property: 'testdb'
      })

      let neil
      let rowling

      return help
        .whenModelsConnect([book, person])
        .then(() => {
          return person.create({
            documents: {name: 'Neil Murray'}
          })
        })
        .then(({results}) => {
          neil = results[0]._id

          return person.create({
            documents: {name: 'J K Rowling', spouse: neil}
          })
        })
        .then(({results}) => {
          rowling = results[0]._id

          return book.create({
            documents: {
              title: 'Harry Potter 1',
              author: rowling
            }
          })
        })
        .then(({results}) => {
          return book.create({
            documents: {
              title: "Neil's Autobiography",
              author: neil
            }
          })
        })
        .then(({results}) => {
          return book.get({
            options: {
              compose: true,
              fields: {
                author: 1
              }
            },
            query: {
              'author.name': 'J K Rowling'
            }
          })
        })
        .then(({results}) => {
          results.length.should.eql(1)

          const doc = results[0]

          should.exist(doc._id)
          should.not.exist(doc.title)
          should.exist(doc.author.name)
          should.exist(doc._composed)
          should.not.exist(doc._history)
        })
    })

    it('should allow querying normal fields and nested Reference field properties', () => {
      const book = model({
        name: 'book',
        schema: bookSchema,
        property: 'testdb'
      })
      const person = model({
        name: 'person',
        schema: personSchema,
        property: 'testdb'
      })

      let neil
      let rowling

      return help
        .whenModelsConnect([book, person])
        .then(() => {
          return person.create({
            documents: {name: 'Neil Murray'}
          })
        })
        .then(({results}) => {
          neil = results[0]._id

          return person.create({
            documents: {name: 'J K Rowling', spouse: neil}
          })
        })
        .then(({results}) => {
          rowling = results[0]._id

          return book.create({
            documents: {
              title: 'Harry Potter 1',
              author: rowling
            }
          })
        })
        .then(({results}) => {
          return book.create({
            documents: {
              title: 'Harry Potter 2',
              author: rowling
            }
          })
        })
        .then(({results}) => {
          return book.create({
            documents: {
              title: "Neil's Autobiography",
              author: neil
            }
          })
        })
        .then(({results}) => {
          return book.get({
            options: {
              compose: true
            },
            query: {
              title: 'Harry Potter 1',
              'author.name': 'J K Rowling'
            }
          })
        })
        .then(({results}) => {
          results.length.should.eql(1)

          const doc = results[0]

          should.exist(doc.author.name)
          doc.author.name.should.equal('J K Rowling')
        })
    })

    it('should only return matching results when querying nested Reference field properties', () => {
      const book = model({
        name: 'book',
        schema: bookSchema,
        property: 'testdb'
      })
      const person = model({
        name: 'person',
        schema: personSchema,
        property: 'testdb'
      })

      let neil
      let rowling

      return help
        .whenModelsConnect([book, person])
        .then(() => {
          return person.create({
            documents: {name: 'Neil Murray'}
          })
        })
        .then(({results}) => {
          neil = results[0]._id

          return person.create({
            documents: {name: 'J K Rowling', spouse: neil}
          })
        })
        .then(({results}) => {
          rowling = results[0]._id

          return book.create({
            documents: {
              title: 'Harry Potter 1',
              author: rowling
            }
          })
        })
        .then(({results}) => {
          return book.create({
            documents: {
              title: 'Harry Potter 2',
              author: rowling
            }
          })
        })
        .then(({results}) => {
          return book.create({
            documents: {
              title: "Neil's Autobiography",
              author: neil
            }
          })
        })
        .then(({results}) => {
          return book.get({
            options: {
              compose: true
            },
            query: {
              title: 'Harry Potter 1',
              'author.name': 'A B Cowling'
            }
          })
        })
        .then(({results}) => {
          results.length.should.eql(0)
        })
    })
  })
})
