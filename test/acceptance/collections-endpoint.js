const app = require('./../../dadi/lib/')
const config = require('./../../config')
const fs = require('fs')
const help = require('./help')
const path = require('path')
const request = require('supertest')
const should = require('should')
const sinon = require('sinon')

const client = request(
  `http://${config.get('server.host')}:${config.get('server.port')}`
)

describe('Collections endpoint', function() {
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
      .get(`/api/collections`)
      .set('content-type', 'application/json')
      .end((err, res) => {
        res.statusCode.should.eql(401)

        done()
      })
  })

  it('should return all the collections if the requesting client has admin access', done => {
    help
      .getBearerTokenWithPermissions({
        accessType: 'admin'
      })
      .then(token => {
        client
          .get(`/api/collections`)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${token}`)
          .end((err, res) => {
            const allCollections = help.getCollectionMap()

            res.body.collections.length.should.eql(
              Object.keys(allCollections).length
            )

            Object.keys(allCollections).forEach(key => {
              const match = res.body.collections.some(collection => {
                return collection.path === key
              })

              match.should.eql(true)
            })

            done()
          })
      })
  })

  it('should include the fields and settings for each collection', done => {
    help
      .getBearerTokenWithPermissions({
        accessType: 'admin'
      })
      .then(token => {
        client
          .get(`/api/collections`)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${token}`)
          .end((err, res) => {
            const allCollections = help.getCollectionMap()

            res.body.collections.length.should.eql(
              Object.keys(allCollections).length
            )

            Object.keys(allCollections).forEach(key => {
              const match = res.body.collections.some(collection => {
                if (collection.path === key) {
                  collection.fields.should.eql(allCollections[key].fields)
                  Object.keys(collection.settings).should.eql(
                    Object.keys(allCollections[key].settings)
                  )

                  return true
                }

                return false
              })

              match.should.eql(true)
            })

            done()
          })
      })
  })

  it('should return only the collections the requesting client has read access to', done => {
    help
      .getBearerTokenWithPermissions({
        resources: {
          'collection:testdb_articles': {
            read: true
          },
          'collection:testdb_publications': {
            create: true
          },
          'collection:testdb_test-schema': {
            read: false
          },
          'collection:radio_articles': {
            read: {
              fields: JSON.stringify({
                fieldOne: 1
              })
            }
          }
        }
      })
      .then(token => {
        client
          .get(`/api/collections`)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${token}`)
          .end((err, res) => {
            res.body.collections.length.should.eql(2)

            const collection1 = res.body.collections.some(collection => {
              return collection.path === '/vtest/testdb/articles'
            })

            const collection2 = res.body.collections.some(collection => {
              return collection.path === '/vtest/testdb/publications'
            })

            const collection3 = res.body.collections.some(collection => {
              return collection.path === '/vtest/testdb/test-schema'
            })

            const collection4 = res.body.collections.some(collection => {
              return collection.path === '/3rdparty/radio/articles'
            })

            collection1.should.eql(true)
            collection2.should.eql(false)
            collection3.should.eql(false)
            collection4.should.eql(true)

            done()
          })
      })
  })

  it('should return all the collections if the requesting client has admin access', done => {
    help
      .getBearerTokenWithPermissions({
        accessType: 'admin'
      })
      .then(token => {
        client
          .get(`/api/collections`)
          .set('content-type', 'application/json')
          .set('Authorization', `Bearer ${token}`)
          .end((err, res) => {
            const allCollections = help.getCollectionMap()

            res.body.collections.length.should.eql(
              Object.keys(allCollections).length
            )

            Object.keys(allCollections).forEach(key => {
              const match = res.body.collections.some(collection => {
                collection.version.should.be.String
                collection.database.should.be.String
                collection.name.should.be.String
                collection.slug.should.be.String
                collection.path.should.be.String

                return collection.path === key
              })

              match.should.eql(true)
            })

            done()
          })
      })
  })
})
