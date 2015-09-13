var should = require('should');
var Validator = require(__dirname + '/../../../bantam/lib/model/validator');
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

            it('should inform of additional fields', function (done) {
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

            it('should inform if field is to long', function (done) {

                // make sure limit works for number and string that can be coerced to number
                var validator = new Validator({
                    schema: {
                        field1: {
                            type: 'String',
                            required: false,
                            limit: "9"
                        },
                        field2: {
                            type: 'String',
                            limit: 9
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
        });
    });
});
