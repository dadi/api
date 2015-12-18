var app = require(__dirname + '/index.js');

app.start({
  collectionPath: __dirname + '/../workspace/collections',
  endpointPath: __dirname + '/../workspace/endpoints'
});

// export the config module
module.exports.Config = require('./config');
