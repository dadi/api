const app = require('./../../dadi/lib/')
const config = require('./../../config')
const featureQueryHandler = require('./../../dadi/lib/controller/featureQueryHandler')
const help = require('./help')
const request = require('supertest')
const should = require('should')
const sinon = require('sinon')

let client = request(`http://${config.get('server.host')}:${config.get('server.port')}`)
let configBackup = config.get()

describe('Feature querying', function () {
  afterEach(done => {
    help.removeACLData(done)
  })

  it('should not append a feature support header if the `featureQuery.enabled` property is disabled', done => {
    config.set('featureQuery.enabled', false)

    featureQueryHandler.setFeatures([
      'feature1',
      'feature2',
      'feature3'
    ])

    app.start(() => {
      client
      .get(`/hello`)
      .set('X-DADI-Requires', 'feature2')
      .set('content-type', 'application/json')
      .end((err, res) => {
        res.statusCode.should.eql(200)

        should.not.exist(res.headers['x-dadi-supports'])

        config.set('featureQuery.enabled', configBackup.featureQuery.enabled)

        app.stop(done)
      })
    })
  })

  it('should not append a feature support header if the request does not contain a feature requirement header', done => {
    config.set('featureQuery.enabled', true)

    featureQueryHandler.setFeatures([
      'feature1',
      'feature2',
      'feature3'
    ])

    app.start(() => {
      client
      .get(`/hello`)
      .set('content-type', 'application/json')
      .end((err, res) => {
        res.statusCode.should.eql(200)

        should.not.exist(res.headers['x-dadi-supports'])

        config.set('featureQuery.enabled', configBackup.featureQuery.enabled)

        app.stop(done)
      })
    })
  })

  it('should not append a feature support header if none of the requested features are supported', done => {
    config.set('featureQuery.enabled', true)

    featureQueryHandler.setFeatures([
      'feature1',
      'feature2',
      'feature3'
    ])

    app.start(() => {
      client
      .get(`/hello`)
      .set('X-DADI-Requires', 'feature4')
      .set('content-type', 'application/json')
      .end((err, res) => {
        res.statusCode.should.eql(200)

        should.not.exist(res.headers['x-dadi-supports'])

        config.set('featureQuery.enabled', configBackup.featureQuery.enabled)

        app.stop(done)
      })
    })
  })

  it('should append a feature support header to an unauthenticated request', done => {
    config.set('featureQuery.enabled', true)

    featureQueryHandler.setFeatures([
      'feature1',
      'feature2',
      'feature3'
    ])

    app.start(() => {
      client
      .get(`/hello`)
      .set('X-DADI-Requires', 'feature2;feature4')
      .set('content-type', 'application/json')
      .end((err, res) => {
        if (err) return done(err)

        res.statusCode.should.eql(200)

        res.headers['x-dadi-supports'].should.eql('feature2')

        let testClient = {
          clientId: 'johnDoe',
          secret: 'sssh!'
        }

        help.createACLClient(testClient).then(() => {
          client
          .post(config.get('auth.tokenUrl'))
          .set('content-type', 'application/json')
          .set('x-dadi-requires', 'feature1;feature2')
          .send(testClient)
          .expect(200)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            if (err) return done(err)

            res.headers['x-dadi-supports'].should.eql('feature1;feature2')

            config.set('featureQuery.enabled', configBackup.featureQuery.enabled)

            app.stop(done)
          })
        })
      })
    })
  })

  it('should append a feature support header to an authenticated request', done => {
    config.set('featureQuery.enabled', true)

    featureQueryHandler.setFeatures([
      'feature1',
      'feature2',
      'feature3'
    ])

    app.start(() => {
      let testClient = {
        clientId: 'johnDoe',
        secret: 'sssh!'
      }

      help.createACLClient(testClient).then(() => {
        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .set('x-dadi-requires', 'feature1;feature2')
        .send(testClient)
        .expect(200)
        .expect('content-type', 'application/json')
        .end((err, res) => {
          if (err) return done(err)

          let bearerToken = res.body.accessToken

          res.headers['x-dadi-supports'].should.eql('feature1;feature2')

          client
          .get('/api/client')
          .set('Authorization', `Bearer ${bearerToken}`)
          .set('content-type', 'application/json')
          .set('x-dadi-requires', 'feature1;feature2')
          .expect(200)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            if (err) return done(err)

            res.headers['x-dadi-supports'].should.eql('feature1;feature2')

            config.set('featureQuery.enabled', configBackup.featureQuery.enabled)

            app.stop(done)
          })
        })
      })
    })
  })
})
