var app = require(__dirname + '/index.js');

app.start(function() {});

module.exports = app;
module.exports.Config = require(__dirname + '/config');
module.exports.Model  = require(__dirname + '/dadi/lib/model/');
module.exports.Log    = require(__dirname + '/dadi/lib/log/');
