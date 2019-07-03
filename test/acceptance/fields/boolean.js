const request = require('supertest')
const config = require(__dirname + '/../../../config')
const help = require(__dirname + '/../help')
const app = require(__dirname + '/../../../dadi/lib/')

let bearerToken
const configBackup = config.get()
const connectionString =
  'http://' + config.get('server.host') + ':' + config.get('server.port')

describe('Boolean Field', () => {
  const docs = [
    {
      boolean: true,
      string: 'one'
    },
    {
      boolean: false,
      string: 'two'
    },
    {
      boolean: true,
      string: 'three'
    },
    {
      string: 'four'
    }
  ]

  beforeEach(done => {
    config.set(
      'paths.collections',
      'test/acceptance/temp-workspace/collections'
    )

    help.dropDatabase('library', 'misc', err => {
      app.start(() => {
        help.getBearerToken(function(err, token) {
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
    const client = request(connectionString)

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
            const {results} = res.body

            results[0].boolean.should.eql(true)

            done()
          })
      })
  })

  it('should retrieve all documents where the field is truthy', done => {
    const client = request(connectionString)

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
            const {results} = res.body

            results.length.should.eql(2)
            results[0].string.should.eql('one')
            results[1].string.should.eql('three')

            done()
          })
      })
  })

  it('should retrieve all documents where the field is falsy', done => {
    const client = request(connectionString)

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
            const {results} = res.body

            results.length.should.eql(2)

            const matches = results.reduce((count, result) => {
              if (['two', 'four'].includes(result.string)) {
                count++
              }

              return count
            }, 0)

            matches.should.eql(2)

            done()
          })
      })
  })

  it('should accept a `{"$ne": true}` filter', done => {
    const client = request(connectionString)

    client
      .post('/v1/library/misc')
      .set('Authorization', 'Bearer ' + bearerToken)
      .send(docs)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        client
          .get(`/v1/library/misc?filter={"boolean":{"$ne":true}}`)
          .set('Authorization', 'Bearer ' + bearerToken)
          .expect(200)
          .end((err, res) => {
            const {results} = res.body

            results.length.should.eql(2)
            const matches = results.reduce((count, result) => {
              if (['two', 'four'].includes(result.string)) {
                count++
              }

              return count
            }, 0)

            matches.should.eql(2)

            done()
          })
      })
  })
})
