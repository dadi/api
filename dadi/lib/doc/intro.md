## Authentication
Every request to the content API requires a `bearer` authentication token which should be passed as a header.
Obtain a token by sending a POST request to the `/token` endpoint and passing your client credentials in the body of the request:

#### Example Request using curl
```
curl -X POST -H "Content-Type: application/json" --data "clientId=testClient&secret=superSecret" "http://api.example.com/token"
```

#### Example request using Node.JS
```js
var http = require("http");

var options = {
  "hostname": "api.example.com",
  "port": 80,
  "method": "POST",
  "path": "/token",
  "headers": {
    "content-type": "application/json"
  }
};

var credentials = JSON.stringify({
  clientId: "testClient",
  secret: "superSecret"
});

var req = http.request(options, function (res) {
  var chunks = [];

  res.on("data", function (chunk) {
    chunks.push(chunk);
  });

  res.on("end", function () {
    var body = Buffer.concat(chunks);
    console.log(body.toString());
  });
});

req.write(credentials);
req.end();
```

#### Response
```
{
  "accessToken": "4172bbf1-0890-41c7-b0db-477095a288b6",
  "tokenType": "Bearer",
  "expiresIn": 2592000
}
```

Once you have the token, each request to the API should include a header containing the token:

#### Example Request using curl
```
curl -X GET -H "Content-Type: application/json" -H "Authorization: Bearer 4172bbf1-0890-41c7-b0db-477095a288b6" "http://api.example.com/api/collections"
```

#### Example request using Node.JS
```js
var http = require("http");

var options = {
  "hostname": "api.example.com",
  "port": 80,
  "method": "GET",
  "path": "/api/collections",
  "headers": {
    "authorization": "Bearer 4172bbf1-0890-41c7-b0db-477095a288b6",
    "content-type": "application/json"
  }
};

var req = http.request(options, function (res) {
  var chunks = [];

  res.on("data", function (chunk) {
    chunks.push(chunk);
  });

  res.on("end", function () {
    var body = Buffer.concat(chunks);
    console.log(body.toString());
  });
});

req.end();
```

## Error States
The common [HTTP Response Status Codes](https://github.com/for-GET/know-your-http-well/blob/master/status-codes.md) are used.
