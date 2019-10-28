const app = require('./../../../../dadi/lib')
const help = require('./../../help')

describe('Roles API', () => {
  before(done => {
    app.start(err => {
      if (err) return done(err)

      setTimeout(() => {
        help
          .createSchemas([
            {
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
              name: 'book',
              property: 'library',
              settings: {
                cache: false,
                authenticate: true,
                count: 40,
                lastModifiedAt: 1496029984527
              },
              version: '1.0'
            },

            {
              fields: {
                name: {
                  type: 'String',
                  required: true
                },
                occupation: {
                  type: 'String',
                  required: false
                },
                nationality: {
                  type: 'String',
                  required: false
                },
                education: {
                  type: 'String',
                  required: false
                },
                spouse: {
                  type: 'Reference'
                }
              },
              name: 'person',
              property: 'library',
              settings: {
                cache: false,
                authenticate: true,
                count: 40,
                lastModifiedAt: 1496029984536
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
  describe('PUT', require('./put'))

  describe('Resources', () => {
    describe('DELETE', require('./resources-delete'))
    describe('POST', require('./resources-post'))
    describe('PUT', require('./resources-put'))
  })
})
