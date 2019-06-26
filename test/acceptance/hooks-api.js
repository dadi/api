const app = require('./../../dadi/lib/')
const config = require('./../../config')
const connection = require('./../../dadi/lib/model/connection')
const fs = require('fs')
const help = require('./help')
const path = require('path')
const request = require('supertest')
const should = require('should')
const sinon = require('sinon')

let client = request(`http://${config.get('server.host')}:${config.get('server.port')}`)

describe('Hooks API', function () {
  let bearerToken

  describe('when the requesting client does not have admin access', () => {
    before(done => {
      help.removeACLData().then(() => {
        app.start(() => {
          help.getBearerTokenWithPermissions(
            {
              resources: {
                'collection:library_book': {
                  create: true,
                  read: true
                }
              },
              roles: ['some-role']
            },
            (err, token) => {
              if (err) return done(err)

              bearerToken = token

              done()
            }
          )
        })
      })
    })

    after(done => {
      app.stop(done)
    })

    describe('GET', () => {
      it('should return 401 if the request does not contain a valid bearer token', done => {
        client
        .get('/api/hooks')
        .expect('content-type', 'application/json')
        .end((err, res) => {
          if (err) return done(err)

          res.statusCode.should.eql(401)

          done()
        })
      })

      it('should return 403 if the request contains a valid bearer token without enough permissions', done => {
        client
        .get('/api/hooks')
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect('content-type', 'application/json')
        .end((err, res) => {
          if (err) return done(err)

          res.statusCode.should.eql(403)

          done()
        })
      })
    })

    describe('POST', () => {
      it('should return 405 if the request does not contain a valid bearer token', done => {
        const hookName = 'myHook1'
        const hookContent = `
          module.exports = (obj, type, data) => {
            return obj
          }
        `.trim()

        client
        .post(`/api/hooks/${hookName}/config`)
        .send(hookContent)
        .set('content-type', 'text/plain')
        .end((err, res) => {
          res.statusCode.should.eql(405)

          done()
        })
      })

      it('should return 405 if the request contains a valid bearer token without enough permissions', done => {
        const hookName = 'myHook1'
        const hookContent = `
          module.exports = (obj, type, data) => {
            return obj
          }
        `.trim()

        client
        .post(`/api/hooks/${hookName}/config`)
        .set('Authorization', `Bearer ${bearerToken}`)
        .send(hookContent)
        .set('content-type', 'text/plain')
        .end((err, res) => {
          res.statusCode.should.eql(405)

          done()
        })
      })
    })

    describe('PUT', () => {
      it('should return 405 if the request does not contain a valid bearer token', done => {
        const hookName = 'myHook1'
        const hookContent = `
          module.exports = (obj, type, data) => {
            return obj
          }
        `.trim()

        client
        .put(`/api/hooks/${hookName}/config`)
        .send(hookContent)
        .set('content-type', 'text/plain')
        .end((err, res) => {
          res.statusCode.should.eql(405)

          done()
        })
      })

      it('should return 405 if the request contains a valid bearer token without enough permissions', done => {
        const hookName = 'myHook1'
        const hookContent = `
          module.exports = (obj, type, data) => {
            return obj
          }
        `.trim()

        client
        .put(`/api/hooks/${hookName}/config`)
        .set('Authorization', `Bearer ${bearerToken}`)
        .send(hookContent)
        .set('content-type', 'text/plain')
        .end((err, res) => {
          res.statusCode.should.eql(405)

          done()
        })
      })
    })

    describe('DELETE', () => {
      it('should return 405 if the request does not contain a valid bearer token', done => {
        const hookName = 'myHook1'
        const hookContent = `
          module.exports = (obj, type, data) => {
            return obj
          }
        `.trim()

        client
        .delete(`/api/hooks/${hookName}/config`)
        .set('content-type', 'text/plain')
        .end((err, res) => {
          res.statusCode.should.eql(405)

          done()
        })
      })

      it('should return 405 if the request contains a valid bearer token without enough permissions', done => {
        const hookName = 'myHook1'
        const hookContent = `
          module.exports = (obj, type, data) => {
            return obj
          }
        `.trim()

        client
        .delete(`/api/hooks/${hookName}/config`)
        .set('Authorization', `Bearer ${bearerToken}`)
        .set('content-type', 'text/plain')
        .end((err, res) => {
          res.statusCode.should.eql(405)

          done()
        })
      })
    })
  })

  describe('when the requesting client has admin access', () => {
    before(done => {
      help.removeACLData().then(() => {
        app.start(() => {
          help.getBearerTokenWithPermissions(
            { accessType: 'admin' },
            (err, token) => {
              if (err) return done(err)

              bearerToken = token

              done()
            }
          )
        })
      })
    })

    after(done => {
      app.stop(done)
    })

    describe('GET', () => {
      it('should return all loaded hooks', function (done) {
        client
        .get('/api/hooks')
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(200)
        .expect('content-type', 'application/json')
        .end((err, res) => {
          if (err) return done(err)

          res.body.should.be.Object
          res.body.results.should.be.Array
          res.body.results.forEach(hook => {
            should.exist(hook.name)
          })

          done()
        })
      })

      it('should return 405 if request method is not supported', function (done) {
        client
        .put('/api/hooks')
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(405, done)
      })

      it('should return 404 if specified hook is not found', function (done) {
        client
        .get('/api/hooks/xx/config')
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(404, done)
      })

      it('should return the hook as text if specified hook is found', function (done) {
        client
        .get('/api/hooks/slugify/config')
        .set('Authorization', `Bearer ${bearerToken}`)
        .end((err, res) => {
          res.statusCode.should.eql(200)
          res.text.should.not.eql('')
          done()
        })
      })
    })

    describe('POST', () => {
      it('should not create a hook with a POST request', function (done) {
        const hookName = 'myHook1'
        const hookContent = `
          module.exports = (obj, type, data) => {
            return obj
          }
        `.trim()

        client
        .post(`/api/hooks/${hookName}/config`)
        .send(hookContent)
        .set('content-type', 'text/plain')
        .set('Authorization', `Bearer ${bearerToken}`)
        .end((err, res) => {
          res.statusCode.should.eql(405)

          setTimeout(() => {
            client
            .get(`/api/hooks/${hookName}/config`)
            .set('Authorization', `Bearer ${bearerToken}`)
            .end((err, res) => {
              res.statusCode.should.eql(404)

              done()
            })
          }, 200)
        })
      })

      it('should return 405 when sending a POST request to a hook that already exists', function (done) {
        const hookContent = `
          module.exports = (obj, type, data) => {
            return obj
          }
        `.trim()

        client
        .post(`/api/hooks/layout/config`)
        .send(hookContent)
        .set('content-type', 'text/plain')
        .set('Authorization', `Bearer ${bearerToken}`)
        .end((err, res) => {
          res.statusCode.should.eql(405)

          done()
        })
      })
    })

    describe('PUT', () => {
      it('should not update a hook with a PUT request', function (done) {
        const hookUpdatedContent = `
          module.exports = (obj, type, data) => {
            obj = 'Something else'

            return obj
          }
        `.trim()

        client
        .put(`/api/hooks/layout/config`)
        .set('content-type', 'text/plain')
        .send(hookUpdatedContent)
        .set('Authorization', `Bearer ${bearerToken}`)
        .end((err, res) => {
          res.statusCode.should.eql(405)

          setTimeout(() => {
            client
            .get(`/api/hooks/layout/config`)
            .set('Authorization', `Bearer ${bearerToken}`)
            .end((err, res) => {
              res.statusCode.should.eql(200)
              res.text.should.not.eql(hookUpdatedContent)

              done()
            })
          }, 200)
        })
      })

      it('should return 405 when sending a PUT request to a hook that does not exist', function (done) {
        const hookName = 'myHook1'
        const hookUpdatedContent = `
          module.exports = (obj, type, data) => {
            return obj
          }
        `.trim()

        client
        .put(`/api/hooks/${hookName}/config`)
        .send(hookUpdatedContent)
        .set('content-type', 'text/plain')
        .set('Authorization', `Bearer ${bearerToken}`)
        .end((err, res) => {
          res.statusCode.should.eql(405)

          done()
        })
      })
    })    

    describe('DELETE', () => {
      it('should not delete a hook with a DELETE request', function (done) {
        client
        .delete(`/api/hooks/layout/config`)
        .set('Authorization', `Bearer ${bearerToken}`)
        .end((err, res) => {
          res.statusCode.should.eql(405)

          setTimeout(() => {
            client
            .get(`/api/hooks/layout/config`)
            .set('Authorization', `Bearer ${bearerToken}`)
            .end((err, res) => {
              res.statusCode.should.eql(200)

              done()
            })
          }, 200)
        })
      })

      it('should return 405 when sending a DELETE request to a hook that does not exist', function (done) {
        const hookName = 'myHook1'

        client
        .delete(`/api/hooks/${hookName}/config`)
        .set('Authorization', `Bearer ${bearerToken}`)
        .end((err, res) => {
          res.statusCode.should.eql(405)

          done()
        })
      })
    })
  })
})