'use strict'

const formatError = require('@dadi/format-error')
const path = require('path')
const config = require(path.join(__dirname, '/../../../config'))

/**
 * Creates a new hook. Allowed types:
 *
 * beforeCreate
 * afterCreate
 * afterGet
 * beforeUpdate
 * afterUpdate
 * beforeDelete
 * afterDelete
 *
 * @param Mixed Hook data
 * @param Number Hook type
 * @return Hook
 * @api public
 */
const Hook = function (data, type) {
  if (typeof data === 'string') {
    this.name = data
  } else {
    this.name = data.hook
    this.options = data.options
  }

  this.hook = function () {
    let result

    try {
      const hookFn = this.load()

      result = hookFn.apply(this, arguments)
    } catch (error) {
      result = Promise.reject(error)
    }

    return result
  }.bind(this)

  this.type = type
}

/**
 * Calls the hook function with the appropriate parameters based
 * on the hook type
 *
 * @param Mixed Hook arguments
 * @return Obj
 * @api public
 */
Hook.prototype.apply = function () {
  switch (this.type) {
    case 'beforeCreate':
      return this.hook(arguments[0], this.type, {
        collection: arguments[2],
        options: this.options,
        req: arguments[3],
        schema: arguments[1]
      })

    case 'afterCreate':
      return this.hook(arguments[0], this.type, {
        collection: arguments[2],
        options: this.options,
        schema: arguments[1]
      })

    case 'afterGet':
      return this.hook(arguments[0], this.type, {
        collection: arguments[2],
        options: this.options,
        req: arguments[3],
        schema: arguments[1]
      })

    case 'beforeUpdate':
      return this.hook(arguments[0], this.type, {
        collection: arguments[3],
        options: this.options,
        req: arguments[4],
        schema: arguments[2],
        updatedDocs: arguments[1]
      })

    case 'afterUpdate':
      return this.hook(arguments[0], this.type, {
        collection: arguments[2],
        options: this.options,
        schema: arguments[1]
      })

    case 'beforeDelete':
      return this.hook(arguments[0], this.type, {
        collection: arguments[3],
        error: arguments[1],
        options: this.options,
        req: arguments[4],
        schema: arguments[2]
      })

    case 'afterDelete':
      return this.hook(arguments[0], this.type, {
        collection: arguments[2],
        options: this.options,
        schema: arguments[1]
      })
  }

  return false
}

/**
 * Builds an error object for the given hook error
 *
 * @param Error
 * @return Object
 * @api public
 */
Hook.prototype.formatError = function (error) {
  const errorCode = error.code ? error : '0002'

  let errorMessage

  // If `error` is a string and not an actual Error object,
  // we'll use that as the message.
  if (typeof error === 'string') {
    errorMessage = error
  } else {
    errorMessage = error.message || ''
    errorMessage += (error.stack ? '\n' + error.stack.split('\n')[1] : '')

    // If this is a custom error, we attach the name of the hook.
    if (error.dadiCustomError && !error.dadiCustomError.hookName) {
      error.dadiCustomError.hookName = this.getName()
    }
  }

  return [formatError.createApiError(errorCode, {
    error: error,
    errorMessage: errorMessage,
    hookName: this.getName()
  })]
}

/**
 * Returns the name of the hook
 *
 * @return String
 * @api public
 */
Hook.prototype.getName = function () {
  return this.name
}

/**
 * Loads the hook file
 *
 * @return Hook module
 * @api public
 */
Hook.prototype.load = function () {
  return require(require('path').resolve(config.get('paths.hooks')) + '/' + this.name)
}

module.exports = function (data, type) {
  return new Hook(data, type)
}

module.exports.Hook = Hook
