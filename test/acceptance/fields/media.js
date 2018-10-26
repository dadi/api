const should = require('should')
const sinon = require('sinon')
const fs = require('fs')
const path = require('path')
const request = require('supertest')
const config = require(__dirname + '/../../../config')
const help = require(__dirname + '/../help')
const app = require(__dirname + '/../../../dadi/lib/')
const Model = require('./../../../dadi/lib/model')

let bearerToken
let configBackup = config.get()
let client = request(`http://${config.get('server.host')}:${config.get('server.port')}`)

describe('Media field', () => {
  beforeEach(done => {
    help.dropDatabase('testdb', err => {
      app.start(() => {
        help.getBearerToken((err, token) => {
          bearerToken = token

          done(err)
        })
      })
    })
  })

  afterEach(done => {
    app.stop(done)
  })

  describe('Single value', () => {
    describe('POST', () => {
      it('should reject a string value that is not an hexadecimal ID', done => {
        client
        .post('/vtest/testdb/test-schema')
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

      it('should accept a media object ID as a string', done => {
        client
        .post('/media/upload')
        .set('content-type', 'application/json')
        .set('Authorization', `Bearer ${bearerToken}`)
        .attach('avatar', 'test/acceptance/temp-workspace/media/1f525.png')
        .end((err, res) => {
          let mediaObject = res.body.results[0]
          let payload = {
            title: 'Media support in DADI API',
            leadImage: mediaObject._id
          }

          client
          .post('/vtest/testdb/test-schema')
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .send(payload)
          .end((err, res) => {
            let {results} = res.body
            
            results.should.be.instanceOf(Array)
            results.length.should.eql(1)
            results[0].title.should.eql(payload.title)
            results[0].leadImage._id.should.eql(mediaObject._id)
            results[0].leadImage.fileName.should.eql('1f525.png')

            client
            .get(`/vtest/testdb/test-schema/${results[0]._id}`)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .end((err, res) => {
              let {results} = res.body
              
              results.should.be.instanceOf(Array)
              results.length.should.eql(1)
              results[0].title.should.eql(payload.title)
              results[0].leadImage._id.should.eql(mediaObject._id)
              results[0].leadImage.fileName.should.eql('1f525.png')

              done(err)
            })
          })
        })
      })

      it('should reject an object value that does not contain an hexadecimal ID', done => {
        client
        .post('/vtest/testdb/test-schema')
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
          .post('/vtest/testdb/test-schema')
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
          let mediaObject = res.body.results[0]
          let payload = {
            title: 'Media support in DADI API',
            leadImage: {
              _id: mediaObject._id
            }
          }

          client
          .post('/vtest/testdb/test-schema')
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .send(payload)
          .end((err, res) => {
            let {results} = res.body
            
            results.should.be.instanceOf(Array)
            results.length.should.eql(1)
            results[0].title.should.eql(payload.title)
            results[0].leadImage._id.should.eql(mediaObject._id)
            results[0].leadImage.fileName.should.eql('1f525.png')

            client
            .get(`/vtest/testdb/test-schema/${results[0]._id}`)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .end((err, res) => {
              let {results} = res.body
              
              results.should.be.instanceOf(Array)
              results.length.should.eql(1)
              results[0].title.should.eql(payload.title)
              results[0].leadImage._id.should.eql(mediaObject._id)
              results[0].leadImage.fileName.should.eql('1f525.png')

              done(err)
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
          let mediaObject = res.body.results[0]
          let payload = {
            title: 'Media support in DADI API',
            leadImage: {
              _id: mediaObject._id,
              altText: 'A diagram outlining media support in DADI API',
              crop: [16, 32, 64, 128]
            }
          }

          client
          .post('/vtest/testdb/test-schema')
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .send(payload)
          .end((err, res) => {
            let {results} = res.body

            results.should.be.instanceOf(Array)
            results.length.should.eql(1)
            results[0].title.should.eql(payload.title)
            results[0].leadImage._id.should.eql(mediaObject._id)
            results[0].leadImage.altText.should.eql(payload.leadImage.altText)
            results[0].leadImage.crop.should.eql(payload.leadImage.crop)
            results[0].leadImage.fileName.should.eql('1f525.png')

            client
            .post(`/vtest/testdb/test-schema/${results[0]._id}`)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .send(payload)
            .end((err, res) => {
              let {results} = res.body

              results.should.be.instanceOf(Array)
              results.length.should.eql(1)
              results[0].title.should.eql(payload.title)
              results[0].leadImage._id.should.eql(mediaObject._id)
              results[0].leadImage.altText.should.eql(payload.leadImage.altText)
              results[0].leadImage.crop.should.eql(payload.leadImage.crop)
              results[0].leadImage.fileName.should.eql('1f525.png')

              done(err)
            })
          })
        })
      })
    })

    describe('PUT', () => {
      it('should reject a string that isn\'t a hexadecimal ID', done => {
        client
        .post('/media/upload')
        .set('content-type', 'application/json')
        .set('Authorization', `Bearer ${bearerToken}`)
        .attach('avatar', 'test/acceptance/temp-workspace/media/1f525.png')
        .end((err, res) => {
          let mediaObject = res.body.results[0]
          let payload = {
            title: 'Media support in DADI API',
            leadImage: mediaObject._id
          }

          client
          .post('/vtest/testdb/test-schema')
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .send(payload)
          .end((err, res) => {
            let {results} = res.body
            
            results.should.be.instanceOf(Array)
            results.length.should.eql(1)
            results[0].title.should.eql(payload.title)
            results[0].leadImage._id.should.eql(mediaObject._id)
            results[0].leadImage.fileName.should.eql('1f525.png')

            let updatePayload = {
              leadImage: 'QWERTYUIOP'
            }

            client
            .put(`/vtest/testdb/test-schema/${results[0]._id}`)
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
          let mediaObject1 = res.body.results[0]

          client
          .post('/media/upload')
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .attach('avatar', 'test/acceptance/temp-workspace/media/flowers.jpg')
          .end((err, res) => {
            let mediaObject2 = res.body.results[0]
            let payload = {
              title: 'Media support in DADI API',
              leadImage: mediaObject1._id
            }

            client
            .post('/vtest/testdb/test-schema')
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .send(payload)
            .end((err, res) => {
              let {results} = res.body
              
              results.should.be.instanceOf(Array)
              results.length.should.eql(1)
              results[0].title.should.eql(payload.title)
              results[0].leadImage._id.should.eql(mediaObject1._id)
              results[0].leadImage.fileName.should.eql('1f525.png')

              let updatePayload = {
                leadImage: mediaObject2._id
              }

              client
              .put(`/vtest/testdb/test-schema/${results[0]._id}`)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .send(updatePayload)
              .end((err, res) => {
                client
                .get(`/vtest/testdb/test-schema/${results[0]._id}`)
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .end((err, res) => {
                  let {results} = res.body

                  results.should.be.instanceOf(Array)
                  results.length.should.eql(1)
                  results[0].title.should.eql(payload.title)
                  results[0].leadImage._id.should.eql(mediaObject2._id)
                  results[0].leadImage.fileName.should.eql('flowers.jpg')

                  done(err)
                })
              })
            })
          })
        })
      })

      it('should reject an object that doesn\'t contain a hexadecimal ID', done => {
        client
        .post('/media/upload')
        .set('content-type', 'application/json')
        .set('Authorization', `Bearer ${bearerToken}`)
        .attach('avatar', 'test/acceptance/temp-workspace/media/1f525.png')
        .end((err, res) => {
          let mediaObject = res.body.results[0]
          let payload = {
            title: 'Media support in DADI API',
            leadImage: mediaObject._id
          }

          client
          .post('/vtest/testdb/test-schema')
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .send(payload)
          .end((err, res) => {
            let {results} = res.body
            
            results.should.be.instanceOf(Array)
            results.length.should.eql(1)
            results[0].title.should.eql(payload.title)
            results[0].leadImage._id.should.eql(mediaObject._id)
            results[0].leadImage.fileName.should.eql('1f525.png')

            let updatePayload = {
              leadImage: {
                _id: 'QWERTYUIOP'
              }
            }

            client
            .put(`/vtest/testdb/test-schema/${results[0]._id}`)
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
          let mediaObject1 = res.body.results[0]

          client
          .post('/media/upload')
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .attach('avatar', 'test/acceptance/temp-workspace/media/flowers.jpg')
          .end((err, res) => {
            let mediaObject2 = res.body.results[0]
            let payload = {
              title: 'Media support in DADI API',
              leadImage: mediaObject1._id
            }

            client
            .post('/vtest/testdb/test-schema')
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .send(payload)
            .end((err, res) => {
              let {results} = res.body
              
              results.should.be.instanceOf(Array)
              results.length.should.eql(1)
              results[0].title.should.eql(payload.title)
              results[0].leadImage._id.should.eql(mediaObject1._id)
              results[0].leadImage.fileName.should.eql('1f525.png')

              let updatePayload = {
                leadImage: {
                  _id: mediaObject2._id
                }
              }

              client
              .put(`/vtest/testdb/test-schema/${results[0]._id}`)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .send(updatePayload)
              .end((err, res) => {
                client
                .get(`/vtest/testdb/test-schema/${results[0]._id}`)
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .end((err, res) => {
                  let {results} = res.body

                  results.should.be.instanceOf(Array)
                  results.length.should.eql(1)
                  results[0].title.should.eql(payload.title)
                  results[0].leadImage._id.should.eql(mediaObject2._id)
                  results[0].leadImage.fileName.should.eql('flowers.jpg')

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
          let mediaObject1 = res.body.results[0]

          client
          .post('/media/upload')
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .attach('avatar', 'test/acceptance/temp-workspace/media/flowers.jpg')
          .end((err, res) => {
            let mediaObject2 = res.body.results[0]
            let payload = {
              title: 'Media support in DADI API',
              leadImage: {
                _id: mediaObject1._id,
                altText: 'Original alt text',
                caption: 'Original caption'
              }
            }

            client
            .post('/vtest/testdb/test-schema')
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .send(payload)
            .end((err, res) => {
              let {results} = res.body
              
              results.should.be.instanceOf(Array)
              results.length.should.eql(1)
              results[0].title.should.eql(payload.title)
              results[0].leadImage._id.should.eql(mediaObject1._id)
              results[0].leadImage.altText.should.eql(payload.leadImage.altText)
              results[0].leadImage.caption.should.eql(payload.leadImage.caption)
              results[0].leadImage.fileName.should.eql('1f525.png')

              let updatePayload = {
                leadImage: {
                  _id: mediaObject2._id,
                  altText: 'New alt text',
                  crop: [16, 32, 64, 128]
                }
              }

              client
              .put(`/vtest/testdb/test-schema/${results[0]._id}`)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .send(updatePayload)
              .end((err, res) => {
                client
                .get(`/vtest/testdb/test-schema/${results[0]._id}`)
                .set('content-type', 'application/json')
                .set('Authorization', `Bearer ${bearerToken}`)
                .end((err, res) => {
                  let {results} = res.body

                  results.should.be.instanceOf(Array)
                  results.length.should.eql(1)
                  results[0].title.should.eql(payload.title)
                  results[0].leadImage._id.should.eql(mediaObject2._id)
                  results[0].leadImage.altText.should.eql(updatePayload.leadImage.altText)
                  results[0].leadImage.crop.should.eql(updatePayload.leadImage.crop)
                  should.not.exist(results[0].leadImage.caption)
                  results[0].leadImage.fileName.should.eql('flowers.jpg')

                  done(err)
                })
              })
            })
          })
        })
      })
    })
  })
})
