const fs = require('fs')
const path = require('path')
const help = require(path.join(__dirname, '/../help'))

const HOOK_PREFIX = 'hook:'

const HooksController = function (parameters) {
  this.components = parameters.components
  this.docs = parameters.docs
  this.path = parameters.path
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

  Object.keys(this.components).find(key => {
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

HooksController.prototype.delete = function (req, res, next) {
  const name = req.params.hookName
  const hook = this._findHooks(name)[0]

  if (!hook) {
    return help.sendBackText(404, res, next)(null, '')
  }

  this._deleteHook(name).then(() => {
    return help.sendBackText(200, res, next)(null, '')
  }).catch(err => {
    return help.sendBackText(200, res, next)(err, '')
  })
}

HooksController.prototype.get = function (req, res, next) {
  // Return the content of a specific hook
  if (req.params.hookName) {
    const name = req.params.hookName
    const hook = this._findHooks(name)[0]

    if (!hook) {
      return help.sendBackText(404, res, next)(null, '')
    }

    fs.readFile(this.components[HOOK_PREFIX + name], (err, content) => {
      return help.sendBackText(200, res, next)(err, content.toString())
    })
  } else {
    // List all hooks
    const hooks = this._findHooks().map(key => {
      let hook = {
        name: key
      }

      const docs = this.docs[HOOK_PREFIX + key]

      if (docs && docs[0]) {
        hook.description = docs[0].description
        hook.params = docs[0].params
        hook.returns = docs[0].returns
      }

      return hook
    })

    const data = {
      hooks: hooks
    }

    return help.sendBackJSON(200, res, next)(null, data)
  }
}

HooksController.prototype.post = function (req, res, next) {
  const name = req.params.hookName
  const hook = this._findHooks(name)[0]

  if (hook) {
    return help.sendBackJSON(409, res, next)(null, {
      err: 'Hook already exists'
    })
  }

  return this._writeHook(name, req.body).then(() => {
    return help.sendBackText(200, res, next)(null, '')
  }).catch(err => {
    return help.sendBackText(200, res, next)(err, '')
  })
}

HooksController.prototype.put = function (req, res, next) {
  const name = req.params.hookName
  const hook = this._findHooks(name)[0]

  if (!hook) {
    return help.sendBackText(404, res, next)(null, '')
  }

  return this._writeHook(name, req.body).then(() => {
    return help.sendBackText(200, res, next)(null, '')
  }).catch(err => {
    return help.sendBackText(200, res, next)(err, '')
  })
}

module.exports = HooksController
