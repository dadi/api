'use strict'

const EventEmitter = require('events')
const sinon = require('sinon')
const util = require('util')

const MOCK_DOC_ID = '59d4b35cb2cf37d706b1d706'

const STATE_DISCONNECTED = 0
const STATE_CONNECTED = 1
const STATE_CONNECTING = 2
const STATE_DISCONNECTING = 3

let forceFailedConnection = false
let instances = []
let mockResponse = []

const MockConnector = function DataStore (datastoreConfig) {
  this.config = datastoreConfig

  this._spies = {
    index: sinon.spy(this, 'index')
  }

  instances.push(this)
}

util.inherits(MockConnector, EventEmitter)

MockConnector.prototype.connect = function () {
  console.log('')
  console.log('*** Mock Connect:', forceFailedConnection)
  console.log('')
  if (forceFailedConnection === true) {
    this.readyState = STATE_DISCONNECTED

    return Promise.reject(new Error())
  }

  this._mockConnect()

  return Promise.resolve()
}

MockConnector.prototype.delete = function () {
  if (this.readyState !== STATE_CONNECTED) {
    return Promise.reject(new Error('DB_DISCONNECTED'))
  }

  return Promise.resolve({
    deletedCount: 1
  })
}

MockConnector.prototype.dropDatabase = function () {
  return Promise.resolve()
}

MockConnector.prototype.find = function () {
  console.log('')
  console.log('*** Mock find:', this.readyState)
  console.log('')
  if (this.readyState !== STATE_CONNECTED) {
    return Promise.reject(new Error('DB_DISCONNECTED'))
  }

  return Promise.resolve(mockResponse)
}

MockConnector.prototype.index = function () {
  return Promise.resolve()
}

MockConnector.prototype.insert = function ({data, collection, schema}) {
  if (this.readyState !== STATE_CONNECTED) {
    return Promise.reject(new Error('DB_DISCONNECTED'))
  }

  let documents = Array.isArray(data)
    ? data
    : [data]

  documents = documents.map(document => {
    let documentCopy = Object.assign({}, document)

    if (!documentCopy._id) {
      documentCopy._id = MOCK_DOC_ID
    }

    return documentCopy
  })

  return Promise.resolve(documents)
}

MockConnector.prototype.update = function () {
  if (this.readyState !== STATE_CONNECTED) {
    return Promise.reject(new Error('DB_DISCONNECTED'))
  }

  return Promise.resolve({
    matchedCount: 3
  })
}

MockConnector.prototype._mockConnect = function () {
  this.readyState = STATE_CONNECTED

  forceFailedConnection = false
}

MockConnector.prototype._mockDisconnect = function () {
  this.readyState = STATE_DISCONNECTED

  forceFailedConnection = true

  this.emit('DB_ERROR', {})
}

MockConnector.prototype._mockReconnect = function () {
  this.readyState = STATE_CONNECTED

  forceFailedConnection = false

  this.emit('DB_RECONNECTED')
}

module.exports = MockConnector
module.exports.Config = {
  get: () => {}
}

module.exports._mockConnect = () => {
  instances.forEach(instance => {
    instance._mockConnect()
  })
}
module.exports._mockFailedConnection = failedConnection => {
  forceFailedConnection = failedConnection
}
module.exports._mockSetResponse = response => {
  mockResponse = response
}
