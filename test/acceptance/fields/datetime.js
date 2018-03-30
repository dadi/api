const should = require('should')
const fs = require('fs')
const moment = require('moment')
const path = require('path')
const request = require('supertest')
const sinon = require('sinon')
const config = require(__dirname + '/../../../config')
const help = require(__dirname + '/../help')
const app = require(__dirname + '/../../../dadi/lib/')

// variables scoped for use throughout tests
let bearerToken
let connectionString = 'http://' + config.get('server.host') + ':' + config.get('server.port')

describe('DateTime Field', function () {
  before(done => {
    config.set('paths.collections', 'test/acceptance/workspace/collections')

    help.dropDatabase('testdb', err => {
      if (err) return done(err)

      app.start(() => {
        help.getBearerToken((err, token) => {
          if (err) return done(err)

          bearerToken = token

          done()
        })
      })
    })
  })

  after(done => {
    //fakeClock.restore()
    config.set('paths.collections', 'workspace/collections')
    app.stop(done)
  })

  it('should format a DateTime field as ISO when no format is specified', done => {
    let person = { name: 'Ernest Hemingway' }

    config.set('query.useVersionFilter', true)

    let client = request(connectionString)
    client
    .post('/v1/library/person')
    .set('Authorization', 'Bearer ' + bearerToken)
    .send(person)
    .expect(200)
    .end((err, res) => {
      if (err) return done(err)

      let personId = res.body.results[0]._id
      let book = { title: 'For Whom The Bell Tolls', author: personId }

      client
      .post('/v1/library/book')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(book)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        let bookId = res.body.results[0]._id
        let date = new Date()
        let event = { type: 'borrow', book: bookId, datetime: date }

        client
        .post('/v1/library/event')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(event)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          client
          .get('/v1/library/event?compose=true')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            res.body.results[0].datetime.should.eql(moment(date).toISOString())
            done()
          })
        })
      })
    })
  })

  it('should format a DateTime field as ISO when `iso` format is specified', done => {
    let person = { name: 'Ernest Hemingway' }

    config.set('query.useVersionFilter', true)

    let client = request(connectionString)
    client
    .post('/v1/library/person')
    .set('Authorization', 'Bearer ' + bearerToken)
    .send(person)
    .expect(200)
    .end((err, res) => {
      if (err) return done(err)

      let personId = res.body.results[0]._id

      let book = { title: 'For Whom The Bell Tolls', author: personId }

      client
      .post('/v1/library/book')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(book)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        let bookId = res.body.results[0]._id

        let date = new Date()
        let event = { type: 'borrow', book: bookId, datetime: date }

        client
        .post('/v1/library/event_iso_date')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(event)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          client
          .get('/v1/library/event_iso_date?compose=true')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            let d1 = res.body.results[0].datetime
            let d2 = moment(date).toISOString()

            d1.substring(0, d1.lastIndexOf(':')).should.eql(d2.substring(0, d2.lastIndexOf(':')))
            done()
          })
        })
      })
    })
  })

  it('should format a DateTime field when format is specified', done => {
    let person = { name: 'Ernest Hemingway' }
    config.set('query.useVersionFilter', true)
    let client = request(connectionString)
    client
    .post('/v1/library/person')
    .set('Authorization', 'Bearer ' + bearerToken)
    .send(person)
    .expect(200)
    .end((err, res) => {
      if (err) return done(err)
      let personId = res.body.results[0]._id
      let book = { title: 'For Whom The Bell Tolls', author: personId }

      client
      .post('/v1/library/book')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(book)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)
        let bookId = res.body.results[0]._id
        let date = moment('2016-11-02', 'YYYY-MM-DD').format('YYYY-MM-DD')
        let event = { type: 'borrow', book: bookId, datetime: date }

        client
        .post('/v1/library/event_format_date')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(event)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          client
          .get('/v1/library/event_format_date?compose=true')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)
            res.body.results[0].datetime.should.eql(
              moment('2016-11-02', 'YYYY-MM-DD').format('YYYY-MM-DD')
            )
            done()
          })
        })
      })
    })
  })

  it('should format a DateTime field as unix when `unix` format is specified', done => {
    let person = { name: 'Ernest Hemingway' }

    config.set('query.useVersionFilter', true)

    let client = request(connectionString)
    client
    .post('/v1/library/person')
    .set('Authorization', 'Bearer ' + bearerToken)
    .send(person)
    .expect(200)
    .end((err, res) => {
      if (err) return done(err)

      let personId = res.body.results[0]._id

      let book = { title: 'For Whom The Bell Tolls', author: personId }

      client
      .post('/v1/library/book')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(book)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        let bookId = res.body.results[0]._id

        let date = new Date()
        let event = { type: 'borrow', book: bookId, datetime: date }

        client
        .post('/v1/library/event_unix_date')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(event)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          client
          .get('/v1/library/event_unix_date?compose=true')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end((err, res) => {
            if (err) return done(err)

            res.body.results[0].datetime.should.eql(moment(date).format('x'))
            done()
          })
        })
      })
    })
  })

  it('should keep a DateTime field as unix when `unix` format is specified', done => {
    let person = { name: 'Ernest Hemingway' }

    config.set('query.useVersionFilter', true)

    let client = request(connectionString)
    client
    .post('/v1/library/person')
    .set('Authorization', 'Bearer ' + bearerToken)
    .send(person)
    .expect(200)
    .end((err, res) => {
      if (err) return done(err)

      let personId = res.body.results[0]._id

      let book = { title: 'For Whom The Bell Tolls', author: personId }

      client
      .post('/v1/library/book')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(book)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        let bookId = res.body.results[0]._id

        let date = moment(new Date()).valueOf()
        let event = { type: 'borrow', book: bookId, datetime: date }

        client
        .post('/v1/library/event_unix_date')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send(event)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          client
          .get('/v1/library/event_unix_date?compose=true')
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end((err, res) => {
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

  it('should replace `$now` with the current timestamp in DateTime queries', done => {
    let currentDate = Date.now()
    let documents = [
      {
        type: 'one',
        datetime: 588985200000
      },
      {
        type: 'two',
        datetime: currentDate + 10000
      },
      {
        type: 'three',
        datetime: currentDate + 20000
      }
    ]

    config.set('query.useVersionFilter', true)

    let client = request(connectionString)
    client
    .post('/v1/library/event_iso_date')
    .set('Authorization', 'Bearer ' + bearerToken)
    .send(documents)
    .expect(200)
    .end((err, res) => {
      if (err) return done(err)

      client
      .get('/v1/library/event_iso_date?filter={"datetime":{"$gte":"$now"}}')
      .set('Authorization', 'Bearer ' + bearerToken)
      .expect(200)
      .end((err, res) => {
        res.body.results.length.should.equal(2)
        res.body.results[0].type.should.equal('two')
        res.body.results[1].type.should.equal('three')

        done()
      })
    })
  })  
})
