const path = require('path')
const should = require('should')
const request = require('supertest')
const config = require(__dirname + '/../../config')
const help = require(__dirname + '/help')
const app = require(__dirname + '/../../dadi/lib/')

let bearerToken // scoped for all tests
const dirs = config.get('paths')
const newSchemaPath = path.resolve(dirs.collections + '/vtest/testdb/collection.test-validation-schema.json')

const client = request(`http://${config.get('server.host')}:${config.get('server.port')}`)

describe('Validation', function () {
  before(function (done) {
    app.start(function (err) {
      if (err) return done(err)

      help.dropDatabase('testdb', function (err) {
        if (err) return done(err)

        help.getBearerToken(function (err, token) {
          if (err) return done(err)

          bearerToken = token

          done()
        })
      })
    })
  })

  after(function (done) {
    help.removeTestClients(function () {
      app.stop(done)
    })
  })

  describe('Field types', function () {
    describe('String', function () {
      it('should not allow setting non-string', function (done) {
        client
          .post('/vtest/testdb/test-validation-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({fieldString: 1337})
          .expect(400, done)
      })

      it('should allow setting string', function (done) {
        client
          .post('/vtest/testdb/test-validation-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({fieldString: '1337'})
          .expect(200, done)
      })

      describe('`minLength` operator', () => {
        it('should allow field lengths greater than or equal to `minLength`', function (done) {
          client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldMinLength: '1234'})
            .expect(200, done)
        })

        it('should not allow field lengths less than `minLength`', function (done) {
          client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldMinLength: '123'})
            .expect(400, done)
        })

        it('should contain JSON body in failure message', function (done) {
          client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldMinLength: '123'})
            .expect(400)
            .expect('content-type', 'application/json')
            .end(function (err, res) {
              if (err) return done(err)

              res.body.should.be.json
              res.body.success.should.be.false
              res.body.errors[0].field.should.equal('fieldMinLength')
              res.body.errors[0].code.should.equal('ERROR_MIN_LENGTH')
              res.body.errors[0].message.should.be.instanceOf(String)

              done()
            })
        })
      })

      describe('`maxLength` operator', () => {
        it('should allow field lengths less than or equal to `maxLength`', function (done) {
          client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldMaxLength: '1234'})
            .expect(200, done)
        })

        it('should not allow field lengths greater than `maxLength`', function (done) {
          client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldMaxLength: '12345678'})
            .expect(400, done)
        })

        it('should contain JSON body in failure message', function (done) {
          client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldMaxLength: '12345678'})
            .expect(400)
            .expect('content-type', 'application/json')
            .end(function (err, res) {
              if (err) return done(err)

              res.body.should.be.json
              res.body.success.should.be.false
              res.body.errors[0].field.should.equal('fieldMaxLength')
              res.body.errors[0].code.should.equal('ERROR_MAX_LENGTH')
              res.body.errors[0].message.should.be.instanceOf(String)

              done()
            })
        })
      })

      describe('`regex` operator', () => {
        it('should allow fields that pass regex', function (done) {
          client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldRegex: 'qqqqq'})
            .expect(200, done)
        })

        it('should not allow fields that don\'t pass regex', function (done) {
          client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldRegex: 'qqpqq'})
            .expect(400, done)
        })

        it('should contain JSON body in failure message', function (done) {
          client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldRegex: 'qqpqq'})
            .expect(400)
            .expect('content-type', 'application/json')
            .end(function (err, res) {
              if (err) return done(err)

              res.body.should.be.json
              res.body.success.should.be.false
              res.body.errors[0].field.should.equal('fieldRegex')
              res.body.errors[0].code.should.equal('ERROR_REGEX')
              res.body.errors[0].message.should.be.instanceOf(String)

              done()
            })
        })
      })
    })

    describe('DateTime', function () {
      describe('POST', function () {
        it('should not allow setting invalid DateTime', function (done) {
          client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldDateTime: 'abcdef'})
            .expect(400)
            .end(done)
        })

        it('should allow setting DateTime', function (done) {
          const date = new Date()

          client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldDateTime: date})
            .expect(200)
            .end(function (err, res) {
              new Date(res.body.results[0].fieldDateTime).should.eql(date)

              done(err)
            })
        })

        describe('`before` operator', () => {
          it('should not allow setting DateTime that fails validation', function (done) {
            client
              .post('/vtest/testdb/test-validation-schema')
              .set('Authorization', 'Bearer ' + bearerToken)
              .send({fieldDateTimeBeforeDate: '2018-01-03'})
              .expect(400)
              .end(done)
          })

          it('should allow setting DateTime that passes validation', function (done) {
            client
              .post('/vtest/testdb/test-validation-schema')
              .set('Authorization', 'Bearer ' + bearerToken)
              .send({fieldDateTimeBeforeDate: '1987-12-28'})
              .expect(200)
              .end(done)
          })
        })

        describe('`after` operator', () => {
          it('should not allow setting DateTime that fails validation', function (done) {
            const now = new Date()

            now.setMonth(now.getMonth() - 1)

            client
              .post('/vtest/testdb/test-validation-schema')
              .set('Authorization', 'Bearer ' + bearerToken)
              .send({fieldDateTimeAfterNow: now.getTime()})
              .expect(400)
              .end(done)
          })

          it('should allow setting DateTime that passes validation', function (done) {
            const now = new Date()

            now.setMonth(now.getMonth() + 1)

            client
              .post('/vtest/testdb/test-validation-schema')
              .set('Authorization', 'Bearer ' + bearerToken)
              .send({fieldDateTimeAfterNow: now.getTime()})
              .expect(200)
              .end((err, res) => {
                done(err)
              })
          })
        })
      })

      describe('PUT', function () {
        it('should not allow setting invalid DateTime', function (done) {
          const date = new Date()

          client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldDateTime: date})
            .expect(200)
            .end(function (err, res) {
              const doc = res.body.results[0]
              const id = doc._id

              doc.fieldDateTime = 'abcdef'
              delete doc.createdAt
              delete doc._createdBy
              delete doc._id

              client
              .put('/vtest/testdb/test-validation-schema/' + id)
              .set('Authorization', 'Bearer ' + bearerToken)
              .send(doc)
              .expect(400)
              .end(function (err, res) {
                res.body.success.should.eql(false)

                done(err)
              })
            })
        })

        it('should allow setting DateTime', function (done) {
          const date = new Date()

          client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldDateTime: date})
            .expect(200)
            .end(function (err, res) {
              const doc = res.body.results[0]
              const id = doc._id

              const date2 = new Date()

              doc.fieldDateTime = date2
              delete doc._createdAt
              delete doc._createdBy
              delete doc._id
              delete doc._version

              client
              .put('/vtest/testdb/test-validation-schema/' + id)
              .set('Authorization', 'Bearer ' + bearerToken)
              .send(doc)
              .expect(200)
              .end(function (err, res) {
                new Date(res.body.results[0].fieldDateTime).should.eql(date2)

                done(err)
              })
            })
        })
      })
    })

    describe('Number', function () {
      it('should not allow setting non-number', function (done) {
        client
          .post('/vtest/testdb/test-validation-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({fieldNumber: '123'})
          .expect(400, done)
      })

      it('should allow setting number', function (done) {
        client
          .post('/vtest/testdb/test-validation-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({fieldNumber: 1337})
          .expect(200, done)
      })

      describe('`equalTo` operator', () => {
        it('should not allow setting number that fails validation', function (done) {
          client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldNumberEqualTo: 5})
            .expect(400)
            .end(done)
        })

        it('should allow setting number that passes validation', function (done) {
          client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldNumberEqualTo: 10})
            .expect(200)
            .end(done)
        })
      })

      describe('`even` operator', () => {
        it('should not allow setting number that fails validation', function (done) {
          client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldNumberEven: 5})
            .expect(400)
            .end((err, res) => {
              if (err) return done(err)

              client
                .post('/vtest/testdb/test-validation-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({fieldNumberOdd: 6})
                .expect(400)
                .end(done)
            })
        })

        it('should allow setting number that passes validation', function (done) {
          client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldNumberEven: 10})
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              client
                .post('/vtest/testdb/test-validation-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({fieldNumberOdd: 11})
                .expect(200)
                .end(done)
            })
        })
      })

      describe('`greaterThan` operator', () => {
        it('should not allow setting number that fails validation', function (done) {
          client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldNumberGreaterThan: 10})
            .expect(400)
            .end(done)
        })

        it('should allow setting number that passes validation', function (done) {
          client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldNumberGreaterThan: 11})
            .expect(200)
            .end(done)
        })
      })

      describe('`greaterThanOrEqualTo` operator', () => {
        it('should not allow setting number that fails validation', function (done) {
          client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldNumberGreaterThanOrEqualTo: 9})
            .expect(400)
            .end(done)
        })

        it('should allow setting number that passes validation', function (done) {
          client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldNumberGreaterThanOrEqualTo: 10})
            .expect(200)
            .end(done)
        })
      })

      describe('`integer` operator', () => {
        it('should not allow setting number that fails validation', function (done) {
          client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldNumberInteger: 3.14})
            .expect(400)
            .end((err, res) => {
              if (err) return done(err)

              client
                .post('/vtest/testdb/test-validation-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({fieldNumberNotInteger: 5})
                .expect(400)
                .end(done)
            })
        })

        it('should allow setting number that passes validation', function (done) {
          client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldNumberInteger: 5})
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              client
                .post('/vtest/testdb/test-validation-schema')
                .set('Authorization', 'Bearer ' + bearerToken)
                .send({fieldNumberNotInteger: 3.14})
                .expect(200)
                .end(done)
            })
        })
      })

      describe('`lessThan` operator', () => {
        it('should not allow setting number that fails validation', function (done) {
          client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldNumberLessThan: 10})
            .expect(400)
            .end(done)
        })

        it('should allow setting number that passes validation', function (done) {
          client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldNumberLessThan: 9})
            .expect(200)
            .end(done)
        })
      })

      describe('`lessThanOrEqualTo` operator', () => {
        it('should not allow setting number that fails validation', function (done) {
          client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldNumberLessThanOrEqualTo: 11})
            .expect(400)
            .end(done)
        })

        it('should allow setting number that passes validation', function (done) {
          client
            .post('/vtest/testdb/test-validation-schema')
            .set('Authorization', 'Bearer ' + bearerToken)
            .send({fieldNumberLessThanOrEqualTo: 10})
            .expect(200)
            .end(done)
        })
      })
    })

    describe('Boolean', function () {
      it('should not allow setting non-boolean', function (done) {
        client
          .post('/vtest/testdb/test-validation-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({fieldBool: 'true'})
          .expect(400, done)
      })

      it('should allow setting boolean', function (done) {
        client
          .post('/vtest/testdb/test-validation-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({fieldBool: true})
          .expect(200, done)
      })

      it('should allow setting a required boolean to `false`', function (done) {
        client
          .post('/vtest/testdb/test-validation-schema-required-boolean')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({fieldBoolRequired: false})
          .expect(200)
          .end(done)
      })

      it('should contain JSON body in failure message', function (done) {
        client
          .post('/vtest/testdb/test-validation-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({fieldBool: 'true'})
          .expect(400)
          .expect('content-type', 'application/json')
          .end(function (err, res) {
            if (err) return done(err)

            res.body.should.be.json
            res.body.success.should.be.false
            res.body.errors[0].field.should.equal('fieldBool')
            res.body.errors[0].code.should.equal('ERROR_VALUE_INVALID')
            res.body.errors[0].message.should.equal('is wrong type')

            done(err)
          })
      })
    })

    describe('Mixed', function () {
      it('should allow any type', function (done) {
        client
          .post('/vtest/testdb/test-validation-schema')
          .set('Authorization', 'Bearer ' + bearerToken)
          .send({fieldMixed: true})
          .expect(200)
          .end(function (err, res) {
            if (err) return done(err)

            client
              .post('/vtest/testdb/test-validation-schema')
              .set('Authorization', 'Bearer ' + bearerToken)
              .send({fieldMixed: 'stringy'})
              .expect(200)
              .end(function (err) {
                if (err) return done(err)

                client
                  .post('/vtest/testdb/test-validation-schema')
                  .set('Authorization', 'Bearer ' + bearerToken)
                  .send({fieldMixed: 1337})
                  .expect(200)
                  .end(function (err) {
                    if (err) return done(err)

                    client
                      .post('/vtest/testdb/test-validation-schema')
                      .set('Authorization', 'Bearer ' + bearerToken)
                      .send({fieldMixed: { foo: new Date() }})  // foo must be included in the schema document to be validated
                      .expect(200)
                      .end(function (err, res) {
                        if (err) return done(err)

                        client
                          .post('/vtest/testdb/test-validation-schema')
                          .set('Authorization', 'Bearer ' + bearerToken)
                          .send({fieldMixed: { 'foo': 'bar', 'baz': 'qux' }})
                          .expect(200)
                          .end(done)
                      })
                  })
              })
          })
      })
    })
  })

  describe('Default value', function () {
    it('should be added to the request object if not supplied', function (done) {
      client
        .post('/vtest/testdb/test-validation-schema')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send({fieldString: 'stringy'})
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)

          res.body.should.be.json
          res.body.results.should.be.an.Array
          res.body.results[0].fieldDefault.should.exist
          res.body.results[0].fieldDefault.should.eql('FOO!')

          done()
        })
    })

    it('should not be added to the request object if it is already supplied', function (done) {
      client
        .post('/vtest/testdb/test-validation-schema')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send({fieldString: 'string', fieldDefault: 'bean'})
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)

          res.body.should.be.json
          res.body.results.should.be.an.Array
          res.body.results[0].fieldDefault.should.exist
          res.body.results[0].fieldDefault.should.eql('bean')

          done()
        })
    })

    it('should not be added to the request object if it is Boolean and already supplied', function (done) {
      client
        .post('/vtest/testdb/test-validation-schema')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send({fieldString: 'string', fieldDefaultBoolean: false})
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)

          res.body.should.be.json
          res.body.results.should.be.an.Array
          res.body.results[0].fieldDefaultBoolean.should.exist
          res.body.results[0].fieldDefaultBoolean.should.eql(false)

          done()
        })
    })

    it('should be added to the request object if it is Boolean false', function (done) {
      client
        .post('/vtest/testdb/test-validation-schema')
        .set('Authorization', 'Bearer ' + bearerToken)
        .send({fieldString: 'string'})
        .expect(200)
        .expect('content-type', 'application/json')
        .end(function (err, res) {
          if (err) return done(err)

          res.body.should.be.json
          res.body.results.should.be.an.Array
          res.body.results[0].fieldDefaultBooleanFalse.should.exist
          res.body.results[0].fieldDefaultBooleanFalse.should.eql(false)

          done()
        })
    })
  })
})
