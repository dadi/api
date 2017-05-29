#! /usr/bin/env node

var fs = require('fs-extra')
var path = require('path')

var currentPath = process.cwd() // should be node_modules/@dadi/api
var workspacePath = path.join(currentPath, 'workspace')
var destinationDir = path.join(currentPath, '../../../workspace')

// Only run if in a node_modules folder
if (~currentPath.indexOf('node_modules')) {
  fs.stat(destinationDir, (err, stats) => {
    if (err && err.code && err.code === 'ENOENT') {
      fs.copy(workspacePath, destinationDir, { overwrite: false }, (err) => {
        if (err) return console.error(err)

        fs.move(destinationDir + '/collections/vjoin', destinationDir + '/collections/1.0', { overwrite: false }, (err) => {
          fs.move(destinationDir + '/collections/1.0/testdb', destinationDir + '/collections/1.0/library', { overwrite: false }, (err) => {

            fs.remove(destinationDir + '/collections/vtest', err => {
              fs.remove(destinationDir + '/endpoints/v1', err => {
                fs.remove(destinationDir + '/media', err => {
                  fs.remove(destinationDir + '/hooks/layout.js', err => {
                    console.log('API: workspace directory created at', destinationDir)
                  })
                })
              })
            })
          })
        })
      })
    } else {
      console.log('API: Refusing to overwrite existing workspace directory')
    }
  })
}
