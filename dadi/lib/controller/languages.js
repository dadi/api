const acl = require('./../model/acl')
const config = require('./../../../config')
const help = require('./../help')
const langs = require('langs')

const FORBIDDEN_FIELD_CHARACTERS = ['.', '@']

const Languages = function (server) {
  FORBIDDEN_FIELD_CHARACTERS.forEach(character => {
    if (config.get('i18n.fieldCharacter').includes(character)) {
      throw new Error(
        `Fatal error in configuration: character "${character}" is not allowed in "i18n.fieldCharacter" value`
      )
    }
  })

  server.app.routeMethods('/api/languages', {
    get: this.get.bind(this)
  })
}

Languages.prototype._getLanguageDetails = function (code) {
  const defaultLanguage = config.get('i18n.defaultLanguage')
  const match = langs.where('1', code)
  const language = {
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

  const supportedLanguages = config.get('i18n.languages')
  const defaultLanguage = config.get('i18n.defaultLanguage')

  if (!supportedLanguages.includes(defaultLanguage)) {
    supportedLanguages.unshift(defaultLanguage)
  }

  const languages = supportedLanguages.map(this._getLanguageDetails)
  const metadata = {
    defaultLanguage: this._getLanguageDetails(defaultLanguage),
    fieldCharacter: config.get('i18n.fieldCharacter'),
    totalCount: supportedLanguages.length
  }

  return help.sendBackJSON(200, res, next)(null, {
    results: languages,
    metadata
  })
}

module.exports = server => new Languages(server)
