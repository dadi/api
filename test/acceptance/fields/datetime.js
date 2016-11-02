var should = require('should')
var fs = require('fs')
var moment = require('moment')
var path = require('path')
var request = require('supertest')
var _ = require('underscore')
var config = require(__dirname + '/../../../config')
var help = require(__dirname + '/../help')
var app = require(__dirname + '/../../../dadi/lib/')

// variables scoped for use throughout tests
var bearerToken
var connectionString = 'http://' + config.get('server.host') + ':' + config.get('server.port')

describe('DateTime Field', function () {

  before(function (done) {

    config.set('paths.collections', 'test/acceptance/workspace/collections')

    help.dropDatabase('testdb', function (err) {
      if (err) return done(err)

      app.start(function() {
        help.getBearerToken(function (err, token) {
          if (err) return done(err)
          bearerToken = token;
          done();
        })
      })
    })
  })

  after(function (done) {
    config.set('paths.collections', 'workspace/collections')
    app.stop(done)
  })

  it('should format a DateTime field as ISO when no format is specified', function (done) {
    var person = { name: 'Ernest Hemingway' }

    config.set('query.useVersionFilter', true)

    var client = request(connectionString)
    client
    .post('/v1/library/person')
    .set('Authorization', 'Bearer ' + bearerToken)
    .send(person)
    .expect(200)
    .end(function (err, res) {
      if (err) return done(err)

      var personId = res.body.results[0]._id

      var book = { title: 'For Whom The Bell Tolls', author: personId }

      client
      .post('/v1/library/book')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(book)
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err)

        var bookId = res.body.results[0]._id

        var date = new Date()
        var event = { type: 'borrow', book: bookId, datetime: date }

        client
        .post('/v1/library/event')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(event)
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err)

          client
          .get('/v1/library/event?compose=true')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err)

            res.body.results[0].datetime.should.eql(moment(date).toISOString())
            done()
          })
        })
      })
    })
  })

  it('should format a DateTime field as ISO when `iso` format is specified', function (done) {
    var person = { name: 'Ernest Hemingway' }

    config.set('query.useVersionFilter', true)

    var client = request(connectionString)
    client
    .post('/v1/library/person')
    .set('Authorization', 'Bearer ' + bearerToken)
    .send(person)
    .expect(200)
    .end(function (err, res) {
      if (err) return done(err)

      var personId = res.body.results[0]._id

      var book = { title: 'For Whom The Bell Tolls', author: personId }

      client
      .post('/v1/library/book')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(book)
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err)

        var bookId = res.body.results[0]._id

        var date = new Date()
        var event = { type: 'borrow', book: bookId, datetime: date }

        client
        .post('/v1/library/event_iso_date')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(event)
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err)

          client
          .get('/v1/library/event_iso_date?compose=true')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err)

            res.body.results[0].datetime.should.eql(moment(date).toISOString())
            done()
          })
        })
      })
    })
  })

  it('should format a DateTime field when format is specified', function (done) {
    var person = { name: 'Ernest Hemingway' }
    config.set('query.useVersionFilter', true)
    var client = request(connectionString)
    client
    .post('/v1/library/person')
    .set('Authorization', 'Bearer ' + bearerToken)
    .send(person)
    .expect(200)
    .end(function (err, res) {
      if (err) return done(err)
      var personId = res.body.results[0]._id
      var book = { title: 'For Whom The Bell Tolls', author: personId }

      client
      .post('/v1/library/book')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(book)
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err)
        var bookId = res.body.results[0]._id
        var date = moment('2016-11-02', 'YYYY-MM-DD').format('YYYY-MM-DD')
        var event = { type: 'borrow', book: bookId, datetime: date }

        client
        .post('/v1/library/event_format_date')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(event)
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err)

          client
          .get('/v1/library/event_format_date?compose=true')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err)
            res.body.results[0].datetime.should.eql(moment('2016-11-02', 'YYYY-MM-DD').format())
            done()
          })
        })
      })
    })
  })

  it('should format a DateTime field as unix when `unix` format is specified', function (done) {
    var person = { name: 'Ernest Hemingway' }

    config.set('query.useVersionFilter', true)

    var client = request(connectionString)
    client
    .post('/v1/library/person')
    .set('Authorization', 'Bearer ' + bearerToken)
    .send(person)
    .expect(200)
    .end(function (err, res) {
      if (err) return done(err)

      var personId = res.body.results[0]._id

      var book = { title: 'For Whom The Bell Tolls', author: personId }

      client
      .post('/v1/library/book')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(book)
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err)

        var bookId = res.body.results[0]._id

        var date = new Date()
        var event = { type: 'borrow', book: bookId, datetime: date }

        client
        .post('/v1/library/event_unix_date')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(event)
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err)

          client
          .get('/v1/library/event_unix_date?compose=true')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err)

            res.body.results[0].datetime.should.eql(moment(date).format('x'))
            done()
          })
        })
      })
    })
  })

  it('should keep a DateTime field as unix when `unix` format is specified', function (done) {
    var person = { name: 'Ernest Hemingway' }

    config.set('query.useVersionFilter', true)

    var client = request(connectionString)
    client
    .post('/v1/library/person')
    .set('Authorization', 'Bearer ' + bearerToken)
    .send(person)
    .expect(200)
    .end(function (err, res) {
      if (err) return done(err)

      var personId = res.body.results[0]._id

      var book = { title: 'For Whom The Bell Tolls', author: personId }

      client
      .post('/v1/library/book')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(book)
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err)

        var bookId = res.body.results[0]._id

        var date = moment(new Date()).valueOf()
        var event = { type: 'borrow', book: bookId, datetime: date }

        client
        .post('/v1/library/event_unix_date')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(event)
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err)

          client
          .get('/v1/library/event_unix_date?compose=true')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err)

            should.exist(res.body.results)
            res.body.results.length.should.eql(2)
            res.body.results[1].datetime.should.eql(date)

            done()
          })
        })
      })
    })
  })
})
