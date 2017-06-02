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

describe.skip('Hooks', function () {

  // reset database
  before(function (done) {
    help.dropDatabase('test', function (err) {
      if (err) return done(err)
console.log('dropped')
      app.start((err) => {
        if (err) return done(err)
console.log('started')
        // get access token
        help.getBearerTokenWithAccessType('admin', (err, token) => {
          if (err) return done(err)
          bearerToken = token
          console.log(token)
          done()
        })
        })
      })
    //})
  })

  after(function (done) {
    app.stop(done)
  })

//   var newSchema = JSON.parse(JSON.stringify(require(path.resolve(dirs.collections + '/../schemas/collection.new-test-schema.json'))))
//   fs.writeFileSync(newSchemaPath, JSON.stringify(newSchema))
//
//   app.start(done)

//   if (fs.existsSync(newSchemaPath)) fs.unlinkSync(newSchemaPath)

  it('testing failure when specifying _layout as a field in a GET request', function (done) {
    var article = {
    	"originalId" : 79343,
    	"publicationDate" : 1469162676000,
    	"isLegacy" : true,
    	"title" : "Cyclist in hospital following crash on the banks of Loch Ness",
    	"mobileTitle" : "",
    	"metaTitle" : "",
    	"metaDescription" : "",
    	"tagLine" : "",
    	"subtitle" : "A motorcyclist is being treated at Raigmore Hospital this morning after being thrown from his bike on the banks of Loch Ness.",
    	"content" : [
    		"**A motorcyclist is being treated at Raigmore Hospital this morning after being thrown from his bike on the banks of Loch Ness.**",
    		"He was travelling along the A82 near Glenmoriston when the accident happened at around 1.40pm yesterday afternoon.",
    		"Emergency services helped rescue the man from the edge of the loch, with the help of lifeboat volunteers from RNLI.",
    		"A spokesman for Loch Ness RNLI said: “We were asked to assist because he had been thrown onto the lochside and was in a difficult to access, steep area.",
    		"“He had tried to scramble up to the roadside and couldn't make it.",
    		"“We helped him back up with the assistance of the fire service and he was taken to hospital.”",
    		"It's understood the man is being treated for suspected leg injuries."
    	],
    	"author" : "57a476c6a510df48125da1c3",
    	"heroImage" : [
    		"57a47713a510df48125e052e"
    	],
    	"heroImageLandscape" : [
    		{
    			"width" : 778,
    			"height" : 436,
    			"x" : 0,
    			"y" : 161
    		}
    	],
    	"heroImageThumbLandscape" : [
    		{
    			"width" : 380,
    			"height" : 285,
    			"x" : 0,
    			"y" : 243
    		}
    	],
    	"images" : [ ],
    	"tags" : [
    		"57a476d5a510df48125dacd9"
    	],
    	"publications" : [
    		"57aa2fd9c57f5ce6369aa33a",
    		"57aa2fdbc57f5ce6369aa35b",
    		"57aa2fd9c57f5ce6369aa33a",
    		"57aa2fd8c57f5ce6369aa315"
    	],
    	"categories" : [
    		"57aa2fbfc57f5ce6369a9f2c",
    		"57aa2fbfc57f5ce6369a9f2c",
    		"57aa2fbfc57f5ce6369a9f2c",
    		"57aa2fbfc57f5ce6369a9f2c"
    	],
    	"primarySyndicatePosition" : 0,
    	"published" : {
    		"state" : "published",
    		"scheduledStart" : 1471503540,
    		"scheduledEnd" : null
    	},
    	"embeds" : [ ],
    	"_layout" : {
    		"hero" : [
    			{
    				"index" : 0,
    				"source" : "heroImage"
    			}
    		],
    		"body" : [
    			{
    				"index" : 0,
    				"source" : "content"
    			},
    			{
    				"index" : 1,
    				"source" : "content"
    			},
    			{
    				"index" : 2,
    				"source" : "content"
    			},
    			{
    				"index" : 3,
    				"source" : "content"
    			},
    			{
    				"index" : 4,
    				"source" : "content"
    			},
    			{
    				"index" : 5,
    				"source" : "content"
    			},
    			{
    				"index" : 6,
    				"source" : "content"
    			}
    		]
    	},
    	"pageTemplate" : "article",
    	"furl" : "cyclist-in-hospital-following-crash-on-the-banks-of-loch-ness",
    	"urls" : [
    		"mfr-2/local/news/cyclist-in-hospital-following-crash-on-the-banks-of-loch-ness",
    		"mfr/local/news/cyclist-in-hospital-following-crash-on-the-banks-of-loch-ness",
    		"mfr-2/local/news/cyclist-in-hospital-following-crash-on-the-banks-of-loch-ness",
    		"mfr-3/local/news/cyclist-in-hospital-following-crash-on-the-banks-of-loch-ness"
    	],
    	"heroImagePortrait" : null,
    	"heroImageThumb" : null,
    	"hidePublicationDate" : false,
    	"excerpt" : "",
    	"urlOverride" : "",
    	"canonical" : "",
    	"toplistFeature" : false,
    	"isAdvertorial" : false,
    	"campaign_name" : "",
    	"trackingPixel" : "57b550451afba38e182619dc",
    	"sponsor" : "57b550451afba38e182619dd"
    }

  //  config.set('query.useVersionFilter', true)

    sinon.stub(hook.Hook.prototype, 'load').returns(require(__dirname + '/workspace/hooks/layout.js'))

    var client = request(connectionString)

    // create article
    client
    .post('/3rdparty/radio/articles')
    .send(article)
    .set('content-type', 'application/json')
    .set('Authorization', 'Bearer ' + bearerToken)
    .end(function (err, res) {
      if (err) return done(err)
      console.log(res.body)

      var newArticle = res.body.results[0]

      // GET the article
      client
      .get('/3rdparty/radio/articles/' + newArticle._id)
      .set('content-type', 'application/json')
      .set('Authorization', 'Bearer ' + bearerToken)
      .end(function (err, res) {
        if (err) return done(err)

        console.log(res.body)

        should.exist(res.body.results)
        should.exist(res.body.results[0])

        var articleResponse = res.body.results[0]
        should.exist(articleResponse._layout)

        // GET the article with qs params
        client
        .get('/3rdparty/radio/articles/' + newArticle._id + '?fields={"_layout":1}')
        .set('content-type', 'application/json')
        .set('Authorization', 'Bearer ' + bearerToken)
        .end(function (err, res) {
          if (err) return done(err)

          hook.Hook.prototype.load.restore()

          should.exist(res.body.results)
          should.exist(res.body.results[0])

          var articleResponse = res.body.results[0]
          should.exist(articleResponse._layout)

          done()
        })
      })
    })
  })

  it.skip('should not cause creation of duplicate records', function (done) {
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

      console.log(res.body)

      // create articles schema
      client
      .post('/vtest/testdb/articles/config')
      .send(JSON.stringify(articleSchema, null, 2))
      .set('content-type', 'text/plain')
      .set('Authorization', 'Bearer ' + bearerToken)
      .end(function (err, res) {
        if (err) return done(err)

        console.log(res.body)

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

          console.log(res.body)

          // get the new id
          var publicationId = res.body.results[0]._id

          // create an article
          var article = {
            title: 'An Article To Test Hooks',
            published: {},
            publications: [publicationId.toString()]
          }

          console.log(article)

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

            console.log(article)
            console.log('/vtest/testdb/articles/' + articleId.toString())
            client
            .put('/vtest/testdb/articles/' + articleId.toString())
            .send(article)
            .set('content-type', 'application/json')
            .set('Authorization', 'Bearer ' + bearerToken)
            .end(function (err, res) {
              console.log(err)
              if (err) return done(err)

              console.log(res.body)

              client
              .get('/vtest/testdb/publications')
              .set('Authorization', 'Bearer ' + bearerToken)
              .end(function (err, res) {
                if (err) return done(err)

                var publicationResults = res.body.results

                console.log(publicationResults)

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
    //"sort": "publicationDate",
    "index": {
        "enabled": true,
        "keys": {
            "_id": 1,
            "urls": 1,
            "publicationDate": 1
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
slugifyHook += '    console.log(obj)\n'
slugifyHook += '    var field = getFieldValue(data.options.override, object) || getFieldValue(data.options.from, object)\n'
slugifyHook += '    if (field) {\n'
slugifyHook += '      obj[data.options.to] = field.toLowerCase()\n'
slugifyHook += '    }\n'
slugifyHook += '    return obj\n'
slugifyHook += '}\n'

var hookFunction = eval(slugifyHook)
