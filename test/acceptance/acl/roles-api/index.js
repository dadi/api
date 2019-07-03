const app = require('./../../../../dadi/lib')
const help = require('./../../help')

describe('Roles API', () => {
  before(done => {
    app.start(err => {
      if (err) return done(err)

      setTimeout(() => {
        help
          .createSchemas(['library/book', 'library/person'])
          .then(() => done())
      }, 300)
    })
  })

  beforeEach(done => {
    help.removeACLData(done)
  })

  after(done => {
    help.removeACLData(() => {
      help.dropSchemas().then(() => {
        app.stop(done)
      })
    })
  })

  describe('DELETE', require('./delete'))
  describe('GET', require('./get'))
  describe('POST', require('./post'))
  describe('PUT', require('./put'))

  describe('Resources', () => {
    describe('DELETE', require('./resources-delete'))
    describe('POST', require('./resources-post'))
    describe('PUT', require('./resources-put'))
  })
})
