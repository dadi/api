const acl = require('./../../../dadi/lib/model/acl')
const ACL = acl.ACL
const app = require('./../../../dadi/lib')
const config = require('./../../../config')
const fs = require('fs-extra')
const help = require('./../help')
const path = require('path')
const request = require('supertest')
const should = require('should')

function assertAccess(access, conditions) {
  Object.keys(conditions).forEach(type => {
    if (typeof conditions[type] === 'function') {
      conditions[type](access[type]).should.eql(true)
    } else {
      access[type].should.eql(conditions[type])
    }
  })

  Object.keys(access).forEach(type => {
    if (conditions[type] === undefined) {
      should.not.exist(access[type])
    }
  })
}

describe('ACL', () => {
  afterEach(done => {
    help.removeACLData(done)
  })

  describe('Resources', () => {
    it('should register resources', done => {
      let acl = new ACL()
      let newResource = {
        name: 'my:resource',
        description: 'Description of the resource'
      }

      Object.keys(acl.resources).length.should.eql(0)

      acl.hasResource(newResource.name).should.eql(false)

      acl.registerResource(
        newResource.name,
        newResource.description
      )

      acl.hasResource(newResource.name).should.eql(true)

      should.exist(acl.resources[newResource.name])
      acl.resources['my:resource'].description.should.eql(
        newResource.description
      )

      done()
    })

    it('should return resources', done => {
      let acl = new ACL()
      let newResource = {
        name: 'my:resource',
        description: 'Description of the resource'
      }

      acl.registerResource(
        newResource.name,
        newResource.description
      )

      acl.getResources().should.eql({
        [newResource.name]: {
          description: newResource.description
        }
      })

      done()
    })
  })

  describe('Access', () => {
    it('should compute the correct access for a resource assigned directly to a client', () => {
      return help.createACLClient({
        clientId: 'testClient',
        secret: 'superSecret',
        resources: {
          'some:resource': {
            read: true
          }
        }
      }).then(client => {
        return acl.access.get({
          clientId: 'testClient'
        }, 'some:resource')
      }).then(access => {
        assertAccess(access, {
          read: true
        })
      })
    })

    it('should compute the correct access for a resource given to a client via a role', () => {
      return help.createACLRole({
        name: 'editor',
        resources: {
          'some:resource': {
            read: true
          }
        }
      }).then(() => {
        return help.createACLClient({
          clientId: 'testClient',
          secret: 'superSecret',
          roles: ['editor']
        })
      }).then(client => {
        return acl.access.get({
          clientId: 'testClient'
        }, 'some:resource')
      }).then(access => {
        assertAccess(access, {
          read: true
        })
      })
    })

    it('should compute the correct access for a resource given to a client via a parent role', () => {
      return help.createACLRole({
        name: 'editor',
        resources: {
          'some:resource': {
            read: true
          }
        }
      }).then(() => {
        return help.createACLRole({
          name: 'administrator',
          extends: 'editor'
        })        
      }).then(() => {
        return help.createACLClient({
          clientId: 'testClient',
          secret: 'superSecret',
          roles: ['administrator']
        })
      }).then(client => {
        return acl.access.get({
          clientId: 'testClient'
        }, 'some:resource')
      }).then(access => {
        assertAccess(access, {
          read: true
        })
      })
    })

    it('should compute the correct access for a resource by travelling up the role inheritance chain and getting the broadest permissions possible', () => {
      return help.createACLRole({
        name: 'editor',
        resources: {
          'some:resource': {
            read: true,
            update: true
          }
        }
      }).then(() => {
        return help.createACLRole({
          name: 'administrator',
          extends: 'editor',
          resources: {
            'some:resource': {
              create: true
            }
          }
        })        
      }).then(() => {
        return help.createACLClient({
          clientId: 'testClient',
          secret: 'superSecret',
          roles: ['administrator'],
          resources: {
            'some:resource': {
              delete: true
            }
          }
        })
      }).then(client => {
        return acl.access.get({
          clientId: 'testClient'
        }, 'some:resource')
      }).then(access => {
        assertAccess(access, {
          delete: true,
          create: true,
          read: true,
          update: true
        })
      })
    })

    it('should give priority to `true` permissions over an object with filters', () => {
      return help.createACLRole({
        name: 'editor',
        resources: {
          'some:resource': {
            read: true
          }
        }
      }).then(() => {
        return help.createACLClient({
          clientId: 'testClient',
          secret: 'superSecret',
          roles: ['editor'],
          resources: {
            'some:resource': {
              read: {
                filter: {
                  fieldOne: 'valueOne'
                }
              }
            }
          }
        })
      }).then(client => {
        return acl.access.get({
          clientId: 'testClient'
        }, 'some:resource')
      }).then(access => {
        assertAccess(access, {
          read: true
        })
      })
    })

    it('should give priority to `true` permissions over an object with fields', () => {
      return help.createACLRole({
        name: 'editor',
        resources: {
          'some:resource': {
            read: true
          }
        }
      }).then(() => {
        return help.createACLClient({
          clientId: 'testClient',
          secret: 'superSecret',
          roles: ['editor'],
          resources: {
            'some:resource': {
              read: {
                fields: {
                  fieldOne: 1,
                  fieldTwo: 1
                }
              }
            }
          }
        })
      }).then(client => {
        return acl.access.get({
          clientId: 'testClient'
        }, 'some:resource')
      }).then(access => {
        assertAccess(access, {
          read: true
        })
      })
    })

    it('should give priority to an object with filters over falsy permissions', () => {
      let filter = {
        fieldOne: {
          $in: ['123', '456']
        }
      }

      return help.createACLRole({
        name: 'editor',
        resources: {
          'some:resource': {
            read: false
          }
        }
      }).then(() => {
        return help.createACLClient({
          clientId: 'testClient',
          secret: 'superSecret',
          roles: ['editor'],
          resources: {
            'some:resource': {
              read: {
                filter
              }
            }
          }
        })
      }).then(client => {
        return acl.access.get({
          clientId: 'testClient'
        }, 'some:resource')
      }).then(access => {
        assertAccess(access, {
          read: {
            filter
          }
        })
      })
    })  

    it('should give priority to an object with fields over falsy permissions', () => {
      let fields = {
        fieldOne: 1,
        fieldTwo: 1
      }

      return help.createACLRole({
        name: 'editor',
        resources: {
          'some:resource': {
            read: false
          }
        }
      }).then(() => {
        return help.createACLClient({
          clientId: 'testClient',
          secret: 'superSecret',
          roles: ['editor'],
          resources: {
            'some:resource': {
              read: {
                fields
              }
            }
          }
        })
      }).then(client => {
        return acl.access.get({
          clientId: 'testClient'
        }, 'some:resource')
      }).then(access => {
        assertAccess(access, {
          read: {
            fields
          }
        })
      })
    })

    it('should merge the fields objects when combining multiple access matrices (combination #1)', () => {
      return help.createACLRole({
        name: 'editor',
        resources: {
          'some:resource': {
            read: {
              fields: {
                fieldOne: 1,
                fieldTwo: 2
              }
            }
          }
        }
      }).then(() => {
        return help.createACLRole({
          name: 'administrator',
          extends: 'editor',
          resources: {
            'some:resource': {
              read: {
                fields: {
                  fieldThree: 1
                }
              }
            }
          }
        })
      }).then(() => {
        return help.createACLClient({
          clientId: 'testClient',
          secret: 'superSecret',
          roles: ['administrator'],
          resources: {
            'some:resource': {
              read: {
                fields: {
                  fieldThree: 0,
                  fieldFour: 0
                }
              }
            }
          }
        })
      }).then(client => {
        return acl.access.get({
          clientId: 'testClient'
        }, 'some:resource')
      }).then(access => {
        assertAccess(access, {
          read: {
            fields: {
              fieldFour: 0
            }
          }
        })
      })
    })

    it('should merge the fields objects when combining multiple access matrices (combination #2)', () => {
      return help.createACLRole({
        name: 'editor',
        resources: {
          'some:resource': {
            read: {
              fields: {
                fieldOne: 0
              }
            }
          }
        }
      }).then(() => {
        return help.createACLRole({
          name: 'administrator',
          extends: 'editor',
          resources: {
            'some:resource': {
              read: {
                fields: {
                  fieldOne: 1
                }
              }
            }
          }
        })
      }).then(() => {
        return help.createACLClient({
          clientId: 'testClient',
          secret: 'superSecret',
          roles: ['administrator'],
          resources: {
            'some:resource': {
              read: {
                fields: {
                  fieldThree: 1,
                  fieldFour: 1
                }
              }
            }
          }
        })
      }).then(client => {
        return acl.access.get({
          clientId: 'testClient'
        }, 'some:resource')
      }).then(access => {
        assertAccess(access, {
          read: true
        })
      })
    })

    it('should merge the fields objects when combining multiple access matrices (combination #3)', () => {
      return help.createACLRole({
        name: 'editor',
        resources: {
          'some:resource': {
            read: {
              fields: {
                fieldOne: 1
              }
            }
          }
        }
      }).then(() => {
        return help.createACLRole({
          name: 'administrator',
          extends: 'editor',
          resources: {
            'some:resource': {
              read: {
                fields: {
                  fieldTwo: 1
                }
              }
            }
          }
        })
      }).then(() => {
        return help.createACLClient({
          clientId: 'testClient',
          secret: 'superSecret',
          roles: ['administrator'],
          resources: {
            'some:resource': {
              read: {
                fields: {
                  fieldThree: 1,
                  fieldFour: 1
                }
              }
            }
          }
        })
      }).then(client => {
        return acl.access.get({
          clientId: 'testClient'
        }, 'some:resource')
      }).then(access => {
        assertAccess(access, {
          read: {
            fields: {
              fieldOne: 1,
              fieldTwo: 1,
              fieldThree: 1,
              fieldFour: 1
            }
          }
        })
      })
    })

    it('should return all the resources accessible by a client', () => {
      return help.createACLRole({
        name: 'editor',
        resources: {
          'collection:one': {
            read: true
          },
          'collection:two': {
            create: true
          },
          'collection:three': {
            read: {
              fields: {
                fieldOne: 1
              }
            }
          },
          'collection:four': {
            read: {
              filter: {
                fieldOne: 'value'
              }
            }
          }
        }
      }).then(() => {
        return help.createACLClient({
          clientId: 'testClient',
          secret: 'superSecret',
          resources: {
            'collection:one': {
              update: true
            },
            'collection:two': {
              create: false
            },
            'collection:three': {
              read: {
                fields: {
                  fieldTwo: 1,
                  fieldThree: 1
                }
              }
            },
            'collection:four': {
              read: true 
            },
            'collection:five': {
              update: true
            }
          },
          roles: ['editor']
        })
      }).then(client => {
        return acl.access.get({
          clientId: 'testClient'
        })
      }).then(matrices => {
        assertAccess(matrices['collection:one'], {
          read: true,
          update: true
        })

        assertAccess(matrices['collection:two'], {
          create: true
        })

        assertAccess(matrices['collection:three'], {
          read: {
            fields: {
              fieldOne: 1,
              fieldTwo: 1,
              fieldThree: 1
            }
          }
        })

        assertAccess(matrices['collection:four'], {
          read: true
        })

        assertAccess(matrices['collection:five'], {
          update: true
        })
      })      
    })
  })
})
