<img src="http://52.209.207.148/assets/products/dadi-api-full.png" alt="DADI API" height="65"/>

[![npm (scoped)](https://img.shields.io/npm/v/@dadi/api.svg?maxAge=10800&style=flat-square)](https://www.npmjs.com/package/@dadi/api)
[![coverage](https://img.shields.io/badge/coverage-85%25-yellow.svg?style=flat-square)](https://github.com/dadi/api)
[![Build Status](https://travis-ci.org/dadi/api.svg?branch=master)](https://travis-ci.org/dadi/api)
[![JavaScript Style Guide](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat-square)](http://standardjs.com/)
[![semantic-release](https://img.shields.io/badge/%20%20%F0%9F%93%A6%F0%9F%9A%80-semantic--release-e10079.svg?style=flat-square)](https://github.com/semantic-release/semantic-release)

## Overview

DADI API is built on Node.JS and MongoDB. It is a high performance RESTful API layer designed in support of [API-first development and the principle of COPE](https://github.com/dadi/api/blob/docs/docs/apiFirst.md).

You can consider it as the data layer within a platform (including the data model). It is designed to be plugged into a templating layer, a mobile application or to be used with any other data consumer.

Calls to a DADI API can contain your business/domain logic (the part of a platform that encodes the real-world business rules that determine how data is created, displayed, stored and changed). It has full support for searching, filtering, limiting, sorting, offsetting, input validation and data aggregation (through support for MongoDB's aggregation pipeline).

It has built in support for oAuth2, includes full collection-level ACL, can connect to multiple databases out of the box, provides native document versioning at collection level, supports static endpoints, includes automatic indexing, has a caching layer and can be run in a clustered configuration.

DADI API provides a starting point that's further advanced than a framework. It allows you to get a complete data layer up and running in minutes.

It is part of DADI, a suite of components covering the full development stack, built for performance and scale.

## Requirements

* MongoDB version 2.6-3.0
* Node.js versions:
   * 4.7.0
   * 5.12.0
   * 6.9.2

## Getting started

### Create a new API project

```bash
$ mkdir my-api-app
$ cd my-api-app
```

### Initialise the project

Running `npm init` adds a file called `package.json` to your project, allowing you to easily add dependencies to it:

```bash
$ npm init
```

### Install @dadi/api from NPM

All DADI platform microservices are available from [NPM](https://www.npmjs.com/). To add *API* to your project as a dependency:

```bash
$ npm install --save @dadi/api
```

### Add an entry point

You'll need an entry point for your project. We'll create a file called `index.js` and later we will start the application with `node index.js`.

```bash
$ touch index.js
```

Add the following to the new file:

```js
/**
 *  index.js
 */
var app = require('@dadi/api')

app.start(function() {
  console.log('API Started')
})
```

### Configuration

API requires a configuration file specific to the application environment. For example in the production environment it will look for a file named `config.production.json`.

Place configuration files in a `config` folder in your application root, for example `config/config.development.json`. Full configuration documentation can be found at http://docs.dadi.tech/api/getting-started/configuration/.

**Sample configuration**

```json
{
  "app": {
    "name": "Your API Name"
  },
  "server": {
    "host": "127.0.0.1",
    "port": 3000
  },
  "database": {
    "hosts": [
      {
        "host": "127.0.0.1",
        "port": 27017
      }
    ],
    "database": "dadi-api"
  },
  "auth": {
    "tokenUrl": "/token",
    "tokenTtl": 3600,
    "clientCollection": "clientStore",
    "tokenCollection": "tokenStore",
    "database": {
      "hosts": [
        {
          "host": "127.0.0.1",
          "port": 27017
        }
      ],
      "database": "dadi-api-auth"
    }
  },
  "paths": {
    "collections": "workspace/collections",
    "endpoints": "workspace/endpoints",
    "hooks": "workspace/hooks"
  }
}
```

### Create the first user

User accounts are required to provide an authentication layer for API. Each user has a "clientId" and a "secret". These are used to obtain access tokens for interacting with the API. See the [Authentication](http://docs.dadi.tech/api/concepts/authentication/) section of the API documentation for full details.

```bash
$ npm explore @dadi/api -- npm run create-client
```

This will start the Client Record Generator, accessing you a series of questions and finally inserting the client record into the database you have configured.

To ensure the correct database is used for your environment, add an environment variable to the command:

```bash
$ NODE_ENV=production npm explore @dadi/api -- npm run create-client
```

## Links
* [API Documentation](http://docs.dadi.tech/api/)

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
