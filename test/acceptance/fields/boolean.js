const should = require('should')
const request = require('supertest')
const config = require(__dirname + '/../../../config')
const help = require(__dirname + '/../help')
const app = require(__dirname + '/../../../dadi/lib/')

let bearerToken
let configBackup = config.get()
let connectionString = 'http://' + config.get('server.host') + ':' + config.get('server.port')

describe('Boolean Field', () => {
  beforeEach(done => {
    config.set('paths.collections', 'test/acceptance/temp-workspace/collections')

    help.dropDatabase('library', 'misc', err => {
      app.start(() => {
        help.getBearerToken(function (err, token) {
          if (err) return done(err)
          bearerToken = token
          done()
        })
      })
    })
  })

  afterEach(done => {
    config.set('paths.collections', configBackup.paths.collections)
    app.stop(done)
  })

  it('should create and retrieve', done => {
    let client = request(connectionString)

    client
    .post('/v1/library/misc')
    .set('Authorization', 'Bearer ' + bearerToken)
    .send({boolean: true})
    .expect(200)
    .end((err, res) => {
      if (err) return done(err)

      res.body.results[0].boolean.should.eql(true)

      client
      .get(`/v1/library/misc/${res.body.results[0]._id}`)
      .set('Authorization', 'Bearer ' + bearerToken)
      .expect(200)
      .end((err, res) => {
        res.body.results[0].boolean.should.eql(true)

        done()
      })
    })
  })

  it('should retrieve all documents where the field is truthy', done => {
    let client = request(connectionString)
    let docs = [
      {
        boolean: true
      },
      {
        boolean: false
      },
      {
        boolean: true
      },
      {
        string: 'hello'
      }
    ]

    client
    .post('/v1/library/misc')
    .set('Authorization', 'Bearer ' + bearerToken)
    .send(docs)
    .expect(200)
    .end((err, res) => {
      if (err) return done(err)

      client
      .get(`/v1/library/misc?filter={"boolean":true}`)
      .set('Authorization', 'Bearer ' + bearerToken)
      .expect(200)
      .end((err, res) => {
        res.body.results.length.should.eql(2)

        done()
      })
    })
  })

  it('should retrieve all documents where the field is falsy', done => {
    let client = request(connectionString)
    let docs = [
      {
        boolean: true
      },
      {
        boolean: false
      },
      {
        boolean: true
      },
      {
        string: 'hello'
      }
    ]

    client
    .post('/v1/library/misc')
    .set('Authorization', 'Bearer ' + bearerToken)
    .send(docs)
    .expect(200)
    .end((err, res) => {
      if (err) return done(err)

      client
      .get(`/v1/library/misc?filter={"boolean":false}`)
      .set('Authorization', 'Bearer ' + bearerToken)
      .expect(200)
      .end((err, res) => {
        res.body.results.length.should.eql(2)

        done()
      })
    })
  })
})
