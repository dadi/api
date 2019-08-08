const should = require('should')
const sinon = require('sinon')
const path = require('path')
const request = require('supertest')
const EventEmitter = require('events').EventEmitter
const config = require(path.join(__dirname, '/../../config'))
const help = require(path.join(__dirname, '/help'))
const app = require(path.join(__dirname, '/../../dadi/lib/'))

const client = request(
  `http://${config.get('server.host')}:${config.get('server.port')}`
)
const FAKE_ID = '5c334a60139c7e48eb44a9bb'

const schema1 = {
  version: 'vtest',
  property: 'testdb',
  name: 'test-history-enabled',
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
  },
  settings: {}
}
const schema2 = Object.assign({}, schema1, {
  version: 'vtest',
  property: 'testdb',
  name: 'test-history-disabled',
  settings: {
    enableVersioning: false
  }
})

const MOCK_CLIENT = {
  clientId: 'apiClient',
  secret: 'someSecret',
  accessType: 'admin'
}
const MOCK_TIME = 123456789
const dateNow = Date.now

let bearerToken

describe('Document versioning', function() {
  this.timeout(4000)

  before(() => {
    Date.now = () => MOCK_TIME
  })

  beforeEach(done => {
    help.dropDatabase('testdb', err => {
      app.start(() => {
        help.createSchemas([schema1, schema2]).then(() => {
          help.createACLClient(MOCK_CLIENT).then(() => {
            client
              .post(config.get('auth.tokenUrl'))
              .set('content-type', 'application/json')
              .send(MOCK_CLIENT)
              .end((err, res) => {
                if (err) return done(err)

                bearerToken = res.body.accessToken

                done()
              })
          })
        })
      })
    })
  })

  after(() => {
    Date.now = dateNow
  })

  afterEach(done => {
    help.dropSchemas().then(() => {
      help.removeACLData(() => {
        app.stop(() => {
          done()
        })
      })
    })
  })

  describe('Versions endpoint', () => {
    it('should return 404 when listing versions for a document that does not exist', done => {
      client
        .get(`/testdb/test-history-enabled/${FAKE_ID}/versions`)
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(404, done)
    })

    it('should return an empty result set when the document does not have previous versions', done => {
      const document = {
        name: 'John',
        surname: 'Doe'
      }

      client
        .post('/testdb/test-history-enabled')
        .set('Authorization', `Bearer ${bearerToken}`)
        .send(document)
        .end((err, res) => {
          if (err) return done(err)

          const id = res.body.results[0]._id

          client
            .get(`/testdb/test-history-enabled/${id}/versions`)
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
      const updates = [{name: 'Jane'}, {surname: 'Fonda'}]

      client
        .post('/testdb/test-history-enabled')
        .set('Authorization', `Bearer ${bearerToken}`)
        .send(document)
        .end((err, res) => {
          if (err) return done(err)

          const id = res.body.results[0]._id

          client
            .put(`/testdb/test-history-enabled/${id}`)
            .set('Authorization', `Bearer ${bearerToken}`)
            .send(updates[0])
            .end((err, res) => {
              if (err) return done(err)

              client
                .put(`/testdb/test-history-enabled/${id}`)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send(updates[1])
                .end((err, res) => {
                  if (err) return done(err)

                  setTimeout(() => {
                    client
                      .get(`/testdb/test-history-enabled/${id}/versions`)
                      .set('Authorization', `Bearer ${bearerToken}`)
                      .expect(200)
                      .end((err, res) => {
                        if (err) return done(err)

                        const {results} = res.body

                        results.length.should.eql(2)

                        results[0]._author.should.eql(MOCK_CLIENT.clientId)
                        results[0]._date.should.eql(MOCK_TIME)

                        results[1]._author.should.eql(MOCK_CLIENT.clientId)
                        results[1]._date.should.eql(MOCK_TIME)

                        done()
                      })
                  }, 50)
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
          update: {name: 'Jane'}
        },
        {
          description: 'Update surname',
          update: {surname: 'Fonda'}
        }
      ]

      client
        .post('/testdb/test-history-enabled')
        .set('Authorization', `Bearer ${bearerToken}`)
        .send(document)
        .end((err, res) => {
          if (err) return done(err)

          const id = res.body.results[0]._id

          client
            .put('/testdb/test-history-enabled')
            .set('Authorization', `Bearer ${bearerToken}`)
            .send(
              Object.assign({}, updates[0], {
                query: {
                  _id: id
                }
              })
            )
            .end((err, res) => {
              if (err) return done(err)

              client
                .put('/testdb/test-history-enabled')
                .set('Authorization', `Bearer ${bearerToken}`)
                .send(
                  Object.assign({}, updates[1], {
                    query: {
                      _id: id
                    }
                  })
                )
                .end((err, res) => {
                  if (err) return done(err)

                  setTimeout(() => {
                    client
                      .get(`/testdb/test-history-enabled/${id}/versions`)
                      .set('Authorization', `Bearer ${bearerToken}`)
                      .expect(200)
                      .end((err, res) => {
                        if (err) return done(err)

                        const {results} = res.body

                        results.length.should.eql(2)
                        results[0]._author.should.eql(MOCK_CLIENT.clientId)
                        results[0]._date.should.eql(MOCK_TIME)
                        results[0].description.should.eql(
                          updates[0].description
                        )

                        results[1]._author.should.eql(MOCK_CLIENT.clientId)
                        results[1]._date.should.eql(MOCK_TIME)
                        results[1].description.should.eql(
                          updates[1].description
                        )

                        done()
                      })
                  }, 200)
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
        .post('/testdb/test-history-enabled')
        .set('Authorization', `Bearer ${bearerToken}`)
        .send(original)
        .end((err, res) => {
          if (err) return done(err)

          const id = res.body.results[0]._id
          const updates = [
            {
              endpoint: `/testdb/test-history-enabled/${id}`,
              body: {
                surname: null
              }
            },
            {
              endpoint: `/testdb/test-history-enabled/${id}`,
              body: {
                surname: 'One'
              }
            },
            {
              endpoint: `/testdb/test-history-enabled/${id}`,
              body: {
                surname: null
              }
            },
            {
              endpoint: `/testdb/test-history-enabled/${id}`,
              body: {
                surname: 'Two'
              }
            },
            {
              endpoint: `/testdb/test-history-enabled/${id}`,
              body: {
                surname: 'Three'
              }
            },
            {
              endpoint: `/testdb/test-history-enabled/${id}`,
              body: {
                surname: null
              }
            },
            {
              endpoint: `/testdb/test-history-enabled/${id}`,
              body: {
                surname: 'Four'
              }
            }
          ]

          help
            .bulkRequest({
              method: 'put',
              requests: updates,
              token: bearerToken
            })
            .then(() => {
              setTimeout(() => {
                client
                  .get(`/testdb/test-history-enabled/${id}/versions`)
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .expect(200)
                  .end((err, res) => {
                    if (err) return done(err)

                    const {results} = res.body
                    const getRequests = results.map(
                      result =>
                        `/testdb/test-history-enabled/${id}?version=${result._id}`
                    )

                    help
                      .bulkRequest({
                        method: 'get',
                        requests: getRequests,
                        token: bearerToken
                      })
                      .then(responses => {
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
              }, 500)
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
        .post('/testdb/test-history-disabled')
        .set('Authorization', `Bearer ${bearerToken}`)
        .send(originalReference)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          const originalReferenceID = res.body.results[0]._id

          client
            .post('/testdb/test-history-disabled')
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
                .post('/testdb/test-history-enabled')
                .set('Authorization', `Bearer ${bearerToken}`)
                .send(payload)
                .end((err, res) => {
                  if (err) return done(err)

                  const id = res.body.results[0]._id

                  client
                    .get(`/testdb/test-history-enabled/${id}?compose=true`)
                    .set('Authorization', `Bearer ${bearerToken}`)
                    .end((err, res) => {
                      if (err) return done(err)

                      const {results} = res.body

                      results.length.should.eql(1)
                      results[0].reference.name.should.eql(
                        originalReference.name
                      )
                      results[0].reference.surname.should.eql(
                        originalReference.surname
                      )

                      client
                        .put(`/testdb/test-history-enabled/${id}`)
                        .set('Authorization', `Bearer ${bearerToken}`)
                        .send({
                          reference: modifiedReferenceID,
                          surname: 'Bouças II'
                        })
                        .end((err, res) => {
                          if (err) return done(err)

                          client
                            .get(
                              `/testdb/test-history-enabled/${id}?compose=true`
                            )
                            .set('Authorization', `Bearer ${bearerToken}`)
                            .end((err, res) => {
                              if (err) return done(err)

                              const {results} = res.body

                              results.length.should.eql(1)
                              results[0].surname.should.eql('Bouças II')
                              results[0].reference.name.should.eql(
                                modifiedReference.name
                              )
                              results[0].reference.surname.should.eql(
                                modifiedReference.surname
                              )

                              setTimeout(() => {
                                client
                                  .get(
                                    `/testdb/test-history-enabled/${id}/versions`
                                  )
                                  .set('Authorization', `Bearer ${bearerToken}`)
                                  .expect(200)
                                  .end((err, res) => {
                                    if (err) return done(err)

                                    const {results} = res.body
                                    const versionId = results[0]._id

                                    results.length.should.eql(1)

                                    client
                                      .get(
                                        `/testdb/test-history-enabled/${id}?compose=true&version=${versionId}`
                                      )
                                      .set(
                                        'Authorization',
                                        `Bearer ${bearerToken}`
                                      )
                                      .end((err, res) => {
                                        if (err) return done(err)

                                        const {metadata, results} = res.body

                                        metadata.version.should.eql(versionId)
                                        results[0].surname.should.eql(
                                          original.surname
                                        )
                                        results[0].reference.name.should.eql(
                                          originalReference.name
                                        )
                                        results[0].reference.surname.should.eql(
                                          originalReference.surname
                                        )

                                        done()
                                      })
                                  })
                              }, 50)
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
        .post('/testdb/test-history-enabled')
        .set('Authorization', `Bearer ${bearerToken}`)
        .send(original)
        .end((err, res) => {
          if (err) return done(err)

          const id = res.body.results[0]._id

          client
            .get(`/testdb/test-history-enabled/${id}`)
            .set('Authorization', `Bearer ${bearerToken}`)
            .end((err, res) => {
              if (err) return done(err)

              const {results} = res.body

              results.length.should.eql(1)
              results[0].name.should.eql(original.name)
              results[0].object.should.eql(original.object)

              client
                .put(`/testdb/test-history-enabled/${id}`)
                .set('Authorization', `Bearer ${bearerToken}`)
                .send(modified)
                .end((err, res) => {
                  if (err) return done(err)

                  client
                    .get(`/testdb/test-history-enabled/${id}`)
                    .set('Authorization', `Bearer ${bearerToken}`)
                    .end((err, res) => {
                      if (err) return done(err)

                      const {results} = res.body

                      results.length.should.eql(1)
                      results[0].name.should.eql(modified.name)
                      results[0].object.should.eql(modified.object)

                      setTimeout(() => {
                        client
                          .get(`/testdb/test-history-enabled/${id}/versions`)
                          .set('Authorization', `Bearer ${bearerToken}`)
                          .expect(200)
                          .end((err, res) => {
                            if (err) return done(err)

                            const {results} = res.body
                            const versionId = results[0]._id

                            results.length.should.eql(1)

                            client
                              .get(
                                `/testdb/test-history-enabled/${id}?version=${versionId}`
                              )
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
                      }, 59)
                    })
                })
            })
        })
    })
  })
})
