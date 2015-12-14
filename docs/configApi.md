![Serama](../serama.png)

# Config API

## Overview

DADI API exposes its own API to allow for the creation new collection endpoints as well as custom endpoints. This allows authorised users to, for example, create a new collection endpoint by sending a POST request to `/version/database/collection/config`.

## Collections

To create a new collection endpoint, simply send a POST request containing the new collection's schema.

The url should be structured as follows -

`/:version/:databaseName/:collectionName/config`

_WARNING: If this version, database, and collection already exists, the request will overwrite the current schema_

The request body should either contain an `application/json` or a `text/plain` content-type that describes that schema. It is not necessary to send the entire schema when making `UPDATE` requests - only the fields that have changed are necessary.

Validation is performed against schema updates to ensure that the minimum viable structure is present and correct.

You may remove a collection endpoint by sending a DELETE request to the url described above.

You may also get a copy of the schema by sending a GET request.

## Endpoints

To create a new custom endpoint, send a POST request to `/:version/:endpointName/config`.

This request should contain content-type `text/plain`, and must contain valid Javascript. If the endpoint already exists the request will replace the existing endpoint.

_WARNING: the content of this request will be evaluated on the server: if a malicious user obtains a valid token they will be able to execute arbitrary Javascript. Take care to fully secure your API in production environments_

## Main Config

To update the main config file, send a POST request to `/serama/config`.

This should contain content-type `application/json`. This may contain only a partial update, i.e. if the requesting agent doesn't want to update the database they can still update the caching config by just sending the cache JSON.

To see what the current config is, you can send a GET request.

_Note: for updated config to take affect, the API instance will need to be restarted_
