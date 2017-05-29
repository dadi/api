var _ = require('underscore')
var app = require(__dirname + '/../../dadi/lib/')
var config = require(__dirname + '/../../config')
var help = require(__dirname + '/help')
var fs = require('fs')
var jwt = require('jsonwebtoken')
var MediaController = require(__dirname + '/../../dadi/lib/controller/media')
var path = require('path')
var request = require('supertest')
var should = require('should')
var sinon = require('sinon')

// variables scoped for use throughout tests
var bearerToken
var connectionString = 'http://' + config.get('server.host') + ':' + config.get('server.port')

describe('Media', function () {
  this.timeout(5000)

  describe('Default configuration', function () {
    beforeEach((done) => {
      app.start(() => {
        help.dropDatabase('testdb', (err) => {
          if (err) return done(err)

          help.getBearerTokenWithAccessType('admin', (err, token) => {
            if (err) return done(err)
            bearerToken = token
            done()
          })
        })
      })
    })

    afterEach((done) => {
      app.stop(() => {
        help.removeTestClients(() => {
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
        .post('/media/sign')
        .set('Authorization', 'Bearer ' + bearerToken)
        .set('content-type', 'application/json')
        .send(obj)
        //.expect(200)
        .end((err, res) => {
          if (err) return done(err)
          should.exist(res.body.url)
          var url = res.body.url.replace('/media/', '')
          jwt.verify(url, config.get('media.tokenSecret'), (err, payload) => {
            payload.fileName.should.eql(obj.fileName)
            done()
          })
        })
      })

      it.skip('should return 404 if media is not enabled', function (done) {
        var obj = {
          fileName: 'test.jpg'
        }

        var client = request(connectionString)

        client
        .post('/media/sign')
        .set('Authorization', 'Bearer ' + bearerToken)
        .set('content-type', 'application/json')
        .send(obj)
        .expect(404)
        .end((err, res) => {
          if (err) return done(err)
          done()
        })
      })

      it('should return 404 if incorrect HTTP method is used to get a signed token', function (done) {
        var client = request(connectionString)

        client
        .get('/media/sign')
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
        .post('/media/sign')
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
        .post('/media/sign')
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
      it.skip('should not allow upload without using a signed token', function (done) {
        var client = request(connectionString)
        client
        .post('/media')
        .set('Authorization', 'Bearer ' + bearerToken)
        .attach('avatar', 'test/acceptance/workspace/media/1f525.png')
        .expect(404)
        .end(done)
      })

      it('should return an error if specified token has expired', function (done) {
        var obj = {
          fileName: 'test.jpg'
        }

        sinon.stub(app, '_signToken').callsFake(function (obj) {
          return jwt.sign(obj, config.get('media.tokenSecret'), { expiresIn: 1 })
        })

        var client = request(connectionString)

        client
        .post('/media/sign')
        .set('Authorization', 'Bearer ' + bearerToken)
        .set('content-type', 'application/json')
        .send(obj)
        .end((err, res) => {
          if (err) return done(err)

          app._signToken.restore()
          var url = res.body.url

          setTimeout(function() {
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
        .post('/media/sign')
        .set('Authorization', 'Bearer ' + bearerToken)
        .set('content-type', 'application/json')
        .send(obj)
        .end((err, res) => {
          if (err) return done(err)

          var url = res.body.url

          client
          .post(url)
          //.set('content-type', 'application/json')
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

        client
        .post('/media/sign')
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

            res.body.name.should.eql('Unexpected mimetype')
            done()
          })
        })
      })
    })

    describe('GET', function () {
      describe('Default bucket', function () {
        it('should return an empty result set if no media has been created', function (done) {
          var client = request(connectionString)

          client
          .get('/media')
          .set('Authorization', 'Bearer ' + bearerToken)
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

          var client = request(connectionString)

          client
          .post('/media/sign')
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
            .end((err, res) => {
              if (err) return done(err)

              should.exist(res.body.results)
              res.body.results.should.be.Array
              res.body.results.length.should.eql(1)
              res.body.results[0].fileName.should.eql('1f525.png')

              client
              .get('/media')
              .set('Authorization', 'Bearer ' + bearerToken)
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

      describe('Named bucket', function () {
        it('should return an empty result set if no media has been created', function (done) {
          var defaultBucket = config.get('media.defaultBucket')
          var client = request(connectionString)
          client
          .get(`/media/${defaultBucket}`)
          .set('Authorization', 'Bearer ' + bearerToken)
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
          var defaultBucket = config.get('media.defaultBucket')

          var obj = {
            fileName: '1f525.png',
            mimetype: 'image/png'
          }

          var client = request(connectionString)

          client
          .post(`/media/${defaultBucket}/sign`)
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
            .end((err, res) => {
              if (err) return done(err)

              should.exist(res.body.results)
              res.body.results.should.be.Array
              res.body.results.length.should.eql(1)
              res.body.results[0].fileName.should.eql('1f525.png')

              client
              .get(`/media/${defaultBucket}`)
              .set('Authorization', 'Bearer ' + bearerToken)
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
    })
  })

  describe('Standard collection media', function () {
    beforeEach((done) => {
      app.start(() => {
        help.dropDatabase('testdb', (err) => {
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

                setTimeout(function() {
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
        //.expect(200)
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

          setTimeout(function() {
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

            res.body.name.should.eql('Unexpected mimetype')
            done()
          })
        })
      })
    })

    describe('PUT', function () {
      it('should allow upload without using a signed token', function (done) {
        var client = request(connectionString)
        client
        .post('/1.0/testdb/media')
        .set('Authorization', 'Bearer ' + bearerToken)
        .attach('avatar', 'test/acceptance/workspace/media/1f525.png')
        .expect(201)
        .end((err, res) => {
          if (err) return done(err)
          should.exist(res.body.results)

          var doc = res.body.results[0]
          var body = {
            query: { _id: doc._id },
            update: {
              fileName: 'test.jpg'
            }
          }

          client
          .put('/1.0/testdb/media/')
          .set('Authorization', 'Bearer ' + bearerToken)
          .set('Content-Type', 'application/json')
          .send(body)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            should.exist(res.body.results)
            done()
          })
        })
      })
    })

    describe('GET', function () {
      it('should return an empty result set if no media has been created', function (done) {
        var client = request(connectionString)

        client
        .get('/1.0/testdb/media')
        .set('Authorization', 'Bearer ' + bearerToken)
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
          .end((err, res) => {
            if (err) return done(err)

            should.exist(res.body.results)
            res.body.results.should.be.Array
            res.body.results.length.should.eql(1)
            res.body.results[0].fileName.should.eql('1f525.png')

            client
            .get('/1.0/testdb/media')
            .set('Authorization', 'Bearer ' + bearerToken)
            .set('content-type', 'application/json')
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)
              should.exist(res.body.results)
              res.body.results.should.be.Array
              res.body.results.length.should.eql(1)
              res.body.results[0].fileName.should.eql('1f525.png')
              done()
            })
          })
        })
      })
    })

    it('should respond to a count method to return count of uploaded media', function (done) {
      var obj = {
        fileName: '1f525.png',
        mimetype: 'image/png'
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
        .end((err, res) => {
          if (err) return done(err)

          should.exist(res.body.results)
          res.body.results.should.be.Array
          res.body.results.length.should.eql(1)
          res.body.results[0].fileName.should.eql('1f525.png')

          client
          .get('/1.0/testdb/media/count')
          .set('Authorization', 'Bearer ' + bearerToken)
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
  })
})
