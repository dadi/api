module.exports.type = 'string'

function escapeRegExp (string) {
  return string.replace(/([.?*+^$[\]\\(){}|-])/g, '\\$1')
}

function sanitiseString (string, schema = {}) {
  // Do nothing for falsy values.
  if (string === null || string === undefined || string === false) {
    return string
  }

  // If the string is representing a number, we leave it alone.
  // This retains backward-compatibility for situations where the
  // value of a String field is treated as a number, and operated on
  // with expressions like $gt or $lt. It raises the question as to
  // why you'd do something like that, worth revisiting in the future.
  if (parseFloat(string).toString() === string) {
    return string
  }

  if (typeof string === 'string') {
    switch (schema.matchType) {
      case undefined:
      case 'ignoreCase':
        return new RegExp(['^', escapeRegExp(string), '$'].join(''), 'i')

      case 'exact':
        return string

      default:
        return new RegExp(['^', escapeRegExp(string), '$'].join(''))
    }
  }

  let sanitisedString = {}

  Object.keys(string).forEach(key => {
    sanitisedString[key] = key === '$regex'
      ? new RegExp(string[key], 'i')
      : sanitiseString(string[key], schema)
  })

  return sanitisedString
}

module.exports.beforeOutput = function ({
  config,
  document,
  field,
  input,
  language
}) {
  // If there is no language parameter, we return
  // the sub-document untransformed.
  if (typeof language !== 'string') {
    return input
  }

  let value
  let valueLanguage
  let languageField = field + config.get('i18n.fieldCharacter') + language
  let supportedLanguages = config.get('i18n.languages')

  // If the language requested is one of the supported languages
  // and the document contains a field translation for it, we'll
  // use the translated value. If not, we use the original one.
  if (
    supportedLanguages.includes(language) &&
    input[languageField] !== undefined
  ) {
    value = input[languageField]
    valueLanguage = language
  } else {
    value = input[field]
    valueLanguage = config.get('i18n.defaultLanguage')
  }

  return {
    _i18n: {
      [field]: valueLanguage
    },
    [field]: value
  }
}

module.exports.beforeQuery = ({field, input, options, schema}) => {
  return sanitiseString(input, schema)
}
