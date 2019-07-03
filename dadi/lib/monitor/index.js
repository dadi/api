const util = require('util')
const EventEmitter = require('events').EventEmitter
const fs = require('fs')

const Monitor = function(path) {
  if (!path) throw new Error('Must provide path to instantiate Monitor')

  this.path = path

  try {
    this.watcher = fs.watch(this.path, (eventName, filename) => {
      setTimeout(() => {
        this.emit('change', filename)
      }, 50)
    })
  } catch (err) {
    if (err.code !== 'ENOENT') {
      throw err
    }
  }
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
