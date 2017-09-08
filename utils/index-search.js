#! /usr/bin/env node

'use strict'

// const Connection = require('@dadi/api').Connection
// const config = require('@dadi/api').Config
const path = require('path')
const config = require(path.join(__dirname, '/../config'))
const Connection = require(path.join(__dirname, '/../dadi/lib/model/connection'))

const BatchIndex = function () {
  this.searchDB
  this.mainDB
}

// BatchIndex.prototype.connectToSearchDB = function () {
//   const settings = config.get('search.database')
//   const connection = Connection(options)

  // this.connection = Connection({ database: settings.database, collection: this.name }, this.name, config.get('datastore'))

//   return new Promise(resolve => {
//     connection.on('connect', database => {
//       this.searchDB = database

//       resolve()
//     })
//   })
// }

// BatchIndex.prototype.connectToMainDB = function () {
//   const options = config.get('database')
//   const connection = Connection(options)

//   return new Promise(resolve => {
//     connection.on('connect', database => {
//       this.mainDB = database

//       resolve()
//     })
//   })
// }

// BatchIndex.prototype.getCollections = function () {
//   const defaultPaths = {
//     collections: path.join(__dirname, '/../../workspace/collections'),
//     endpoints: path.join(__dirname, '/../../workspace/endpoints')
//   }

//   const options = {}
//   this.loadPaths(config.get('paths') || defaultPaths, function (paths) {
//     options = paths
//   })
// }

BatchIndex.prototype.start = function () {
  // let connectionQueue = []
  // connectionQueue.push(this.connectToSearchDB())
  // connectionQueue.push(this.connectToMainDB())

  // Promise.all(connectionQueue)
  //   .then(res => {
  //     console.log("DONE", this.searchDB.databaseName)
  //   })
}

new BatchIndex().start()
