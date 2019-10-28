const app = require('./../../dadi/lib/')
const config = require('./../../config')
const help = require('./help')
const request = require('supertest')
const should = require('should')

const connectionString = `http://${config.get('server.host')}:${config.get(
  'server.port'
)}`
const client = request(connectionString)
const configBackup = config.get()

let bearerToken

describe('Multi-language', function() {
  this.timeout(4000)

  before(() => {
    config.set('i18n.languages', ['fr', 'pt'])
  })

  after(() => {
    config.set('i18n.languages', configBackup.i18n.languages)
  })

  beforeEach(done => {
    help.dropDatabase('library', null, err => {
      if (err) return done(err)

      app.start(() => {
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
                count: 40
              },
              version: 'v1'
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
                },
                friend: {
                  type: 'Reference'
                }
              },
              name: 'person',
              property: 'library',
              settings: {
                cache: false,
                authenticate: true,
                count: 40
              },
              version: 'v1'
            }
          ])
          .then(() => {
            help.getBearerTokenWithAccessType('admin', (err, token) => {
              if (err) return done(err)

              bearerToken = token

              done()
            })
          })
      })
    })
  })

  afterEach(done => {
    help.dropSchemas().then(() => {
      app.stop(done)
    })
  })

  describe('Languages endpoint', () => {
    it('should return 401 if the request does not contain a valid bearer token', done => {
      client.get('/api/languages').end((err, res) => {
        if (err) return done(err)

        res.statusCode.should.eql(401)

        done()
      })
    })

    it('should return a list of all supported languages', done => {
      config.set('i18n.languages', ['en', 'fr', 'pt'])

      client
        .get('/api/languages')
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          const defaultLanguage = config.get('i18n.defaultLanguage')
          const supportedLanguages = config.get('i18n.languages')

          res.body.results.length.should.eql(3)
          res.body.results.forEach(language => {
            language.code.should.be.String
            language.name.should.be.String
            language.local.should.be.String
            language.default.should.be.Boolean

            language.default.should.eql(language.code === defaultLanguage)

            supportedLanguages.includes(language.code).should.eql(true)
          })

          res.body.metadata.defaultLanguage.code.should.eql(defaultLanguage)
          res.body.metadata.totalCount.should.eql(3)

          config.set('i18n.languages', configBackup.i18n.languages)

          done()
        })
    })

    it("should include the default language in the list of supported languages even if it's not part of `i18n.languages`", done => {
      config.set('i18n.languages', ['es', 'fr', 'pt'])

      client
        .get('/api/languages')
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          const defaultLanguage = config.get('i18n.defaultLanguage')
          const supportedLanguages = config.get('i18n.languages')

          res.body.results.length.should.eql(4)
          res.body.results.forEach(language => {
            language.code.should.be.String
            language.name.should.be.String
            language.local.should.be.String
            language.default.should.be.Boolean

            language.default.should.eql(language.code === defaultLanguage)

            supportedLanguages
              .concat(defaultLanguage)
              .includes(language.code)
              .should.eql(true)
          })

          res.body.metadata.defaultLanguage.code.should.eql(defaultLanguage)
          res.body.metadata.totalCount.should.eql(4)

          config.set('i18n.languages', configBackup.i18n.languages)

          done()
        })
    })

    it('should include a `fieldCharacter` property in the metadata block', done => {
      config.set('i18n.fieldCharacter', '@')

      client
        .get('/api/languages')
        .set('Authorization', `Bearer ${bearerToken}`)
        .expect(200)
        .end((err, res) => {
          if (err) return done(err)

          res.body.metadata.fieldCharacter.should.eql('@')

          config.set('i18n.fieldCharacter', configBackup.i18n.fieldCharacter)

          done()
        })
    })
  })

  it('should accept a language variation of a field, separated by the character configured in `i18n.fieldCharacter` (using default)', done => {
    const document = {
      title: 'The Little Prince',
      'title:pt': 'O Principezinho'
    }

    client
      .post('/library/book')
      .set('Authorization', `Bearer ${bearerToken}`)
      .send(document)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        res.body.results.length.should.eql(1)
        res.body.results[0].title.should.eql(document.title)
        res.body.results[0]['title:pt'].should.eql(document['title:pt'])

        done()
      })
  })

  it('should accept a language variation of a field, separated by the character configured in `i18n.fieldCharacter`', done => {
    const document = {
      title: 'The Little Prince',
      'title=pt': 'O Principezinho'
    }

    app.stop(() => {
      config.set('i18n.fieldCharacter', '=')

      app.start(() => {
        help.getBearerTokenWithAccessType('admin', (err, token) => {
          if (err) return done(err)

          bearerToken = token

          client
            .post('/library/book')
            .set('Authorization', `Bearer ${bearerToken}`)
            .send(document)
            .expect(200)
            .end((err, res) => {
              if (err) return done(err)

              res.body.results.length.should.eql(1)
              res.body.results[0].title.should.eql(document.title)
              res.body.results[0]['title=pt'].should.eql(document['title=pt'])

              config.set(
                'i18n.fieldCharacter',
                configBackup.i18n.fieldCharacter
              )

              done()
            })
        })
      })
    })
  })

  it('should accept a language variation of a field, even if the language in question is not part of `i18n.languages`', done => {
    config.set('i18n.languages', ['es', 'fr'])

    const document = {
      title: 'The Little Prince',
      'title:pt': 'O Principezinho'
    }

    client
      .post('/library/book')
      .set('Authorization', `Bearer ${bearerToken}`)
      .send(document)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        res.body.results.length.should.eql(1)
        res.body.results[0].title.should.eql(document.title)
        res.body.results[0]['title:pt'].should.eql(document['title:pt'])

        config.set('i18n.languages', configBackup.i18n.languages)

        done()
      })
  })

  it('should validate language variation of a field in the same way as the main field', done => {
    config.set('i18n.fieldCharacter', ':')

    const document = {
      title: 'The Little Prince',
      'title:pt': 123456
    }

    client
      .post('/library/book')
      .set('Authorization', `Bearer ${bearerToken}`)
      .send(document)
      .expect(400)
      .end((err, res) => {
        if (err) return done(err)

        res.body.success.should.eql(false)
        res.body.errors[0].field.should.eql('title:pt')
        res.body.errors[0].message.should.eql('is wrong type')

        config.get('i18n.fieldCharacter', configBackup.i18n.fieldCharacter)

        done()
      })
  })

  it('should retrieve all language variations if no `lang` parameter is supplied', done => {
    const document = {
      title: 'The Little Prince',
      'title:pt': 'O Principezinho',
      'title:fr': 'Le Petit Prince'
    }

    client
      .post('/library/book')
      .set('Authorization', `Bearer ${bearerToken}`)
      .send(document)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        client
          .get(`/library/book/${res.body.results[0]._id}`)
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect(200)
          .end((err, res) => {
            res.body.results.length.should.eql(1)

            const result = res.body.results[0]

            result.title.should.eql(document.title)
            result['title:pt'].should.eql(document['title:pt'])
            result['title:fr'].should.eql(document['title:fr'])

            should.not.exist(result._i18n)

            done()
          })
      })
  })

  it('should return the translation version of a field when there is one set for the language in the `lang` parameter, falling back to the default language', done => {
    config.set('i18n.languages', ['pt', 'fr'])

    const documents = [
      {
        title: 'The Little Prince',
        'title:pt': 'O Principezinho',
        'title:fr': 'Le Petit Prince'
      },
      {
        title: 'The Untranslatable'
      }
    ]

    client
      .post('/library/book')
      .set('Authorization', `Bearer ${bearerToken}`)
      .send(documents)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        client
          .get(`/library/book?lang=pt`)
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect(200)
          .end((err, res) => {
            res.body.results.length.should.eql(2)

            const results = res.body.results

            results[0].title.should.eql(documents[0]['title:pt'])
            results[0]._i18n.title.should.eql('pt')
            should.not.exist(results[0]['title:pt'])
            should.not.exist(results[0]['title:fr'])

            results[1].title.should.eql(documents[1].title)
            results[1]._i18n.title.should.eql(
              config.get('i18n.defaultLanguage')
            )
            should.not.exist(results[1]['title:pt'])
            should.not.exist(results[1]['title:fr'])

            config.set('i18n.languages', configBackup.i18n.languages)

            done()
          })
      })
  })

  it('should return the translation version of a field when the fields projection is set to include the field in question (with `lang` param)', done => {
    config.set('i18n.languages', ['pt', 'fr'])

    const documents = [
      {
        title: 'The Little Prince',
        'title:pt': 'O Principezinho',
        'title:fr': 'Le Petit Prince'
      },
      {
        title: 'The Untranslatable'
      }
    ]

    client
      .post('/library/book')
      .set('Authorization', `Bearer ${bearerToken}`)
      .send(documents)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        client
          .get(`/library/book?fields={"title":1}&lang=pt`)
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect(200)
          .end((err, res) => {
            res.body.results.length.should.eql(2)

            const results = res.body.results

            results[0].title.should.eql(documents[0]['title:pt'])
            results[0]._i18n.title.should.eql('pt')
            should.not.exist(results[0]['title:pt'])
            should.not.exist(results[0]['title:fr'])

            results[1].title.should.eql(documents[1].title)
            results[1]._i18n.title.should.eql(
              config.get('i18n.defaultLanguage')
            )
            should.not.exist(results[1]['title:pt'])
            should.not.exist(results[1]['title:fr'])

            config.set('i18n.languages', configBackup.i18n.languages)

            done()
          })
      })
  })

  it('should return the translation version of a field when the fields projection is set to include the field in question (without `lang` param)', done => {
    config.set('i18n.languages', ['pt', 'fr'])

    const documents = [
      {
        title: 'The Little Prince',
        'title:pt': 'O Principezinho',
        'title:fr': 'Le Petit Prince'
      },
      {
        title: 'The Untranslatable'
      }
    ]

    client
      .post('/library/book')
      .set('Authorization', `Bearer ${bearerToken}`)
      .send(documents)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        client
          .get(`/library/book?fields={"title":1}`)
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect(200)
          .end((err, res) => {
            res.body.results.length.should.eql(2)

            const results = res.body.results

            results[0].title.should.eql(documents[0]['title'])
            should.not.exist(results[0]._i18n)
            results[0]['title:pt'].should.eql(documents[0]['title:pt'])
            results[0]['title:fr'].should.eql(documents[0]['title:fr'])

            results[1].title.should.eql(documents[1].title)
            should.not.exist(results[1]._i18n)
            should.not.exist(results[1]['title:pt'])
            should.not.exist(results[1]['title:fr'])

            config.set('i18n.languages', configBackup.i18n.languages)

            done()
          })
      })
  })

  it('should return the original version of a field when the requested language is not part of `i18n.languages`', done => {
    config.set('i18n.languages', ['fr'])

    const document = {
      title: 'The Little Prince',
      'title:pt': 'O Principezinho',
      'title:fr': 'Le Petit Prince'
    }

    client
      .post('/library/book')
      .set('Authorization', `Bearer ${bearerToken}`)
      .send(document)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        client
          .get(`/library/book?cache=false&fields={"title":1}&lang=pt`)
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect(200)
          .end((err, res) => {
            res.body.results.length.should.eql(1)

            const results = res.body.results

            results[0].title.should.eql(document.title)
            results[0]._i18n.title.should.eql('en')
            should.not.exist(results[0]['title:pt'])
            should.not.exist(results[0]['title:fr'])

            config.set('i18n.languages', configBackup.i18n.languages)

            done()
          })
      })
  })

  it('should populate a `_i18n` field with a mapping of the language used for each translatable field', done => {
    config.set('i18n.languages', ['pt', 'fr'])

    const document = {
      name: 'Eduardo Bouças',
      occupation: 'Software engineer',
      'occupation:pt': 'Engenheiro de software',
      nationality: 'Portugal',
      education: "Master's degree",
      'education:pt': 'Mestrado'
    }

    client
      .post('/library/person')
      .set('Authorization', `Bearer ${bearerToken}`)
      .send(document)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        client
          .get(`/library/person/${res.body.results[0]._id}?lang=pt`)
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect(200)
          .end((err, res) => {
            res.body.results.length.should.eql(1)

            const result = res.body.results[0]

            result.name.should.eql(document.name)
            result.occupation.should.eql(document['occupation:pt'])
            result.nationality.should.eql(document.nationality)
            result.education.should.eql(document['education:pt'])

            should.exist(result._i18n)

            const defaultLanguage = config.get('i18n.defaultLanguage')

            result._i18n.name.should.eql(defaultLanguage)
            result._i18n.occupation.should.eql('pt')
            result._i18n.nationality.should.eql(defaultLanguage)
            result._i18n.education.should.eql('pt')

            config.set('i18n.languages', configBackup.i18n.languages)

            done()
          })
      })
  })

  it('should translate fields and create a `_i18n` map in referenced documents', done => {
    config.set('i18n.languages', ['pt', 'fr'])

    const document = {
      name: 'Eduardo Bouças',
      occupation: 'Software engineer',
      'occupation:pt': 'Engenheiro de software',
      nationality: 'Portugal',
      education: "Master's degree",
      'education:pt': 'Mestrado',
      friend: {
        name: 'Lord Voldemort',
        occupation: 'Wizard',
        'occupation:pt': 'Feiticeiro',
        nationality: 'United Kingdom',
        education: 'Doctorate',
        'education:pt': 'Doutoramento'
      }
    }

    client
      .post('/library/person')
      .set('Authorization', `Bearer ${bearerToken}`)
      .send(document)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        client
          .get(
            `/library/person/${res.body.results[0]._id}?lang=pt&compose=true`
          )
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect(200)
          .end((err, res) => {
            res.body.results.length.should.eql(1)

            const result = res.body.results[0]

            result.name.should.eql(document.name)
            result.occupation.should.eql(document['occupation:pt'])
            result.nationality.should.eql(document.nationality)
            result.education.should.eql(document['education:pt'])

            should.exist(result._i18n)

            const defaultLanguage = config.get('i18n.defaultLanguage')

            result._i18n.name.should.eql(defaultLanguage)
            result._i18n.occupation.should.eql('pt')
            result._i18n.nationality.should.eql(defaultLanguage)
            result._i18n.education.should.eql('pt')

            const referencedResult = res.body.results[0].friend

            referencedResult.name.should.eql(document.friend.name)
            referencedResult.occupation.should.eql(
              document.friend['occupation:pt']
            )
            referencedResult.nationality.should.eql(document.friend.nationality)
            referencedResult.education.should.eql(
              document.friend['education:pt']
            )

            should.exist(referencedResult._i18n)

            referencedResult._i18n.name.should.eql(defaultLanguage)
            referencedResult._i18n.occupation.should.eql('pt')
            referencedResult._i18n.nationality.should.eql(defaultLanguage)
            referencedResult._i18n.education.should.eql('pt')

            config.set('i18n.languages', configBackup.i18n.languages)

            done()
          })
      })
  })

  it('should return the translation version of a referenced field when the fields projection is set to include the field in question', done => {
    config.set('i18n.languages', ['pt', 'fr'])

    const document = {
      name: 'Eduardo Bouças',
      occupation: 'Software engineer',
      'occupation:pt': 'Engenheiro de software',
      nationality: 'Portugal',
      education: "Master's degree",
      'education:pt': 'Mestrado',
      friend: {
        name: 'Lord Voldemort',
        occupation: 'Wizard',
        'occupation:pt': 'Feiticeiro',
        nationality: 'United Kingdom',
        education: 'Doctorate',
        'education:pt': 'Doutoramento'
      }
    }

    client
      .post('/library/person')
      .set('Authorization', `Bearer ${bearerToken}`)
      .send(document)
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        client
          .get(
            `/library/person/${res.body.results[0]._id}?lang=pt&compose=true&fields={"occupation":1,"friend.occupation":1}`
          )
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect(200)
          .end((err, res) => {
            res.body.results.length.should.eql(1)

            const result = res.body.results[0]

            result.occupation.should.eql(document['occupation:pt'])

            should.exist(result._i18n)

            const defaultLanguage = config.get('i18n.defaultLanguage')

            result._i18n.occupation.should.eql('pt')

            const referencedResult = res.body.results[0].friend

            referencedResult.occupation.should.eql(
              document.friend['occupation:pt']
            )

            should.exist(referencedResult._i18n)

            referencedResult._i18n.occupation.should.eql('pt')

            config.set('i18n.languages', configBackup.i18n.languages)

            done()
          })
      })
  })

  it('should handle translations with special characters', done => {
    const original = {
      name: "I can eat glass and it doesn't hurt me."
    }
    const translations = {
      'name:af': 'Ek kan glas eet, maar dit doen my nie skade nie.',
      'name:an': "Puedo minchar beire, no me'n fa mal .",
      'name:ar': 'أنا قادر على أكل الزجاج و هذا لا يؤلمني.',
      'name:bg': 'Мога да ям стъкло, то не ми вреди.',
      'name:bo': 'ཤེལ་སྒོ་ཟ་ནས་ང་ན་གི་མ་རེད།',
      'name:ca': 'Puc menjar vidre, que no em fa mal.',
      'name:cs': 'Mohu jíst sklo, neublíží mi.',
      'name:cy': "Dw i'n gallu bwyta gwydr, 'dyw e ddim yn gwneud dolur i mi.",
      'name:da': 'Jeg kan spise glas, det gør ikke ondt på mig.',
      'name:de': 'Ich kann Glas essen, ohne mir zu schaden.',
      'name:el': 'Μπορώ να φάω σπασμένα γυαλιά χωρίς να πάθω τίποτα.',
      'name:eo': 'Mi povas manĝi vitron, ĝi ne damaĝas min.',
      'name:es': 'Puedo comer vidrio, no me hace daño.',
      'name:eu': 'Kristala jan dezaket, ez dit minik ematen.',
      'name:fa': '.من می توانم بدونِ احساس درد شيشه بخورم',
      'name:fi': 'Voin syödä lasia, se ei vahingoita minua.',
      'name:fo': 'Eg kann eta glas, skaðaleysur.',
      'name:fr': 'Je peux manger du verre, ça ne me fait pas mal.',
      'name:ga':
        'Is féidir liom gloinne a ithe. Ní dhéanann sí dochar ar bith dom.',
      'name:gd': 'S urrainn dhomh gloinne ithe; cha ghoirtich i mi.',
      'name:gl': 'Eu podo xantar cristais e non cortarme.',
      'name:he': 'אני יכול לאכול זכוכית וזה לא מזיק לי.',
      'name:hi': 'मैं काँच खा सकता हूँ और मुझे उससे कोई चोट नहीं पहुंचती.',
      'name:ht': "Mwen kap manje vè, li pa blese'm.",
      'name:hu': 'Meg tudom enni az üveget, nem lesz tőle bajom.',
      'name:is': 'Ég get etið gler án þess að meiða mig.',
      'name:it': 'Posso mangiare il vetro e non mi fa male.',
      'name:ja': '私はガラスを食べられます。それは私を傷つけません。',
      'name:km': 'ខ្ញុំអាចញុំកញ្ចក់បាន ដោយគ្មានបញ្ហារ',
      'name:ko': '나는 유리를 먹을 수 있어요. 그래도 아프지 않아요',
      'name:kw': 'Mý a yl dybry gwéder hag éf ny wra ow ankenya.',
      'name:lb': 'Ech kan Glas iessen, daat deet mir nët wei.',
      'name:lo': 'ຂອ້ຍກິນແກ້ວໄດ້ໂດຍທີ່ມັນບໍ່ໄດ້ເຮັດໃຫ້ຂອ້ຍເຈັບ.',
      'name:mk': 'Можам да јадам стакло, а не ме штета.',
      'name:mn': 'Би шил идэй чадна, надад хортой биш',
      'name:nb': 'Jeg kan spise glass uten å skade meg.',
      'name:ne': 'म काँच खान सक्छू र मलाई केहि नी हुन्‍न् ।',
      'name:nl': 'Ik kan glas eten, het doet mĳ geen kwaad.',
      'name:nn': 'Eg kan eta glas utan å skada meg.',
      'name:oc': 'Pòdi manjar de veire, me nafrariá pas.',
      'name:pl': 'Mogę jeść szkło i mi nie szkodzi.',
      'name:pt': 'Posso comer vidro, não me faz mal.',
      'name:rm': 'Jau sai mangiar vaider, senza che quai fa donn a mai.',
      'name:ro': 'Pot să mănânc sticlă și ea nu mă rănește.',
      'name:ru': 'Я могу есть стекло, оно мне не вредит.',
      'name:sa': 'काचं शक्नोम्यत्तुम् । नोपहिनस्ति माम् ॥',
      'name:sk': 'Môžem jesť sklo. Nezraní ma.',
      'name:sv': 'Jag kan äta glas utan att skada mig.',
      'name:th': 'ฉันกินกระจกได้ แต่มันไม่ทำให้ฉันเจ็บ',
      'name:tr': 'Cam yiyebilirim, bana zararı dokunmaz.',
      'name:uk': 'Я можу їсти скло, і воно мені не зашкодить.',
      'name:ur': 'میں کانچ کھا سکتا ہوں اور مجھے تکلیف نہیں ہوتی ۔',
      'name:vi': 'Tôi có thể ăn thủy tinh mà không hại gì.',
      'name:wa': "Dji pou magnî do vêre, çoula m' freut nén må.",
      'name:zh': '我能吞下玻璃而不伤身体。'
    }
    const languages = Object.keys(translations).map(field => {
      return field.split(':')[1]
    })

    config.set('i18n.languages', languages)

    client
      .post('/library/person')
      .set('Authorization', `Bearer ${bearerToken}`)
      .send(Object.assign(original, translations))
      .expect(200)
      .end((err, res) => {
        if (err) return done(err)

        const id = res.body.results[0]._id
        let i = 0

        client
          .get(`/library/person/${id}`)
          .set('Authorization', `Bearer ${bearerToken}`)
          .expect(200)
          .end((err, res) => {
            res.body.results.length.should.eql(1)

            res.body.results[0].name.should.eql(original.name)
            should.not.exist(res.body.results[0]._i18n)

            languages.forEach(language => {
              should.exist(res.body.results[0][`name:${language}`])

              client
                .get(`/library/person/${id}?lang=${language}`)
                .set('Authorization', `Bearer ${bearerToken}`)
                .expect(200)
                .end((err, res) => {
                  res.body.results.length.should.eql(1)

                  res.body.results[0].name.should.eql(
                    translations[`name:${language}`]
                  )
                  res.body.results[0]._i18n.name.should.eql(language)

                  if (++i === Object.keys(translations).length) {
                    config.set('i18n.languages', configBackup.i18n.languages)

                    done()
                  }
                })
            })
          })
      })
  })

  it('should throw an error at startup if `i18n.fieldCharacter` contains a `.`', done => {
    app.stop(() => {
      config.set('i18n.fieldCharacter', '.')

      try {
        app.start()
      } catch (err) {
        err.message.includes(
          'character "." is not allowed in "i18n.fieldCharacter" value'
        )

        config.set('i18n.fieldCharacter', configBackup.i18n.fieldCharacter)

        done()
      }
    })
  })

  it('should throw an error at startup if `i18n.fieldCharacter` contains a `@`', done => {
    app.stop(() => {
      config.set('i18n.fieldCharacter', '@')

      try {
        app.start()
      } catch (err) {
        err.message.includes(
          'character "@" is not allowed in "i18n.fieldCharacter" value'
        )

        config.set('i18n.fieldCharacter', configBackup.i18n.fieldCharacter)

        done()
      }
    })
  })
})
