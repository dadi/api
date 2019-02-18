const app = require('./../../../../dadi/lib')
const help = require('./../../help')
const should = require('should')

describe('Schemas API', () => {
  before(done => {
    app.start(err => {
      if (err) return done(err)

      setTimeout(done, 300)
    })
  })

  beforeEach(done => {
    help.removeACLData(() => {
      help.removeSchemaData(done)
    })
  })

  after(done => {
    help.removeACLData(() => {
      help.removeSchemaData(() => {
        app.stop(done)
      })
    })
  })

  describe('DELETE', require('./delete'))
  describe('GET', require('./get'))
  describe('POST', require('./post'))
  describe('PUT', require('./put'))
})
