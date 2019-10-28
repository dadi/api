module.exports.type = 'string'

function escapeRegExp(string) {
  return string.replace(/([.?*+^$[\]\\(){}|-])/g, '\\$1')
}

function sanitise(input, schema = {}) {
  if (typeof input === 'string') {
    switch (schema.matchType) {
      case undefined:
      case 'ignoreCase':
        return new RegExp(['^', escapeRegExp(input), '$'].join(''), 'i')

      case 'exact':
        return input

      default:
        return new RegExp(['^', escapeRegExp(input), '$'].join(''))
    }
  }

  if (input.$regex) {
    return new RegExp(input.$regex, 'i')
  }

  return input
}

module.exports.beforeOutput = function({
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
  const languageField = field + config.get('i18n.fieldCharacter') + language
  const supportedLanguages = config.get('i18n.languages')

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

module.exports.beforeQuery = ({field, input, schema}) => {
  // Do nothing for falsy values.
  if (input === null || input === undefined || input === false) {
    return input
  }

  const sanitisedInput = Object.keys(input).reduce((result, key) => {
    result[key] = sanitise(input[key], schema)

    return result
  }, {})

  return sanitisedInput
}
