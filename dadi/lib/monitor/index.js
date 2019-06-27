const util = require('util')
const EventEmitter = require('events').EventEmitter
const fs = require('fs')

const Monitor = function(path) {
  if (!path) throw new Error('Must provide path to instantiate Monitor')

  this.path = path

  const self = this

  this.watcher = fs.watch(this.path, function(eventName, filename) {
    setTimeout(function() {
      self.emit('change', filename)
    }, 50)
  })
}

// inherits from EventEmitter
util.inherits(Monitor, EventEmitter)

Monitor.prototype.close = function() {
  this.watcher.close.apply(this.watcher, arguments)
}

// exports
module.exports = function(path) {
  return new Monitor(path)
}

module.exports.Monitor = Monitor
