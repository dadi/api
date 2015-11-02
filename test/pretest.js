var path = require('path');
var colors = require('colors');
var config = require('./../config.js');

if (path.basename(config.configPath()) !== 'config.test.json') {
  var message = '\nWARNING: The test suite requires a `config.test.json` configuration file. Loaded file is `' + config.configPath() + '`.'
  console.log(message.bold.red);
  console.log('');
  console.log('Tests will not be run with the current configuration file.\n'.bold.red);
  stop();
}

var database = config.get('database.database');
var authDatabase = config.get('auth.database.database');

if (database !== 'test' || authDatabase !== 'test') {
  var message = '\nWARNING: The test suite requires the use of a `test` database. The databases for authentication and data can be configured in the file ' + config.configPath() + '.';
  console.log(message.bold.red);
  console.log('');
  console.log('Tests will not be run with the current configuration.\n'.bold.red);
  stop();
}

function stop() {
  process.exit(1);
}
