#! /usr/bin/env node
var util = require('util');
var data = require('./../config.json');

console.log('NOTE: Running `npm test` will erase any data in the databases specified in `config.json`. The following databases will be affected:');
console.log('');
console.log(JSON.stringify(data.database, null, 2));

console.log('');
console.log('Do you wish to continue? (type \'yes\' to continue): ');
process.stdin.resume();
process.stdin.setEncoding('utf8');

process.stdin.on('data', function (text) {
  if (text === 'yes\n') {
    done();
  }
	else {
		stop();
	}
});

function done() {
  console.log('Tests continuing - you\'ve been warned!');
  process.exit(0);
}

function stop() {
  process.exit(1);
}
