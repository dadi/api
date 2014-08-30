var path = require('path');
var fs = require('fs');
var config = require(__dirname + '/../../config').logging;
var moment = require('moment');
var _ = require('underscore');

var logPath = path.resolve(config.path + '.' + config.extension);
var logLevel = config.level;

var levelMap = {
    'DEGBUG': 1,
    'STAGE': 2,
    'PRODUCTION': 3
};

// generate formatter function
var formatter = compile(config.message_format);

// create writeStream to log
var stream = fs.createWriteStream(logPath, {encoding: 'utf8', flags: 'a'});

stream.on('error', function (err) {
    console.log('stream error');
    console.error(err);
});

stream.on('finish', function () {
    console.log('stream finish');
    console.log(arguments);
});

/**
 * Log string to file system
 *
 * @param {String} message
 * @param {Function} [done]
 * @return undefined
 * @api private
 */
module.exports._log = function (message, done) {
    stream.write(message);
    done && done();
};

/**
 * Format Object to a string
 *
 * @param {Object} data
 * @return String
 * @api public
 */
module.exports.format = function (data) {
    // add default info
    data.date = moment().format(config.date_format);
    data.label = config.level;
    return formatter(data) + '\n';
};

/**
 * Log debug message if running at debug level
 *
 * @param {String} message
 * @return undefined
 * @api public
 */
module.exports.debug = function (message, done) {
    if (levelMap[config.level.toUpperCase()] < levelMap['DEBUG']) return;
    module.exports._log(this.format({message: message}), done);
};

/**
 * Log debug message if running at debug level
 *
 * @param {String} message
 * @return undefined
 * @api public
 */
module.exports.stage = function (message, done) {
    if (levelMap[config.level.toUpperCase()] < levelMap['STAGE']) return;
    module.exports._log(this.format({message: message}), done);
};

/**
 * Log debug message if running at debug level
 *
 * @param {String} message
 * @return undefined
 * @api public
 */
module.exports.prod = function (message, done) {
    if (levelMap[config.level.toUpperCase()] < levelMap['PROD']) return;
    module.exports._log(this.format({message: message}), done);
};

/**
 * Compile `fmt` into a function.
 *
 * @param {String} fmt
 * @return {Function}
 * @api private
 */
function compile(fmt) {
    return _.template(fmt);
}
