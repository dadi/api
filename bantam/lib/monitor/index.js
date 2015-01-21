var util = require('util');
var EventEmitter = require('events').EventEmitter;
var Path = require('path');
var chokidar = require('chokidar');

var Monitor = function (path) {
    if (!path) throw new Error('Must provide path to instantiate Monitor');

    this.path = path;

    var self = this;

    this.watcher = chokidar.watch(this.path, {ignored: /.DS_Store/, persistent: true});

    this.watcher.on('add', function(path, stats) {
      self.emit('change', Path.basename(path));
    });

    this.watcher.on('change', function(path, stats) {
      self.emit('change', Path.basename(path));
    });

    this.watcher.on('unlink', function(path, stats) {
      self.emit('change', Path.basename(path));
    });

};

// inherits from EventEmitter
util.inherits(Monitor, EventEmitter);

Monitor.prototype.close = function () {
    this.watcher.close();
};

// exports
module.exports = function (path) {
    return new Monitor(path);
};

module.exports.Monitor = Monitor;
