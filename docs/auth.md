![Serama](../serama.png)

# Auth

## Overview

This is exposed as middleware that both issues bearer tokens and validates bearer tokens.  It is an implementation of 2-legged oAuth2.

Bearer Tokens should be sent from the client as a header, e.g. -

`Authorization: Bearer bfbd1886-404c-4457-9c74-bf67829c10ae`.

To get a token the client must authenticate itself by issuing a POST request to `/token` with valid credentials.

Example -

    POST /token HTTP/1.1
    Host: localhost:3000
    content-type: application/json
    Cache-Control: no-cache
    
    { "clientId": "testClient", "secret": "superSecret" }

All requests, aside from requesting a token, require that a token be present.

The storage of client credentials and tokens is specified in `config.auth.database`. 

A script that creates a client - `testClient / superSecret` - for QA testing can be found in `utils/create-client.js`.

Token expiration is specified in seconds at `config.auth.tokenTtl`.

The removal of expired tokens within MongoDB is handled via a ttl index - [expireAfterSeconds](http://docs.mongodb.org/manual/tutorial/expire-data/) - on the tokens collection.
