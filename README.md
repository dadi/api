<img src="https://dadi.tech/assets/products/dadi-api-full.png" alt="DADI API" height="65"/>

[![npm (scoped)](https://img.shields.io/npm/v/@dadi/api.svg?maxAge=10800&style=flat-square)](https://www.npmjs.com/package/@dadi/api)
[![coverage](https://img.shields.io/badge/coverage-88%25-yellow.svg?style=flat?style=flat-square)](https://github.com/dadi/api)
[![Build Status](https://travis-ci.org/dadi/api.svg?branch=master)](https://travis-ci.org/dadi/api)
[![JavaScript Style Guide](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square)](http://standardjs.com/)

## DADI API

* [Overview](#overview)
* [Requirements](#requirements)
* [Your First API Project](#your-first-api-project)
* [Links](#links)

## Overview

DADI API is built on Node.JS and MongoDB. It is a high performance RESTful API layer designed in support of [API-first development and the principle of COPE](https://dadi.tech/platform/concepts/api-first-and-cope/).

You can consider it as the data layer within a platform (including the data model). It is designed to be plugged into a templating layer (such as [DADI Web](https://dadi.tech/platform/web)), a mobile application or to be used with any other data consumer.

Calls to a DADI API can contain your business/domain logic (the part of a platform that encodes the real-world business rules that determine how data is created, displayed, stored and changed). It has full support for searching, filtering, limiting, sorting, offsetting, input validation and data aggregation (through support for MongoDB's aggregation pipeline).

It has built-in support for oAuth2, includes full collection-level ACL, can connect to multiple databases out of the box, provides native document versioning at collection level, supports static endpoints, includes automatic indexing, has a caching layer and can be run in a clustered configuration.

DADI API provides a starting point that's further advanced than a framework. It allows you to get a complete data layer up and running in minutes.

It is part of DADI, a suite of components covering the full development stack, built for performance and scale.

## Requirements

* **[MongoDB](https://docs.mongodb.com/v3.0/)** (supported versions: 2.6 - 3.2)
* **[Node.js](https://www.nodejs.org/)** (supported versions: 6.x)

## Your first API project

### Install API

The quickest way to get started with *API* is to use [DADI CLI](https://github.com/dadi/cli). See [Creating an API](https://docs.dadi.tech/#api/creating-an-api) for full installation details.


### Configuration

API starts with some sensible defaults, so it's not necessary to understand all the configuration options available when first running the application.

Configuration is handled using JSON files specific to the application environment. For example in the production environment a file named `config.production.json` will be used. Configuration files must be placed in a `config` folder in your application root, for example `config/config.production.json`. The default start up environment is `development`, using the configuration file at `config/config.development.json`.

The bare minimum required for running the API is a `server` block. With only a `server` block, default values are used for all other properties.

**Sample configuration**

```json
{
  "server": {
    "host": "127.0.0.1",
    "port": 3000
  }
}
```

### Start the server

API can be started from the command line simply by issuing the following command:

```bash
$ npm start
```

#### Test the connection

With the default configuration, our API server is available at http://localhost:3000. If you've modified the configuration file's `server` block, your API will be available at the address and port you've chosen. Use cURL to check the server is running, if the connection can be made you will receive the following "Unauthorised" message.

```bash
$ curl http://localhost:3000
```

```json
{ "statusCode": 401 }
```


#### Check the response headers

```bash
$ curl -I http://localhost:3000
```
```json
HTTP/1.1 401 Unauthorized
content-type: application/json
content-length: 18
Date: Thu, 20 Apr 2017 23:42:25 GMT
Connection: keep-alive
```

### Authentication

The HTTP 401 response received in the previous step shows that the server is running. To start using the REST endpoints you'll need a user account so you can obtain access tokens for interacting with the API.

User accounts provide an authentication layer for API. Each user account has a *__clientId__* and a *__secret__*. These are used to obtain access tokens for interacting with the API. See the [Authentication](https://docs.dadi.tech/#api/authentication) section of the API documentation for full details.

#### Creating the first user

[CLI](https://github.com/dadi/api) contains an interactive "Client Record Generator" to help you create user accounts. Run the following command in the directory where you installed *API*:

```bash
cd my-new-api
dadi api clients:add
```

If you need to create user accounts in other environments (for example following a deployment to a live server), add the environment to the following command:

```bash
$ NODE_ENV=production npm explore @dadi/api -- npm run create-client
```

### Run API as a service
To run your API application in the background as a service, install Forever and Forever Service:

```bash
$ npm install forever forever-service -g

$ sudo forever-service install -s index.js -e "NODE_ENV=production" api --start
```

You can now interact with the `api` service using the following commands:

```bash
$ [sudo] service api start
$ [sudo] service api stop
$ [sudo] service api status
$ [sudo] service api restart
```

> Note: the environment variable `NODE_ENV=production` must be set to the required configuration version matching the configuration files available in the `config` directory.

## Links
* [API Documentation](https://docs.dadi.tech/#api/)

## Contributors

DADI API is based on an original idea by Joseph Denne. It is developed and maintained by the engineering team at DADI ([https://dadi.tech](https://dadi.tech))

* Adam K Dean <akd@dadi.co>
* Arthur Mingard <am@dadi.co>
* Dave Allen <da@dadi.co>
* David Longworth <dl@dadi.co>
* Derrick <dh@dadi.co>
* Eduardo Bouças <eb@dadi.co>
* Francesco Iannuzzelli <fi@dadi.co>
* James Lambie <jl@dadi.co>
* Joe Wagner
* Joseph Denne <jd@dadi.co>
* Kevin Sowers <kevin.sowers223@gmail.com>
* Magnus Dahlstrand <magnus@mdahlstrand.com>
* Robert Stanford <rs@dadi.co>
* Viktor Fero <vf@dadi.co>

## Licence

DADI is a data centric development and delivery stack, built specifically in support of the principles of API first and COPE.

Copyright notice<br />
(C) 2017 DADI+ Limited <support@dadi.tech><br />
All rights reserved

This product is part of DADI.<br />
DADI is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version ("the GPL").

**If you wish to use DADI outside the scope of the GPL, please
contact us at info@dadi.co for details of alternative licence
arrangements.**

**This product may be distributed alongside other components
available under different licences (which may not be GPL). See
those components themselves, or the documentation accompanying
them, to determine what licences are applicable.**

DADI is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

The GNU General Public License (GPL) is available at
http://www.gnu.org/licenses/gpl-3.0.en.html.<br />
A copy can be found in the file GPL.md distributed with
these files.

This copyright notice MUST APPEAR in all copies of the product!

