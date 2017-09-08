#! /usr/bin/env node

'use strict'

var Connection
var config

try {
  Connection = require('@dadi/api').Connection
  config = require('@dadi/api').Config
} catch (err) {
  Connection = require(__dirname + '/../dadi/lib/model/connection')
  config = require(__dirname + '/../config')
}

const clientCollectionName = config.get('auth.clientCollection')
const dbOptions = { auth: true, database: config.get('auth.database'), collection: clientCollectionName }
const connection = Connection(dbOptions, config.get('auth.datastore'))

const prompt = require('cli-prompt')

let connected = false

// Temporarily restore original console
delete console.log

connection.on('connect', db => {
  if (connected) return

  connected = true

  setTimeout(() => {
    console.log()
    console.log('==================================')
    console.log(' DADI API Client Record Generator ')
    console.log('==================================')
    console.log()

    prompt.multi([
      {
        label: '-> Client identifier',
        key: 'clientId',
        default: 'api-client'
      },
      {
        label: '-> Secret access key',
        key: 'secret',
        default: 'client-secret'
      },
      {
        label: '-> Access type (admin, user)',
        key: 'accessType',
        default: 'user'
      },
      {
        label: '(!) Is this ok?',
        key: 'confirm',
        type: 'boolean'
      }
    ], options => {
      if (options.confirm) {
        delete options.confirm

        // check for an existing client account
        db.find({
          clientId: options.clientId
        }, clientCollectionName, {}, getSchema()).then(existingClients => {
          if (existingClients.length > 0) {
            console.log(`(x) The identifier ${options.clientId} already exists. Exiting...`)
            return
          }

          db.insert(options, clientCollectionName, getSchema()).then(result => {
            console.log()
            console.log('(*) Client created successfully:')
            console.log()
            console.log(options)
            console.log()

            process.exit(0)
          }).catch((err) => {
            throw err
          })
        })
      } else {
        process.exit(0)
      }
    })
  }, 1000)
})

function getSchema () {
  return {
    fields: {
      token: {
        type: 'String',
        required: true
      },
      tokenExpire: {
        type: 'Number',
        required: true
      },
      created: {
        type: 'DateTime',
        required: true
      },
      value: {
        type: 'Object',
        required: false
      }
    },
    settings: {
      cache: false
    }
  }
}