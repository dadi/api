#! /usr/bin/env node

const fs = require('fs-extra')
const path = require('path')

const currentPath = process.cwd() // should be node_modules/@dadi/api
const workspacePath = path.join(currentPath, 'workspace')
const destinationDir = path.join(currentPath, '../../../workspace')

// Only run if in a node_modules folder
if (currentPath.indexOf('node_modules') !== -1) {
  fs.stat(destinationDir, (err, stats) => {
    if (err && err.code && err.code === 'ENOENT') {
      fs.copy(workspacePath, destinationDir, {overwrite: false}, err => {
        if (err) return console.error(err)

        fs.move(
          destinationDir + '/collections/vjoin',
          destinationDir + '/collections/1.0',
          {overwrite: false},
          err => {
            fs.move(
              destinationDir + '/collections/testdb',
              destinationDir + '/collections/library',
              {overwrite: false},
              err => {
                fs.remove(destinationDir + '/collections/vtest', err => {
                  fs.remove(destinationDir + '/endpoints/v1', err => {
                    fs.remove(destinationDir + '/media', err => {
                      fs.remove(destinationDir + '/hooks/layout.js', err => {
                        console.log(
                          'API: workspace directory created at',
                          destinationDir
                        )
                      })
                    })
                  })
                })
              }
            )
          }
        )
      })
    } else {
      console.log('API: Refusing to overwrite existing workspace directory')
    }
  })
}
