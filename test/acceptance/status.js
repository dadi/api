const app = require('./../../dadi/lib/')
const config = require('./../../config')
const help = require('./help')
const request = require('supertest')

describe('Status', function() {
  this.timeout(8000)

  before(done => {
    help.createClient(null, function() {
      app.start(function(err) {
        if (err) return done(err)

        help
          .createSchemas([
            {
              name: 'book',
              fields: {
                title: {
                  type: 'String',
                  required: true
                },
                author: {
                  type: 'Reference',
                  settings: {
                    collection: 'person',
                    fields: ['name', 'spouse']
                  }
                },
                booksInSeries: {
                  type: 'Reference',
                  settings: {
                    collection: 'book',
                    multiple: true
                  }
                }
              },
              property: 'library',
              settings: {
                cache: false,
                authenticate: true,
                count: 40
              },
              version: '1.0'
            }
          ])
          .then(() => {
            setTimeout(done, 500)
          })
      })
    })
  })

  beforeEach(() => {
    config.set('status.enabled', true)
  })

  after(function(done) {
    config.set('status.enabled', false)
    help.removeTestClients(function() {
      help.dropSchemas().then(() => {
        app.stop(done)
      })
    })
  })

  it('should return 404 if config status.enabled = false', function(done) {
    help.getBearerToken(function(err, token) {
      const client = request(
        'http://' + config.get('server.host') + ':' + config.get('server.port')
      )

      config.set('status.enabled', false)

      client
        .post('/api/status')
        .set('Authorization', 'Bearer ' + token)
        .expect(404, done)
    })
  })

  it('should return 200 if config status.enabled = true', function(done) {
    help.getBearerToken(function(err, token) {
      const client = request(
        'http://' + config.get('server.host') + ':' + config.get('server.port')
      )

      client
        .post('/api/status')
        .set('Authorization', 'Bearer ' + token)
        .expect(200)
        .end(function(err, res) {
          done()
        })
    })
  })

  describe('Auth', function(done) {
    it('should allow "/api/status" request containing token', function(done) {
      help.getBearerToken(function(err, token) {
        const client = request(
          'http://' +
            config.get('server.host') +
            ':' +
            config.get('server.port')
        )

        client
          .post('/api/status')
          .set('Authorization', 'Bearer ' + token)
          .expect('content-type', 'application/json')
          .expect(200)
          .end((err, res) => {
            done()
          })
      })
    })

    it('should not allow "/api/status" request containing invalid token', function(done) {
      help.getBearerToken(function(err, token) {
        const client = request(
          'http://' +
            config.get('server.host') +
            ':' +
            config.get('server.port')
        )

        client
          .post('/api/status')
          .set('Authorization', 'Bearer badtokenvalue')
          .expect(401, done)
      })
    })
  })

  describe('Routes', function(done) {
    it('should contain data for specified routes', function(done) {
      help.getBearerToken(function(err, token) {
        // set some routes
        config.set('status.routes', [
          {route: '/library/book', expectedResponseTime: 1}
        ])

        const client = request(
          'http://' +
            config.get('server.host') +
            ':' +
            config.get('server.port')
        )

        client
          .post('/api/status')
          .set('Authorization', 'Bearer ' + token)
          .expect('content-type', 'application/json')
          .expect(200, function(err, res) {
            const status = res.body

            status.routes.should.exist
            status.routes[0].should.exist
            status.routes[0].route.should.eql('/library/book')
            done()
          })
      })
    })

    it('should return Green for a route that is faster than expected', function(done) {
      help.getBearerToken(function(err, token) {
        // set some routes
        config.set('status.routes', [
          {route: '/library/book', expectedResponseTime: 1}
        ])

        const client = request(
          'http://' +
            config.get('server.host') +
            ':' +
            config.get('server.port')
        )

        client
          .post('/api/status')
          .set('Authorization', 'Bearer ' + token)
          .expect('content-type', 'application/json')
          .expect(200, function(err, res) {
            const status = res.body

            status.routes.should.exist
            status.routes[0].should.exist
            status.routes[0].healthStatus.should.eql('Green')
            done()
          })
      })
    })

    it('should return Amber for a route that takes longer than expected', function(done) {
      help.getBearerToken(function(err, token) {
        // set some routes
        config.set('status.routes', [
          {route: '/library/book', expectedResponseTime: -1}
        ])

        const client = request(
          'http://' +
            config.get('server.host') +
            ':' +
            config.get('server.port')
        )

        client
          .post('/api/status')
          .set('Authorization', 'Bearer ' + token)
          .expect('content-type', 'application/json')
          .expect(200, function(err, res) {
            const status = res.body

            status.routes.should.exist
            status.routes[0].should.exist
            status.routes[0].healthStatus.should.eql('Amber')
            done()
          })
      })
    })
  })
})
