const EventEmitter = require('events').EventEmitter
const fs = require('fs')
const util = require('util')

const Monitor = function(path) {
  if (!path) throw new Error('Must provide path to instantiate Monitor')

  this.path = path

  this.watcher = fs.watch(this.path, (_, filename) => {
    clearTimeout(this.timer)

    this.timer = setTimeout(() => {
      this.emit('change', filename)
    }, 50)
  })
}

util.inherits(Monitor, EventEmitter)

Monitor.prototype.close = function() {
  this.watcher.close.apply(this.watcher, arguments)
}

// exports
module.exports = function(path) {
  return new Monitor(path)
}

module.exports.Monitor = Monitor
