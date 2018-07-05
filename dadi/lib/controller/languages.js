const acl = require('./../model/acl')
const config = require('./../../../config')
const help = require('./../help')
const langs = require('langs')

const Languages = function (server) {
  server.app.routeMethods('/api/languages', {
    get: this.get.bind(this)
  })
}

Languages.prototype._getLanguageDetails = function (code) {
  let defaultLanguage = config.get('i18n.defaultLanguage')
  let match = langs.where('1', code)
  let language = {
    code,
    default: defaultLanguage === code
  }

  if (match) {
    language.name = match.name
    language.local = match.local
  }

  return language
}

Languages.prototype.get = function (req, res, next) {
  if (!req.dadiApiClient.clientId) {
    return help.sendBackJSON(null, res, next)(
      acl.createError(req.dadiApiClient)
    )
  }

  let supportedLanguages = config.get('i18n.languages')
  let defaultLanguage = config.get('i18n.defaultLanguage')

  if (!supportedLanguages.includes(defaultLanguage)) {
    supportedLanguages.unshift(defaultLanguage)
  }

  let languages = supportedLanguages.map(this._getLanguageDetails)

  let metadata = {
    defaultLanguage: this._getLanguageDetails(defaultLanguage),
    totalCount: supportedLanguages.length
  }

  return help.sendBackJSON(200, res, next)(null, {
    results: languages,
    metadata
  })
}

module.exports = server => new Languages(server)
