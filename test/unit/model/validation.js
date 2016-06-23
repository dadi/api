var should = require('should');
var Validator = require(__dirname + '/../../../dadi/lib/model/validator');
var help = require(__dirname + '/../help');

describe('Model validator', function () {
  describe('`query` method', function () {
    it('should exist', function (done) {
      var validator = new Validator();
      validator.query.should.be.Function;
      done();
    });

    it('should return validation object', function (done) {
      var validator = new Validator();
      var val = validator.query({$where: 'throw new Error("Insertion Attack!")'});

      val.success.should.be.false;
      val.errors.length.should.equal(1);
      val.errors[0].message.should.equal('Bad query');

      val = validator.query({});
      val.success.should.be.true;

      done();
    });
  });

  describe('`schema` method', function () {
    it('should exist', function (done) {
      var validator = new Validator();
      validator.schema.should.be.Function;
      done();
    });

    describe('validation object', function () {
      it('should inform of bad type', function (done) {
        var validator = new Validator({
          schema: {
            field1: {
              type: 'String',
              required: true
            }
          }
        });
        var val = validator.schema({field1: 123});
        val.success.should.be.false;
        val.errors.length.should.equal(1);
        val.errors[0].field.should.equal('field1');
        val.errors[0].message.should.equal('is wrong type');

        done();
      });

      it('should throw error if `limit` is used in schema', function (done) {
        var validator = new Validator({
          schema: {
            field1: {
              type: 'String',
              required: false,
              limit: 9
            }
          }
        });

        should.throws(function() { validator.schema({field1: '1234567890'}) })
        done();
      });

      it('should throw error if `validationRule` is used in schema', function (done) {
        var validator = new Validator({
          schema: {
            field1: {
              type: 'String',
              required: false,
              validationRule: '/a-z/'
            }
          }
        });

        should.throws(function() { validator.schema({field1: '1234567890'}) })
        done();
      });

      describe('DateTime', function () {
        it('should inform of invalid DateTime', function (done) {
          var validator = new Validator({
            schema: {
              field1: {
                type: 'DateTime',
                required: false
              }
            }
          });
          var val = validator.schema({field1: 'a123'});
          val.success.should.be.false;
          val.errors.length.should.equal(1);
          val.errors[0].field.should.equal('field1');
          val.errors[0].message.should.equal('is not a valid DateTime');

          done();
        });

        it('should allow passing Strings representing a date', function (done) {
          var validator = new Validator({
            schema: {
              field1: { type: 'DateTime', required: false },
              field2: { type: 'DateTime', required: false },
              field3: { type: 'DateTime', required: false },
              field4: { type: 'DateTime', required: false },
              field5: { type: 'DateTime', required: false }
            }
          });
          var val = validator.schema(
            {
              field1: '09/12/2016',
              field2: '2016-04-25',
              field3: '2010-01-01T05:06:07',
              field4: '2013-02-08T09:30:26.123+07:00',
              field5: 'Jan 1 2001'
            }
          );
          val.success.should.be.true;
          done();
        });

        it('should allow passing a Number representing a timestamp in milliseconds', function (done) {
          var validator = new Validator({
            schema: {
              field1: {
                type: 'DateTime',
                required: false
              }
            }
          });
          var val = validator.schema({field1: 1461820582000});
          val.success.should.be.true;
          done();
        });

        it('should allow passing a Number representing a timestamp in seconds', function (done) {
          var validator = new Validator({
            schema: {
              field1: {
                type: 'DateTime',
                required: false
              }
            }
          });
          var val = validator.schema({field1: 1461820582});
          val.success.should.be.true;
          done();
        });
      })

      describe('ObjectID', function () {
        it('should inform of bad type for ObjectID that is not string', function (done) {
          var validator = new Validator({
            schema: {
              field1: {
                type: 'ObjectID',
                required: false
              }
            }
          });
          var val = validator.schema({field1: 123});
          val.success.should.be.false;
          val.errors.length.should.equal(1);
          val.errors[0].field.should.equal('field1');
          val.errors[0].message.should.equal('is wrong type');

          done();
        });

        it('should inform of invalid ObjectID', function (done) {
          var validator = new Validator({
            schema: {
              field1: {
                type: 'ObjectID',
                required: false
              }
            }
          });
          var val = validator.schema({field1: '123'});
          val.success.should.be.false;
          val.errors.length.should.equal(1);
          val.errors[0].field.should.equal('field1');
          val.errors[0].message.should.equal('is not a valid ObjectID');

          done();
        });

        it('should allow valid ObjectID', function (done) {
          var validator = new Validator({
            schema: {
              field1: {
                type: 'ObjectID',
                required: false
              }
            }
          });
          var val = validator.schema({field1: '55cb1658341a0a804d4dadcc'});
          val.success.should.be.true;

          done();
        });

        it('should allow array of valid ObjectIDs', function (done) {
          var validator = new Validator({
            schema: {
              field1: {
                type: 'ObjectID',
                required: false
              }
            }
          });
          var val = validator.schema({field1: ['55cb1658341a0a804d4dadcc'] });
          val.success.should.be.true;

          done();
        });

        it('should not allow array with invalid string ObjectIDs', function (done) {
          var validator = new Validator({
            schema: {
              field1: {
                type: 'ObjectID',
                required: false
              }
            }
          });
          var val = validator.schema({field1: ['55cb1658341a0a804d4dadcc', '55cb1658341a0a8'] });
          val.success.should.be.false;

          done();
        });

        it('should not allow array with invalid ObjectIDs', function (done) {
          var validator = new Validator({
            schema: {
              field1: {
                type: 'ObjectID',
                required: false
              }
            }
          });
          var val = validator.schema({field1: [12345, 566788999] });
          val.success.should.be.false;

          done();
        });
      });

      it('should allow Reference types', function (done) {
        var validator = new Validator({
          schema: {
            field1: {
              type: 'Reference',
              required: false
            }
          }
        });

        var val = validator.schema({field1: '55cb1658341a0a804d4dadcc'});
        val.success.should.be.true;

        done();
      });

      describe('Missing/Blank', function () {
        it('should inform of missing field', function (done) {
          var validator = new Validator({
            schema: {
              field1: {
                type: 'String',
                required: true
              },
              field2: {
                type: 'Number',
                required: false
              }
            }
          });
          var val = validator.schema({field2: 123});
          val.success.should.be.false;
          val.errors.length.should.equal(1);
          val.errors[0].field.should.equal('field1');
          val.errors[0].message.should.equal('must be specified');

          done();
        });

        it('should inform of blank field', function (done) {
          var validator = new Validator({
            schema: {
              field1: {
                type: 'String',
                required: true
              },
              field2: {
                type: 'Number',
                required: false
              }
            }
          });
          var val = validator.schema({field1: '', field2: 123});
          val.success.should.be.false;
          val.errors.length.should.equal(1);
          val.errors[0].field.should.equal('field1');
          val.errors[0].message.should.equal('can\'t be blank');

          done();
        });

        it('should inform of blank field on update', function (done) {
          var validator = new Validator({
            schema: {
              field1: {
                type: 'String',
                required: true
              },
              field2: {
                type: 'Number',
                required: false
              }
            }
          });
          var val = validator.schema({field1: '', field2: 123}, true); // update == true
          val.success.should.be.false;
          val.errors.length.should.equal(1);
          val.errors[0].field.should.equal('field1');
          val.errors[0].message.should.equal('can\'t be blank');

          done();
        });

        it('should allow missing field on update', function (done) {
          var validator = new Validator({
            schema: {
              field1: {
                type: 'String',
                required: true
              },
              field2: {
                type: 'Number',
                required: false
              }
            }
          });

          var val = validator.schema({field2: 123}, true); // update == true
          val.success.should.be.true;

          done();
        });
      })

      describe('Default', function () {
        it('should add default value if field is missing', function (done) {
          var validator = new Validator({
            schema: {
              field1: {
                type: 'String',
                required: true
              },
              field2: {
                type: 'Number',
                required: false
              },
              field3: {
                type: 'String',
                required: true,
                default: 'foo'
              }
            }
          });
          var val = validator.schema({field1: 'bar', field2: 123});
          val.success.should.be.true;

          done();
        });

        it('should not add default value if Boolean field is false', function (done) {
          var validator = new Validator({
            schema: {
              field1: {
                type: 'String',
                required: true
              },
              field2: {
                type: 'Number',
                required: false
              },
              field3: {
                type: 'Boolean',
                required: true,
                default: true
              }
            }
          });
          var val = validator.schema({field1: 'bar', field2: 123, field3: false});
          val.success.should.be.true;

          done();
        });
      })

      describe('Mixed', function() {
        it('should allow Mixed fields that contain objects', function (done) {
          var validator = new Validator({
            schema: {
              field1: {
                type: 'String',
                required: false
              },
              field2: {
                type: 'Mixed',
                required: false
              }
            }
          });
          var val = validator.schema({field2: { hour: 20, minute: 30}});
          val.success.should.be.true;
          val.errors.length.should.equal(0);
          done();
        });
      });

      it('should inform of fields not in the schema', function (done) {
        var validator = new Validator({
          schema: {
            field1: {
              type: 'String',
              required: false
            },
            field2: {
              type: 'Mixed',
              required: false
            }
          }
        });
        var val = validator.schema({field3: 123});
        val.success.should.be.false;
        val.errors.length.should.equal(1);
        val.errors[0].field.should.equal('field3');
        val.errors[0].message.should.equal('doesn\'t exist in the collection schema');

        done();
      });

      it('should inform if field is too long', function (done) {

        // make sure limit works for number and string that can be coerced to number
        var validator = new Validator({
          schema: {
            field1: {
              type: 'String',
              required: false,
              validation: {
                maxLength: "9"
              }
            },
            field2: {
              type: 'String',
              validation: {
                maxLength: 9
              }
            }
          }
        });
        var val = validator.schema({field2: '1234567890'});
        val.success.should.be.false;
        val.errors.length.should.equal(1);
        val.errors[0].field.should.equal('field2');
        val.errors[0].message.should.equal('is too long');

        val = validator.schema({field1: '1234567890'});
        val.success.should.be.false;
        val.errors.length.should.equal(1);
        val.errors[0].field.should.equal('field1');
        val.errors[0].message.should.equal('is too long');

        val = validator.schema({field1: '123456789', field2: '123456789'});
        val.success.should.be.true;

        done();
      });

      describe('minLength', function () {

        it('should return false if string field is to short', function (done) {
          var validator = new Validator({
            schema: {
              field1: {
                type: 'String',
                required: false,
                validation: {
                minLength: 4
                }
              }
            }
          });

          val = validator.schema({field1: '123'});
          val.success.should.be.false;
          val.errors.length.should.equal(1);
          val.errors[0].field.should.equal('field1');
          val.errors[0].message.should.equal('is too short');

          done();
        });

        it('should return false if number field is to short', function (done) {

          // make sure limit works for number and string that can be coerced to number
          var validator = new Validator({
            schema: {
              field1: {
                type: 'Number',
                required: false,
                validation: {
                minLength: 4
                }
              }
            }
          });

          val = validator.schema({field1: 123});
          val.success.should.be.false;
          val.errors.length.should.equal(1);
          val.errors[0].field.should.equal('field1');
          val.errors[0].message.should.equal('is too short');

          done();
        });

        it('should return true if string field is specified length', function (done) {

          var validator = new Validator({
            schema: {
              field1: {
                type: 'String',
                required: false,
                validation: {
                minLength: 4
                }
              }
            }
          });

          val = validator.schema({field1: '1239'});
          val.success.should.be.true;

          done();
        });

      });

      describe('maxLength', function () {

        it('should return false if field is to long', function (done) {

          // make sure limit works for number and string that can be coerced to number
          var validator = new Validator({
            schema: {
              field1: {
                type: 'String',
                required: false,
                validation: {
                maxLength: 4
                }
              }
            }
          });

          val = validator.schema({field1: '123456789'});
          val.success.should.be.false;
          val.errors.length.should.equal(1);
          val.errors[0].field.should.equal('field1');
          val.errors[0].message.should.equal('is too long');

          done();
        });

        it('should return false if number field is to long', function (done) {

          // make sure limit works for number and string that can be coerced to number
          var validator = new Validator({
            schema: {
              field1: {
                type: 'Number',
                required: false,
                validation: {
                maxLength: 4
                }
              }
            }
          });

          val = validator.schema({field1: 123456778});
          val.success.should.be.false;
          val.errors.length.should.equal(1);
          val.errors[0].field.should.equal('field1');
          val.errors[0].message.should.equal('is too long');

          done();
        });

        it('should return true if string field is specified length', function (done) {

          var validator = new Validator({
            schema: {
              field1: {
                type: 'String',
                required: false,
                validation: {
                maxLength: 4
                }
              }
            }
          });

          val = validator.schema({field1: '1239'});
          val.success.should.be.true;

          done();
        });

      });

      describe('regex', function () {
        it('should return false if string field does not match the pattern', function (done) {

          var validator = new Validator({
            schema: {
              field1: {
                type: 'String',
                required: false,
                validation: {
                regex: {
                  pattern: /^abc/
                }
                }
              }
            }
          });

          val = validator.schema({field1: '123'});
          val.success.should.be.false;
          val.errors.length.should.equal(1);
          val.errors[0].field.should.equal('field1');
          val.errors[0].message.should.equal('should match the pattern /^abc/');

          done();
        });

        it('should return true if string field matches the pattern', function (done) {

          var validator = new Validator({
            schema: {
              field1: {
                type: 'String',
                required: false,
                validation: {
                regex: {
                  pattern: /^abc/
                }
                }
              }
            }
          });

          val = validator.schema({field1: 'abcdef'});
          val.success.should.be.true;

          done();
        });

      });

      describe('regex + length', function () {
        it('should return false if string field matches the pattern but is wrong length', function (done) {

          var validator = new Validator({
            schema: {
              field1: {
                type: 'String',
                required: false,
                validation: {
                regex: {
                  pattern: /^abc/
                },
                minLength: 6
                }
              }
            }
          });

          val = validator.schema({field1: 'abc'});

          val.success.should.be.false;
          val.errors.length.should.equal(1);
          val.errors[0].field.should.equal('field1');
          val.errors[0].message.should.equal('is too short');

          done();
        });
      });
    });
  });
});
