const help = require('./../help')
const Matrix = require('./../../../dadi/lib/model/acl/matrix')
const should = require('should')

const EMPTY_MATRIX = {
  delete: false,
  deleteOwn: false,
  create: false,
  read: false,
  readOwn: false,
  update: false,
  updateOwn: false
}

describe('ACL access matrix', function () {
  it('should export function', () => {
    Matrix.should.be.Function
  })

  it('should export access types', () => {
    Matrix.ACCESS_TYPES.should.be.Array
  })

  it('should initialise with an empty map if none is supplied', () => {
    let matrix = new Matrix()

    matrix.map.should.eql({})
  })

  it('should initialise with the map supplied', () => {
    let map = {
      'collection:db_one': {
        create: true,
        readOwn: true
      },
      'collection:db_two': {
        create: false,
        updateOwn: true
      }
    }
    let matrix = new Matrix(map)

    matrix.map.should.eql(map)
  })

  describe('get()', () => {
    it('should return the access matrix for a given resource', () => {
      let map = {
        'collection:db_one': {
          create: true,
          readOwn: true
        },
        'collection:db_two': {
          create: false,
          updateOwn: true
        }
      }
      let matrix = new Matrix(map)

      matrix.get('collection:db_one').should.eql(
        map['collection:db_one']
      )
    })

    it('should return the access matrix for a given resource and format it for input', () => {
      let map = {
        'collection:db_one': {
          create: true,
          delete: {
            filter: {
              fieldOne: {
                $in: ['valueOne', 'valueTwo']
              }
            }
          },
          readOwn: true
        }
      }
      let matrix = new Matrix(map)

      matrix.get('collection:db_one', {
        formatForInput: true
      }).should.eql(
        Object.assign(
          {},
          map['collection:db_one'],
          {
            delete: {
              filter: JSON.stringify(map['collection:db_one'].delete.filter)
            }
          }
        )
      )
    })

    it('should return the access matrix for a given resource and format it for output', () => {
      let map = {
        'collection:db_one': {
          create: true,
          delete: {
            filter: '{"fieldOne":{"$in":["valueOne","valueTwo"]}}'
          },
          readOwn: true
        },
        'collection:db_two': {
          create: false,
          updateOwn: true
        }
      }
      let matrix = new Matrix(map)

      matrix.get('collection:db_one', {
        formatForOutput: true
      }).should.eql(
        Object.assign(
          {},
          EMPTY_MATRIX,
          map['collection:db_one'],
          {
            delete: {
              filter: JSON.parse(map['collection:db_one'].delete.filter)
            }
          }
        )
      )
    })

    it('should gracefully handle an ACL filter with a malformed JSON payload', () => {
      let map = {
        'collection:db_one': {
          create: true,
          delete: {
            filter: '{"fieldOne":{"$in":["valueOne","valueTwo"}}'
          },
          readOwn: true
        }
      }
      let matrix = new Matrix(map)

      matrix.get('collection:db_one', {
        formatForOutput: true
      }).should.eql(
        Object.assign(
          {},
          EMPTY_MATRIX,
          map['collection:db_one'],
          {
            delete: false
          }
        )
      )      
    })    
  })

  describe('getAll()', () => {
    it('should return the access matrix for all resources', () => {
      let map = {
        'collection:db_one': {
          create: true,
          readOwn: true
        },
        'collection:db_two': {
          create: false,
          updateOwn: true
        }
      }
      let matrix = new Matrix(map)

      matrix.getAll().should.eql(map)
    })

    it('should return the access matrix for all resources and format them for output', () => {
      let map = {
        'collection:db_one': {
          create: true,
          delete: {
            filter: {
              fieldOne: {
                $in: ['valueOne', 'valueTwo']
              }
            }
          },          
          readOwn: true
        },
        'collection:db_two': {
          create: false,
          delete: {
            filter: {
              fieldTwo: {
                $in: ['valueThree', 'valueFour']
              }
            }
          },          
          updateOwn: true
        }
      }
      let matrix = new Matrix(map)

      matrix.getAll({
        formatForInput: true
      }).should.eql({
        'collection:db_one': Object.assign(
          {},
          map['collection:db_one'],
          {
            delete: {
              filter: JSON.stringify(map['collection:db_one'].delete.filter)
            }
          }          
        ),
        'collection:db_two': Object.assign(
          {},
          map['collection:db_two'],
          {
            delete: {
              filter: JSON.stringify(map['collection:db_two'].delete.filter)
            }
          }          
        )
      })
    })

    it('should return the access matrix for all resources and format them for output', () => {
      let map = {
        'collection:db_one': {
          create: true,
          delete: {
            filter: '{"fieldOne":{"$in":["valueOne","valueTwo"]}}'
          },          
          readOwn: true
        },
        'collection:db_two': {
          create: false,
          delete: {
            filter: '{"fieldTwo":{"$in":["valueThree","valueFour"]}}'
          },          
          updateOwn: true
        }
      }
      let matrix = new Matrix(map)

      matrix.getAll({
        formatForOutput: true
      }).should.eql({
        'collection:db_one': Object.assign(
          {},
          EMPTY_MATRIX,
          map['collection:db_one'],
          {
            delete: {
              filter: JSON.parse(map['collection:db_one'].delete.filter)
            }
          }          
        ),
        'collection:db_two': Object.assign(
          {},
          EMPTY_MATRIX,
          map['collection:db_two'],
          {
            delete: {
              filter: JSON.parse(map['collection:db_two'].delete.filter)
            }
          }          
        )
      })
    })
  })

  describe('remove()', () => {
    it('should remove a resource from the map', () => {
      let map = {
        'collection:db_one': {
          create: true,
          readOwn: true
        },
        'collection:db_two': {
          create: false,
          updateOwn: true
        }
      }
      let matrix = new Matrix(map)

      matrix.map.should.eql(map)
      matrix.remove('collection:db_one')
      matrix.map.should.eql({
        'collection:db_two': map['collection:db_two']
      })
    })
  })

  describe('set()', () => {
    it('should merge an access matrix with the existing one for a particular resource', () => {
      let map = {
        'collection:db_one': {
          create: true,
          readOwn: true
        }
      }
      let matrix = new Matrix(map)

      matrix.map.should.eql(map)
      matrix.set('collection:db_one', {
        readOwn: false,
        read: true,
        update: true
      })
      matrix.map.should.eql({
        'collection:db_one': {
          create: true,
          readOwn: false,
          read: true,
          update: true
        }
      })
    })
  })

  describe('validation', () => {
    it('should throw an error for an invalid access type', done => {
      let matrix = new Matrix()

      try {
        matrix.validate({
          create: true,
          somethingElse: true
        })
      } catch (error) {
        error.should.be.Error
        error.message.should.eql('ACCESS_MATRIX_VALIDATION_FAILED')
        error.data.includes('Invalid access type: somethingElse').should.eql(true)

        done()
      }
    })

    it('should throw an error for an invalid access type value', done => {
      let matrix = new Matrix()

      try {
        matrix.validate({
          create: true,
          read: 123
        })
      } catch (error) {
        error.should.be.Error
        error.message.should.eql('ACCESS_MATRIX_VALIDATION_FAILED')
        error.data.includes(
          'Invalid value for read. Expected Boolean or Object'
        ).should.eql(true)

        done()
      }
    })    

    it('should throw an error for an invalid key in a complex access type', done => {
      let matrix = new Matrix()

      try {
        matrix.validate({
          create: {
            filter: {
              field1: 'valueOne'
            },
            somethingElse: true
          }
        })
      } catch (error) {
        error.should.be.Error
        error.message.should.eql('ACCESS_MATRIX_VALIDATION_FAILED')
        error.data.includes(
          'Invalid key in access matrix: create.somethingElse'
        ).should.eql(true)

        done()
      }
    })

    it('should throw an error if the value for a `fields` or `filter` properties are not an object', done => {
      let matrix = new Matrix()

      try {
        matrix.validate({
          create: {
            filter: 'string'
          },
          read: {
            fields: 'another string'
          }
        })
      } catch (error) {
        error.should.be.Error
        error.message.should.eql('ACCESS_MATRIX_VALIDATION_FAILED')
        error.data.includes(
          'Invalid value in access matrix for key create.filter (expected object)'
        ).should.eql(true)
        error.data.includes(
          'Invalid value in access matrix for key read.fields (expected object)'
        ).should.eql(true)

        done()
      }
    })

    it('should throw an error if the value for a `fields` property is not a valid field projection (invalid value)', done => {
      let matrix = new Matrix()

      try {
        matrix.validate({
          read: {
            fields: {
              fieldOne: 'something'
            }
          }
        })
      } catch (error) {
        error.should.be.Error
        error.message.should.eql('ACCESS_MATRIX_VALIDATION_FAILED')
        error.data.includes(
          'Invalid field projection in access matrix for read access type. Accepted values for keys are either 0 or 1 and they cannot be combined in the same projection'
        ).should.eql(true)

        done()
      }
    })

    it('should throw an error if the value for a `fields` property is not a valid field projection (combining inclusion and exclusion)', done => {
      let matrix = new Matrix()

      try {
        matrix.validate({
          read: {
            fields: {
              fieldOne: 1,
              fieldTwo: 1,
              fieldThree: 0
            }
          }
        })
      } catch (error) {
        error.should.be.Error
        error.message.should.eql('ACCESS_MATRIX_VALIDATION_FAILED')
        error.data.includes(
          'Invalid field projection in access matrix for read access type. Accepted values for keys are either 0 or 1 and they cannot be combined in the same projection'
        ).should.eql(true)

        done()
      }
    })

    it('should not throw an error for a valid access matrix', done => {
      let matrix = new Matrix()

      try {
        matrix.validate({
          create: false,
          deleteOwn: true,
          read: {
            fields: {
              fieldOne: 1,
              fieldTwo: 1,
              fieldThree: 1
            }
          },
          update: {
            filter: {
              fieldOne: 'valueOne'
            }
          }
        })

        done()
      } catch (error) {
        done(error)
      }
    })
  })
})
