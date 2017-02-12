#! /usr/bin/env node

'use strict'

var  Connection
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
        default: 'testClient'
      },
      {
        label: '-> Secret access key',
        key: 'secret',
        default: 'secretSquirrel'
      },
      {
        label: '-> Access type (admin, user)',
        key: 'type',
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

        db.insert(options, clientCollectionName, err => {
          if (err) throw err

          console.log()
          console.log('(*) Client created successfully:')
          console.log()
          console.log(options)
          console.log()

          db.close()
        })
      } else {
        db.close()
      }
    })
  }, 1000)
})
