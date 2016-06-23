var chokidar = require('chokidar')
var cluster = require('cluster')
var config = require('./config')
var fs = require('fs')
var path = require('path')

var log = require(__dirname + '/dadi/lib/log.js')

//module.exports       = app = require(__dirname + '/index.js');
module.exports.App         = {};
module.exports.Config      = require(__dirname + '/config');
module.exports.Connection  = require(__dirname + '/dadi/lib/model/connection');
module.exports.Controller  = require(__dirname + '/dadi/lib/controller/');
module.exports.Model       = require(__dirname + '/dadi/lib/model/');
module.exports.Log         = require(__dirname + '/dadi/lib/log.js');

require('console-stamp')(console, 'yyyy-mm-dd HH:MM:ss.l')

if (config.get('cluster')) {

  if (cluster.isMaster) {
    var numWorkers = require('os').cpus().length
    log.info('Starting DADI API in cluster mode, using ' + numWorkers + ' workers.')
    log.info('Master cluster setting up ' + numWorkers + ' workers...')

    // Start new workers
    for(var i = 0; i < numWorkers; i++) {
      cluster.fork()
    }

    // New worker alive
    cluster.on('online', function(worker) {
      log.info('Worker ' + worker.process.pid + ' is online')
    })

    // Handle a thread exit, start a new worker
    cluster.on('exit', function(worker, code, signal) {
      log.info('Worker ' + worker.process.pid + ' died with code: ' + code + ', and signal: ' + signal)
      log.info('Starting a new worker')

      cluster.fork();
    })

    // Watch the current directory for a "restart.api" file
    var watcher = chokidar.watch(process.cwd(), {
      depth: 1,
      ignored: /[\/\\]\./,
      ignoreInitial: true
    })

    watcher.on('add', function(filePath) {
      if (path.basename(filePath) === 'restart.api') {
        log.info('Shutdown requested')
        fs.unlinkSync(filePath)
        restartWorkers()
      }
    })

    // watcher.on('change', function(filePath) {
    //   if (/config\.(.*)\.json/.test(path.basename(filePath))) {
    //     log.info('Shutdown requested')
    //     restartWorkers()
    //   }
    // })
  }
  else {
    // Start Workers
    var app = require(__dirname + '/index.js')
    module.exports.App = app

    app.start(function() {
      log.info('Process ' + process.pid + ' is listening for incoming requests')

      process.on('message', function(message) {
        if (message.type === 'shutdown') {
          log.info('Process ' + process.pid + ' is shutting down...')

          process.exit(0)
        }
      })
    })
  }
} else {
  // Single thread start
  log.info('Starting DADI API in single thread mode.')

  var app = require(__dirname + '/index.js')
  module.exports.App = app
  app.start(function() {
    log.info('Process ' + process.pid + ' is listening for incoming requests')
  })
}

function restartWorkers() {
  var wid, workerIds = []

  for(wid in cluster.workers) {
    workerIds.push(wid)
  }

  workerIds.forEach(function(wid) {
    if (cluster.workers[wid]) {
      cluster.workers[wid].send({
        type: 'shutdown',
        from: 'master'
      })

      setTimeout(function() {
        if(cluster.workers[wid]) {
          cluster.workers[wid].kill('SIGKILL')
        }
      }, 5000)
    }
  })
}
