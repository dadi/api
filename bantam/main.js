var app = require(__dirname + '/lib/');

// Go!
app.start({
    collectionPath: __dirname + '/../workspace/collections',
    endpointPath: __dirname + '/../workspace/endpoints'
});
