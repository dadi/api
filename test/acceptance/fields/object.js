const should = require('should')
const fs = require('fs')
const path = require('path')
const request = require('supertest')
const config = require(__dirname + '/../../../config')
const help = require(__dirname + '/../help')
const app = require(__dirname + '/../../../dadi/lib/')

let bearerToken
let connectionString = 'http://' + config.get('server.host') + ':' + config.get('server.port')

describe('Object Field', () => {
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
    config.set('paths.collections', 'workspace/collections')
    app.stop(done)
  })

  it('should create and retrieve', done => {
    let client = request(connectionString)
    let value = {
      name: 'GrandDADI',
      child: {
        name: 'DADI',
        child: {
          name: 'Grandson'
        }
      }
    }

    client
    .post('/v1/library/misc')
    .set('Authorization', 'Bearer ' + bearerToken)
    .send({mixed: value})
    .expect(200)
    .end((err, res) => {
      if (err) return done(err)

      res.body.results[0].mixed.should.eql(value)

      client
      .get(`/v1/library/misc/${res.body.results[0]._id}`)
      .set('Authorization', 'Bearer ' + bearerToken)
      .expect(200)
      .end((err, res) => {
        res.body.results[0].mixed.should.eql(value)

        done()
      })
    })
  })

  it('should retrieve by nested keys', done => {
    let client = request(connectionString)
    let value = {
      name: 'GrandDADI',
      child: {
        name: 'DADI',
        child: {
          name: 'Grandson'
        }
      }
    }

    client
    .post('/v1/library/misc')
    .set('Authorization', 'Bearer ' + bearerToken)
    .send({mixed: value})
    .expect(200)
    .end((err, res) => {
      if (err) return done(err)

      res.body.results[0].mixed.should.eql(value)

      client
      .get(`/v1/library/misc?filter={"mixed.child.name":"${value.child.name}"}`)
      .set('Authorization', 'Bearer ' + bearerToken)
      .expect(200)
      .end((err, res) => {
        res.body.results[0].mixed.should.eql(value)

        done()
      })
    })
  })

  it('should update by id', done => {
    let client = request(connectionString)
    let value = {
      name: 'GrandDADI',
      child: {
        name: 'DADI',
        child: {
          name: 'Grandson'
        }
      }
    }
    let newValue = {
      name: 'GrandDADI',
      child: {
        name: 'DADI'
      }
    }

    client
    .post('/v1/library/misc')
    .set('Authorization', 'Bearer ' + bearerToken)
    .send({mixed: value})
    .expect(200)
    .end((err, res) => {
      if (err) return done(err)

      let id = res.body.results[0]._id

      res.body.results[0].mixed.should.eql(value)

      client
      .put(`/v1/library/misc/${id}`)
      .send({mixed: newValue})
      .set('Authorization', 'Bearer ' + bearerToken)
      .expect(200)
      .end((err, res) => {
        client
        .get(`/v1/library/misc/${id}`)
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .end((err, res) => {
          res.body.results[0].mixed.should.eql(newValue)

          done()
        })
      })
    })
  })

  it('should update by query for nested key', done => {
    let client = request(connectionString)
    let value = {
      name: 'GrandDADI',
      child: {
        name: 'DADI',
        child: {
          name: 'Grandson'
        }
      }
    }
    let newValue = {
      name: 'GrandDADI',
      child: {
        name: 'DADI'
      }
    }

    client
    .post('/v1/library/misc')
    .set('Authorization', 'Bearer ' + bearerToken)
    .send({mixed: value})
    .expect(200)
    .end((err, res) => {
      if (err) return done(err)

      let id = res.body.results[0]._id

      res.body.results[0].mixed.should.eql(value)

      client
      .put(`/v1/library/misc`)
      .send({
        query: {
          'mixed.child.name': value.child.name
        },
        update: {
          mixed: newValue
        }
      })
      .set('Authorization', 'Bearer ' + bearerToken)
      .expect(200)
      .end((err, res) => {
        client
        .get(`/v1/library/misc/${id}`)
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .end((err, res) => {
          res.body.results[0].mixed.should.eql(newValue)

          done()
        })
      })
    })
  })

  it('should delete', done => {
    let client = request(connectionString)
    let value = {
      name: 'GrandDADI',
      child: {
        name: 'DADI',
        child: {
          name: 'Grandson'
        }
      }
    }

    client
    .post('/v1/library/misc')
    .set('Authorization', 'Bearer ' + bearerToken)
    .send({mixed: value})
    .expect(200)
    .end((err, res) => {
      if (err) return done(err)

      let id = res.body.results[0]._id

      res.body.results[0].mixed.should.eql(value)

      client
      .delete(`/v1/library/misc/${id}`)
      .set('Authorization', 'Bearer ' + bearerToken)
      .expect(200)
      .end((err, res) => {
        client
        .get(`/v1/library/misc/${id}`)
        .set('Authorization', 'Bearer ' + bearerToken)
        .expect(200)
        .end((err, res) => {
          res.body.results.length.should.eql(0)

          done()
        })
      })
    })
  })
})
