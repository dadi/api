var should = require('should');
var fs = require('fs');
var request = require('supertest');
var _ = require('underscore');
var config = require(__dirname + '/../../config');
var help = require(__dirname + '/help');
var app = require(__dirname + '/../../dadi/lib/');

// variables scoped for use throughout tests
var bearerToken;
var connectionString = 'http://' + config.get('server.host') + ':' + config.get('server.port');

describe.only('Layout', function () {

  before(function (done) {
    this.timeout(8000);
    help.dropDatabase('testdb', function (err) {
      if (err) return done(err);

      app.start(function() {
          help.getBearerTokenWithAccessType("admin", function (err, token) {
            if (err) return done(err);

            bearerToken = token;

            // add a new field to the schema
            var jsSchemaString = fs.readFileSync(__dirname + '/../new-schema.json', {encoding: 'utf8'});
            jsSchemaString = jsSchemaString.replace('newField', 'title');
            var schema = JSON.parse(jsSchemaString);

            schema.fields.author = _.extend({}, schema.fields.title, {
              type: 'String'
            });

            schema.fields.paragraph = _.extend({}, schema.fields.title, {
              type: 'String'
            });

            schema.fields.pullquote = _.extend({}, schema.fields.title, {
              type: 'String'
            });

            schema.fields.image = _.extend({}, schema.fields.title, {
              type: 'Object'
            });

            schema.settings.type = 'article';
            schema.settings.layout = [
              {
                "source": "title"
              },
              {
                "free": true,
                "name": "mainbody",
                "displayName": "Main Body",
                "fields": [
                  {
                    "source": "paragraph",
                    "min": 1
                  },
                  {
                    "source": "image",
                    "max": 2
                  },
                  {
                    "source": "pullquote"
                  }
                ]
              },
              {
                "source": "author"
              },
              {
                "free": true,
                "name": "secondarybody",
                "displayName": "Secondary Body",
                "fields": [
                  {
                    "source": "paragraph"
                  },
                  {
                    "source": "image",
                    "max": 5
                  }
                ]
              }      
            ];

            var client = request(connectionString);

            client
            .post('/vtest/testdb/test-schema/config')
            .send(JSON.stringify(schema, null, 4))
            .set('content-type', 'text/plain')
            .set('Authorization', 'Bearer ' + bearerToken)
            .expect(200)
            .expect('content-type', 'application/json')
            .end(function (err, res) {
              if (err) return done(err);

              done();
          });
        });
      });
    });
  });

  after(function (done) {
      // reset the schema
      // var jsSchemaString = fs.readFileSync(__dirname + '/../new-schema.json', {encoding: 'utf8'});
      // var schema = JSON.parse(jsSchemaString);

      // var client = request(connectionString);

      // client
      // .post('/vtest/testdb/test-schema/config')
      // .send(JSON.stringify(schema, null, 4))
      // .set('content-type', 'text/plain')
      // .set('Authorization', 'Bearer ' + bearerToken)
      // .expect(200)
      // .expect('content-type', 'application/json')
      // .end(function (err, res) {
      //     if (err) return done(err);

      //     app.stop(done);
      // });
  })

  it('should throw an error when layout validation fails', function (done) {
    var doc = {
      title: 'A title',
      author: 'An author',
      paragraph: ['Paragraph 1', 'Paragraph 2'],
      pullquote: ['Pull quote 1'],
      image: [
        {
          path: '/some/path.jpg',
          width: 600,
          height: 400
        },
        {
          path: '/some/other/path.jpg',
          width: 800,
          height: 600
        },
        {
          path: '/yet/another/path.jpg',
          width: 1024,
          height: 768
        }
      ],
      _layout: {
        'mainbody': [
          {
            source: 'image',
            index: 0
          },
          {
            source: 'image',
            index: 1
          },
          {
            source: 'image',
            index: 2
          }
        ]
      }
    };

    var errors = [
      {
        field: '_layout',
        message: 'Layout section \'mainbody\' must contain at least 1 instances of \'paragraph\''
      },
      {
        field: '_layout',
        message: 'Layout section \'mainbody\' cannot contain more than 2 instances of \'image\''
      }
    ];

    request('http://' + config.get('server.host') + ':' + config.get('server.port'))
    .post('/vtest/testdb/test-schema')
    .set('Authorization', 'Bearer ' + bearerToken)
    .send(doc)
    .expect(400)
    .end(function (err, res) {
      console.log('*** ERR:', err);
      if (err) return done(err);

      res.body.success.should.be.false;

      JSON.stringify(res.body.errors).should.equal(JSON.stringify(errors));

      done();
    });
  })

  it('should insert a document with layout', function (done) {
    var doc = {
      title: 'A title',
      author: 'An author',
      paragraph: ['Paragraph 1', 'Paragraph 2'],
      pullquote: ['Pull quote 1'],
      image: [
        {
          path: '/some/path.jpg',
          width: 600,
          height: 400
        },
        {
          path: '/some/other/path.jpg',
          width: 800,
          height: 600
        }
      ],
      _layout: {
        'mainbody': [
          {
            source: 'paragraph',
            index: 0
          },
          {
            source: 'image',
            index: 0
          },
          {
            source: 'paragraph',
            index: 1
          },
          {
            source: 'pullquote',
            index: 0
          }
        ],
        'secondarybody': [
          {
            source: 'image',
            index: 1
          }
        ]
      }
    };

    var resolvedLayout = [
      {
        content: 'A title',
        type: 'title'
      },
      {
        content: 'Paragraph 1',
        displayName: 'Main Body',
        free: true,
        name: 'mainbody',
        type: 'paragraph'
      },
      {
        content: {
          path: '/some/path.jpg',
          width: 600,
          height: 400
        },
        displayName: 'Main Body',
        free: true,
        name: 'mainbody',
        type: 'image'
      },
      {
        content: 'Paragraph 2',
        displayName: 'Main Body',
        free: true,
        name: 'mainbody',
        type: 'paragraph'
      },
      {
        content: 'Pull quote 1',
        displayName: 'Main Body',
        free: true,
        name: 'mainbody',
        type: 'pullquote'
      },
      {
        content: 'An author',
        type: 'author'
      },
      {
        content: {
          path: '/some/other/path.jpg',
          width: 800,
          height: 600
        },
        displayName: 'Secondary Body',
        free: true,
        name: 'secondarybody',
        type: 'image'
      }
    ];

    request('http://' + config.get('server.host') + ':' + config.get('server.port'))
    .post('/vtest/testdb/test-schema')
    .set('Authorization', 'Bearer ' + bearerToken)
    .send(doc)
    .expect(200)
    .end(function (err, res) {
        if (err) return done(err);

        JSON.stringify(res.body.results[0]._layout).should.equal(JSON.stringify(resolvedLayout));

        done(null, res.body.results[0]);
    });
  });

});
