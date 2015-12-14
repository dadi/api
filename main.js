var app = require(__dirname + '/index.js');

app.start({
  collectionPath: __dirname + '/../workspace/collections',
  endpointPath: __dirname + '/../workspace/endpoints'
});
