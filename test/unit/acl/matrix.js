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

describe('ACL access matrix', function() {
  it('should export function', () => {
    Matrix.should.be.Function
  })

  it('should export access types', () => {
    Matrix.ACCESS_TYPES.should.be.Array
  })

  it('should initialise with an empty map if none is supplied', () => {
    const matrix = new Matrix()

    matrix.map.should.eql({})
  })

  it('should initialise with the map supplied', () => {
    const map = {
      'collection:db_one': {
        create: true,
        readOwn: true
      },
      'collection:db_two': {
        create: false,
        updateOwn: true
      }
    }
    const matrix = new Matrix(map)

    matrix.map.should.eql(map)
  })

  describe('get()', () => {
    it('should return the access matrix for a given resource', () => {
      const map = {
        'collection:db_one': {
          create: true,
          readOwn: true
        },
        'collection:db_two': {
          create: false,
          updateOwn: true
        }
      }
      const matrix = new Matrix(map)

      matrix.get('collection:db_one').should.eql(map['collection:db_one'])
    })

    it('should return the access matrix for a given resource and add missing access types', () => {
      const map = {
        'collection:db_one': {
          create: true,
          readOwn: true
        },
        'collection:db_two': {
          create: false,
          updateOwn: true
        }
      }
      const matrix = new Matrix(map)

      matrix
        .get('collection:db_one', {
          addFalsyTypes: true
        })
        .should.eql(Object.assign({}, EMPTY_MATRIX, map['collection:db_one']))
    })

    it('should return the access matrix for a given resource and stringify ACL objects', () => {
      const map = {
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
      const matrix = new Matrix(map)

      matrix
        .get('collection:db_one', {
          stringifyObjects: true
        })
        .should.eql(
          Object.assign({}, map['collection:db_one'], {
            delete: {
              filter: JSON.stringify(map['collection:db_one'].delete.filter)
            }
          })
        )
    })

    it('should return the access matrix for a given resource and parse ACL objects', () => {
      const map = {
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
      const matrix = new Matrix(map)

      matrix
        .get('collection:db_one', {
          parseObjects: true
        })
        .should.eql(
          Object.assign({}, map['collection:db_one'], {
            delete: {
              filter: JSON.parse(map['collection:db_one'].delete.filter)
            }
          })
        )
    })

    it('should gracefully handle an ACL filter with a malformed JSON payload', () => {
      const map = {
        'collection:db_one': {
          create: true,
          delete: {
            filter: '{"fieldOne":{"$in":["valueOne","valueTwo"}}'
          },
          readOwn: true
        }
      }
      const matrix = new Matrix(map)

      matrix
        .get('collection:db_one', {
          parseObjects: true
        })
        .should.eql(
          Object.assign({}, map['collection:db_one'], {
            delete: false
          })
        )
    })
  })

  describe('getAll()', () => {
    it('should return the access matrix for all resources', () => {
      const map = {
        'collection:db_one': {
          create: true,
          readOwn: true
        },
        'collection:db_two': {
          create: false,
          updateOwn: true
        }
      }
      const matrix = new Matrix(map)

      matrix.getAll().should.eql(map)
    })

    it('should return the access matrix for all resources and add missing access types', () => {
      const map = {
        'collection:db_one': {
          create: true,
          readOwn: true
        },
        'collection:db_two': {
          create: false,
          updateOwn: true
        }
      }
      const matrix = new Matrix(map)

      matrix
        .getAll({
          addFalsyTypes: true
        })
        .should.eql({
          'collection:db_one': Object.assign(
            {},
            EMPTY_MATRIX,
            map['collection:db_one']
          ),
          'collection:db_two': Object.assign(
            {},
            EMPTY_MATRIX,
            map['collection:db_two']
          )
        })
    })

    it('should return the access matrix for all resources and stringify ACL objects', () => {
      const map = {
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
      const matrix = new Matrix(map)

      matrix
        .getAll({
          stringifyObjects: true
        })
        .should.eql({
          'collection:db_one': Object.assign({}, map['collection:db_one'], {
            delete: {
              filter: JSON.stringify(map['collection:db_one'].delete.filter)
            }
          }),
          'collection:db_two': Object.assign({}, map['collection:db_two'], {
            delete: {
              filter: JSON.stringify(map['collection:db_two'].delete.filter)
            }
          })
        })
    })

    it('should return the access matrix for all resources and parse ACL objects', () => {
      const map = {
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
      const matrix = new Matrix(map)

      matrix
        .getAll({
          parseObjects: true
        })
        .should.eql({
          'collection:db_one': Object.assign({}, map['collection:db_one'], {
            delete: {
              filter: JSON.parse(map['collection:db_one'].delete.filter)
            }
          }),
          'collection:db_two': Object.assign({}, map['collection:db_two'], {
            delete: {
              filter: JSON.parse(map['collection:db_two'].delete.filter)
            }
          })
        })
    })
  })

  describe('remove()', () => {
    it('should remove a resource from the map', () => {
      const map = {
        'collection:db_one': {
          create: true,
          readOwn: true
        },
        'collection:db_two': {
          create: false,
          updateOwn: true
        }
      }
      const matrix = new Matrix(map)

      matrix.map.should.eql(map)
      matrix.remove('collection:db_one')
      matrix.map.should.eql({
        'collection:db_two': map['collection:db_two']
      })
    })
  })

  describe('set()', () => {
    it('should merge an access matrix with the existing one for a particular resource', () => {
      const map = {
        'collection:db_one': {
          create: true,
          readOwn: true
        }
      }
      const matrix = new Matrix(map)

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

  describe('array and object notations', () => {
    it('should leave the map untouched when trying to convert from array notation to object notation a map that is not an array', () => {
      const matrix = new Matrix()
      const input = {
        'resource:one': {
          create: true,
          read: true,
          update: true
        },
        'resource:two': {
          delete: true,
          update: true
        }
      }

      matrix._convertArrayNotationToObjectNotation(input).should.eql(input)
    })

    it('should convert an empty map from array notation to object notation', () => {
      const matrix = new Matrix()
      const input = []

      matrix._convertArrayNotationToObjectNotation(input).should.eql({})
    })

    it('should convert a map from array notation to object notation', () => {
      const matrix = new Matrix()
      const input = [
        {
          r: 'resource:one',
          a: {
            create: true,
            read: true,
            update: true
          }
        },
        {
          r: 'resource:two',
          a: {
            delete: true,
            update: true
          }
        }
      ]

      matrix._convertArrayNotationToObjectNotation(input).should.eql({
        [input[0].r]: input[0].a,
        [input[1].r]: input[1].a
      })
    })

    it('should leave the map untouched when trying to convert from object notation to array notation a map that is already an array', () => {
      const matrix = new Matrix()
      const input = [
        {
          r: 'resource:one',
          a: {
            create: true,
            read: true,
            update: true
          }
        },
        {
          r: 'resource:two',
          a: {
            delete: true,
            update: true
          }
        }
      ]

      matrix._convertObjectNotationToArrayNotation(input).should.eql(input)
    })

    it('should convert an empty map from object notation to array notation', () => {
      const matrix = new Matrix()
      const input = {}

      matrix._convertArrayNotationToObjectNotation(input).should.eql([])
    })

    it('should convert a map from object notation to array notation', () => {
      const matrix = new Matrix()
      const input = {
        'resource:one': {
          create: true,
          read: true,
          update: true
        },
        'resource:two': {
          delete: true,
          update: true
        }
      }

      matrix._convertObjectNotationToArrayNotation(input).should.eql([
        {
          r: 'resource:one',
          a: input['resource:one']
        },
        {
          r: 'resource:two',
          a: input['resource:two']
        }
      ])
    })
  })
})
