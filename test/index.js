const fs = require('fs')
const path = require('path')
const should = require('should')

function serialiser(key, value) {
  if (value instanceof RegExp) {
    return ['<<REGEXP_', value.toString(), '_REGEXP>>']
  }

  return value
}

global.___dbOps = global.___dbOps || []

let previousFilePath = null

beforeEach(function() {
  const filePath = path.relative(
    path.resolve(__dirname, '../'),
    this.currentTest.file
  )

  if (filePath !== previousFilePath) {
    previousFilePath = filePath

    global.___dbOps.push({
      file: filePath
    })
  }

  global.___dbOps.push({
    test: this.currentTest.title
  })
  global.___skipTestFromScript = false
})

after(() => {
  const payload = global.___dbOps.map(op => {
    if (typeof op.file === 'string') {
      return `#${op.file}`
    } else if (typeof op.test === 'string') {
      return `>${op.test}`
    }

    return JSON.stringify(op, serialiser)
  }).join('\n')
  const filePath = path.join(__dirname, 'data.apisnapshot')

  fs.writeFileSync(filePath, payload)

  console.log('Data script written to', filePath)
})
