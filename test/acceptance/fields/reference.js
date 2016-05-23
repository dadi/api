var should = require('should');
var fs = require('fs');
var path = require('path');
var request = require('supertest');
var _ = require('underscore');
var config = require(__dirname + '/../../../config');
var help = require(__dirname + '/../help');
var app = require(__dirname + '/../../../dadi/lib/');

// variables scoped for use throughout tests
var bearerToken;
var connectionString = 'http://' + config.get('server.host') + ':' + config.get('server.port');

describe('Reference Field', function () {

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
  });

  it('should populate a reference field containing an ObjectID', function (done) {

    var person = { name: 'Ernest Hemingway' };
    var book = { title: 'For Whom The Bell Tolls', author: null };

    config.set('query.useVersionFilter', true)

    var client = request(connectionString);
    client
    .post('/v1/library/person')
    .set('Authorization', 'Bearer ' + bearerToken)
    .send(person)
    .expect(200)
    .end(function (err, res) {
      if (err) return done(err);

      should.exist(res.body.results);

      var personId = res.body.results[0]._id
      book.author = personId

      client
      .post('/v1/library/book')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(book)
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);

        client
        .get('/v1/library/book?compose=true')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);

          should.exist(res.body.results)
          var bookResult = res.body.results[0]
          //console.log(bookResult)
          should.exist(bookResult.author)
          should.exist(bookResult.author.name)

          done();
        })
      })
    });
  });

  it('should populate a reference field containing a String', function (done) {

    var person = { name: 'Ernest Hemingway' };
    var book = { title: 'For Whom The Bell Tolls', author: null };

    config.set('query.useVersionFilter', true)

    var client = request(connectionString);
    client
    .post('/v1/library/person')
    .set('Authorization', 'Bearer ' + bearerToken)
    .send(person)
    .expect(200)
    .end(function (err, res) {
      if (err) return done(err);

      should.exist(res.body.results);

      var personId = res.body.results[0]._id
      book.author = personId.toString()

      client
      .post('/v1/library/book')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(book)
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);

        client
        .get('/v1/library/book?compose=true')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);

          should.exist(res.body.results)
          var bookResult = res.body.results[0]
          //console.log(bookResult)
          should.exist(bookResult.author)
          should.exist(bookResult.author.name)

          done();
        })
      })
    });
  });

  it('should return results for a reference field containing an Array of Strings', function (done) {

    var person = { name: 'Ernest Hemingway' };
    var book = { title: 'For Whom The Bell Tolls', author: null };

    config.set('query.useVersionFilter', true)

    var client = request(connectionString);
    client
    .post('/v1/library/person')
    .set('Authorization', 'Bearer ' + bearerToken)
    .send(person)
    .expect(200)
    .end(function (err, res) {
      if (err) return done(err);

      should.exist(res.body.results);

      var personId = res.body.results[0]._id
      book.author = [personId.toString()]

      client
      .post('/v1/library/book')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(book)
      .expect(200)
      .end(function (err, res) {
        if (err) return done(err);

        client
        .get('/v1/library/book?filter={"book.author":{"$in":' + [personId.toString()] + '}}&compose=true')
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .end(function (err, res) {
          if (err) return done(err);

          //console.log(res.body)

          should.exist(res.body.results)
          var bookResult = res.body.results[0]
          //console.log(bookResult)
          should.exist(bookResult.author)
          should.exist(bookResult.author.name)

          done();
        })
      })
    });
  });
})
