const config = require('../../../config')
const jwt = require('jsonwebtoken')
const model = require('../model/acl/client')
const help = require('../help')
const path = require('path')
const Validator = require('@dadi/api-validator')

const validator = new Validator()

const PasswordReset = function(server) {
  const passwordResetPath = config.get('paths.passwordReset')

  if (!passwordResetPath) return

  const passwordResetFullPath = path.join(process.cwd(), passwordResetPath)

  this.handler = require(passwordResetFullPath)

  server.app.routeMethods('/api/reset', {
    post: this.startReset.bind(this)
  })

  server.app.routeMethods('/api/reset/:token', {
    post: this.finishReset.bind(this)
  })
}

PasswordReset.prototype.decodeToken = function(token) {
  return new Promise((resolve, reject) => {
    jwt.verify(token, config.get('auth.tokenKey'), (error, decoded) => {
      if (error) return reject(error)

      const {accessType, clientId} = decoded

      if (
        accessType !== 'password-reset' ||
        !clientId ||
        typeof clientId !== 'string'
      ) {
        return reject(new Error('invalid token'))
      }

      return resolve(decoded)
    })
  })
}

PasswordReset.prototype.finishReset = async function(req, res, next) {
  const schema = {
    secret: {
      type: 'String',
      required: true
    }
  }

  let payload

  try {
    payload = await this.decodeToken(req.params.token)
  } catch (error) {
    return this.handleError(res, next)(new Error('INVALID_TOKEN'))
  }

  try {
    await validator.validateDocument({
      document: req.body,
      schema
    })
  } catch (errors) {
    const error = new Error('VALIDATION_ERROR')

    error.data = errors

    return this.handleError(res, next)(error)
  }

  try {
    const {results} = await model.resetSecret({
      clientId: payload.clientId,
      secret: req.body.secret,
      token: req.params.token
    })

    if (results.length === 0) {
      return this.handleError(res, next)(new Error('INVALID_TOKEN'))
    }
  } catch (error) {
    return this.handleError(res, next)(error)
  }

  help.sendBackJSON(200, res, next)(null, {
    success: true
  })
}

PasswordReset.prototype.handleError = function(res, next) {
  return err => {
    switch (err.message) {
      case 'CLIENT_NOT_FOUND':
        return help.sendBackJSON(404, res, next)(null, null)

      case 'INVALID_TOKEN':
        return help.sendBackJSON(403, res, next)(null, null)

      case 'VALIDATION_ERROR':
        return help.sendBackJSON(400, res, next)(null, {
          success: false,
          errors: err.data
        })

      default:
        return help.sendBackJSON(400, res, next)(err)
    }
  }
}

PasswordReset.prototype.setResetToken = function({clientId}) {
  return new Promise((resolve, reject) => {
    const payload = {
      accessType: 'password-reset',
      clientId
    }

    jwt.sign(
      payload,
      config.get('auth.tokenKey'),
      {
        expiresIn: config.get('auth.resetTokenTtl')
      },
      (error, token) => {
        if (error) {
          return reject(error)
        }

        return resolve(
          model
            .setResetToken({
              clientId,
              token
            })
            .then(() => token)
        )
      }
    )
  })
}

PasswordReset.prototype.startReset = async function(req, res, next) {
  const {clientId, data, email} = req.body
  const hasClientId = Boolean(clientId && typeof clientId === 'string')
  const schema = {
    clientId: {
      type: 'String'
    },
    email: {
      type: 'String',
      required: !hasClientId
    },
    data: {
      type: 'Object'
    }
  }

  try {
    await validator.validateDocument({
      document: req.body,
      schema
    })
  } catch (errors) {
    const error = new Error('VALIDATION_ERROR')

    error.data = errors

    return this.handleError(res, next)(error)
  }

  const query = hasClientId ? {clientId} : {email}
  const {results} = await model.find(query)

  if (results.length === 0) {
    return this.handleError(res, next)(new Error('CLIENT_NOT_FOUND'))
  }

  const [client] = results

  if (client.resetToken) {
    try {
      await this.decodeToken(client.resetToken)

      return help.sendBackJSON(403, res, next)(null, null)
    } catch (_) {
      // no-op
    }
  }

  try {
    const token = await this.setResetToken({clientId: client.clientId})

    this.handler({
      clientId: client.clientId,
      data,
      email: client.email,
      token
    })

    help.sendBackJSON(200, res, next)(null, {
      success: true
    })
  } catch (error) {
    return this.handleError(res, next)(error)
  }
}

module.exports = server => new PasswordReset(server)
module.exports.PasswordReset = PasswordReset
