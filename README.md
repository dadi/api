![Serama](serama.png)

## Overview

Serama is a high performance RESTful API layer designed in support of API-first development and the principle of COPE.

It is built on Node.JS and MongoDB, using latest stable versions.

Serama is part of the Bantam toolkit, a modern development stack built for performance and scale.

## Setup and Installation

For tests to run you will need stand alone `mongod`s running at localhost:27017 and localhost:27018

`cd serama`

`npm install`

`npm test`

`npm start`

You may want to look at a handy QA testing tool called [Postman](http://www.getpostman.com/).

In order to get up and running you will also need to create a client document in the db.  To automate this do -

`node utils/create-client.js`

You can then get a bearer token with the following request -

    POST /token HTTP/1.1
    Host: localhost:3000
    content-type: application/json
    Cache-Control: no-cache

    { "client_id": "test-client", "secret": "super_secret" }

Once you have the token, each request to the api should include a header similar to the one below (of course use your specific token) -

    Authorization: Bearer 171c8c12-6e9b-47a8-be29-0524070b0c65

There is an example collection endpoint and custom endpoint included in the `workspace` directory.

## Example API requests

### Collections POST request

    POST /vtest/testdb/test-schema HTTP/1.1
    Host: localhost:3000
    content-type: application/json
    Authorization: Bearer 171c8c12-6e9b-47a8-be29-0524070b0c65

    { "field_1": "hi world!", "field_2": 123293582345 }


### Endpoint GET request

This will return a "Hello World" example -

    GET /endpoints/test-endpoint HTTP/1.1
    Host: localhost:3000
    content-type: application/json
    Authorization: Bearer 171c8c12-6e9b-47a8-be29-0524070b0c65

## Configuration notes

The `server.host` config is passed to node's `server.listen` function
http://nodejs.org/api/http.html#http_server_listen_port_hostname_backlog_callback

You should be able to set it to your IP as well, but depending on your hosting, that may be tricky. For example, on AWS you would have to use your private IP instead of your public IP.

The proper name should always resolve correctly. Alternately, you can set it to null, to accept connections on any IPv4 address.

## Further reading

The `docs/` directory contains additional documentation on the compenent parts of the system -

* API module
* Authorisation middleware
* Caching
* Connection module
* Endpoints
* Logging
* Model module
* Monitor module
* Validation

Feel free to contact the Bantam core development team on team@bant.am with questions.

## Development

Serama was conceived, developed and is maintained by the engineering team at DADI+ ([https://dadi.co](https://dadi.co)).

Core contributors -

* Joseph Denne
* Viktor Fero
* James Lambie
* Joe Warner
* Niklas Iversen
* Dave Longworth

### Contributing

Very daring.

Fork, hack, possibly even add some tests, then send a pull request :)

## Licence

Copyright (c) 2014, DADI+ Limited (https://dadi.co).

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
