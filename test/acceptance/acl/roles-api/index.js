const app = require('./../../../../dadi/lib')
const config = require('./../../../../config')
const help = require('./../../help')
const request = require('supertest')
const should = require('should')

describe('Roles API', () => {
  const configBackup = config.get()
  const client = request(
    `http://${config.get('server.host')}:${config.get('server.port')}`
  )

  before(done => {
    app.start(err => {
      if (err) return done(err)

      setTimeout(done, 300)
    })
  })

  beforeEach(done => {
    help.removeACLData(done)
  })

  after(done => {
    help.removeACLData(() => {
      app.stop(done)
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
