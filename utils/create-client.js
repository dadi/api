const Connection = require(__dirname + '/../dadi/lib/model/connection')
const config = require(__dirname + '/../config')

const connection = Connection(config.get('auth.database'))
const clientCollectionName = config.get('auth.clientCollection')

const prompt = require('cli-prompt')

connection.on('connect', db => {
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

      db.collection(clientCollectionName).insert(options, err => {
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
})
