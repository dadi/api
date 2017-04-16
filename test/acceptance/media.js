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
  beforeEach((done) => {
    config.set('media.enabled', true)

    app.start(() => {
      help.dropDatabase('testdb', (err) => {
        if (err) return done(err)

        help.getBearerToken((err, token) => {
          if (err) return done(err)

          bearerToken = token
          done()
        })
      })
    })
  })

  afterEach((done) => {
    app.stop(() => {
      config.set('media.enabled', false)
      help.removeTestClients(done)
    })
  })

  describe('sign token', function () {
    it('should accept a payload and return a signed url', function (done) {
      var obj = {
        fileName: 'test.jpg'
      }

      var client = request(connectionString)

      client
      .post('/api/media/sign')
      .set('Authorization', 'Bearer ' + bearerToken)
      .set('content-type', 'application/json')
      .send(obj)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        should.exist(res.body.url)
        var url = res.body.url.replace('/api/media/', '')
        jwt.verify(url, config.get('media.tokenSecret'), (err, payload) => {
          payload.fileName.should.eql(obj.fileName)
          done()
        })
      })
    })

    it('should return 404 if media is not enabled', function (done) {
      config.set('media.enabled', false)

      var obj = {
        fileName: 'test.jpg'
      }

      var client = request(connectionString)

      client
      .post('/api/media/sign')
      .set('Authorization', 'Bearer ' + bearerToken)
      .set('content-type', 'application/json')
      .send(obj)
      .expect(404)
      .end((err, res) => {
        if (err) return done(err)

        config.set('media.enabled', true)
        done()
      })
    })

    it('should return 404 if incorrect HTTP method is used to get a signed token', function (done) {
      config.set('media.enabled', true)
      var client = request(connectionString)

      client
      .get('/api/media/sign')
      .set('Authorization', 'Bearer ' + bearerToken)
      .set('content-type', 'application/json')
      .expect(404)
      .end((err, res) => {
        if (err) return done(err)
        done()
      })
    })

    it('should return 400 if tokenExpiresIn configuration parameter is invalid', function (done) {
      config.set('media.enabled', true)
      config.set('media.tokenExpiresIn', 0.5)
      var client = request(connectionString)

      client
      .post('/api/media/sign')
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
      .post('/api/media/sign')
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

  describe('use token', function () {
    it('should return an error if specified token has expired', function (done) {
      var obj = {
        fileName: 'test.jpg'
      }

      sinon.stub(app, '_signToken', function (obj) {
        return jwt.sign(obj, config.get('media.tokenSecret'), { expiresIn: 1 })
      })

      var client = request(connectionString)

      client
      .post('/api/media/sign')
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
      .post('/api/media/sign')
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
      .post('/api/media/sign')
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
    it('should return an empty result set if no media has been created', function (done) {
      var client = request(connectionString)

      client
      .get('/api/media')
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
      .post('/api/media/sign')
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
          .get('/api/media')
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
})
