![Serama](../serama.png)

# Endpoints

## Overview

An endpoint must be named such that the filename is endpoint.{endpoint name}.js, and the corresponding url will be /endpoints/{endpoint name}. The javascript file should export functions with all lowercase names that correspond to the HTTP method that the function is meant to handle.

Each function will recieve three arguments -

`(request, response, next)`

1. `request` is an instance of node's [http.IncomingMessage](http://nodejs.org/api/http.html#http_http_incomingmessage) as created internally by node
2. `response` is an instance of node's [http.ServerResponse](http://nodejs.org/api/http.html#http_class_http_serverresponse) as created internally by node
3. `next` is a function that can be passed an error, or called if this endpoint has nothing to do.  This will result in a 500, or 404 respectively.

## Example Usage

See `test/acceptance/workspace/endpoints/endpoint.test-endpoint.js` for a "Hello World" example.
