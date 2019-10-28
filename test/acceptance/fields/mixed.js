const app = require('../../../dadi/lib/')
const config = require('../../../config')
const help = require('../help')
const request = require('supertest')

const connectionString =
  'http://' + config.get('server.host') + ':' + config.get('server.port')

let bearerToken

describe('Mixed Field', () => {
  beforeEach(done => {
    help.dropDatabase('library', 'misc', err => {
      app.start(() => {
        help
          .createSchemas([
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
            }
          ])
          .then(() => {
            help.getBearerToken(function(err, token) {
              bearerToken = token

              done(err)
            })
          })
      })
    })
  })

  afterEach(done => {
    help.dropSchemas().then(() => {
      app.stop(done)
    })
  })

  describe('String values', () => {
    it('should create and retrieve', done => {
      const client = request(connectionString)
      const value = 'DADI #ftw'

      client
        .post('/library/misc')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send({mixed: value})
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          res.body.results[0].mixed.should.eql(value)

          client
            .get(`/library/misc/${res.body.results[0]._id}`)
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end((err, res) => {
              res.body.results[0].mixed.should.eql(value)

              done()
            })
        })
    })

    it('should update', done => {
      const client = request(connectionString)
      const value = 'DADI #ftw'
      const newValue = 'DADI #superftw'

      client
        .post('/library/misc')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send({mixed: value})
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          const id = res.body.results[0]._id

          res.body.results[0].mixed.should.eql(value)

          client
            .put(`/library/misc/${id}`)
            .send({mixed: newValue})
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end((err, res) => {
              client
                .get(`/library/misc/${id}`)
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .end((err, res) => {
                  res.body.results[0].mixed.should.eql(newValue)

                  done()
                })
            })
        })
    })

    it('should delete', done => {
      const client = request(connectionString)
      const value = 'DADI #ftw'

      client
        .post('/library/misc')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send({mixed: value})
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          const id = res.body.results[0]._id

          res.body.results[0].mixed.should.eql(value)

          client
            .delete(`/library/misc/${id}`)
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end((err, res) => {
              client
                .get(`/library/misc/${id}`)
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(404)
                .end(done)
            })
        })
    })
  })

  describe('Number values', () => {
    it('should create and retrieve', done => {
      const client = request(connectionString)
      const value = 1337

      client
        .post('/library/misc')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send({mixed: value})
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          res.body.results[0].mixed.should.eql(value)

          client
            .get(`/library/misc/${res.body.results[0]._id}`)
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end((err, res) => {
              res.body.results[0].mixed.should.eql(value)

              done()
            })
        })
    })

    it('should update', done => {
      const client = request(connectionString)
      const value = 1337
      const newValue = 'DADI #superftw'

      client
        .post('/library/misc')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send({mixed: value})
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          const id = res.body.results[0]._id

          res.body.results[0].mixed.should.eql(value)

          client
            .put(`/library/misc/${id}`)
            .send({mixed: newValue})
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end((err, res) => {
              client
                .get(`/library/misc/${id}`)
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .end((err, res) => {
                  res.body.results[0].mixed.should.eql(newValue)

                  done()
                })
            })
        })
    })

    it('should delete', done => {
      const client = request(connectionString)
      const value = 1337

      client
        .post('/library/misc')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send({mixed: value})
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          const id = res.body.results[0]._id

          res.body.results[0].mixed.should.eql(value)

          client
            .delete(`/library/misc/${id}`)
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end((err, res) => {
              client
                .get(`/library/misc/${id}`)
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(404)
                .end(done)
            })
        })
    })
  })

  describe('Object values', () => {
    it('should create and retrieve', done => {
      const client = request(connectionString)
      const value = {
        name: 'GrandDADI',
        child: {
          name: 'DADI',
          child: {
            name: 'Grandson'
          }
        }
      }

      client
        .post('/library/misc')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send({mixed: value})
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          res.body.results[0].mixed.should.eql(value)

          client
            .get(`/library/misc/${res.body.results[0]._id}`)
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end((err, res) => {
              res.body.results[0].mixed.should.eql(value)

              done()
            })
        })
    })

    it('should retrieve by nested keys', done => {
      const client = request(connectionString)
      const value = {
        name: 'GrandDADI',
        child: {
          name: 'DADI',
          child: {
            name: 'Grandson'
          }
        }
      }

      client
        .post('/library/misc')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send({mixed: value})
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          res.body.results[0].mixed.should.eql(value)

          client
            .get(
              `/library/misc?filter={"mixed.child.name":"${value.child.name}"}`
            )
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end((err, res) => {
              res.body.results[0].mixed.should.eql(value)

              done()
            })
        })
    })

    it('should update by id', done => {
      const client = request(connectionString)
      const value = {
        name: 'GrandDADI',
        child: {
          name: 'DADI',
          child: {
            name: 'Grandson'
          }
        }
      }
      const newValue = {
        name: 'GrandDADI',
        child: {
          name: 'DADI'
        }
      }

      client
        .post('/library/misc')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send({mixed: value})
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          const id = res.body.results[0]._id

          res.body.results[0].mixed.should.eql(value)

          client
            .put(`/library/misc/${id}`)
            .send({mixed: newValue})
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end((err, res) => {
              client
                .get(`/library/misc/${id}`)
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .end((err, res) => {
                  res.body.results[0].mixed.should.eql(newValue)

                  done()
                })
            })
        })
    })

    it('should update by query for nested key', done => {
      const client = request(connectionString)
      const value = {
        name: 'GrandDADI',
        child: {
          name: 'DADI',
          child: {
            name: 'Grandson'
          }
        }
      }
      const newValue = {
        name: 'GrandDADI',
        child: {
          name: 'DADI'
        }
      }

      client
        .post('/library/misc')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send({mixed: value})
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          const id = res.body.results[0]._id

          res.body.results[0].mixed.should.eql(value)

          client
            .put(`/library/misc`)
            .send({
              query: {
                'mixed.child.name': value.child.name
              },
              update: {
                mixed: newValue
              }
            })
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end((err, res) => {
              client
                .get(`/library/misc/${id}`)
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(200)
                .end((err, res) => {
                  res.body.results[0].mixed.should.eql(newValue)

                  done()
                })
            })
        })
    })

    it('should delete', done => {
      const client = request(connectionString)
      const value = {
        name: 'GrandDADI',
        child: {
          name: 'DADI',
          child: {
            name: 'Grandson'
          }
        }
      }

      client
        .post('/library/misc')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send({mixed: value})
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          const id = res.body.results[0]._id

          res.body.results[0].mixed.should.eql(value)

          client
            .delete(`/library/misc/${id}`)
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .end((err, res) => {
              client
                .get(`/library/misc/${id}`)
                .set('Authorization', 'Bearer ' + bearerToken)
                .expect(404)
                .end(done)
            })
        })
    })
  })
})
