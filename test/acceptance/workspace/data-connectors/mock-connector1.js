'use strict'

const EventEmitter = require('events')
const sinon = require('sinon')
const util = require('util')

const STATE_DISCONNECTED = 0
const STATE_CONNECTED = 1
const STATE_CONNECTING = 2
const STATE_DISCONNECTING = 3

let forceFailedConnection = false

const MockConnector = function DataStore (datastoreConfig) {
  this.config = datastoreConfig

  this._spies = {
    index: sinon.spy(this, 'index')
  }
}

util.inherits(MockConnector, EventEmitter)

MockConnector.prototype.connect = function () {
  if (forceFailedConnection === true) {
    this.readyState = STATE_DISCONNECTED

    return Promise.reject(new Error())
  }

  this._mockConnect()

  return Promise.resolve()
}

MockConnector.prototype.dropDatabase = function () {
  return Promise.resolve()
}

MockConnector.prototype.find = function () {
  if (this.readyState !== STATE_CONNECTED) {
    return Promise.reject(new Error('DB_DISCONNECTED'))
  }

  return Promise.resolve(this.response)
}

MockConnector.prototype.index = function () {
  return Promise.resolve()
}

MockConnector.prototype.insert = function ({data, collection, schema}) {
  return Promise.resolve(data)
}

MockConnector.prototype._mockConnect = function () {
  this.readyState = STATE_CONNECTED

  this.emit('DB_CONNECTED', {})
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

MockConnector.prototype._mockSetResponse = function (response) {
  this.response = response
}

module.exports = MockConnector
module.exports.Config = {
  get: () => {}
}

module.exports._mockFailedConnection = failedConnection => {
  forceFailedConnection = failedConnection
}
