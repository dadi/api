const app = require('./../../../../dadi/lib')
const config = require('./../../../../config')
const help = require('./../../help')
const request = require('supertest')
const should = require('should')

module.exports = () => {
  let configBackup = config.get()
  let client = request(`http://${config.get('server.host')}:${config.get('server.port')}`)

  describe('error states', () => {
    it('should return 401 if the request does not include a valid bearer token', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret'
      }

      help.createACLClient(testClient).then(() => {
        client
        .put(`/api/clients/${testClient.clientId}`)
        .send({
          secret: 'ssshhh!'
        })
        .set('content-type', 'application/json')
        .expect('content-type', 'application/json')
        .end((err, res) => {
          res.statusCode.should.eql(401)

          client
          .post(config.get('auth.tokenUrl'))
          .set('content-type', 'application/json')
          .send({
            clientId: testClient.clientId,
            secret: testClient.secret
          })
          .expect(200)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            if (err) return done(err)

            res.body.accessToken.should.be.String

            done()
          })
        })
      })
    })

    it('should return 401 if a non-admin client is trying to change the secret of another client', done => {
      let testClient1 = {
        clientId: 'apiClient1',
        secret: 'someSecret'
      }
      let testClient2 = {
        clientId: 'apiClient2',
        secret: 'someSecret'
      }

      help.createACLClient(testClient1).then(() => {
        return help.createACLClient(testClient2)
      }).then(() => {
        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send({
          clientId: testClient1.clientId,
          secret: testClient1.secret
        })
        .expect(200)
        .expect('content-type', 'application/json')
        .end((err, res) => {
          if (err) return done(err)

          res.body.accessToken.should.be.String

          let bearerToken = res.body.accessToken

          client
          .put('/api/clients/testClient2')
          .send({
            secret: 'aNewSecret'
          })
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            res.statusCode.should.eql(403)

            client
            .post(config.get('auth.tokenUrl'))
            .set('content-type', 'application/json')
            .send({
              clientId: testClient2.clientId,
              secret: testClient2.secret
            })
            .expect(200)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              if (err) return done(err)

              res.body.accessToken.should.be.String

              done()
            })
          })
        })
      })
    })

    it('should return 404 when trying to update a client that does not exist', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret',
        accessType: 'admin'
      }

      help.createACLClient(testClient).then(() => {
        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send({
          clientId: testClient.clientId,
          secret: testClient.secret
        })
        .expect(200)
        .expect('content-type', 'application/json')
        .end((err, res) => {
          if (err) return done(err)

          res.body.accessToken.should.be.String

          let bearerToken = res.body.accessToken

          client
          .put('/api/clients/johnnynobody')
          .send({
            secret: 'ssshhh!'
          })
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            res.statusCode.should.eql(404)

            done()
          })          
        })        
      })
    })

    it('should return 403 when a non-admin client tries to change another client\'s ID', done => {
      let testClient1 = {
        clientId: 'apiClient1',
        secret: 'someSecret',
        resources: {
          clients: {
            update: true
          }
        }
      }
      let testClient2 = {
        clientId: 'apiClient2',
        secret: 'someSecret'
      }

      help.createACLClient(testClient1).then(() => {
        return help.createACLClient(testClient2)
      }).then(() => {
        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send({
          clientId: testClient1.clientId,
          secret: testClient1.secret
        })
        .expect(200)
        .expect('content-type', 'application/json')
        .end((err, res) => {
          if (err) return done(err)

          res.body.accessToken.should.be.String

          let bearerToken = res.body.accessToken

          client
          .put(`/api/clients/${testClient2.clientId}`)
          .send({
            clientId: 'aNewId'
          })
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            res.statusCode.should.eql(403)

            client
            .post(config.get('auth.tokenUrl'))
            .set('content-type', 'application/json')
            .send({
              clientId: testClient1.clientId,
              secret: testClient1.secret
            })
            .expect(200)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              if (err) return done(err)

              res.body.accessToken.should.be.String

              done()
            })
          })
        })
      })
    })

    it('should return 400 when a non-admin client tries to change their own ID', done => {
      let testClient1 = {
        clientId: 'apiClient1',
        secret: 'someSecret'
      }

      help.createACLClient(testClient1).then(() => {
        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send({
          clientId: testClient1.clientId,
          secret: testClient1.secret
        })
        .expect(200)
        .expect('content-type', 'application/json')
        .end((err, res) => {
          if (err) return done(err)

          res.body.accessToken.should.be.String

          let bearerToken = res.body.accessToken

          client
          .put(`/api/clients/${testClient1.clientId}`)
          .send({
            clientId: 'aNewId'
          })
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            res.statusCode.should.eql(400)

            res.body.success.should.eql(false)
            res.body.errors[0].should.eql('Invalid field: clientId')

            client
            .post(config.get('auth.tokenUrl'))
            .set('content-type', 'application/json')
            .send({
              clientId: testClient1.clientId,
              secret: testClient1.secret
            })
            .expect(200)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              if (err) return done(err)

              res.body.accessToken.should.be.String

              done()
            })
          })
        })
      })
    })

    it('should return 400 when an admin client tries to change another client\'s ID', done => {
      let testClient1 = {
        clientId: 'apiClient1',
        secret: 'someSecret',
        accessType: 'admin'
      }
      let testClient2 = {
        clientId: 'apiClient2',
        secret: 'someSecret'
      }

      help.createACLClient(testClient1).then(() => {
        return help.createACLClient(testClient2)
      }).then(() => {
        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send({
          clientId: testClient1.clientId,
          secret: testClient1.secret
        })
        .expect(200)
        .expect('content-type', 'application/json')
        .end((err, res) => {
          if (err) return done(err)

          res.body.accessToken.should.be.String

          let bearerToken = res.body.accessToken

          client
          .put(`/api/clients/${testClient2.clientId}`)
          .send({
            clientId: 'aNewId'
          })
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            res.statusCode.should.eql(400)

            res.body.success.should.eql(false)
            res.body.errors[0].should.eql('Invalid field: clientId')

            done()
          })
        })
      })
    })

    it('should return 400 when an admin client tries to change their own ID', done => {
      let testClient1 = {
        clientId: 'apiClient1',
        secret: 'someSecret',
        accessType: 'admin'
      }

      help.createACLClient(testClient1).then(() => {
        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send({
          clientId: testClient1.clientId,
          secret: testClient1.secret
        })
        .expect(200)
        .expect('content-type', 'application/json')
        .end((err, res) => {
          if (err) return done(err)

          res.body.accessToken.should.be.String

          let bearerToken = res.body.accessToken

          client
          .put(`/api/clients/${testClient1.clientId}`)
          .send({
            clientId: 'aNewId'
          })
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            res.statusCode.should.eql(400)

            res.body.success.should.eql(false)
            res.body.errors[0].should.eql('Invalid field: clientId')

            done()
          })
        })
      })
    })

    it('should return 400 when a client tries to write a protected data property to their record', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret'
      }
      let newData = {
        _keyOne: 1
      }        

      help.createACLClient(testClient).then(() => {
        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send({
          clientId: testClient.clientId,
          secret: testClient.secret
        })
        .expect(200)
        .expect('content-type', 'application/json')
        .end((err, res) => {
          if (err) return done(err)

          res.body.accessToken.should.be.String

          let bearerToken = res.body.accessToken

          client
          .put(`/api/clients/${testClient.clientId}`)
          .send({
            data: newData
          })
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            res.statusCode.should.eql(400)

            res.body.success.should.eql(false)
            res.body.errors[0].should.eql('Cannot set internal data property: data._keyOne')

            client
            .get(`/api/clients/${testClient.clientId}`)
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              res.statusCode.should.eql(200)

              res.body.results.should.be.Array
              res.body.results.length.should.eql(1)
              res.body.results[0].clientId.should.eql(testClient.clientId)
              
              should.not.exist(res.body.results[0].data._keyOne)

              done()
            })
          })
        })
      })
    })

    it('should return 400 when a non-admin client tries to update their secret without supplying the current secret', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret'
      }

      help.createACLClient(testClient).then(() => {
        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send({
          clientId: testClient.clientId,
          secret: testClient.secret
        })
        .expect(200)
        .expect('content-type', 'application/json')
        .end((err, res) => {
          if (err) return done(err)

          res.body.accessToken.should.be.String

          let bearerToken = res.body.accessToken

          client
          .put(`/api/clients/${testClient.clientId}`)
          .send({
            secret: 'aNewSecret'
          })
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            res.statusCode.should.eql(400)

            res.body.success.should.eql(false)
            res.body.errors[0].should.eql('The current secret must be supplied via a `currentSecret` property')

            client
            .post(config.get('auth.tokenUrl'))
            .set('content-type', 'application/json')
            .send({
              clientId: testClient.clientId,
              secret: 'someSecret'
            })
            .expect(200)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              if (err) return done(err)

              res.body.accessToken.should.be.String

              done()
            })
          })
        })
      })
    })

    it('should return 400 when a non-admin client tries to update their secret and the current secret supplied is incorrect', done => {
      let testClient = {
        clientId: 'apiClient',
        secret: 'someSecret'
      }

      help.createACLClient(testClient).then(() => {
        client
        .post(config.get('auth.tokenUrl'))
        .set('content-type', 'application/json')
        .send({
          clientId: testClient.clientId,
          secret: testClient.secret
        })
        .expect(200)
        .expect('content-type', 'application/json')
        .end((err, res) => {
          if (err) return done(err)

          res.body.accessToken.should.be.String

          let bearerToken = res.body.accessToken

          client
          .put(`/api/clients/${testClient.clientId}`)
          .send({
            currentSecret: 'this does not look right',
            secret: 'aNewSecret'
          })
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            res.statusCode.should.eql(400)

            res.body.success.should.eql(false)
            res.body.errors[0].should.eql('The current secret supplied is not valid')

            client
            .post(config.get('auth.tokenUrl'))
            .set('content-type', 'application/json')
            .send({
              clientId: testClient.clientId,
              secret: 'someSecret'
            })
            .expect(200)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              if (err) return done(err)

              res.body.accessToken.should.be.String

              done()
            })
          })
        })
      })
    })
  })

  describe('success states', () => {
    describe('updating the secret', () => {
      it('should allow a client to update their own secret on /api/clients/{ID}', done => {
        let testClient = {
          clientId: 'apiClient',
          secret: 'someSecret'
        }

        help.createACLClient(testClient).then(() => {
          client
          .post(config.get('auth.tokenUrl'))
          .set('content-type', 'application/json')
          .send({
            clientId: testClient.clientId,
            secret: testClient.secret
          })
          .expect(200)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            if (err) return done(err)

            res.body.accessToken.should.be.String

            let bearerToken = res.body.accessToken

            client
            .put(`/api/clients/${testClient.clientId}`)
            .send({
              currentSecret: 'someSecret',
              secret: 'aNewSecret'
            })
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              res.statusCode.should.eql(200)

              res.body.results.should.be.Array
              res.body.results.length.should.eql(1)
              res.body.results[0].clientId.should.eql(testClient.clientId)

              should.not.exist(res.body.results[0].secret)

              client
              .post(config.get('auth.tokenUrl'))
              .set('content-type', 'application/json')
              .send({
                clientId: testClient.clientId,
                secret: 'aNewSecret'
              })
              .expect(200)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                if (err) return done(err)

                res.body.accessToken.should.be.String

                done()
              })
            })
          })
        })
      })

      it('should allow a client to update their own secret on /api/client', done => {
        let testClient = {
          clientId: 'apiClient',
          secret: 'someSecret'
        }

        help.createACLClient(testClient).then(() => {
          client
          .post(config.get('auth.tokenUrl'))
          .set('content-type', 'application/json')
          .send({
            clientId: testClient.clientId,
            secret: testClient.secret
          })
          .expect(200)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            if (err) return done(err)

            res.body.accessToken.should.be.String

            let bearerToken = res.body.accessToken

            client
            .put('/api/client')
            .send({
              currentSecret: 'someSecret',
              secret: 'aNewSecret'
            })
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              res.statusCode.should.eql(200)

              res.body.results.should.be.Array
              res.body.results.length.should.eql(1)
              res.body.results[0].clientId.should.eql(testClient.clientId)

              should.not.exist(res.body.results[0].secret)

              client
              .post(config.get('auth.tokenUrl'))
              .set('content-type', 'application/json')
              .send({
                clientId: testClient.clientId,
                secret: 'aNewSecret'
              })
              .expect(200)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                if (err) return done(err)

                res.body.accessToken.should.be.String

                done()
              })
            })
          })
        })
      })

      it('should allow an admin to update another client\'s secret', done => {
        let testClient1 = {
          clientId: 'apiClient',
          secret: 'someSecret'
        }
        let testClient2 = {
          clientId: 'adminClient',
          secret: 'someSecret',
          accessType: 'admin'
        }

        help.createACLClient(testClient1).then(() => {
          return help.createACLClient(testClient2)
        }).then(() => {
          client
          .post(config.get('auth.tokenUrl'))
          .set('content-type', 'application/json')
          .send({
            clientId: testClient2.clientId,
            secret: testClient2.secret
          })
          .expect(200)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            if (err) return done(err)

            res.body.accessToken.should.be.String

            let bearerToken = res.body.accessToken

            client
            .put(`/api/clients/${testClient1.clientId}`)
            .send({
              secret: 'aNewSecret'
            })
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              res.statusCode.should.eql(200)

              res.body.results.should.be.Array
              res.body.results.length.should.eql(1)
              res.body.results[0].clientId.should.eql(testClient1.clientId)

              should.not.exist(res.body.results[0].secret)

              client
              .post(config.get('auth.tokenUrl'))
              .set('content-type', 'application/json')
              .send({
                clientId: testClient1.clientId,
                secret: 'aNewSecret'
              })
              .expect(200)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                if (err) return done(err)

                res.body.accessToken.should.be.String

                done()
              })
            })
          })
        })
      })
    })

    describe('storing arbitrary data', () => {
      it('should allow a client to write a new data property to their own record at /api/clients/{ID}', done => {
        let testClient = {
          clientId: 'apiClient',
          secret: 'someSecret'
        }
        let newData = {
          keyOne: 1
        }

        help.createACLClient(testClient).then(() => {
          client
          .post(config.get('auth.tokenUrl'))
          .set('content-type', 'application/json')
          .send({
            clientId: testClient.clientId,
            secret: testClient.secret
          })
          .expect(200)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            if (err) return done(err)

            res.body.accessToken.should.be.String

            let bearerToken = res.body.accessToken

            client
            .put(`/api/clients/${testClient.clientId}`)
            .send({
              data: newData
            })
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              res.statusCode.should.eql(200)

              res.body.results.should.be.Array
              res.body.results.length.should.eql(1)
              res.body.results[0].clientId.should.eql(testClient.clientId)
              res.body.results[0].data.should.eql(newData)

              should.not.exist(res.body.results[0].secret)

              client
              .get(`/api/clients/${testClient.clientId}`)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(200)

                res.body.results.should.be.Array
                res.body.results.length.should.eql(1)
                res.body.results[0].clientId.should.eql(testClient.clientId)
                res.body.results[0].data.should.eql(newData)

                done()
              })
            })
          })
        })
      })

      it('should allow a client to write a new data property to their own record at /api/client', done => {
        let testClient = {
          clientId: 'apiClient',
          secret: 'someSecret'
        }
        let newData = {
          keyOne: 1
        }

        help.createACLClient(testClient).then(() => {
          client
          .post(config.get('auth.tokenUrl'))
          .set('content-type', 'application/json')
          .send({
            clientId: testClient.clientId,
            secret: testClient.secret
          })
          .expect(200)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            if (err) return done(err)

            res.body.accessToken.should.be.String

            let bearerToken = res.body.accessToken

            client
            .put('/api/client')
            .send({
              data: newData
            })
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              res.statusCode.should.eql(200)

              res.body.results.should.be.Array
              res.body.results.length.should.eql(1)
              res.body.results[0].clientId.should.eql(testClient.clientId)
              res.body.results[0].data.should.eql(newData)

              should.not.exist(res.body.results[0].secret)

              client
              .get(`/api/clients/${testClient.clientId}`)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(200)

                res.body.results.should.be.Array
                res.body.results.length.should.eql(1)
                res.body.results[0].clientId.should.eql(testClient.clientId)
                res.body.results[0].data.should.eql(newData)

                done()
              })
            })
          })
        })
      })

      it('should allow an admin client to write a new data property to another client\'s record', done => {
        let testClient1 = {
          clientId: 'apiClient',
          secret: 'someSecret'
        }
        let testClient2 = {
          clientId: 'adminClient',
          secret: 'someSecret',
          accessType: 'admin'
        }
        let newData = {
          keyOne: 1
        }        

        help.createACLClient(testClient1).then(() => {
          return help.createACLClient(testClient2)
        }).then(() => {
          client
          .post(config.get('auth.tokenUrl'))
          .set('content-type', 'application/json')
          .send({
            clientId: testClient2.clientId,
            secret: testClient2.secret
          })
          .expect(200)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            if (err) return done(err)

            res.body.accessToken.should.be.String

            let bearerToken = res.body.accessToken

            client
            .put(`/api/clients/${testClient1.clientId}`)
            .send({
              data: newData
            })
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              res.statusCode.should.eql(200)

              res.body.results.should.be.Array
              res.body.results.length.should.eql(1)
              res.body.results[0].clientId.should.eql(testClient1.clientId)
              res.body.results[0].data.should.eql(newData)

              should.not.exist(res.body.results[0].secret)

              client
              .get(`/api/clients/${testClient1.clientId}`)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(200)

                res.body.results.should.be.Array
                res.body.results.length.should.eql(1)
                res.body.results[0].clientId.should.eql(testClient1.clientId)
                res.body.results[0].data.should.eql(newData)

                done()
              })
            })
          })
        })
      })

      it('should allow an admin client to write a new protected data property to another client\'s record', done => {
        let testClient1 = {
          clientId: 'apiClient',
          secret: 'someSecret'
        }
        let testClient2 = {
          clientId: 'adminClient',
          secret: 'someSecret',
          accessType: 'admin'
        }
        let newData = {
          _keyOne: 1
        }        

        help.createACLClient(testClient1).then(() => {
          return help.createACLClient(testClient2)
        }).then(() => {
          client
          .post(config.get('auth.tokenUrl'))
          .set('content-type', 'application/json')
          .send({
            clientId: testClient2.clientId,
            secret: testClient2.secret
          })
          .expect(200)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            if (err) return done(err)

            res.body.accessToken.should.be.String

            let bearerToken = res.body.accessToken

            client
            .put(`/api/clients/${testClient1.clientId}`)
            .send({
              data: newData
            })
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              res.statusCode.should.eql(200)

              res.body.results.should.be.Array
              res.body.results.length.should.eql(1)
              res.body.results[0].clientId.should.eql(testClient1.clientId)
              res.body.results[0].data.should.eql(newData)

              should.not.exist(res.body.results[0].secret)

              client
              .get(`/api/clients/${testClient1.clientId}`)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(200)

                res.body.results.should.be.Array
                res.body.results.length.should.eql(1)
                res.body.results[0].clientId.should.eql(testClient1.clientId)
                res.body.results[0].data.should.eql(newData)

                done()
              })
            })
          })
        })
      })      

      it('should merge existing data properties with any new ones sent in the payload', done => {
        let testClient = {
          clientId: 'apiClient',
          secret: 'someSecret',
          data: {
            keyTwo: 2,
            keyThree: 3
          }
        }
        let newData = {
          keyOne: 1,
          keyTwo: 9999
        }

        help.createACLClient(testClient).then(() => {
          client
          .post(config.get('auth.tokenUrl'))
          .set('content-type', 'application/json')
          .send({
            clientId: testClient.clientId,
            secret: testClient.secret
          })
          .expect(200)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            if (err) return done(err)

            res.body.accessToken.should.be.String

            let bearerToken = res.body.accessToken

            client
            .put('/api/client')
            .send({
              data: newData
            })
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              res.statusCode.should.eql(200)

              res.body.results.should.be.Array
              res.body.results.length.should.eql(1)
              res.body.results[0].clientId.should.eql(testClient.clientId)
              res.body.results[0].data.should.eql(
                Object.assign({}, testClient.data, newData)
              )

              should.not.exist(res.body.results[0].secret)

              client
              .get(`/api/clients/${testClient.clientId}`)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(200)

                res.body.results.should.be.Array
                res.body.results.length.should.eql(1)
                res.body.results[0].clientId.should.eql(testClient.clientId)
                res.body.results[0].data.should.eql(
                  Object.assign({}, testClient.data, newData)
                )

                done()
              })
            })
          })
        })
      })

      it('should delete data properties when their value in the payload is `null`', done => {
        let testClient = {
          clientId: 'apiClient',
          secret: 'someSecret',
          data: {
            keyTwo: 2,
            keyThree: 3
          }
        }
        let newData = {
          keyTwo: null
        }

        help.createACLClient(testClient).then(() => {
          client
          .post(config.get('auth.tokenUrl'))
          .set('content-type', 'application/json')
          .send({
            clientId: testClient.clientId,
            secret: testClient.secret
          })
          .expect(200)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            if (err) return done(err)

            res.body.accessToken.should.be.String

            let bearerToken = res.body.accessToken

            client
            .put('/api/client')
            .send({
              data: newData
            })
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              res.statusCode.should.eql(200)

              res.body.results.should.be.Array
              res.body.results.length.should.eql(1)
              res.body.results[0].clientId.should.eql(testClient.clientId)
              res.body.results[0].data.should.eql({
                keyThree: testClient.data.keyThree
              })

              should.not.exist(res.body.results[0].secret)

              client
              .get(`/api/clients/${testClient.clientId}`)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(200)

                res.body.results.should.be.Array
                res.body.results.length.should.eql(1)
                res.body.results[0].clientId.should.eql(testClient.clientId)
                res.body.results[0].data.should.eql({
                  keyThree: testClient.data.keyThree
                })

                done()
              })
            })
          })
        })
      })

      it('should leave the data object untouched if the payload of the update request does not contain a `data` property', done => {
        let testClient = {
          clientId: 'apiClient',
          secret: 'someSecret',
          data: {
            keyOne: 1,
            keyTwo: 2
          }
        }

        help.createACLClient(testClient).then(() => {
          client
          .post(config.get('auth.tokenUrl'))
          .set('content-type', 'application/json')
          .send({
            clientId: testClient.clientId,
            secret: testClient.secret
          })
          .expect(200)
          .expect('content-type', 'application/json')
          .end((err, res) => {
            if (err) return done(err)

            res.body.accessToken.should.be.String

            let bearerToken = res.body.accessToken

            client
            .put('/api/client')
            .send({
              currentSecret: 'someSecret',
              secret: 'something'
            })
            .set('content-type', 'application/json')
            .set('Authorization', `Bearer ${bearerToken}`)
            .expect('content-type', 'application/json')
            .end((err, res) => {
              res.statusCode.should.eql(200)

              res.body.results.should.be.Array
              res.body.results.length.should.eql(1)
              res.body.results[0].clientId.should.eql(testClient.clientId)

              should.not.exist(res.body.results[0].secret)

              client
              .get(`/api/clients/${testClient.clientId}`)
              .set('content-type', 'application/json')
              .set('Authorization', `Bearer ${bearerToken}`)
              .expect('content-type', 'application/json')
              .end((err, res) => {
                res.statusCode.should.eql(200)

                res.body.results.should.be.Array
                res.body.results.length.should.eql(1)
                res.body.results[0].clientId.should.eql(testClient.clientId)
                res.body.results[0].data.should.eql(testClient.data)

                done()
              })
            })
          })
        })
      })
    })
  })
}