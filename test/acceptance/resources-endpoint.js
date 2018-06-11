const app = require('./../../dadi/lib/')
const config = require('./../../config')
const fs = require('fs')
const help = require('./help')
const path = require('path')
const request = require('supertest')
const should = require('should')
const sinon = require('sinon')

let client = request(`http://${config.get('server.host')}:${config.get('server.port')}`)

describe('Resources endpoint', function () {
  let bearerToken

  before(done => {
    help.removeACLData(() => {
      app.start(done)  
    })
    
  })

  after(done => {
    help.removeACLData(() => {
      app.stop(done)  
    })
  })

  it('should return 401 if the request does not contain a valid bearer token', done => {
    client
    .get(`/api/resources`)
    .set('content-type', 'application/json')
    .end((err, res) => {
      res.statusCode.should.eql(401)

      done()
    })
  })

  it('should list collection, media and custom endpoint resources', done => {
    help.getBearerTokenWithPermissions({
      roles: ['some-role']
    }).then(bearerToken => {
      client
      .get(`/api/resources`)
      .set('content-type', 'application/json')
      .set('Authorization', `Bearer ${bearerToken}`)
      .end((err, res) => {
        Object.keys(app.components).forEach(key => {
          let component = app.components[key]
          let aclKey

          switch (component._type) {
            case app.COMPONENT_TYPE.COLLECTION:
            case app.COMPONENT_TYPE.MEDIA_COLLECTION:
              aclKey = component.model.aclKey

              break

            case app.COMPONENT_TYPE.CUSTOM_ENDPOINT:
              aclKey = component.aclKey

              break
          }

          if (!aclKey) return

          let match = res.body.results.some(result => {
            return result.name === aclKey
          })

          match.should.eql(true)
        })

        done()
      })
    })
  })  
})