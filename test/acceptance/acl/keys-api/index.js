const app = require('./../../../../dadi/lib')
const help = require('./../../help')

describe('Keys API', () => {
  before(done => {
    app.start(err => {
      if (err) return done(err)

      setTimeout(() => {
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

  describe('Resources', () => {
    describe('DELETE', require('./resources-delete'))
    describe('POST', require('./resources-post'))
    describe('PUT', require('./resources-put'))
  })
})
