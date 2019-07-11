const app = require('../../../dadi/lib/')
const config = require('../../../config')
const help = require('../help')
const modelStore = require('../../../dadi/lib/model/')
const request = require('supertest')
const should = require('should')

let bearerToken
const client = request(
  `http://${config.get('server.host')}:${config.get('server.port')}`
)

describe('Media field', () => {
  beforeEach(done => {
    help.dropDatabase('testdb', err => {
      app.start(() => {
        help
          .createSchemas([
            {
              fields: {
                field1: {
                  type: 'String',
                  label: 'Title',
                  comments: 'The title of the entry',
                  validation: {},
                  required: false
                },
                title: {
                  type: 'String',
                  label: 'Title',
                  comments: 'The title of the entry',
                  validation: {},
                  required: false,
                  search: {
                    weight: 2
                  }
                },
                leadImage: {
                  type: 'Media'
                },
                leadImageJPEG: {
                  type: 'Media',
                  validation: {
                    mimeTypes: ['image/jpeg']
                  }
                },
                legacyImage: {
                  type: 'Reference',
                  settings: {
                    collection: 'mediaStore'
                  }
                },
                fieldReference: {
                  type: 'Reference',
                  settings: {
                    collection: 'test-reference-schema'
                  }
                }
              },
              name: 'test-schema',
              property: 'testdb',
              settings: {
                cache: true,
                cacheTTL: 300,
                authenticate: true,
                count: 40,
                sortOrder: 1,
                storeRevisions: true,
                revisionCollection: 'testSchemaHistory'
              },
              version: 'vtest'
            }
          ])
          .then(() => {
            help.getBearerToken((err, token) => {
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

  describe('POST', () => {
    describe('when `validation.mimeTypes` is defined', () => {
      it('should reject a single value that does not correspond to a valid media object', done => {
        const payload = {
          title: 'Media support in DADI API',
          leadImageJPEG: '5bf5369dd680048cf051bd92'
        }

        client
          .post('/testdb/test-schema')
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect(400)
          .send(payload)
          .end((err, res) => {
            res.body.success.should.eql(false)
            res.body.errors.length.should.eql(1)
            res.body.errors[0].field.should.eql('leadImageJPEG')
            res.body.errors[0].code.should.eql('ERROR_INVALID_ID')
            res.body.errors[0].message.should.be.instanceOf(String)

            done(err)
          })
      })

      it('should reject a single value that corresponds to a media object with a MIME type that is not allowed', done => {
        client
          .post('/media/upload')
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .attach('avatar', 'test/acceptance/temp-workspace/media/1f525.png')
          .end((err, res) => {
            const mediaObject = res.body.results[0]
            const payload = {
              title: 'Media support in DADI API',
              leadImageJPEG: mediaObject._id
            }

            client
              .post('/testdb/test-schema')
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect(400)
              .send(payload)
              .end((err, res) => {
                res.body.success.should.eql(false)
                res.body.errors.length.should.eql(1)
                res.body.errors[0].field.should.eql('leadImageJPEG')
                res.body.errors[0].code.should.eql('ERROR_INVALID_MIME_TYPE')
                res.body.errors[0].message.should.be.instanceOf(String)

                done(err)
              })
          })
      })

      it('should accept a single value that corresponds to a media object with a MIME type that is allowed', done => {
        client
          .post('/media/upload')
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .attach('avatar', 'test/acceptance/temp-workspace/media/flowers.jpg')
          .end((err, res) => {
            const mediaObject = res.body.results[0]
            const payload = {
              title: 'Media support in DADI API',
              leadImageJPEG: mediaObject._id
            }

            client
              .post('/testdb/test-schema')
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect(200)
              .send(payload)
              .end((err, res) => {
                res.body.results.should.be.instanceOf(Array)
                res.body.results.length.should.eql(1)
                res.body.results[0].title.should.eql(payload.title)
                res.body.results[0].leadImageJPEG._id.should.eql(
                  mediaObject._id
                )
                res.body.results[0].leadImageJPEG.fileName.should.eql(
                  'flowers.jpg'
                )
                res.body.results[0]._composed.leadImageJPEG.should.eql(
                  mediaObject._id
                )

                done(err)
              })
          })
      })

      it('should reject a multiple value where one of the IDs does not correspond to a valid media object', done => {
        client
          .post('/media/upload')
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .attach('avatar', 'test/acceptance/temp-workspace/media/1f525.png')
          .end((err, res) => {
            const mediaObject = res.body.results[0]
            const payload = {
              title: 'Media support in DADI API',
              leadImageJPEG: ['5bf5369dd680048cf051bd92', mediaObject._id]
            }

            client
              .post('/testdb/test-schema')
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect(400)
              .send(payload)
              .end((err, res) => {
                res.body.success.should.eql(false)
                res.body.errors.length.should.eql(1)
                res.body.errors[0].field.should.eql('leadImageJPEG')
                res.body.errors[0].code.should.eql('ERROR_INVALID_ID')
                res.body.errors[0].message.should.be.instanceOf(String)

                done(err)
              })
          })
      })

      it('should reject a multiple value where one of the IDs corresponds to a media object with a MIME type that is not allowed', done => {
        client
          .post('/media/upload')
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .attach('avatar', 'test/acceptance/temp-workspace/media/1f525.png')
          .end((err, res) => {
            const mediaObject1 = res.body.results[0]

            client
              .post('/media/upload')
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .attach(
                'avatar',
                'test/acceptance/temp-workspace/media/flowers.jpg'
              )
              .end((err, res) => {
                const mediaObject2 = res.body.results[0]
                const payload = {
                  title: 'Media support in DADI API',
                  leadImageJPEG: [mediaObject1._id, mediaObject2._id]
                }

                client
                  .post('/testdb/test-schema')
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .expect(400)
                  .send(payload)
                  .end((err, res) => {
                    res.body.success.should.eql(false)
                    res.body.errors.length.should.eql(1)
                    res.body.errors[0].field.should.eql('leadImageJPEG')
                    res.body.errors[0].code.should.eql(
                      'ERROR_INVALID_MIME_TYPE'
                    )
                    res.body.errors[0].message.should.be.instanceOf(String)

                    done(err)
                  })
              })
          })
      })
    })

    it('should reject a string value that is not an hexadecimal ID', done => {
      client
        .post('/testdb/test-schema')
        .set('content-type', 'application/json')
        .set('Authorization', `Bearer ${bearerToken}`)
        .send({
          leadImage: 'QWERTYUIOP'
        })
        .expect(400)
        .end((err, res) => {
          res.body.success.should.eql(false)
          res.body.errors[0].field.should.eql('leadImage')
          res.body.errors[0].code.should.eql('ERROR_VALUE_INVALID')

          done(err)
        })
    })

    it('should accept `null` as a value', done => {
      const payload = {
        title: 'Media support in DADI API',
        leadImage: null
      }

      client
        .post('/testdb/test-schema')
        .set('content-type', 'application/json')
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(200)
        .send(payload)
        .end((err, res) => {
          res.body.results.should.be.instanceOf(Array)
          res.body.results.length.should.eql(1)
          res.body.results[0].title.should.eql(payload.title)
          should.not.exist(res.body.results[0].leadImage)

          done(err)
        })
    })

    it('should accept an ID that does not correspond to a valid media object', done => {
      const payload = {
        title: 'Media support in DADI API',
        leadImage: '5bf5369dd680048cf051bd92'
      }

      client
        .post('/testdb/test-schema')
        .set('content-type', 'application/json')
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(200)
        .send(payload)
        .end((err, res) => {
          res.body.results.should.be.instanceOf(Array)
          res.body.results.length.should.eql(1)
          res.body.results[0].title.should.eql(payload.title)
          res.body.results[0].leadImage.should.eql(payload.leadImage)
          should.not.exist(res.body.results[0]._composed)

          done(err)
        })
    })

    it('should accept a media object ID as a string', done => {
      client
        .post('/media/upload')
        .set('content-type', 'application/json')
        .set('Authorization', `Bearer ${bearerToken}`)
        .attach('avatar', 'test/acceptance/temp-workspace/media/1f525.png')
        .end((err, res) => {
          const mediaObject = res.body.results[0]
          const payload = {
            title: 'Media support in DADI API',
            leadImage: mediaObject._id
          }

          client
            .post('/testdb/test-schema')
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .send(payload)
            .end((err, res) => {
              const {results} = res.body

              results.should.be.instanceOf(Array)
              results.length.should.eql(1)
              results[0].title.should.eql(payload.title)
              results[0].leadImage._id.should.eql(mediaObject._id)
              results[0].leadImage.fileName.should.eql('1f525.png')
              results[0].leadImage.url.should.be.instanceOf(String)
              results[0]._composed.leadImage.should.eql(mediaObject._id)

              client
                .get(`/testdb/test-schema/${results[0]._id}`)
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .end((err, res) => {
                  const {results} = res.body

                  results.should.be.instanceOf(Array)
                  results.length.should.eql(1)
                  results[0].title.should.eql(payload.title)
                  results[0].leadImage._id.should.eql(mediaObject._id)
                  results[0].leadImage.fileName.should.eql('1f525.png')
                  results[0].leadImage.url.should.be.instanceOf(String)
                  results[0]._composed.leadImage.should.eql(mediaObject._id)

                  done(err)
                })
            })
        })
    })

    it('should accept multiple media object IDs as an array of strings', done => {
      client
        .post('/media/upload')
        .set('content-type', 'application/json')
        .set('Authorization', `Bearer ${bearerToken}`)
        .attach('avatar', 'test/acceptance/temp-workspace/media/1f525.png')
        .end((err, res) => {
          const mediaObject1 = res.body.results[0]

          client
            .post('/media/upload')
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .attach(
              'avatar',
              'test/acceptance/temp-workspace/media/flowers.jpg'
            )
            .end((err, res) => {
              const mediaObject2 = res.body.results[0]
              const payload = {
                title: 'Media support in DADI API',
                leadImage: [mediaObject1._id, mediaObject2._id]
              }

              client
                .post('/testdb/test-schema')
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .send(payload)
                .end((err, res) => {
                  const {results} = res.body

                  results.should.be.instanceOf(Array)
                  results.length.should.eql(1)
                  results[0].title.should.eql(payload.title)
                  results[0].leadImage.should.be.instanceOf(Array)
                  results[0].leadImage.length.should.eql(2)
                  results[0].leadImage[0]._id.should.eql(mediaObject1._id)
                  results[0].leadImage[0].fileName.should.eql('1f525.png')
                  results[0].leadImage[0].url.should.be.instanceOf(String)
                  results[0].leadImage[1]._id.should.eql(mediaObject2._id)
                  results[0].leadImage[1].fileName.should.eql('flowers.jpg')
                  results[0].leadImage[1].url.should.be.instanceOf(String)
                  results[0]._composed.leadImage.should.eql([
                    mediaObject1._id,
                    mediaObject2._id
                  ])

                  client
                    .get(`/testdb/test-schema/${results[0]._id}`)
                    .set('content-type', 'application/json')
                    .set('Authorization', `Bearer ${bearerToken}`)
                    .end((err, res) => {
                      const {results} = res.body

                      results.should.be.instanceOf(Array)
                      results.length.should.eql(1)
                      results[0].title.should.eql(payload.title)
                      results[0].leadImage.should.be.instanceOf(Array)
                      results[0].leadImage.length.should.eql(2)
                      results[0].leadImage[0]._id.should.eql(mediaObject1._id)
                      results[0].leadImage[0].fileName.should.eql('1f525.png')
                      results[0].leadImage[0].url.should.be.instanceOf(String)
                      results[0].leadImage[1]._id.should.eql(mediaObject2._id)
                      results[0].leadImage[1].fileName.should.eql('flowers.jpg')
                      results[0].leadImage[1].url.should.be.instanceOf(String)
                      results[0]._composed.leadImage.should.eql([
                        mediaObject1._id,
                        mediaObject2._id
                      ])

                      done(err)
                    })
                })
            })
        })
    })

    it('should reject an object value that does not contain an hexadecimal ID', done => {
      client
        .post('/testdb/test-schema')
        .set('content-type', 'application/json')
        .set('Authorization', `Bearer ${bearerToken}`)
        .send({
          leadImage: {
            someProperty: 'Some value'
          }
        })
        .expect(400)
        .end((err, res) => {
          res.body.success.should.eql(false)
          res.body.errors[0].field.should.eql('leadImage')
          res.body.errors[0].code.should.eql('ERROR_VALUE_INVALID')

          client
            .post('/testdb/test-schema')
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .send({
              leadImage: {
                _id: 'QWERTYUIOP',
                someProperty: 'Some value'
              }
            })
            .expect(400)
            .end((err, res) => {
              res.body.success.should.eql(false)
              res.body.errors[0].field.should.eql('leadImage')
              res.body.errors[0].code.should.eql('ERROR_VALUE_INVALID')

              done(err)
            })
        })
    })

    it('should accept a media object as an object', done => {
      client
        .post('/media/upload')
        .set('content-type', 'application/json')
        .set('Authorization', `Bearer ${bearerToken}`)
        .attach('avatar', 'test/acceptance/temp-workspace/media/1f525.png')
        .end((err, res) => {
          const mediaObject = res.body.results[0]
          const payload = {
            title: 'Media support in DADI API',
            leadImage: {
              _id: mediaObject._id
            }
          }

          client
            .post('/testdb/test-schema')
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .send(payload)
            .end((err, res) => {
              const {results} = res.body

              results.should.be.instanceOf(Array)
              results.length.should.eql(1)
              results[0].title.should.eql(payload.title)
              results[0].leadImage._id.should.eql(mediaObject._id)
              results[0].leadImage.fileName.should.eql('1f525.png')
              results[0].leadImage.url.should.be.instanceOf(String)
              results[0]._composed.leadImage.should.eql(mediaObject._id)

              client
                .get(`/testdb/test-schema/${results[0]._id}`)
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .end((err, res) => {
                  const {results} = res.body

                  results.should.be.instanceOf(Array)
                  results.length.should.eql(1)
                  results[0].title.should.eql(payload.title)
                  results[0].leadImage._id.should.eql(mediaObject._id)
                  results[0].leadImage.fileName.should.eql('1f525.png')
                  results[0].leadImage.url.should.be.instanceOf(String)
                  results[0]._composed.leadImage.should.eql(mediaObject._id)

                  done(err)
                })
            })
        })
    })

    it('should accept multiple media object IDs as an array of objects', done => {
      client
        .post('/media/upload')
        .set('content-type', 'application/json')
        .set('Authorization', `Bearer ${bearerToken}`)
        .attach('avatar', 'test/acceptance/temp-workspace/media/1f525.png')
        .end((err, res) => {
          const mediaObject1 = res.body.results[0]

          client
            .post('/media/upload')
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .attach(
              'avatar',
              'test/acceptance/temp-workspace/media/flowers.jpg'
            )
            .end((err, res) => {
              const mediaObject2 = res.body.results[0]
              const payload = {
                title: 'Media support in DADI API',
                leadImage: [{_id: mediaObject1._id}, {_id: mediaObject2._id}]
              }

              client
                .post('/testdb/test-schema')
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .send(payload)
                .end((err, res) => {
                  const {results} = res.body

                  results.should.be.instanceOf(Array)
                  results.length.should.eql(1)
                  results[0].title.should.eql(payload.title)
                  results[0].leadImage.should.be.instanceOf(Array)
                  results[0].leadImage.length.should.eql(2)
                  results[0].leadImage[0]._id.should.eql(mediaObject1._id)
                  results[0].leadImage[0].fileName.should.eql('1f525.png')
                  results[0].leadImage[0].url.should.be.instanceOf(String)
                  results[0].leadImage[1]._id.should.eql(mediaObject2._id)
                  results[0].leadImage[1].fileName.should.eql('flowers.jpg')
                  results[0].leadImage[1].url.should.be.instanceOf(String)
                  results[0]._composed.leadImage.should.eql([
                    mediaObject1._id,
                    mediaObject2._id
                  ])

                  client
                    .get(`/testdb/test-schema/${results[0]._id}`)
                    .set('content-type', 'application/json')
                    .set('Authorization', `Bearer ${bearerToken}`)
                    .end((err, res) => {
                      const {results} = res.body

                      results.should.be.instanceOf(Array)
                      results.length.should.eql(1)
                      results[0].title.should.eql(payload.title)
                      results[0].leadImage.should.be.instanceOf(Array)
                      results[0].leadImage.length.should.eql(2)
                      results[0].leadImage[0]._id.should.eql(mediaObject1._id)
                      results[0].leadImage[0].fileName.should.eql('1f525.png')
                      results[0].leadImage[0].url.should.be.instanceOf(String)
                      results[0].leadImage[1]._id.should.eql(mediaObject2._id)
                      results[0].leadImage[1].fileName.should.eql('flowers.jpg')
                      results[0].leadImage[1].url.should.be.instanceOf(String)
                      results[0]._composed.leadImage.should.eql([
                        mediaObject1._id,
                        mediaObject2._id
                      ])

                      done(err)
                    })
                })
            })
        })
    })

    it('should accept a media object as an object with additional metadata', done => {
      client
        .post('/media/upload')
        .set('content-type', 'application/json')
        .set('Authorization', `Bearer ${bearerToken}`)
        .attach('avatar', 'test/acceptance/temp-workspace/media/1f525.png')
        .end((err, res) => {
          const mediaObject = res.body.results[0]
          const payload = {
            title: 'Media support in DADI API',
            leadImage: {
              _id: mediaObject._id,
              altText: 'A diagram outlining media support in DADI API',
              crop: [16, 32, 64, 128]
            }
          }

          client
            .post('/testdb/test-schema')
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .send(payload)
            .end((err, res) => {
              const {results} = res.body

              results.should.be.instanceOf(Array)
              results.length.should.eql(1)
              results[0].title.should.eql(payload.title)
              results[0].leadImage._id.should.eql(mediaObject._id)
              results[0].leadImage.altText.should.eql(payload.leadImage.altText)
              results[0].leadImage.crop.should.eql(payload.leadImage.crop)
              results[0].leadImage.fileName.should.eql('1f525.png')
              results[0].leadImage.url.should.be.instanceOf(String)
              results[0]._composed.leadImage.should.eql(mediaObject._id)

              client
                .post(`/testdb/test-schema/${results[0]._id}`)
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .send(payload)
                .end((err, res) => {
                  const {results} = res.body

                  results.should.be.instanceOf(Array)
                  results.length.should.eql(1)
                  results[0].title.should.eql(payload.title)
                  results[0].leadImage._id.should.eql(mediaObject._id)
                  results[0].leadImage.altText.should.eql(
                    payload.leadImage.altText
                  )
                  results[0].leadImage.crop.should.eql(payload.leadImage.crop)
                  results[0].leadImage.fileName.should.eql('1f525.png')
                  results[0].leadImage.url.should.be.instanceOf(String)
                  results[0]._composed.leadImage.should.eql(mediaObject._id)

                  done(err)
                })
            })
        })
    })

    it('should accept multiple media object IDs as an array of objects with additional metadata', done => {
      client
        .post('/media/upload')
        .set('content-type', 'application/json')
        .set('Authorization', `Bearer ${bearerToken}`)
        .attach('avatar', 'test/acceptance/temp-workspace/media/1f525.png')
        .end((err, res) => {
          const mediaObject1 = res.body.results[0]

          client
            .post('/media/upload')
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .attach(
              'avatar',
              'test/acceptance/temp-workspace/media/flowers.jpg'
            )
            .end((err, res) => {
              const mediaObject2 = res.body.results[0]
              const payload = {
                title: 'Media support in DADI API',
                leadImage: [
                  {
                    _id: mediaObject1._id,
                    caption: 'Caption for the first image'
                  },
                  {
                    _id: mediaObject2._id,
                    caption: 'Caption for the second image'
                  }
                ]
              }

              client
                .post('/testdb/test-schema')
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .send(payload)
                .end((err, res) => {
                  const {results} = res.body

                  results.should.be.instanceOf(Array)
                  results.length.should.eql(1)
                  results[0].title.should.eql(payload.title)
                  results[0].leadImage.should.be.instanceOf(Array)
                  results[0].leadImage.length.should.eql(2)
                  results[0].leadImage[0]._id.should.eql(mediaObject1._id)
                  results[0].leadImage[0].fileName.should.eql('1f525.png')
                  results[0].leadImage[0].url.should.be.instanceOf(String)
                  results[0].leadImage[0].caption.should.eql(
                    payload.leadImage[0].caption
                  )
                  results[0].leadImage[1]._id.should.eql(mediaObject2._id)
                  results[0].leadImage[1].fileName.should.eql('flowers.jpg')
                  results[0].leadImage[1].url.should.be.instanceOf(String)
                  results[0].leadImage[1].caption.should.eql(
                    payload.leadImage[1].caption
                  )
                  results[0]._composed.leadImage.should.eql([
                    mediaObject1._id,
                    mediaObject2._id
                  ])

                  client
                    .get(`/testdb/test-schema/${results[0]._id}`)
                    .set('content-type', 'application/json')
                    .set('Authorization', `Bearer ${bearerToken}`)
                    .end((err, res) => {
                      const {results} = res.body

                      results.should.be.instanceOf(Array)
                      results.length.should.eql(1)
                      results[0].title.should.eql(payload.title)
                      results[0].leadImage.should.be.instanceOf(Array)
                      results[0].leadImage.length.should.eql(2)
                      results[0].leadImage[0]._id.should.eql(mediaObject1._id)
                      results[0].leadImage[0].fileName.should.eql('1f525.png')
                      results[0].leadImage[0].url.should.be.instanceOf(String)
                      results[0].leadImage[0].caption.should.eql(
                        payload.leadImage[0].caption
                      )
                      results[0].leadImage[1]._id.should.eql(mediaObject2._id)
                      results[0].leadImage[1].fileName.should.eql('flowers.jpg')
                      results[0].leadImage[1].url.should.be.instanceOf(String)
                      results[0].leadImage[1].caption.should.eql(
                        payload.leadImage[1].caption
                      )
                      results[0]._composed.leadImage.should.eql([
                        mediaObject1._id,
                        mediaObject2._id
                      ])

                      done(err)
                    })
                })
            })
        })
    })

    it('should resolve a legacy value created by a Reference field', done => {
      client
        .post('/media/upload')
        .set('content-type', 'application/json')
        .set('Authorization', `Bearer ${bearerToken}`)
        .attach('avatar', 'test/acceptance/temp-workspace/media/1f525.png')
        .end((err, res) => {
          const mediaObject = res.body.results[0]
          const payload = {
            title: 'Media support in DADI API',
            legacyImage: mediaObject._id
          }

          client
            .post('/testdb/test-schema')
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .send(payload)
            .end((err, res) => {
              const {results} = res.body

              results.should.be.instanceOf(Array)
              results.length.should.eql(1)
              results[0].title.should.eql(payload.title)
              results[0].legacyImage._id.should.eql(mediaObject._id)
              results[0].legacyImage.fileName.should.eql('1f525.png')
              results[0].legacyImage.url.should.be.instanceOf(String)
              results[0]._composed.legacyImage.should.eql(mediaObject._id)

              client
                .get(`/testdb/test-schema/${results[0]._id}?compose=true`)
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .end((err, res) => {
                  const {results} = res.body

                  results.should.be.instanceOf(Array)
                  results.length.should.eql(1)
                  results[0].title.should.eql(payload.title)
                  results[0].legacyImage._id.should.eql(mediaObject._id)
                  results[0].legacyImage.fileName.should.eql('1f525.png')
                  results[0].legacyImage.url.should.be.instanceOf(String)
                  results[0]._composed.legacyImage.should.eql(mediaObject._id)

                  const model = modelStore.get({
                    name: 'test-schema',
                    property: 'testdb',
                    version: 'vtest'
                  })

                  model.schema.legacyImage.type = 'Media'
                  delete model.schema.legacyImage.settings

                  client
                    .get(
                      `/testdb/test-schema/${results[0]._id}?cache=false`
                    )
                    .set('content-type', 'application/json')
                    .set('Authorization', `Bearer ${bearerToken}`)
                    .end((err, res) => {
                      const {results} = res.body

                      results.should.be.instanceOf(Array)
                      results.length.should.eql(1)
                      results[0].title.should.eql(payload.title)
                      results[0].legacyImage._id.should.eql(mediaObject._id)
                      results[0].legacyImage.fileName.should.eql('1f525.png')
                      results[0].legacyImage.url.should.be.instanceOf(String)
                      results[0]._composed.legacyImage.should.eql(
                        mediaObject._id
                      )

                      done(err)
                    })
                })
            })
        })
    })
  })

  describe('PUT', () => {
    describe('when `validation.mimeTypes` is defined', () => {
      it('should reject a single value that does not correspond to a valid media object', done => {
        client
          .post('/media/upload')
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .attach('avatar', 'test/acceptance/temp-workspace/media/flowers.jpg')
          .end((err, res) => {
            const mediaObject = res.body.results[0]
            const payload = {
              title: 'Media support in DADI API',
              leadImageJPEG: mediaObject._id
            }

            client
              .post('/testdb/test-schema')
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .send(payload)
              .end((err, res) => {
                const {results} = res.body
                const id = results[0]._id
                const payload = {
                  leadImageJPEG: '5bf5369dd680048cf051bd92'
                }

                client
                  .put(`/testdb/test-schema/${id}`)
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .expect(400)
                  .send(payload)
                  .end((err, res) => {
                    res.body.success.should.eql(false)
                    res.body.errors.length.should.eql(1)
                    res.body.errors[0].field.should.eql('leadImageJPEG')
                    res.body.errors[0].code.should.eql('ERROR_INVALID_ID')
                    res.body.errors[0].message.should.be.instanceOf(String)

                    done(err)
                  })
              })
          })
      })

      it('should reject a single value that corresponds to a media object with a MIME type that is not allowed', done => {
        client
          .post('/media/upload')
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .attach('avatar', 'test/acceptance/temp-workspace/media/flowers.jpg')
          .end((err, res) => {
            const mediaObject = res.body.results[0]
            const payload = {
              title: 'Media support in DADI API',
              leadImageJPEG: mediaObject._id
            }

            client
              .post('/testdb/test-schema')
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .send(payload)
              .end((err, res) => {
                const {results} = res.body
                const id = results[0]._id

                client
                  .post('/media/upload')
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .attach(
                    'avatar',
                    'test/acceptance/temp-workspace/media/1f525.png'
                  )
                  .end((err, res) => {
                    const mediaObject = res.body.results[0]
                    const payload = {
                      leadImageJPEG: mediaObject._id
                    }

                    client
                      .put(`/testdb/test-schema/${id}`)
                      .set('content-type', 'application/json')
                      .set('Authorization', `Bearer ${bearerToken}`)
                      .expect(400)
                      .send(payload)
                      .end((err, res) => {
                        res.body.success.should.eql(false)
                        res.body.errors.length.should.eql(1)
                        res.body.errors[0].field.should.eql('leadImageJPEG')
                        res.body.errors[0].code.should.eql(
                          'ERROR_INVALID_MIME_TYPE'
                        )
                        res.body.errors[0].message.should.be.instanceOf(String)

                        done(err)
                      })
                  })
              })
          })
      })

      it('should accept a single value that corresponds to a media object with a MIME type that is allowed', done => {
        client
          .post('/media/upload')
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .attach('avatar', 'test/acceptance/temp-workspace/media/flowers.jpg')
          .end((err, res) => {
            const mediaObject = res.body.results[0]
            const payload1 = {
              title: 'Media support in DADI API',
              leadImageJPEG: mediaObject._id
            }

            client
              .post('/testdb/test-schema')
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .send(payload1)
              .end((err, res) => {
                const {results} = res.body
                const id = results[0]._id

                client
                  .post('/media/upload')
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .attach(
                    'avatar',
                    'test/acceptance/temp-workspace/media/flowers.jpg'
                  )
                  .end((err, res) => {
                    const mediaObject = res.body.results[0]
                    const payload2 = {
                      leadImageJPEG: mediaObject._id
                    }

                    client
                      .put(`/testdb/test-schema/${id}`)
                      .set('content-type', 'application/json')
                      .set('Authorization', `Bearer ${bearerToken}`)
                      .expect(200)
                      .send(payload2)
                      .end((err, res) => {
                        res.body.results.should.be.instanceOf(Array)
                        res.body.results.length.should.eql(1)
                        res.body.results[0].title.should.eql(payload1.title)
                        res.body.results[0].leadImageJPEG._id.should.eql(
                          mediaObject._id
                        )
                        res.body.results[0].leadImageJPEG.fileName.should.eql(
                          'flowers.jpg'
                        )
                        res.body.results[0].leadImageJPEG.url.should.be.instanceOf(
                          String
                        )
                        res.body.results[0]._composed.leadImageJPEG.should.eql(
                          mediaObject._id
                        )

                        done(err)
                      })
                  })
              })
          })
      })

      it('should reject a multiple value where one of the IDs does not correspond to a valid media object', done => {
        client
          .post('/media/upload')
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .attach('avatar', 'test/acceptance/temp-workspace/media/1f525.png')
          .end((err, res) => {
            const mediaObject = res.body.results[0]
            const payload = {
              title: 'Media support in DADI API',
              leadImageJPEG: ['5bf5369dd680048cf051bd92', mediaObject._id]
            }

            client
              .post('/testdb/test-schema')
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect(400)
              .send(payload)
              .end((err, res) => {
                res.body.success.should.eql(false)
                res.body.errors.length.should.eql(1)
                res.body.errors[0].field.should.eql('leadImageJPEG')
                res.body.errors[0].code.should.eql('ERROR_INVALID_ID')
                res.body.errors[0].message.should.be.instanceOf(String)

                done(err)
              })
          })
      })

      it('should reject a multiple value where one of the IDs corresponds to a media object with a MIME type that is not allowed', done => {
        client
          .post('/media/upload')
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .attach('avatar', 'test/acceptance/temp-workspace/media/flowers.jpg')
          .end((err, res) => {
            const mediaObject = res.body.results[0]
            const payload = {
              title: 'Media support in DADI API',
              leadImageJPEG: mediaObject._id
            }

            client
              .post('/testdb/test-schema')
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .send(payload)
              .end((err, res) => {
                const {results} = res.body
                const id = results[0]._id

                client
                  .post('/media/upload')
                  .set('content-type', 'application/json')
                  .set('Authorization', `Bearer ${bearerToken}`)
                  .attach(
                    'avatar',
                    'test/acceptance/temp-workspace/media/1f525.png'
                  )
                  .end((err, res) => {
                    const mediaObject1 = res.body.results[0]

                    client
                      .post('/media/upload')
                      .set('content-type', 'application/json')
                      .set('Authorization', `Bearer ${bearerToken}`)
                      .attach(
                        'avatar',
                        'test/acceptance/temp-workspace/media/flowers.jpg'
                      )
                      .end((err, res) => {
                        const mediaObject2 = res.body.results[0]
                        const payload = {
                          title: 'Media support in DADI API',
                          leadImageJPEG: [mediaObject1._id, mediaObject2._id]
                        }

                        client
                          .put(`/testdb/test-schema/${id}`)
                          .set('content-type', 'application/json')
                          .set('Authorization', `Bearer ${bearerToken}`)
                          .expect(400)
                          .send(payload)
                          .end((err, res) => {
                            res.body.success.should.eql(false)
                            res.body.errors.length.should.eql(1)
                            res.body.errors[0].field.should.eql('leadImageJPEG')
                            res.body.errors[0].code.should.eql(
                              'ERROR_INVALID_MIME_TYPE'
                            )
                            res.body.errors[0].message.should.be.instanceOf(
                              String
                            )

                            done(err)
                          })
                      })
                  })
              })
          })
      })
    })

    it("should reject a string that isn't a hexadecimal ID", done => {
      client
        .post('/media/upload')
        .set('content-type', 'application/json')
        .set('Authorization', `Bearer ${bearerToken}`)
        .attach('avatar', 'test/acceptance/temp-workspace/media/1f525.png')
        .end((err, res) => {
          const mediaObject = res.body.results[0]
          const payload = {
            title: 'Media support in DADI API',
            leadImage: mediaObject._id
          }

          client
            .post('/testdb/test-schema')
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .send(payload)
            .end((err, res) => {
              const {results} = res.body

              results.should.be.instanceOf(Array)
              results.length.should.eql(1)
              results[0].title.should.eql(payload.title)
              results[0].leadImage._id.should.eql(mediaObject._id)
              results[0].leadImage.fileName.should.eql('1f525.png')
              results[0].leadImage.url.should.be.instanceOf(String)

              const updatePayload = {
                leadImage: 'QWERTYUIOP'
              }

              client
                .put(`/testdb/test-schema/${results[0]._id}`)
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .send(updatePayload)
                .expect(400)
                .end((err, res) => {
                  res.body.success.should.eql(false)
                  res.body.errors[0].field.should.eql('leadImage')
                  res.body.errors[0].code.should.eql('ERROR_VALUE_INVALID')

                  done(err)
                })
            })
        })
    })

    it('should accept a media object ID as a string', done => {
      client
        .post('/media/upload')
        .set('content-type', 'application/json')
        .set('Authorization', `Bearer ${bearerToken}`)
        .attach('avatar', 'test/acceptance/temp-workspace/media/1f525.png')
        .end((err, res) => {
          const mediaObject1 = res.body.results[0]

          client
            .post('/media/upload')
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .attach(
              'avatar',
              'test/acceptance/temp-workspace/media/flowers.jpg'
            )
            .end((err, res) => {
              const mediaObject2 = res.body.results[0]
              const payload = {
                title: 'Media support in DADI API',
                leadImage: mediaObject1._id
              }

              client
                .post('/testdb/test-schema')
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .send(payload)
                .end((err, res) => {
                  const {results} = res.body

                  results.should.be.instanceOf(Array)
                  results.length.should.eql(1)
                  results[0].title.should.eql(payload.title)
                  results[0].leadImage._id.should.eql(mediaObject1._id)
                  results[0].leadImage.fileName.should.eql('1f525.png')
                  results[0].leadImage.url.should.be.instanceOf(String)
                  results[0]._composed.leadImage.should.eql(mediaObject1._id)

                  const updatePayload = {
                    leadImage: mediaObject2._id
                  }

                  client
                    .put(`/testdb/test-schema/${results[0]._id}`)
                    .set('content-type', 'application/json')
                    .set('Authorization', `Bearer ${bearerToken}`)
                    .send(updatePayload)
                    .end((err, res) => {
                      client
                        .get(`/testdb/test-schema/${results[0]._id}`)
                        .set('content-type', 'application/json')
                        .set('Authorization', `Bearer ${bearerToken}`)
                        .end((err, res) => {
                          const {results} = res.body

                          results.should.be.instanceOf(Array)
                          results.length.should.eql(1)
                          results[0].title.should.eql(payload.title)
                          results[0].leadImage._id.should.eql(mediaObject2._id)
                          results[0].leadImage.fileName.should.eql(
                            'flowers.jpg'
                          )
                          results[0].leadImage.url.should.be.instanceOf(String)
                          results[0]._composed.leadImage.should.eql(
                            mediaObject2._id
                          )

                          done(err)
                        })
                    })
                })
            })
        })
    })

    it("should reject an object that doesn't contain a hexadecimal ID", done => {
      client
        .post('/media/upload')
        .set('content-type', 'application/json')
        .set('Authorization', `Bearer ${bearerToken}`)
        .attach('avatar', 'test/acceptance/temp-workspace/media/1f525.png')
        .end((err, res) => {
          const mediaObject = res.body.results[0]
          const payload = {
            title: 'Media support in DADI API',
            leadImage: mediaObject._id
          }

          client
            .post('/testdb/test-schema')
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .send(payload)
            .end((err, res) => {
              const {results} = res.body

              results.should.be.instanceOf(Array)
              results.length.should.eql(1)
              results[0].title.should.eql(payload.title)
              results[0].leadImage._id.should.eql(mediaObject._id)
              results[0].leadImage.fileName.should.eql('1f525.png')
              results[0].leadImage.url.should.be.instanceOf(String)

              const updatePayload = {
                leadImage: {
                  _id: 'QWERTYUIOP'
                }
              }

              client
                .put(`/testdb/test-schema/${results[0]._id}`)
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .send(updatePayload)
                .expect(400)
                .end((err, res) => {
                  res.body.success.should.eql(false)
                  res.body.errors[0].field.should.eql('leadImage')
                  res.body.errors[0].code.should.eql('ERROR_VALUE_INVALID')

                  done(err)
                })
            })
        })
    })

    it('should accept a media object ID as an object', done => {
      client
        .post('/media/upload')
        .set('content-type', 'application/json')
        .set('Authorization', `Bearer ${bearerToken}`)
        .attach('avatar', 'test/acceptance/temp-workspace/media/1f525.png')
        .end((err, res) => {
          const mediaObject1 = res.body.results[0]

          client
            .post('/media/upload')
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .attach(
              'avatar',
              'test/acceptance/temp-workspace/media/flowers.jpg'
            )
            .end((err, res) => {
              const mediaObject2 = res.body.results[0]
              const payload = {
                title: 'Media support in DADI API',
                leadImage: mediaObject1._id
              }

              client
                .post('/testdb/test-schema')
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .send(payload)
                .end((err, res) => {
                  const {results} = res.body

                  results.should.be.instanceOf(Array)
                  results.length.should.eql(1)
                  results[0].title.should.eql(payload.title)
                  results[0].leadImage._id.should.eql(mediaObject1._id)
                  results[0].leadImage.fileName.should.eql('1f525.png')
                  results[0].leadImage.url.should.be.instanceOf(String)
                  results[0]._composed.leadImage.should.eql(mediaObject1._id)

                  const updatePayload = {
                    leadImage: {
                      _id: mediaObject2._id
                    }
                  }

                  client
                    .put(`/testdb/test-schema/${results[0]._id}`)
                    .set('content-type', 'application/json')
                    .set('Authorization', `Bearer ${bearerToken}`)
                    .send(updatePayload)
                    .end((err, res) => {
                      client
                        .get(`/testdb/test-schema/${results[0]._id}`)
                        .set('content-type', 'application/json')
                        .set('Authorization', `Bearer ${bearerToken}`)
                        .end((err, res) => {
                          const {results} = res.body

                          results.should.be.instanceOf(Array)
                          results.length.should.eql(1)
                          results[0].title.should.eql(payload.title)
                          results[0].leadImage._id.should.eql(mediaObject2._id)
                          results[0].leadImage.fileName.should.eql(
                            'flowers.jpg'
                          )
                          results[0].leadImage.url.should.be.instanceOf(String)
                          results[0]._composed.leadImage.should.eql(
                            mediaObject2._id
                          )

                          done(err)
                        })
                    })
                })
            })
        })
    })

    it('should accept a media object ID as an object with additional metadata', done => {
      client
        .post('/media/upload')
        .set('content-type', 'application/json')
        .set('Authorization', `Bearer ${bearerToken}`)
        .attach('avatar', 'test/acceptance/temp-workspace/media/1f525.png')
        .end((err, res) => {
          const mediaObject1 = res.body.results[0]

          client
            .post('/media/upload')
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .attach(
              'avatar',
              'test/acceptance/temp-workspace/media/flowers.jpg'
            )
            .end((err, res) => {
              const mediaObject2 = res.body.results[0]
              const payload = {
                title: 'Media support in DADI API',
                leadImage: {
                  _id: mediaObject1._id,
                  altText: 'Original alt text',
                  caption: 'Original caption'
                }
              }

              client
                .post('/testdb/test-schema')
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .send(payload)
                .end((err, res) => {
                  const {results} = res.body

                  results.should.be.instanceOf(Array)
                  results.length.should.eql(1)
                  results[0].title.should.eql(payload.title)
                  results[0].leadImage._id.should.eql(mediaObject1._id)
                  results[0].leadImage.altText.should.eql(
                    payload.leadImage.altText
                  )
                  results[0].leadImage.caption.should.eql(
                    payload.leadImage.caption
                  )
                  results[0].leadImage.fileName.should.eql('1f525.png')
                  results[0].leadImage.url.should.be.instanceOf(String)
                  results[0]._composed.leadImage.should.eql(mediaObject1._id)

                  const updatePayload = {
                    leadImage: {
                      _id: mediaObject2._id,
                      altText: 'New alt text',
                      crop: [16, 32, 64, 128]
                    }
                  }

                  client
                    .put(`/testdb/test-schema/${results[0]._id}`)
                    .set('content-type', 'application/json')
                    .set('Authorization', `Bearer ${bearerToken}`)
                    .send(updatePayload)
                    .end((err, res) => {
                      client
                        .get(`/testdb/test-schema/${results[0]._id}`)
                        .set('content-type', 'application/json')
                        .set('Authorization', `Bearer ${bearerToken}`)
                        .end((err, res) => {
                          const {results} = res.body

                          results.should.be.instanceOf(Array)
                          results.length.should.eql(1)
                          results[0].title.should.eql(payload.title)
                          results[0].leadImage._id.should.eql(mediaObject2._id)
                          results[0].leadImage.altText.should.eql(
                            updatePayload.leadImage.altText
                          )
                          results[0].leadImage.crop.should.eql(
                            updatePayload.leadImage.crop
                          )
                          should.not.exist(results[0].leadImage.caption)
                          results[0].leadImage.fileName.should.eql(
                            'flowers.jpg'
                          )
                          results[0].leadImage.url.should.be.instanceOf(String)
                          results[0]._composed.leadImage.should.eql(
                            mediaObject2._id
                          )

                          done(err)
                        })
                    })
                })
            })
        })
    })
  })
})
