'use strict'

const acl = require('./../model/acl')
const fs = require('fs')
const help = require('./../help')
const path = require('path')

const HOOK_PREFIX = 'hook:'

const HooksController = function (server, hooksPath) {
  this.path = hooksPath
  this.server = server

  server.app.use('/api/hooks', (req, res, next) => {
    let method = req.method && req.method.toLowerCase()

    if (method === 'get') {
      return this.get(req, res, next)
    }

    return help.sendBackJSON(405, res, next)(null, {'error': 'Invalid method'})
  })

  server.app.use('/api/hooks/:hookName/config', (req, res, next) => {
    let method = req.method && req.method.toLowerCase()

    if (typeof this[method] === 'function') {
      return this[method](req, res, next)
    }

    return help.sendBackJSON(405, res, next)(null, {'error': 'Invalid method'})
  })
}

HooksController.prototype._deleteHook = function (name) {
  const filePath = path.join(this.path, name + '.js')

  return new Promise((resolve, reject) => {
    fs.unlink(filePath, err => {
      if (err) return reject(err)

      resolve()
    })
  })
}

HooksController.prototype._findHooks = function (filterByName) {
  let hooks = []

  Object.keys(this.server.components).find(key => {
    if (key.indexOf(HOOK_PREFIX) === 0) {
      const hookName = key.replace(HOOK_PREFIX, '')

      if (filterByName && filterByName !== hookName) {
        return
      }

      hooks.push(hookName)

      if (filterByName) {
        return true
      }
    }
  })

  return hooks.sort()
}

HooksController.prototype._writeHook = function (name, content) {
  const filePath = path.join(this.path, name + '.js')

  return new Promise((resolve, reject) => {
    fs.writeFile(filePath, content, err => {
      if (err) return reject(err)

      resolve()
    })
  })
}

HooksController.prototype.get = function (req, res, next) {
  if (!acl.client.isAdmin(req.dadiApiClient)) {
    return help.sendBackJSON(null, res, next)(
      acl.createError(req.dadiApiClient)
    )
  }

  // Return the content of a specific hook
  if (req.params.hookName) {
    let name = req.params.hookName
    let hook = this._findHooks(name)[0]

    if (!hook) {
      return help.sendBackText(404, res, next)(null, '')
    }

    fs.readFile(this.server.components[HOOK_PREFIX + name], (err, content) => {
      return help.sendBackText(200, res, next)(err, content.toString())
    })
  } else {
    // List all hooks
    let hooks = this._findHooks().map(key => {
      let hook = {
        name: key
      }

      let docs = this.server.docs[HOOK_PREFIX + key]

      if (docs && docs[0]) {
        hook.description = docs[0].description
        hook.params = docs[0].params
        hook.returns = docs[0].returns
      }

      return hook
    })

    return help.sendBackJSON(200, res, next)(null, {results: hooks})
  }
}

module.exports = (server, hooksPath) => new HooksController(server, hooksPath)
