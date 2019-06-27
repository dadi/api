#! /usr/bin/env node

'use strict'

const prompt = require('cli-prompt')

let api

try {
  api = require('@dadi/api')
} catch (err) {
  api = require(process.cwd())
}

// Temporarily restore original console
delete console.log

console.log()
console.log('==================================')
console.log(' DADI API Client Record Generator ')
console.log('==================================')
console.log()

prompt.multi(
  [
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
  ],
  options => {
    if (!options.confirm) {
      return process.exit(0)
    }

    delete options.confirm

    api.ACL.client
      .create(options, {
        allowAccessType: true
      })
      .then(response => {
        console.log()
        console.log('(*) Client created successfully:')
        console.log()
        console.log(response)
        console.log()

        process.exit(0)
      })
      .catch(error => {
        if (error.message === 'CLIENT_EXISTS') {
          console.log(
            `(x) The identifier ${options.clientId} already exists. Exiting...`
          )
        } else {
          console.log('(x) An unexpected error occurred:', error.message)
        }

        process.exit(0)
      })
  }
)
