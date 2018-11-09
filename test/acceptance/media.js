const AWS = require('aws-sdk-mock')
const path = require('path')
const app = require(path.join(__dirname, '/../../dadi/lib/'))
const config = require(path.join(__dirname, '/../../config'))
const help = require(path.join(__dirname, '/help'))
const fs = require('fs')
const jwt = require('jsonwebtoken')
const MediaController = require(path.join(__dirname, '/../../dadi/lib/controller/media'))
const request = require('supertest')
const should = require('should')
const sinon = require('sinon')

// Bearer token with admin access
let bearerToken
let client = request(`http://${config.get('server.host')}:${config.get('server.port')}`)
let configBackup = config.get()

function signAndUpload (data, callback) {
  return client
  .post('/media/sign')
  .set('Authorization', `Bearer ${bearerToken}`)
  .set('content-type', 'application/json')
  .send(data)
  .end((err, res) => {
    return client
    .post(res.body.url)
    .set('content-type', 'application/json')
    .attach('avatar', 'test/acceptance/temp-workspace/media/1f525.png')
    .end((err, res) => {
      return callback(err, res)
    })
  })
}

describe('Media', function () {
  this.timeout(5000)

  describe('Path format', function () {
    it('should generate a folder hierarchy for a file with 4 character chunks', function (done) {
      config.set('media.pathFormat', 'sha1/4')
      let mediaController = new MediaController()
      mediaController.getPath('test.jpg').split('/')[0].length.should.eql(4)
      done()
    })

    it('should generate a folder hierarchy for a file with 5 character chunks', function (done) {
      config.set('media.pathFormat', 'sha1/5')
      let mediaController = new MediaController()
      mediaController.getPath('test.jpg').split('/')[0].length.should.eql(5)
      done()
    })

    it('should generate a folder hierarchy for a file with 8 character chunks', function (done) {
      config.set('media.pathFormat', 'sha1/8')
      let mediaController = new MediaController()
      mediaController.getPath('test.jpg').split('/')[0].length.should.eql(8)
      done()
    })

    it('should generate a folder hierarchy for a file using the current date', function (done) {
      config.set('media.pathFormat', 'date')
      let mediaController = new MediaController()
      mediaController.getPath('test.jpg').split('/').length.should.eql(3)
      done()
    })

    it('should generate a folder hierarchy for a file using the current datetime', function (done) {
      config.set('media.pathFormat', 'datetime')
      let mediaController = new MediaController()
      mediaController.getPath('test.jpg').split('/').length.should.eql(6)
      done()
    })

    it('should not generate a folder hierarchy for a file when not configured', function (done) {
      config.set('media.pathFormat', '')
      let mediaController = new MediaController()
      mediaController.getPath('test.jpg').should.eql('')
      done()
    })
  })

  describe('Default configuration', function () {
    beforeEach((done) => {
      app.start(() => {
        help.dropDatabase('testdb', null, (err) => {
          if (err) return done(err)

          help.getBearerTokenWithPermissions({
            accessType: 'admin'
          }, (err, token) => {
            if (err) return done(err)

            bearerToken = token

            done()
          })
        })
      })
    })

    afterEach((done) => {
      app.stop(() => {
        help.removeTestClients(done)
      })
    })

    describe('sign token', function () {
      let bearerToken

      beforeEach(done => {
        help.getBearerTokenWithPermissions({
          resources: {
            'media:mediaStore': {
              create: true,
              read: true
            }
          }
        }, (err, token) => {
          if (err) return done(err)

          bearerToken = token

          done()
        })
      })

      it('should return 401 if the request does not include a valid bearer token', done => {
        let obj = {
          fileName: 'test.jpg'
        }

        client
        .post('/media/sign')
        .set('content-type', 'application/json')
        .send(obj)
        .expect(200)
        .end((err, res) => {
          res.statusCode.should.eql(401)

          done()
        })
      })

      it('should return 403 if the request includes a bearer token with insufficient permissions', done => {
        help.getBearerTokenWithPermissions({
          resources: {
            'media:mediaStore': {
              read: true
            }
          }
        }, (err, token) => {
          if (err) return done(err)

          let obj = {
            fileName: 'test.jpg'
          }

          client
          .post('/media/sign')
          .set('Authorization', `Bearer ${token}`)
          .set('content-type', 'application/json')
          .send(obj)
          .expect(200)
          .end((err, res) => {
            res.statusCode.should.eql(403)

            done()
          })
        })
      })

      it('should accept a payload and return a signed url', function (done) {
        var obj = {
          fileName: 'test.jpg'
        }

        client
        .post('/media/sign')
        .set('Authorization', `Bearer ${bearerToken}`)
        .set('content-type', 'application/json')
        .send(obj)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          should.exist(res.body.url)
          var url = res.body.url.replace('/media/upload/', '')
          jwt.verify(url, config.get('media.tokenSecret'), (err, payload) => {
            payload.fileName.should.eql(obj.fileName)
            payload._createdBy.should.eql('test123')
            done()
          })
        })
      })

      it('should return 404 if incorrect HTTP method is used to get a signed token', function (done) {
        client
        .get('/media/sign')
        .set('Authorization', `Bearer ${bearerToken}`)
        .set('content-type', 'application/json')
        .expect(404)
        .end((err, res) => {
          if (err) return done(err)
          done()
        })
      })

      it('should return 400 if tokenExpiresIn configuration parameter is invalid', function (done) {
        config.set('media.tokenExpiresIn', 0.5)

        client
        .post('/media/sign')
        .set('Authorization', `Bearer ${bearerToken}`)
        .set('content-type', 'application/json')
        .expect(400)
        .end((err, res) => {
          if (err) return done(err)
          res.body.name.should.eql('ValidationError')
          config.set('media.tokenExpiresIn', '1h')
          done()
        })
      })

      it('should use override expiresIn value if specified', function (done) {
        var obj = {
          fileName: 'test.jpg',
          expiresIn: '60',
          _createdBy: 'test123'
        }

        var spy = sinon.spy(MediaController.MediaController.prototype, '_signToken')
        var expected = jwt.sign(obj, config.get('media.tokenSecret'), { expiresIn: '60' })

        client
        .post('/media/sign')
        .set('Authorization', `Bearer ${bearerToken}`)
        .set('content-type', 'application/json')
        .send(obj)
        .end((err, res) => {
          if (err) return done(err)
          MediaController.MediaController.prototype._signToken.restore()
          spy.firstCall.returnValue.should.eql(expected)
          done()
        })
      })
    })

    describe('POST', function () {
      describe('with signed URL', () => {
        it('should return an error if specified token has expired', function (done) {
          var obj = {
            fileName: '1f525.png'
          }

          sinon.stub(MediaController.MediaController.prototype, '_signToken').callsFake(function (obj) {
            return jwt.sign(obj, config.get('media.tokenSecret'), { expiresIn: 0 })
          })

          signAndUpload(obj, (err, res) => {
            MediaController.MediaController.prototype._signToken.restore()
            res.statusCode.should.eql(400)
            res.body.name.should.eql('TokenExpiredError')
            done()
          })
        })

        it('should return an error if posted filename does not match token payload', function (done) {
          var obj = {
            fileName: 'test.jpg'
          }

          signAndUpload(obj, (err, res) => {
            res.statusCode.should.eql(400)
            res.body.errors[0].includes('Unexpected filename').should.eql(true)
            done()
          })
        })

        it('should return an error if posted mimetype does not match token payload', function (done) {
          var obj = {
            fileName: '1f525.png',
            mimetype: 'image/jpeg'
          }

          signAndUpload(obj, (err, res) => {
            res.statusCode.should.eql(400)
            res.body.errors[0].includes('Unexpected MIME type').should.eql(true)
            done()
          })
        })

        it('should return an error when uploading multiple files', function (done) {
          client
          .post('/media/sign')
          .set('Authorization', `Bearer ${bearerToken}`)
          .set('content-type', 'application/json')
          .send({})
          .end((err, res) => {
            if (err) return (err)

            client
            .post(res.body.url)
            .set('content-type', 'application/json')
            .attach('avatar', 'test/acceptance/temp-workspace/media/1f525.png')
            .attach('avatar', 'test/acceptance/temp-workspace/media/flowers.jpg')
            .end((err, res) => {
              res.statusCode.should.eql(400)
              res.body.errors[0].should.eql('Multiple file upload with signed URLs not supported')

              done(err)
            })
          })
        })
      })

      describe('with access token', () => {
        it('should handle the upload of a single file', done => {
          client
          .post('/media/upload')
          .set('Authorization', `Bearer ${bearerToken}`)
          .set('content-type', 'application/json')
          .attach('file1', 'test/acceptance/temp-workspace/media/1f525.png')
          .end((err, res) => {
            res.body.results.length.should.eql(1)
            res.body.results[0].fileName.should.eql('1f525.png')
            res.body.results[0].mimeType.should.eql('image/png')

            done(err)
          })
        })

        it('should accept metadata properties alongside the file and add them to the created object', done => {
          let metadata = {
            caption: 'A thousand words'
          }

          client
          .post('/media/upload')
          .set('Authorization', `Bearer ${bearerToken}`)
          .set('content-type', 'application/json')
          .attach('file1', 'test/acceptance/temp-workspace/media/1f525.png')
          .field('meta', JSON.stringify(metadata))
          .end((err, res) => {
            res.body.results.length.should.eql(1)
            res.body.results[0].fileName.should.eql('1f525.png')
            res.body.results[0].mimeType.should.eql('image/png')
            res.body.results[0].caption.should.eql(metadata.caption)

            done(err)
          })
        })

        it('should handle the upload of multiple files', done => {
          let metadata = {
            caption: 'A thousand words'
          }

          client
          .post('/media/upload')
          .set('Authorization', `Bearer ${bearerToken}`)
          .set('content-type', 'application/json')
          .attach('file1', 'test/acceptance/temp-workspace/media/1f525.png')
          .attach('file2', 'test/acceptance/temp-workspace/media/flowers.jpg')
          .end((err, res) => {
            res.body.results.length.should.eql(2)
            res.body.results[0].fileName.should.eql('1f525.png')
            res.body.results[0].mimeType.should.eql('image/png')
            res.body.results[1].fileName.should.eql('flowers.jpg')
            res.body.results[1].mimeType.should.eql('image/jpeg')

            done(err)
          })
        })

        it('should accept metadata properties alongside the files and add them to all created objects', done => {
          let metadata = {
            caption: 'A thousand words'
          }

          client
          .post('/media/upload')
          .set('Authorization', `Bearer ${bearerToken}`)
          .set('content-type', 'application/json')
          .attach('file1', 'test/acceptance/temp-workspace/media/1f525.png')
          .attach('file2', 'test/acceptance/temp-workspace/media/flowers.jpg')
          .field('meta', JSON.stringify(metadata))
          .end((err, res) => {
            res.body.results.length.should.eql(2)
            res.body.results[0].fileName.should.eql('1f525.png')
            res.body.results[0].mimeType.should.eql('image/png')
            res.body.results[0].caption.should.eql(metadata.caption)
            res.body.results[1].fileName.should.eql('flowers.jpg')
            res.body.results[1].mimeType.should.eql('image/jpeg')
            res.body.results[1].caption.should.eql(metadata.caption)

            done(err)
          })
        })
      })

      it('should return 400 if the content type is not `multipart/form-data`', done => {
        let metadata = {
          caption: 'A thousand words'
        }

        client
        .post('/media/upload')
        .set('Authorization', `Bearer ${bearerToken}`)
        .set('content-type', 'application/json')
        .expect(400)
        .end((err, res) => {
          res.body.success.should.eql(false)
          res.body.errors[0].should.eql('Unexpected content type: application/json. Expected: multipart/form-data')

          done(err)
        })
      })
    })

    describe('PUT', function () {
      it('should update a document by ID', done => {
        let obj = {
          fileName: '1f525.png',
          mimetype: 'image/png'
        }

        signAndUpload(obj, (err, res) => {
          res.statusCode.should.eql(201)

          res.body.results.should.be.Array
          res.body.results.length.should.eql(1)

          res.body.results[0].fileName.should.eql(obj.fileName)
          res.body.results[0].mimeType.should.eql(obj.mimetype)
          res.body.results[0].width.should.eql(512)
          res.body.results[0].height.should.eql(512)

          let id = res.body.results[0]._id
          let metadataUpdate = {
            altText: 'A lovely flower',
            someNumericValue: 1337
          }

          client
          .put(`/media/${id}`)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .attach('avatar', 'test/acceptance/temp-workspace/media/flowers.jpg')
          .field('someUpdate', JSON.stringify(metadataUpdate))
          .end((err, res) => {
            res.body.results[0].fileName.should.eql('flowers.jpg')
            res.body.results[0].mimeType.should.eql('image/jpeg')
            res.body.results[0].width.should.eql(1600)
            res.body.results[0].height.should.eql(1086)

            client
            .get(`/media/${id}`)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .end((err, res) => {
              res.body.results[0].fileName.should.eql('flowers.jpg')
              res.body.results[0].mimeType.should.eql('image/jpeg')
              res.body.results[0].width.should.eql(1600)
              res.body.results[0].height.should.eql(1086)
              res.body.results[0].altText.should.eql(metadataUpdate.altText)
              res.body.results[0].someNumericValue.should.eql(metadataUpdate.someNumericValue)

              done(err)
            })
          })
        })
      })

      it('should accept application/json to update metadata on document by ID', done => {
        let obj = {
          fileName: '1f525.png',
          mimetype: 'image/png'
        }

        signAndUpload(obj, (err, res) => {
          res.statusCode.should.eql(201)

          res.body.results.should.be.Array
          res.body.results.length.should.eql(1)

          res.body.results[0].fileName.should.eql(obj.fileName)
          res.body.results[0].mimeType.should.eql(obj.mimetype)
          res.body.results[0].width.should.eql(512)
          res.body.results[0].height.should.eql(512)

          let id = res.body.results[0]._id
          let metadataUpdate = {
            altText: 'A lovely flower',
            someNumericValue: 1337
          }

          client
          .put(`/media/${id}`)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .send(metadataUpdate)
          .end((err, res) => {
            res.body.results[0].fileName.should.eql(obj.fileName)
            res.body.results[0].mimeType.should.eql(obj.mimetype)

            client
            .get(`/media/${id}`)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .end((err, res) => {
              res.body.results[0].fileName.should.eql(obj.fileName)
              res.body.results[0].mimeType.should.eql(obj.mimetype)
              res.body.results[0].altText.should.eql(metadataUpdate.altText)
              res.body.results[0].someNumericValue.should.eql(metadataUpdate.someNumericValue)

              done(err)
            })
          })
        })
      })

      it('should return a 400 when trying to update a reserved property', done => {
        let obj = {
          fileName: '1f525.png',
          mimetype: 'image/png'
        }

        signAndUpload(obj, (err, res) => {
          res.statusCode.should.eql(201)

          res.body.results.should.be.Array
          res.body.results.length.should.eql(1)

          res.body.results[0].fileName.should.eql(obj.fileName)
          res.body.results[0].mimeType.should.eql(obj.mimetype)
          res.body.results[0].width.should.eql(512)
          res.body.results[0].height.should.eql(512)

          let id = res.body.results[0]._id
          let metadataUpdate = {
            altText: 'A lovely flower',
            _createdBy: 'johnDoe'
          }

          client
          .put(`/media/${id}`)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .attach('avatar', 'test/acceptance/temp-workspace/media/flowers.jpg')
          .field('someUpdate', JSON.stringify(metadataUpdate))
          .expect(400)
          .end((err, res) => {
            if (err) return done(err)

            res.body.success.should.eql(false)
            res.body.errors[0].includes('Invalid update object').should.eql(true)

            client
            .get(`/media/${id}`)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .end((err, res) => {
              res.body.results[0].fileName.should.eql(obj.fileName)
              res.body.results[0].mimeType.should.eql(obj.mimetype)
              should.not.exist(res.body.results[0].altText)
              res.body.results[0]._createdBy.should.not.eql(metadataUpdate._createdBy)

              done(err)
            })
          })
        })
      })
    })

    describe('COUNT', function () {
      it('should return 401 if the request does not include a valid bearer token', done => {
        let obj = {
          fileName: '1f525.png',
          mimetype: 'image/png'
        }

        signAndUpload(obj, (err, res) => {
          should.exist(res.body.results)
          res.body.results.should.be.Array
          res.body.results.length.should.eql(1)
          res.body.results[0].fileName.should.eql('1f525.png')

          client
            .get('/media/count')
            .set('content-type', 'application/json')
            .expect(200)
            .end((err, res) => {
              res.statusCode.should.eql(401)

              done()
            })
        })
      })

      it('should return 403 if the request includes a bearer token with insufficient permissions', done => {
        help.getBearerTokenWithPermissions({
          resources: {
            'media:mediaStore': {
              create: true
            }
          }
        }, (err, token) => {
          if (err) return done(err)

          let obj = {
            fileName: '1f525.png',
            mimetype: 'image/png'
          }

          signAndUpload(obj, (err, res) => {
            should.exist(res.body.results)
            res.body.results.should.be.Array
            res.body.results.length.should.eql(1)
            res.body.results[0].fileName.should.eql('1f525.png')

            client
              .get('/media/count')
              .set('Authorization', `Bearer ${token}`)
              .set('content-type', 'application/json')
              .expect(200)
              .end((err, res) => {
                res.statusCode.should.eql(403)

                done()
              })
          })
        })
      })

      it('should return count of uploaded media', function (done) {
        let obj = {
          fileName: '1f525.png',
          mimetype: 'image/png'
        }

        signAndUpload(obj, (err, res) => {
          should.exist(res.body.results)
          res.body.results.should.be.Array
          res.body.results.length.should.eql(1)
          res.body.results[0].fileName.should.eql('1f525.png')

          client
            .get('/media/count')
            .set('Authorization', `Bearer ${bearerToken}`)
            .set('content-type', 'application/json')
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              should.exist(res.body.metadata)
              res.body.metadata.totalCount.should.eql(1)
              done()
            })
        })
      })
    })

    describe('GET', function () {
      describe('Default bucket', function () {
        let bearerToken

        beforeEach(done => {
          help.getBearerTokenWithPermissions({
            resources: {
              'collection:library_person': {
                create: true,
                read: true
              },
              'media:mediaStore': {
                read: true
              }
            }
          }, (err, token) => {
            if (err) return done(err)

            bearerToken = token

            done()
          })
        })

        it('should return 401 if the request does not include a valid bearer token', done => {
          client
          .get('/media')
          .set('content-type', 'application/json')
          .expect(200)
          .end((err, res) => {
            res.statusCode.should.eql(401)

            done()
          })
        })

        it('should return 403 if the request includes a bearer token with insufficient permissions', done => {
          help.getBearerTokenWithPermissions({
            resources: {
              'media:mediaStore': {
                read: false
              }
            }
          }, (err, token) => {
            if (err) return done(err)

            client
            .get('/media')
            .set('Authorization', `Bearer ${token}`)
            .set('content-type', 'application/json')
            .expect(200)
            .end((err, res) => {
              res.statusCode.should.eql(403)

              done()
            })
          })
        })

        it('should return an empty result set if no media has been created', function (done) {
          client
          .get('/media')
          .set('Authorization', `Bearer ${bearerToken}`)
          .set('content-type', 'application/json')
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            should.exist(res.body.results)
            res.body.results.should.be.Array
            res.body.results.length.should.eql(0)
            done()
          })
        })

        it('should return results of uploaded media', function (done) {
          var obj = {
            fileName: '1f525.png',
            mimetype: 'image/png'
          }

          signAndUpload(obj, (err, res) => {
            should.exist(res.body.results)
            res.body.results.should.be.Array
            res.body.results.length.should.eql(1)
            res.body.results[0].fileName.should.eql('1f525.png')

            client
            .get('/media')
            .set('Authorization', `Bearer ${bearerToken}`)
            .set('content-type', 'application/json')
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              should.exist(res.body.results)
              res.body.results.should.be.Array
              res.body.results.length.should.eql(1)
              res.body.results[0].fileName.should.eql('1f525.png')
              res.body.results[0].url.indexOf('somedomain').should.be.above(0)
              done()
            })
          })
        })

        it('should format Reference fields containing media documents', function (done) {
          var obj = {
            fileName: '1f525.png',
            mimetype: 'image/png'
          }

          signAndUpload(obj, (err, res) => {
            if (err) return done(err)

            client
            .post('/v1/library/person')
            .set('Authorization', `Bearer ${bearerToken}`)
            .send({
              name: 'John Doe',
              picture: res.body.results[0]._id
            })
            .end((err, res) => {
              should.exist(res.body.results)
              res.body.results.should.be.Array
              res.body.results.length.should.eql(1)
              res.body.results[0].picture.fileName.should.eql('1f525.png')
              res.body.results[0].picture.url.indexOf('api.somedomain.tech').should.be.above(0)

              client
              .get(`/v1/library/person/${res.body.results[0]._id}?compose=true`)
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                should.exist(res.body.results)
                res.body.results.should.be.Array
                res.body.results.length.should.eql(1)
                res.body.results[0].picture.fileName.should.eql('1f525.png')
                res.body.results[0].picture.url.indexOf('api.somedomain.tech').should.be.above(0)

                done()
              })
            })
          })
        })

        it('should allow standard filtering on media collection', function (done) {
          var obj = {
            fileName: '1f525.png',
            mimetype: 'image/png'
          }

          signAndUpload(obj, (err, res) => {
            if (err) return done(err)

            client
            .get(`/media/?filter={"fileName":"1f525.png"}`)
            .set('Authorization', `Bearer ${bearerToken}`)
            .end((err, res) => {
              should.exist(res.body.results)
              res.body.results.should.be.Array
              res.body.results.length.should.eql(1)
              res.body.results[0].fileName.should.eql('1f525.png')

              done()
            })
          })
        })

        it('should allow limiting fields returned', function (done) {
          var obj = {
            fileName: '1f525.png',
            mimetype: 'image/png'
          }

          signAndUpload(obj, (err, res) => {
            if (err) return done(err)

            client
            .get(`/media/?filter={"fileName":"1f525.png"}&fields={"fileName":1}`)
            .set('Authorization', `Bearer ${bearerToken}`)
            .end((err, res) => {
              should.exist(res.body.results)
              res.body.results.should.be.Array
              res.body.results.length.should.eql(1)
              res.body.results[0].fileName.should.eql('1f525.png')

              done()
            })
          })
        })
      })

      describe('Named bucket', function () {
        let bearerToken
        let defaultBucket = config.get('media.defaultBucket')

        beforeEach(done => {
          help.getBearerTokenWithPermissions({
            resources: {
              'collection:library_person': {
                create: true,
                read: true
              },
              [`media:${defaultBucket}`]: {
                create: true,
                read: true
              }
            }
          }, (err, token) => {
            if (err) return done(err)

            bearerToken = token

            done()
          })
        })

        it('should return 401 if the request does not include a valid bearer token', done => {
          client
          .get(`/media/${defaultBucket}`)
          .set('content-type', 'application/json')
          .expect(200)
          .end((err, res) => {
            res.statusCode.should.eql(401)

            done()
          })
        })

        it('should return 403 if the request includes a bearer token with insufficient permissions', done => {
          help.getBearerTokenWithPermissions({
            resources: {
              [`media:${defaultBucket}`]: {
                read: false
              }
            }
          }, (err, token) => {
            if (err) return done(err)

            client
            .get(`/media/${defaultBucket}`)
            .set('Authorization', `Bearer ${token}`)
            .set('content-type', 'application/json')
            .expect(200)
            .end((err, res) => {
              res.statusCode.should.eql(403)

              done()
            })
          })
        })

        it('should return an empty result set if no media has been created', function (done) {
          client
          .get(`/media/${defaultBucket}`)
          .set('Authorization', `Bearer ${bearerToken}`)
          .set('content-type', 'application/json')
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            should.exist(res.body.results)
            res.body.results.should.be.Array
            res.body.results.length.should.eql(0)
            done()
          })
        })

        it('should return results of uploaded media', function (done) {
          var obj = {
            fileName: '1f525.png',
            mimetype: 'image/png'
          }

          client
          .post(`/media/${defaultBucket}/sign`)
          .set('Authorization', `Bearer ${bearerToken}`)
          .set('content-type', 'application/json')
          .send(obj)
          .end((err, res) => {
            if (err) return done(err)

            var url = res.body.url

            client
            .post(url)
            .set('content-type', 'application/json')
            .attach('avatar', 'test/acceptance/temp-workspace/media/1f525.png')
            .end((err, res) => {
              if (err) return done(err)

              should.exist(res.body.results)
              res.body.results.should.be.Array
              res.body.results.length.should.eql(1)
              res.body.results[0].fileName.should.eql('1f525.png')

              client
              .get(`/media/${defaultBucket}`)
              .set('Authorization', `Bearer ${bearerToken}`)
              .set('content-type', 'application/json')
              .expect(200)
              .end((err, res) => {
                if (err) return done(err)

                should.exist(res.body.results)
                res.body.results.should.be.Array
                res.body.results.length.should.eql(1)
                res.body.results[0].fileName.should.eql('1f525.png')
                res.body.results[0].url.indexOf('somedomain').should.be.above(0)
                done()
              })
            })
          })
        })
      })

      it('should list media buckets in /api/collections endpoint', function (done) {
        let additionalBuckets = ['bucketOne', 'bucketTwo']
        let defaultBucket = config.get('media.defaultBucket')
        let allBuckets = additionalBuckets.concat(defaultBucket)

        let originalBuckets = config.get('media.buckets')

        config.set('media.buckets', additionalBuckets)

        client
        .get('/api/collections')
        .set('Authorization', `Bearer ${bearerToken}`)
        .set('content-type', 'application/json')
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          should.exist(res.body.media)

          res.body.media.defaultBucket.should.be.String
          res.body.media.defaultBucket.should.eql(defaultBucket)

          res.body.media.buckets.should.be.Array
          res.body.media.buckets.length.should.eql(allBuckets.length)
          res.body.media.buckets.forEach(bucket => {
            allBuckets.indexOf(bucket).should.not.eql(-1)
          })

          // Restore original list of buckets
          config.set('media.buckets', originalBuckets)

          done()
        })
      })
    })

    describe('DELETE', function () {
      let deleteBearerToken

      beforeEach(done => {
        help.getBearerTokenWithPermissions({
          resources: {
            'media:mediaStore': {
              delete: true,
              read: true
            }
          }
        }, (err, token) => {
          if (err) return done(err)

          deleteBearerToken = token

          done()
        })
      })

      it('should return 401 if the request does not include a valid bearer token', done => {
        let obj = {
          fileName: '1f525.png',
          mimetype: 'image/png'
        }

        signAndUpload(obj, (err, res) => {
          should.exist(res.body.results)
          res.body.results.should.be.Array
          res.body.results.length.should.eql(1)
          res.body.results[0].fileName.should.eql('1f525.png')

          client
          .delete('/media/' + res.body.results[0]._id)
          .set('content-type', 'application/json')
          .end((err, res) => {
            res.statusCode.should.eql(401)

            done()
          })
        })
      })

      it('should return 403 if the request includes a bearer token with insufficient permissions', done => {
        let obj = {
          fileName: '1f525.png',
          mimetype: 'image/png'
        }

        help.getBearerTokenWithPermissions({
          resources: {
            'media:mediaStore': {
              read: true
            }
          }
        }, (err, token) => {
          if (err) return done(err)

          signAndUpload(obj, (err, res) => {
            should.exist(res.body.results)
            res.body.results.should.be.Array
            res.body.results.length.should.eql(1)
            res.body.results[0].fileName.should.eql('1f525.png')

            client
            .delete('/media/' + res.body.results[0]._id)
            .set('Authorization', `Bearer ${token}`)
            .set('content-type', 'application/json')
            .end((err, res) => {
              res.statusCode.should.eql(403)

              done()
            })
          })
        })
      })

      it('should allow deleting media by ID', function (done) {
        var obj = {
          fileName: '1f525.png',
          mimetype: 'image/png'
        }

        config.set('feedback', true)

        signAndUpload(obj, (err, res) => {
          should.exist(res.body.results)
          res.body.results.should.be.Array
          res.body.results.length.should.eql(1)
          res.body.results[0].fileName.should.eql('1f525.png')

          client
          .delete('/media/' + res.body.results[0]._id)
          .set('Authorization', `Bearer ${deleteBearerToken}`)
          .set('content-type', 'application/json')
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            res.body.success.should.eql(true)
            res.body.deleted.should.eql(1)
            done()
          })
        })
      })

      it('should allow deleting media by query', function (done) {
        config.set('feedback', true)

        let objects = [
          {
            fileName: '1f525.png',
            mimeType: 'image/png'
          },
          {
            fileName: 'flowers.jpg',
            mimeType: 'image/jpeg'
          }
        ]

        client
        .post('/media/upload')
        .set('Authorization', `Bearer ${bearerToken}`)
        .set('content-type', 'application/json')
        .attach('file1', 'test/acceptance/temp-workspace/media/1f525.png')
        .attach('file2', 'test/acceptance/temp-workspace/media/flowers.jpg')
        .end((err, res) => {
          res.body.results.length.should.eql(2)
          res.body.results[0].fileName.should.eql('1f525.png')
          res.body.results[0].mimeType.should.eql('image/png')
          res.body.results[1].fileName.should.eql('flowers.jpg')
          res.body.results[1].mimeType.should.eql('image/jpeg')

          client
          .delete('/media')
          .send({
            query: {
              mimeType: {
                $in: ['image/jpeg', 'image/png']
              }
            }
          })
          .set('Authorization', `Bearer ${deleteBearerToken}`)
          .set('content-type', 'application/json')
          .expect(200)
          .end((err, res) => {
            console.log(res.body)
            res.body.success.should.eql(true)
            res.body.deleted.should.eql(2)

            client
            .get('/media')
            .set('Authorization', `Bearer ${bearerToken}`)
            .set('content-type', 'application/json')
            .expect(200)
            .end((err, res) => {
              res.body.results.length.should.eql(0)

              done(err)
            })
          })
        })
      })

      it('should return 204 when deleting media and feedback == false', function (done) {
        var obj = {
          fileName: '1f525.png',
          mimetype: 'image/png'
        }

        config.set('feedback', false)

        signAndUpload(obj, (err, res) => {
          should.exist(res.body.results)
          res.body.results.should.be.Array
          res.body.results.length.should.eql(1)
          res.body.results[0].fileName.should.eql('1f525.png')

          client
          .delete('/media/' + res.body.results[0]._id)
          .set('Authorization', `Bearer ${bearerToken}`)
          .set('content-type', 'application/json')
          .expect(204)
          .end((err, res) => {
            if (err) return done(err)
            res.body.should.eql({})
            done()
          })
        })
      })
    })

    describe('Disk Storage', () => {
      let bearerToken
      let defaultBucket = config.get('media.defaultBucket')

      beforeEach(done => {
        config.set('media.storage', 'disk')

        help.getBearerTokenWithPermissions({
          resources: {
            'collection:library_person': {
              create: true,
              read: true
            },
            [`media:${defaultBucket}`]: {
              create: true,
              read: true
            }
          }
        }, (err, token) => {
          if (err) return done(err)

          bearerToken = token

          done()
        })
      })

      afterEach(() => {
        config.set('media.storage', configBackup.media.storage)
      })

      describe('GET', function () {
        it('should return 404 when image is not found', function (done) {
          client
          .get('/media/mock/logo.png')
          .set('Authorization', `Bearer ${bearerToken}`)
          .end((err, res) => {
            res.statusCode.should.eql(404)
            done()
          })
        })

        it('should return 200 when image is returned', function (done) {
          var obj = {
            fileName: '1f525.png',
            mimetype: 'image/png'
          }

          let defaultBucket = config.get('media.defaultBucket')

          client
          .post(`/media/${defaultBucket}/sign`)
          .set('Authorization', `Bearer ${bearerToken}`)
          .set('content-type', 'application/json')
          .send(obj)
          .end((err, res) => {
            if (err) return done(err)

            var url = res.body.url

            client
            .post(url)
            .set('content-type', 'application/json')
            .attach('avatar', 'test/acceptance/temp-workspace/media/1f525.png')
            .end((err, res) => {
              if (err) return done(err)

              should.exist(res.body.results)
              res.body.results.should.be.Array
              res.body.results.length.should.eql(1)
              res.body.results[0].fileName.should.eql('1f525.png')

              client
              .get(res.body.results[0].path)
              .set('Authorization', `Bearer ${bearerToken}`)
              .end((err, res) => {
                if (err) return done(err)

                res.body.should.be.instanceof(Buffer)
                res.headers['content-type'].should.eql('image/png')
                res.statusCode.should.eql(200)

                done()
              })
            })
          })
        })
      })
    })

    describe('S3 Storage', () => {
      beforeEach(() => {
        config.set('media.storage', 's3')
      })

      afterEach(() => {
        config.set('media.storage', configBackup.media.storage)
        config.set('media.s3.bucketName', configBackup.media.s3.bucketName)
        config.set('media.s3.accessKey', configBackup.media.s3.accessKey)
        config.set('media.s3.secretKey', configBackup.media.s3.secretKey)
      })

      describe('GET', function () {
        it('should return 200 when image is returned', function (done) {
          // return a buffer from the S3 request
          let stream = fs.createReadStream('./test/acceptance/temp-workspace/media/1f525.png')
          let buffers = []

          stream
          .on('data', function (data) { buffers.push(data) })
          .on('end', function () {
            let buffer = Buffer.concat(buffers)

            AWS.mock('S3', 'getObject', Promise.resolve({
              LastModified: Date.now(),
              Body: buffer
            }))

            config.set('media.s3.bucketName', 'test-bucket')
            config.set('media.s3.accessKey', 'xxx')
            config.set('media.s3.secretKey', 'xyz')
            config.set('media.s3.region', 'eu-west-1')

            client
            .get('/media/mock/logo.png')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect(200)
            .end((err, res) => {
              AWS.restore()

              // res.text.should.be.instanceof(Buffer)
              // res.headers['content-type'].should.eql('image/png')
              res.statusCode.should.eql(200)

              done()
            })
          })
        })

        it('should return 400 when no bucket is defined', function (done) {
          config.set('media.s3.bucketName', '')
          config.set('media.s3.accessKey', 'xxx')
          config.set('media.s3.secretKey', 'xyz')

          client
        .get('/media/mock/logo.png')
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(400)
        .end(done)
        })
      })

      describe('DELETE', function () {
        beforeEach(done => {
          help.getBearerTokenWithPermissions({
            resources: {
              'media:mediaStore': {
                create: true,
                read: true,
                delete: true
              }
            }
          }, (err, token) => {
            if (err) return done(err)

            bearerToken = token

            done()
          })
        })

        it('should return 400 when no bucket is defined', function (done) {
          var obj = {
            fileName: '1f525.png',
            mimetype: 'image/png'
          }

          AWS.mock('S3', 'putObject', Promise.resolve({
            path: obj.filename,
            contentLength: 100,
            awsUrl: `https://s3.amazonaws.com/${obj.filename}`
          }))

          config.set('media.s3.bucketName', 'test-bucket')
          config.set('media.s3.accessKey', 'xxx')
          config.set('media.s3.secretKey', 'xyz')

          signAndUpload(obj, (err, res) => {
            should.exist(res.body.results)
            res.body.results.should.be.Array
            res.body.results.length.should.eql(1)
            res.body.results[0].fileName.should.eql('1f525.png')

            config.set('media.s3.bucketName', '')
            config.set('media.s3.accessKey', 'xxx')
            config.set('media.s3.secretKey', 'xyz')

            client
            .delete('/media/' + res.body.results[0]._id)
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect(400)
            .end(done)
          })
        })
      })

      describe('PUT', function () {
        beforeEach(done => {
          help.getBearerTokenWithPermissions({
            resources: {
              'media:mediaStore': {
                create: true,
                read: true,
                delete: true,
                update: true
              }
            }
          }, (err, token) => {
            if (err) return done(err)

            bearerToken = token

            done()
          })
        })

        it('should return 400 when no bucket is defined', function (done) {
          var obj = {
            fileName: '1f525.png',
            mimetype: 'image/png'
          }

          AWS.mock('S3', 'putObject', Promise.resolve({
            path: obj.filename,
            contentLength: 100,
            awsUrl: `https://s3.amazonaws.com/${obj.filename}`
          }))

          config.set('media.s3.bucketName', 'test-bucket')
          config.set('media.s3.accessKey', 'xxx')
          config.set('media.s3.secretKey', 'xyz')

          signAndUpload(obj, (err, res) => {
            should.exist(res.body.results)
            res.body.results.should.be.Array
            res.body.results.length.should.eql(1)
            res.body.results[0].fileName.should.eql('1f525.png')

            config.set('media.s3.bucketName', '')
            config.set('media.s3.accessKey', 'xxx')
            config.set('media.s3.secretKey', 'xyz')

            client
            .put('/media/' + res.body.results[0]._id)
            .set('Authorization', `Bearer ${bearerToken}`)
            .attach('avatar', 'test/acceptance/temp-workspace/media/1f525.png')
            .expect(400)
            .end(done)
          })
        })
      })
    })
  })
})
