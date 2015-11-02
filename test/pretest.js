var path = require('path');
var colors = require('colors');
var config = require('./../config');

var database = config.database.database;
var authDatabase = config.auth.database.database;

if (database !== 'test' || authDatabase !== 'test') {
  var message = '\nWARNING: The test suite requires the use of a `test` database. The databases for authentication and data can be configured in the file ./../config.json.';
  console.log(message.bold.red);
  console.log('');
  console.log('Tests will not be run with the current configuration.\n'.bold.red);
  stop();
}

function stop() {
  process.exit(1);
}
