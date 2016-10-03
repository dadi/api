var _ = require('underscore')
var app = require(__dirname + '/../../dadi/lib/')
var config = require(__dirname + '/../../config')
var connection = require(__dirname + '/../../dadi/lib/model/connection')
var fs = require('fs')
var help = require(__dirname + '/help')
var hook = require(__dirname + '/../../dadi/lib/model/hook')
var model = require(__dirname + '/../../dadi/lib/model')
var path = require('path')
var should = require('should')
var sinon = require('sinon')
var request = require('supertest')

// variables scoped for use throughout tests
var bearerToken
var connectionString = 'http://' + config.get('server.host') + ':' + config.get('server.port')

describe('Hooks', function () {

  // reset database
  before(function (done) {
    help.dropDatabase('test', function (err) {
      if (err) return done(err)

      app.start((err) => {
        if (err) return done(err)

        // get access token
        help.getBearerTokenWithAccessType('admin', (err, token) => {
          if (err) return done(err)
          bearerToken = token
          done()
        })
      })
    })
  })

  after(function (done) {
    app.stop(done)
  })

//   var newSchema = JSON.parse(JSON.stringify(require(path.resolve(dirs.collections + '/../schemas/collection.new-test-schema.json'))))
//   fs.writeFileSync(newSchemaPath, JSON.stringify(newSchema))
//
//   app.start(done)

//   if (fs.existsSync(newSchemaPath)) fs.unlinkSync(newSchemaPath)

  it('should not cause creation of duplicate records', function (done) {
    config.set('query.useVersionFilter', true)

    var client = request(connectionString)

    // create publications schema
    client
    .post('/vtest/testdb/publications/config')
    .send(JSON.stringify(publicationSchema, null, 2))
    .set('content-type', 'text/plain')
    .set('Authorization', 'Bearer ' + bearerToken)
    .end(function (err, res) {
      if (err) return done(err)

      // create articles schema
      client
      .post('/vtest/testdb/articles/config')
      .send(JSON.stringify(articleSchema, null, 2))
      .set('content-type', 'text/plain')
      .set('Authorization', 'Bearer ' + bearerToken)
      .end(function (err, res) {
        if (err) return done(err)

        sinon.stub(hook.Hook.prototype, 'load').returns(hookFunction)

        // create a publication
        var publication = {
          name: 'Test FM'
        }

        client
        .post('/vtest/testdb/publications')
        .send(publication)
        .set('content-type', 'application/json')
        .set('Authorization', 'Bearer ' + bearerToken)
        .end(function (err, res) {
          if (err) return done(err)

          // get the new id
          var publicationId = res.body.results[0]._id

          // create an article
          var article = {
            title: 'An Article To Test Hooks',
            published: {},
            publications: [publicationId.toString()]
          }

          client
          .post('/vtest/testdb/articles')
          .send(article)
          .set('content-type', 'application/json')
          .set('Authorization', 'Bearer ' + bearerToken)
          .end(function (err, res) {
            if (err) return done(err)

            // get the new id
            var articleId = res.body.results[0]._id

            // update the article
            article.title = 'Updated Article Title'

            client
            .put('/vtest/testdb/articles/' + articleId)
            .send(article)
            .set('content-type', 'application/json')
            .set('Authorization', 'Bearer ' + bearerToken)
            .end(function (err, res) {
              if (err) return done(err)

              client
              .get('/vtest/testdb/publications')
              .set('Authorization', 'Bearer ' + bearerToken)
              .end(function (err, res) {
                if (err) return done(err)

                var publicationResults = res.body.results

                client
                .get('/vtest/testdb/articles')
                .set('Authorization', 'Bearer ' + bearerToken)
                .end(function (err, res) {
                  if (err) return done(err)

                  publicationResults.length.should.eql(1)

                  hook.Hook.prototype.load.restore()

                  done()
                })
              })
            })
          })
        })
      })
    })
  })
})

var publicationSchema = {
  "fields": {
    "name": {
      "type": "String",
      "label": "Name",
      "validation": {
        "maxLength": 250
      },
      "publish": {
        "section": "Editorial",
        "subSection": "Content"
      },
      "required": false,
      "display": {
        "index": true,
        "edit": true
      }
    },
    "furl": {
      "type": "String",
      "label": "URL Formatted Name",
      "validation": {
        "maxLength": 250
      },
      "publish": {
        "section": "Meta",
        "subSection": "Url"
      },
      "required": false,
      "display": {
        "index": true,
        "edit": true
      }
    },
    "url": {
      "type": "String",
      "label": "URL",
      "publish": {
        "section": "Meta",
        "subSection": "Url"
      },
      "required": false,
      "display": {
        "index": true,
        "edit": false
      }
    },
    "urlOverride": {
      "type": "String",
      "label": "URL Override",
      "publish": {
        "section": "Meta",
        "subSection": "Url"
      },
      "required": false,
      "display": {
        "index": true,
        "edit": false
      }
    }
  },
  "settings": {
    "cache": true,
    "compose": true,
    "callback": null,
    "defaultFilters": null,
    "fieldLimiters": null,
    "cacheTTL": 300,
    "authenticate": true,
    "publish": {
      "group": "Taxonomy"
    },
    "allowExtension": true,
    "displayName": "Publications",
    "count": 100,
    "sortOrder": 1,
    "hooks": {
      "beforeCreate": [
        {
          "hook": "slugify",
          "options": {
            "from": "name",
            "override": "urlOverride",
            "to": "furl"
          }
        }
      ],
      "beforeUpdate": [
        {
          "hook": "slugify",
          "options": {
            "from": "name",
            "override": "urlOverride",
            "to": "furl"
          }
        }
      ]
    },
    "lastModifiedAt": 1467082904736
  }
}

var articleSchema = {
  "fields": {
    "published": {
      "type": "Object",
      "label": "Published State",
      "required": true,
      "publish": {
        "section": "Syndication",
        "subSection": "Placement",
        "subType": "PublishedState"
      },
      "search": {
        "indexed": false,
        "store": true
      },
      "display": {
        "filter": false,
        "index": true,
        "edit": true
      }
    },
    "syndicates": {
      "type": "Object",
      "label": "Syndicates",
      "required": false,
      "publish": {
        "section": "Syndication",
        "subSection": "Placement",
        "subType": "Syndicates"
      },
      "search": {
        "indexed": false,
        "store": true
      },
      "display": {
        "index": true,
        "edit": true
      }
    },
    "publications": {
      "type": "Reference",
      "settings": {
        "collection": "publications",
        "multiple": true,
        "fields": [
          "name",
          "furl"
        ]
      },
      "publish": {
        "section": "Taxonomy",
        "subSection": "Syndicates",
        "displayField": "name",
        "limit": 0
      },
      "search": {
        "indexed": false,
        "store": true
      },
      "label": "Publications",
      "required": false,
      "display": {
        "filter": true,
        "index": false,
        "edit": false
      }
    },
    "categories": {
      "type": "Reference",
      "settings": {
        "collection": "categories",
        "multiple": true,
        "fields": [
          "name",
          "furl",
          "parent"
        ]
      },
      "search": {
        "indexed": false,
        "store": true
      },
      "publish": {
        "section": "Taxonomy",
        "subSection": "Syndicates",
        "displayField": "name",
        "limit": 0
      },
      "label": "Categories",
      "required": false,
      "display": {
        "filter": true,
        "index": false,
        "edit": false
      }
    },
    "primarySyndicatePosition": {
      "type": "Number",
      "label": "Primary Syndicate",
      "required": false,
      "publish": {
        "section": "Taxonomy",
        "subSection": "Syndicates"
      },
      "search": {
        "indexed": false,
        "store": true
      },
      "display": {
        "index": false,
        "edit": false
      }
    },
    "title": {
      "type": "String",
      "label": "Title",
      "validation": {
        "maxLength": 500
      },
      "required": true,
      "publish": {
        "displaySize": "kilo",
        "section": "Editorial",
        "subSection": "Text"
      },
      "search": {
        "indexed": true,
        "store": true,
        "weight": 2
      },
      "display": {
        "filter": true,
        "index": true,
        "edit": true
      }
    },
    "furl": {
      "type": "String",
      "label": "Friendly URL",
      "publish": {
        "section": "Meta",
        "subSection": "Url"
      },
      "required": false,
      "display": {
        "index": false,
        "edit": true
      }
    },
    "urlOverride": {
      "type": "String",
      "label": "URL Override",
      "publish": {
        "section": "Meta",
        "subSection": "Url"
      },
      "required": false,
      "display": {
        "index": false,
        "edit": true
      }
    }
  },
  "settings": {
    "cache": true,
    "cacheTTL": 300,
    "authenticate": true,
    "compose": true,
    "callback": null,
    "displayName": "Articles",
    "storeRevisions": true,
    "defaultFilters": null,
    "fieldLimiters": null,
    "type": "article",
    "publish": {
      "group": "Content",
      "messageCollection": "messages"
    },
    "allowExtension": true,
    "standardEditPage": true,
    "allowDelete": true,
    "count": 20,
    "sortOrder": 1,
    "sort": "publicationDate",
    "index": {
        "enabled": true,
        "keys": {
            "_id": 1,
            "urls": 1
        }
    },
    "hooks": {
      "afterGet": [],
      "beforeCreate": [{
        "hook": "slugify",
        "options": {
          "from": "title",
          "override": "urlOverride",
          "to": "furl"
        }
      }],
      "afterCreate": [],
      "beforeUpdate": [{
        "hook": "slugify",
        "options": {
          "from": "title",
          "override": "urlOverride",
          "to": "furl"
        }
      }],
      "afterUpdate": []
    },
    "lastModifiedAt": 1466596322579
  }
}

var slugifyHook = ''
slugifyHook += 'var slugify = require("underscore.string/slugify")\n'
slugifyHook += 'var _ = require("underscore")\n'
slugifyHook += '\n'
slugifyHook += 'var getFieldValue = function(fieldName, object) {\n'
slugifyHook += '  if (!fieldName) return\n'
slugifyHook += '    fieldName = fieldName.split(".")\n'
slugifyHook += '  _.each(fieldName, (child) => {\n'
slugifyHook += '    if (!_.isUndefined(object[child])) {\n'
slugifyHook += '      object = object[child]\n'
slugifyHook += '    } else {\n'
slugifyHook += '      return\n'
slugifyHook += '    }\n'
slugifyHook += '  })\n'
slugifyHook += '  return Boolean(object.length) ? object : false\n'
slugifyHook += '}\n'
slugifyHook += '\n'
slugifyHook += 'module.exports = function (obj, type, data) {\n'
slugifyHook += '  // if (type === "beforeUpdate" || type === "beforeCreate") {\n'
slugifyHook += '    var object = _.clone(obj)\n'
slugifyHook += '    //console.log(object)\n'
slugifyHook += '    var field = getFieldValue(data.options.override, object) || getFieldValue(data.options.from, object)\n'
slugifyHook += '    if (field) {\n'
slugifyHook += '      obj[data.options.to] = slugify(field)\n'
slugifyHook += '    }\n'
slugifyHook += '    return obj\n'
slugifyHook += '}\n'

var hookFunction = eval(slugifyHook)