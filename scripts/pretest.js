#! /usr/bin/env node
var path = require('path');
var util = require('util');
var config = require('./../config.js');

console.log('NOTE: Running `npm test` will erase any data in the databases specified in \n`' + path.resolve(config.configPath()) + '`. \n\nThe following databases will be affected:');
console.log('');
console.log(JSON.stringify(config.get('database'), null, 2));

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
