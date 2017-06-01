#! /usr/bin/env node

'use strict'

const Connection = require('@dadi/api').Connection
const config = require('@dadi/api').Config

const options = config.get('auth.database')
options.auth = true
const connection = Connection(options)
const clientCollectionName = config.get('auth.clientCollection')

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

        const existingClients = db.collection(clientCollectionName).find({
          clientId: options.clientId
        })

        existingClients.toArray((err, documents) => {
          if (documents.length > 0) {
            console.log(`(x) The identifier ${options.clientId} already exists. Exiting...`)

            db.close()

            return
          }

          db.collection(clientCollectionName).insert(options, err => {
            if (err) throw err

            console.log()
            console.log('(*) Client created successfully:')
            console.log()
            console.log(options)
            console.log()

            db.close()
          })
        })
      } else {
        db.close()
      }
    })
  }, 1000)
})
