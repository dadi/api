const app = require('./../../../dadi/lib')
const config = require('./../../../config')
const help = require('./../help')
const request = require('supertest')
const sinon = require('sinon')

describe('Password reset', () => {
  const configBackup = config.get()
  const client = request(
    `http://${config.get('server.host')}:${config.get('server.port')}`
  )
  const testClient = {
    clientId: 'rootClient',
    email: 'test@edit.com',
    secret: 'superSecret'
  }

  describe('reset handler file is configured', () => {
    before(done => {
      config.set('auth.resetTokenTtl', 5)
      config.set(
        'paths.passwordReset',
        'test/acceptance/workspace/password-reset.js'
      )

      app.start(err => {
        if (err) return done(err)

        setTimeout(done, 500)
      })
    })

    beforeEach(done => {
      help.createClient(testClient, done)
    })

    after(done => {
      app.stop(done)
    })

    afterEach(done => {
      config.set('auth.resetTokenTtl', configBackup.auth.resetTokenTtl)
      config.set('paths.passwordReset', configBackup.paths.passwordReset)

      help.removeTestClients(done)
    })

    it('should return 404 when requesting a password reset for an email that does not exist', done => {
      client
        .post('/api/reset')
        .send({
          email: 'i-do-not@exist.com'
        })
        .expect('content-type', 'application/json')
        .expect(404, done)
    })

    it('should start a password reset mechanism, calling the handler file', done => {
      const spy = sinon.spy(app.passwordResetController, 'handler')
      const data = {
        foobar: 123
      }

      client
        .post('/api/reset')
        .send({
          email: testClient.email,
          data
        })
        .expect('content-type', 'application/json')
        .expect(200, (err, res) => {
          res.body.success.should.eql(true)

          spy.args[0][0].clientId.should.eql(testClient.clientId)
          spy.args[0][0].email.should.eql(testClient.email)
          spy.args[0][0].data.should.eql(data)
          spy.args[0][0].token.should.be.String

          spy.restore()

          done(err)
        })
    })

    it('should return a 403 when requesting a password reset multiple times within the TTL timeframe', done => {
      client
        .post('/api/reset')
        .send({
          email: testClient.email
        })
        .expect('content-type', 'application/json')
        .expect(200, (err, res) => {
          if (err) return done(err)

          res.body.success.should.eql(true)

          setTimeout(() => {
            client
              .post('/api/reset')
              .send({
                email: testClient.email
              })
              .expect('content-type', 'application/json')
              .expect(403, done)
          }, 2000)
        })
    })

    it('should allow a client to reset a password if they supply a valid reset token', done => {
      const spy = sinon.spy(app.passwordResetController, 'handler')
      const newPassword = 'newPassword123'

      client
        .post('/token')
        .send({
          email: testClient.email,
          secret: newPassword
        })
        .expect('content-type', 'application/json')
        .expect(401, (err, _) => {
          if (err) return done(err)

          client
            .post('/api/reset')
            .send({
              email: testClient.email
            })
            .expect('content-type', 'application/json')
            .expect(200, (err, res) => {
              if (err) return done(err)

              res.body.success.should.eql(true)

              spy.args[0][0].token.should.be.String

              spy.restore()

              client
                .post(`/api/reset/${spy.args[0][0].token}`)
                .send({
                  secret: newPassword
                })
                .expect('content-type', 'application/json')
                .expect(200, (err, _) => {
                  if (err) return done(err)

                  client
                    .post('/token')
                    .send({
                      email: testClient.email,
                      secret: newPassword
                    })
                    .expect('content-type', 'application/json')
                    .expect(200, done)
                })
            })
        })
    })

    it('should return 403 when using an invalid reset token', done => {
      const newPassword = 'newPassword123'

      client
        .post(`/api/reset/not-a-valid-token`)
        .send({
          secret: newPassword
        })
        .expect('content-type', 'application/json')
        .expect(403, done)
    })

    it('should return 403 when using an expired reset token', done => {
      const spy = sinon.spy(app.passwordResetController, 'handler')
      const newPassword = 'newPassword123'

      client
        .post('/api/reset')
        .send({
          email: testClient.email
        })
        .expect('content-type', 'application/json')
        .expect(200, (err, res) => {
          if (err) return done(err)

          res.body.success.should.eql(true)

          const resetToken = spy.args[0][0].token

          resetToken.should.be.String

          spy.restore()

          client
            .post(`/api/reset/${resetToken}`)
            .send({
              secret: newPassword
            })
            .expect('content-type', 'application/json')
            .expect(200, (err, _) => {
              if (err) return done(err)

              client
                .post(`/api/reset/${resetToken}`)
                .send({
                  secret: 'another-password'
                })
                .expect('content-type', 'application/json')
                .expect(403, (err, _) => {
                  if (err) return done(err)

                  client
                    .post('/token')
                    .send({
                      email: testClient.email,
                      secret: newPassword
                    })
                    .expect('content-type', 'application/json')
                    .expect(200, done)
                })
            })
        })
    })
  })

  describe('reset handler file is not configured', () => {
    before(done => {
      config.set('auth.resetTokenTtl', 5)
      config.set('paths.passwordReset', '')

      app.start(err => {
        if (err) return done(err)

        setTimeout(done, 500)
      })
    })

    beforeEach(done => {
      help.createClient(testClient, done)
    })

    after(done => {
      app.stop(done)
    })

    afterEach(done => {
      config.set('auth.resetTokenTtl', configBackup.auth.resetTokenTtl)
      config.set('paths.passwordReset', configBackup.paths.passwordReset)

      help.removeTestClients(done)
    })

    it('should return 404 when requesting a password reset', done => {
      client
        .post('/api/reset')
        .send({
          email: testClient.email
        })
        .expect(404, done)
    })

    it('should return 404 when using a reset token', done => {
      client
        .post('/api/reset/123token')
        .send({
          secret: 'a-new-secret'
        })
        .expect(404, done)
    })
  })
})
