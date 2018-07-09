#! /usr/bin/env node

var fs = require('fs')
var mkdirp = require('mkdirp')
var path = require('path')

var currentPath = process.cwd() // should be node_modules/@dadi/api
var configPath = path.join(__dirname, '../config/config.development.json.sample')
var destinationDir = path.join(currentPath, '../../../config')
var destinationFile = path.join(destinationDir, 'config.development.json')

// Only run if in a node_modules folder
if (~currentPath.indexOf('node_modules')) {
  // mkdirp only creates the directory if it doesn't exist
  mkdirp(destinationDir, (err, made) => {
    if (err) throw err

    fs.stat(destinationFile, (err, stats) => {
      if (err && err.code && err.code === 'ENOENT') {
        // destinationFile doesn't exist, so ok to write
        fs.readFile(configPath, (err, data) => {
          if (err) throw err

          fs.writeFile(destinationFile, data, (err) => {
            if (err) throw err

            console.log('API configuration created at', destinationFile)
          })
        })
      }
    })
  })
}
