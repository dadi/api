const should = require('should')
const sinon = require('sinon')
const path = require('path')
const request = require('supertest')
const EventEmitter = require('events').EventEmitter
const config = require(path.join(__dirname, '/../../config'))
const help = require(path.join(__dirname, '/help'))
const app = require(path.join(__dirname, '/../../dadi/lib/'))

const client = request(`http://${config.get('server.host')}:${config.get('server.port')}`)
const FAKE_ID = '5c334a60139c7e48eb44a9bb'

let bearerToken

describe('Document versioning', function () {
  this.timeout(4000)

  let cleanupFn

  beforeEach(done => {
    help.dropDatabase('testdb', err => {
      if (err) return done(err)

      const schema1 = {
        fields: {
          name: {
            type: 'String'
          },
          surname: {
            type: 'String'
          },
          occupation: {
            type: 'String'
          },
          object: {
            type: 'Object'
          },
          reference: {
            type: 'Reference',
            settings: {
              collection: 'test-history-disabled'
            }
          }
        }
      }
      const schema2 = Object.assign({}, schema1, {
        settings: {
          enableVersioning: true
        }        
      })

      help.writeTempFile(
        'temp-workspace/collections/vtest/testdb/collection.test-history-enabled.json',
        schema1,
        callback1 => {
          help.writeTempFile(
            'temp-workspace/collections/vtest/testdb/collection.test-history-disabled.json',
            schema2,
            callback2 => {
              cleanupFn = () => {
                callback1()
                callback2()
              }

              app.start(() => {
                help.getBearerTokenWithAccessType('admin', (err, token) => {
                  if (err) return done(err)

                  bearerToken = token

                  done()
                })
              })
            }
          )          
        }
      )
    })
  })

  afterEach(done => {
    app.stop(() => {
      cleanupFn()
      done()
    })
  })

  describe('Versions endpoint', () => {
    it('should return 404 when listing versions for a document that does not exist', done => {
      client
      .get(`/vtest/testdb/test-history-enabled/${FAKE_ID}/versions`)
      .set('Authorization', `Bearer ${bearerToken}`)
      .expect(404, done)
    })

    it('should return an empty result set when the document does not have previous versions', done => {
      const document = {
        name: 'John',
        surname: 'Doe'
      }

      client
      .post('/vtest/testdb/test-history-enabled')
      .set('Authorization', `Bearer ${bearerToken}`)
      .send(document)
      .end((err, res) => {
        if (err) return done(err)

        const id = res.body.results[0]._id

        client
        .get(`/vtest/testdb/test-history-enabled/${id}/versions`)
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          const {results} = res.body

          results.length.should.eql(0)

          done()
        })
      })
    })

    it('should list document versions', done => {
      const document = {
        name: 'John',
        surname: 'Doe'
      }
      const updates = [
        { name: 'Jane' },
        { surname: 'Fonda' }
      ]

      client
      .post('/vtest/testdb/test-history-enabled')
      .set('Authorization', `Bearer ${bearerToken}`)
      .send(document)
      .end((err, res) => {
        if (err) return done(err)

        const id = res.body.results[0]._id

        client
        .put(`/vtest/testdb/test-history-enabled/${id}`)
        .set('Authorization', `Bearer ${bearerToken}`)
        .send(updates[0])
        .end((err, res) => {
          if (err) return done(err)

          client
          .put(`/vtest/testdb/test-history-enabled/${id}`)
          .set('Authorization', `Bearer ${bearerToken}`)
          .send(updates[1])
          .end((err, res) => {
            if (err) return done(err)

            client
            .get(`/vtest/testdb/test-history-enabled/${id}/versions`)
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              const {results} = res.body

              results.length.should.eql(2)
              results[0]._document.should.eql(id)
              results[1]._document.should.eql(id)

              done()
            })
          })
        })
      })
    })

    it('should list document versions and show update description when available', done => {
      const document = {
        name: 'John',
        surname: 'Doe'
      }
      const updates = [
        {
          description: 'Update first name',
          update: { name: 'Jane' }
        },
        {
          description: 'Update surname',
          update: { surname: 'Fonda' }
        }
      ]

      client
      .post('/vtest/testdb/test-history-enabled')
      .set('Authorization', `Bearer ${bearerToken}`)
      .send(document)
      .end((err, res) => {
        if (err) return done(err)

        const id = res.body.results[0]._id

        client
        .put('/vtest/testdb/test-history-enabled')
        .set('Authorization', `Bearer ${bearerToken}`)
        .send(Object.assign({}, updates[0], {
          query: {
            _id: id
          }
        }))
        .end((err, res) => {
          if (err) return done(err)

          client
          .put('/vtest/testdb/test-history-enabled')
          .set('Authorization', `Bearer ${bearerToken}`)
          .send(Object.assign({}, updates[1], {
            query: {
              _id: id
            }
          }))
          .end((err, res) => {
            if (err) return done(err)

            client
            .get(`/vtest/testdb/test-history-enabled/${id}/versions`)
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              const {results} = res.body

              results.length.should.eql(2)
              results[0]._document.should.eql(id)
              results[0]._changeDescription.should.eql(updates[0].description)
              results[1]._document.should.eql(id)
              results[1]._changeDescription.should.eql(updates[1].description)

              done()
            })
          })
        })
      })
    })
  })

  describe('Rollback to previous versions', () => {
    it('should rollback to a previous version where a property was added, changed and removed multiple times', done => {
      const original = {
        name: 'John',
        surname: 'Doe'
      }

      client
      .post('/vtest/testdb/test-history-enabled')
      .set('Authorization', `Bearer ${bearerToken}`)
      .send(original)
      .end((err, res) => {
        if (err) return done(err)

        const id = res.body.results[0]._id
        const updates = [
          {
            endpoint: `/vtest/testdb/test-history-enabled/${id}`,
            body: {
              surname: null
            }
          },
          {
            endpoint: `/vtest/testdb/test-history-enabled/${id}`,
            body: {
              surname: 'One'
            }
          },
          {
            endpoint: `/vtest/testdb/test-history-enabled/${id}`,
            body: {
              surname: null
            }
          },
          {
            endpoint: `/vtest/testdb/test-history-enabled/${id}`,
            body: {
              surname: 'Two'
            }
          },
          {
            endpoint: `/vtest/testdb/test-history-enabled/${id}`,
            body: {
              surname: 'Three'
            }
          },
          {
            endpoint: `/vtest/testdb/test-history-enabled/${id}`,
            body: {
              surname: null
            }
          },
          {
            endpoint: `/vtest/testdb/test-history-enabled/${id}`,
            body: {
              surname: 'Four'
            }
          }
        ]

        help.bulkRequest({
          method: 'put',
          requests: updates,
          token: bearerToken
        }).then(() => {
          client
          .get(`/vtest/testdb/test-history-enabled/${id}/versions`)
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            const {results} = res.body
            const getRequests = results.map(result => `/vtest/testdb/test-history-enabled/${id}?version=${result._id}`)

            help.bulkRequest({
              method: 'get',
              requests: getRequests,
              token: bearerToken
            }).then(responses => {
              responses.length.should.eql(updates.length)
              responses[0].results[0].surname.should.eql('Doe')
              should.not.exist(responses[1].results[0].surname)
              responses[2].results[0].surname.should.eql('One')
              should.not.exist(responses[3].results[0].surname)
              responses[4].results[0].surname.should.eql('Two')
              responses[5].results[0].surname.should.eql('Three')
              should.not.exist(responses[6].results[0].surname)

              done()
            })
          })
        })
      })
    })

    it('should rollback to a previous version and compose Reference fields accordingly', done => {
      const original = {
        name: 'Eduardo',
        surname: 'Bouças'
      }
      const originalReference = {
        name: 'James',
        surname: 'Lambie'
      }
      const modifiedReference = {
        name: 'David',
        surname: 'Longworth'
      }

      client
      .post('/vtest/testdb/test-history-disabled')
      .set('Authorization', `Bearer ${bearerToken}`)
      .send(originalReference)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        const originalReferenceID = res.body.results[0]._id

        client
        .post('/vtest/testdb/test-history-disabled')
        .set('Authorization', `Bearer ${bearerToken}`)
        .send(modifiedReference)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          const modifiedReferenceID = res.body.results[0]._id
          const payload = Object.assign(original, {
            reference: originalReferenceID
          })

          client
          .post('/vtest/testdb/test-history-enabled')
          .set('Authorization', `Bearer ${bearerToken}`)
          .send(payload)
          .end((err, res) => {
            if (err) return done(err)

            const id = res.body.results[0]._id

            client
            .get(`/vtest/testdb/test-history-enabled/${id}?compose=true`)
            .set('Authorization', `Bearer ${bearerToken}`)
            .end((err, res) => {
              if (err) return done(err)

              const {results} = res.body

              results.length.should.eql(1)
              results[0].reference.name.should.eql(originalReference.name)
              results[0].reference.surname.should.eql(originalReference.surname)

              client
              .put(`/vtest/testdb/test-history-enabled/${id}`)
              .set('Authorization', `Bearer ${bearerToken}`)
              .send({
                reference: modifiedReferenceID,
                surname: 'Bouças II'
              })
              .end((err, res) => {
                if (err) return done(err)

                client
                .get(`/vtest/testdb/test-history-enabled/${id}?compose=true`)
                .set('Authorization', `Bearer ${bearerToken}`)
                .end((err, res) => {
                  if (err) return done(err)

                  const {results} = res.body

                  results.length.should.eql(1)
                  results[0].surname.should.eql('Bouças II')
                  results[0].reference.name.should.eql(modifiedReference.name)
                  results[0].reference.surname.should.eql(modifiedReference.surname)

                  client
                  .get(`/vtest/testdb/test-history-enabled/${id}/versions`)
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done(err)

                    const {results} = res.body
                    const versionId = results[0]._id

                    results.length.should.eql(1)

                    client
                    .get(`/vtest/testdb/test-history-enabled/${id}?compose=true&version=${versionId}`)
                    .set('Authorization', `Bearer ${bearerToken}`)
                    .end((err, res) => {
                      if (err) return done(err)

                      const {metadata, results} = res.body

                      metadata.version.should.eql(versionId)
                      results[0].surname.should.eql(original.surname)
                      results[0].reference.name.should.eql(originalReference.name)
                      results[0].reference.surname.should.eql(originalReference.surname)

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

    it('should rollback to a previous version containing Object fields', done => {
      const original = {
        name: 'Eduardo',
        object: {
          parent: {
            child1: true,
            child2: {
              child3: false
            },
            child3: 'The original string'
          }
        }
      }
      const modified = {
        name: 'James',
        object: {
          parent: {
            child1: {
              child2: {
                child3: 83,
                child4: 'Some string'
              }
            },
            child5: {
              child6: false,
              child7: 1337
            },
            child3: 'The modified string'
          },
          parent2: {
            child8: 5000
          }
        }
      }

      client
      .post('/vtest/testdb/test-history-enabled')
      .set('Authorization', `Bearer ${bearerToken}`)
      .send(original)
      .end((err, res) => {
        if (err) return done(err)

        const id = res.body.results[0]._id

        client
        .get(`/vtest/testdb/test-history-enabled/${id}`)
        .set('Authorization', `Bearer ${bearerToken}`)
        .end((err, res) => {
          if (err) return done(err)

          const {results} = res.body

          results.length.should.eql(1)
          results[0].name.should.eql(original.name)
          results[0].object.should.eql(original.object)

          client
          .put(`/vtest/testdb/test-history-enabled/${id}`)
          .set('Authorization', `Bearer ${bearerToken}`)
          .send(modified)
          .end((err, res) => {
            if (err) return done(err)

            client
            .get(`/vtest/testdb/test-history-enabled/${id}`)
            .set('Authorization', `Bearer ${bearerToken}`)
            .end((err, res) => {
              if (err) return done(err)

              const {results} = res.body

              results.length.should.eql(1)
              results[0].name.should.eql(modified.name)
              results[0].object.should.eql(modified.object)

              client
              .get(`/vtest/testdb/test-history-enabled/${id}/versions`)
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)

                const {results} = res.body
                const versionId = results[0]._id

                results.length.should.eql(1)

                client
                .get(`/vtest/testdb/test-history-enabled/${id}?version=${versionId}`)
                .set('Authorization', `Bearer ${bearerToken}`)
                .end((err, res) => {
                  if (err) return done(err)

                  const {metadata, results} = res.body

                  metadata.version.should.eql(versionId)
                  results[0].name.should.eql(original.name)
                  results[0].object.should.eql(original.object)

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
