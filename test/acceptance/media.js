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
  let client = request(connectionString)
  return client
  .post('/media/sign')
  .set('Authorization', `Bearer ${bearerToken}`)
  .set('content-type', 'application/json')
  .send(data)
  .end((err, res) => {
    return client
    .post(res.body.url)
    .set('content-type', 'application/json')
    .attach('avatar', 'test/acceptance/workspace/media/1f525.png')
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
          res.body.results[0].mimetype.should.eql(obj.mimetype)
          res.body.results[0].width.should.eql(512)
          res.body.results[0].height.should.eql(512)

          let id = res.body.results[0]._id

          client
          .put(`/media/${id}`)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .attach('avatar', 'test/acceptance/workspace/media/flowers.jpg')
          .end((err, res) => {
            res.body.results[0].fileName.should.eql('flowers.jpg')
            res.body.results[0].mimetype.should.eql('image/jpeg')
            res.body.results[0].width.should.eql(1600)
            res.body.results[0].height.should.eql(1086)

            client
            .get(`/media/${id}`)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .end((err, res) => {
              res.body.results[0].fileName.should.eql('flowers.jpg')
              res.body.results[0].mimetype.should.eql('image/jpeg')
              res.body.results[0].width.should.eql(1600)
              res.body.results[0].height.should.eql(1086)

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

          var client = request(connectionString)

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

          var client = request(connectionString)

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
            .attach('avatar', 'test/acceptance/workspace/media/1f525.png')
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
      let bearerToken

      beforeEach(done => {
        help.getBearerTokenWithPermissions({
          resources: {
            'media:mediaStore': {
              delete: true
            }
          }
        }, (err, token) => {
          if (err) return done(err)

        var client = request(connectionString)

        config.set('feedback', true)
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
            res.body.deleted.should.eql(1)
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
        var client = request(connectionString)

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
          .set('Authorization', `Bearer ${bearerToken}`)
          .set('content-type', 'application/json')
        .expect(404)
        .end(done)
            if (err) return done(err)
            res.body.success.should.eql(true)
            res.body.deleted.should.eql(1)
            done()
          })
        })
      })

      it('should return 204 when deleting media and feedback == false', function (done) {
        var obj = {
          fileName: '1f525.png',
          mimetype: 'image/png'
        }

        var client = request(connectionString)

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

      it('should return 200 when image is returned', function (done) {
        // return a buffer from the S3 request
        let stream = fs.createReadStream('./test/acceptance/workspace/media/1f525.png')
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

            let client = request(connectionString)
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
    })
  })

  describe('Standard collection media', function () {
    beforeEach((done) => {
      app.start(() => {
        help.dropDatabase('testdb', null, (err) => {
          if (err) return done(err)

          help.getBearerTokenWithAccessType('admin', (err, token) => {
            if (err) return done(err)
            bearerToken = token

            // mimic a file that could be sent to the server
            var mediaSchema = fs.readFileSync(__dirname + '/../media-schema.json', {encoding: 'utf8'})
            request(connectionString)
            .post('/1.0/testdb/media/config')
            .send(mediaSchema)
            .set('content-type', 'text/plain')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .expect('content-type', 'application/json')
            .end(function (err, res) {
              if (err) return done(err)

              mediaSchema = JSON.parse(mediaSchema)
              mediaSchema.settings.signUploads = true
              mediaSchema = JSON.stringify(mediaSchema, null, 2)

              request(connectionString)
              .post('/1.0/testdb/media2/config')
              .send(mediaSchema)
              .set('content-type', 'text/plain')
              .set('Authorization', 'Bearer ' + bearerToken)
              .expect(200)
              .expect('content-type', 'application/json')
              .end(function (err, res) {
                if (err) return done(err)

                setTimeout(function () {
                  done()
                }, 550)
              })
            })
          })
        })
      })
    })

    afterEach((done) => {
      app.stop(() => {
        help.removeTestClients(() => {
          var dirs = config.get('paths')

          try {
            fs.unlinkSync(dirs.collections + '/1.0/testdb/collection.media.json')
            fs.unlinkSync(dirs.collections + '/1.0/testdb/collection.media2.json')
            return done()
          } catch (e) {}

          return done()
        })
      })
    })

    describe('sign token', function () {
      it('should accept a payload and return a signed url', function (done) {
        var obj = {
          fileName: 'test.jpg'
        }

        var client = request(connectionString)

        client
        .post('/1.0/testdb/media/sign')
        .set('Authorization', 'Bearer ' + bearerToken)
        .set('content-type', 'application/json')
        .send(obj)
        // .expect(200)
        .end((err, res) => {
          if (err) return done(err)
          should.exist(res.body.url)
          var url = res.body.url.replace('/1.0/testdb/media/', '')
          jwt.verify(url, config.get('media.tokenSecret'), (err, payload) => {
            payload.fileName.should.eql(obj.fileName)
            done()
          })
        })
      })

      it('should return 404 if incorrect HTTP method is used to get a signed token', function (done) {
        var client = request(connectionString)

        client
        .get('/1.0/testdb/media/sign')
        .set('Authorization', 'Bearer ' + bearerToken)
        .set('content-type', 'application/json')
        .expect(404)
        .end((err, res) => {
          if (err) return done(err)
          done()
        })
      })

      it('should return 400 if tokenExpiresIn configuration parameter is invalid', function (done) {
        config.set('media.tokenExpiresIn', 0.5)
        var client = request(connectionString)

        client
        .post('/1.0/testdb/media/sign')
        .set('Authorization', 'Bearer ' + bearerToken)
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
          expiresIn: '60'
        }

        var spy = sinon.spy(app, '_signToken')

        var expected = jwt.sign(obj, config.get('media.tokenSecret'), { expiresIn: '60' })

        var client = request(connectionString)

        client
        .post('/1.0/testdb/media/sign')
        .set('Authorization', 'Bearer ' + bearerToken)
        .set('content-type', 'application/json')
        .send(obj)
        .end((err, res) => {
          if (err) return done(err)
          app._signToken.restore()
          spy.firstCall.returnValue.should.eql(expected)
          done()
        })
      })
    })

    describe('POST', function () {
      // it('should allow upload without using a signed token', function (done) {
      //   var client = request(connectionString)
      //   client
      //   .post('/1.0/testdb/media')
      //   .set('Authorization', 'Bearer ' + bearerToken)
      //   .attach('avatar', 'test/acceptance/workspace/media/1f525.png')
      //   .expect(201)
      //   .end((err, res) => {
      //     if (err) return done(err)
      //     should.exist(res.body.results)
      //     done()
      //   })
      // })
      //
      // it('should error if upload attempted without using a signed token', function (done) {
      //   var client = request(connectionString)
      //   client
      //   .post('/1.0/testdb/media2')
      //   .set('Authorization', 'Bearer ' + bearerToken)
      //   .attach('avatar', 'test/acceptance/workspace/media/1f525.png')
      //   .expect(400)
      //   .end(done)
      // })

      it('should return an error if specified token has expired', function (done) {
        var obj = {
          fileName: 'test.jpg'
        }

        sinon.stub(app, '_signToken').callsFake(function (obj) {
          return jwt.sign(obj, config.get('media.tokenSecret'), { expiresIn: 1 })
        })

        var client = request(connectionString)

        client
        .post('/1.0/testdb/media/sign')
        .set('Authorization', 'Bearer ' + bearerToken)
        .set('content-type', 'application/json')
        .send(obj)
        .end((err, res) => {
          if (err) return done(err)

          app._signToken.restore()
          var url = res.body.url

          setTimeout(function () {
            client
            .post(url)
            .set('content-type', 'application/json')
            .send(obj)
            .expect(400)
            .end((err, res) => {
              if (err) return done(err)
              res.body.name.should.eql('TokenExpiredError')
              done()
            })
          }, 1500)
        })
      })

      it('should return an error if posted filename does not match token payload', function (done) {
        var obj = {
          fileName: 'test.jpg'
        }

        var client = request(connectionString)

        client
        .post('/1.0/testdb/media/sign')
        .set('Authorization', 'Bearer ' + bearerToken)
        .set('content-type', 'application/json')
        .send(obj)
        .end((err, res) => {
          if (err) return done(err)

          var url = res.body.url

          client
          .post(url)
          .set('content-type', 'application/json')
          .attach('avatar', 'test/acceptance/workspace/media/1f525.png')
          .expect(400)
          .end((err, res) => {
            if (err) return done(err)

            res.body.name.should.eql('Unexpected filename')
            done()
          })
        })
      })

      it('should return an error if posted mimetype does not match token payload', function (done) {
        var obj = {
          fileName: '1f525.png',
          mimetype: 'image/jpeg'
        }

        var client = request(connectionString)

              done()
            })
          })
      })
    })
  })
})
