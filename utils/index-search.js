#! /usr/bin/env node

'use strict'

// const Connection = require('@dadi/api').Connection
// const config = require('@dadi/api').Config
const path = require('path')
const fs = require('fs')
const config = require(path.join(__dirname, '/../config'))
const Connection = require(path.join(__dirname, '/../dadi/lib/model/connection'))
const Model = require(path.join(__dirname, '/../dadi/lib/model'))
const Search = require(path.join(__dirname, '/../dadi/lib/search'))
const help = require(path.join(__dirname, '/../dadi/lib/help'))

const idParam = ':id([a-fA-F0-9]{24})?'

const BatchIndex = function () {
  this.wordCollection = config.get('search.wordCollection')
  this.collections = {}
  this.wordConnection
  this.mainDB
}

BatchIndex.prototype.connectToDB = function (database, collection, datastore, override = false) {
  const connection = Connection({database, collection, override}, collection, datastore)

  return new Promise(resolve => {
    return connection.on('connect', db => {
      resolve(db)
    })
  })
}

BatchIndex.prototype.getSchemas = function () {
  const collectionDir = config.get('paths.collections') || path.join(__dirname, '/../../workspace/collections')
  this.updateVersions(collectionDir)
}

BatchIndex.prototype.updateVersions = function (versionsPath) {
  // Load initial api descriptions
  const versions = fs.readdirSync(versionsPath)

  versions
    .map(version => {
      if (version.indexOf('.') === 0) return

      const dirname = path.join(versionsPath, version)

      if (dirname.indexOf('collections') > 0) {
        this.updateDatabases(dirname)
      }
    })
}

BatchIndex.prototype.updateDatabases = function (databasesPath) {
  const databases = fs.readdirSync(databasesPath)

  databases
    .map(database => {
      if (database.indexOf('.') === 0) return

      const dirname = path.join(databasesPath, database)
      this.updateCollections(dirname)
    })
}

BatchIndex.prototype.updateCollections = function (collectionsPath) {
  const collections = fs.readdirSync(collectionsPath)

  collections
    .map(collection => {
      if (collection.indexOf('.') === 0) return

      const cpath = path.join(collectionsPath, collection)
      const dirs = cpath.split(path.sep)
      const version = dirs[dirs.length - 3]
      const database = dirs[dirs.length - 2]

      const schema = require(path.join(process.env.PWD, cpath))
      const name = collection.slice(collection.indexOf('.') + 1, collection.indexOf('.json'))

      this.addCollectionResource({
        route: ['', version, database, name, idParam].join('/'),
        filepath: cpath,
        name: name,
        schema: schema,
        database: database
      })
    })
}

BatchIndex.prototype.addCollectionResource = function (options) {
  const fields = help.getFieldsFromSchema(options.schema)
  const database = options.database
  const settings = options.schema.settings
  const model = Model(options.name, JSON.parse(fields), null, settings, database)
  this.collections[options.name] = model
}

BatchIndex.prototype.startCollectionImport = function () {
  Object.keys(this.collections)
    .forEach(name => {
      new Search(this.collections[name]).batchIndex()
    })
}

BatchIndex.prototype.setWordConnection = function () {
  return this.connectToDB(
    config.get('search.database'), 
    this.wordCollection, 
    config.get('search.datastore'),
    true
  ).then(db => {
    this.wordConnection = db
  })
}

BatchIndex.prototype.start = function () {
  this.getSchemas()

  this.setWordConnection()
    .then(() => {
      this.startCollectionImport()
    })
}

new BatchIndex().start()
