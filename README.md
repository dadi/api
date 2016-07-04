# DADI API

[![npm (scoped)](https://img.shields.io/npm/v/@dadi/api.svg?maxAge=10800&style=flat-square)](https://www.npmjs.com/package/@dadi/api)
&nbsp;![Coverage](https://img.shields.io/badge/coverage-87%-yellow.svg?style=flat-square)&nbsp;[![Build](http://ci.dadi.technology/dadi/api/badge?branch=master&service=shield)](http://ci.dadi.technology/dadi/api)

## Overview

DADI API is built on Node.JS and MongoDB. It is a high performance RESTful API layer designed in support of [API-first development and the principle of COPE](https://github.com/dadi/api/blob/docs/docs/apiFirst.md).

You can consider it as the data layer within a platform (including the data model). It is designed to be plugged into a templating layer, a mobile application or to be used with any other data consumer.

Calls to a DADI API can contain your business/domain logic (the part of a platform that encodes the real-world business rules that determine how data is created, displayed, stored and changed). It has full support for searching, filtering, limiting, sorting, offsetting, input validation and data aggregation (through support for MongoDB's aggregation pipeline).

It has built in support for oAuth2, includes full collection-level ACL, can connect to multiple databases out of the box, provides native document versioning at collection level, supports static endpoints, includes automatic indexing, has a caching layer and can be run in a clustered configuration.

DADI API provides a starting point that's further advanced than a framework. It allows you to get a complete data layer up and running in minutes.

It is part of DADI, a suite of components covering the full development stack, built for performance and scale.

## Documentation

Documentation is maintained under the `docs` branch and can be found on the [dadi.tech](https://dadi.tech) site.

## Licence

DADI is a data centric development and delivery stack, built specifically in support of the principles of API first and COPE.

Copyright notice<br />
(C) 2016 DADI+ Limited <support@dadi.tech><br />
All rights reserved

This product is part of DADI.<br />
DADI is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version ("the AGPL").

**If you wish to use DADI outside the scope of the AGPL, please
contact us at info@dadi.co for details of alternative licence
arrangements.**

**This product may be distributed alongside other components
available under different licences (which may not be AGPL). See
those components themselves, or the documentation accompanying
them, to determine what licences are applicable.**

DADI is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU Affero General Public License for more details.

The GNU Affero General Public License (AGPL) is available at
http://www.gnu.org/licenses/agpl-3.0.en.html.<br />
A copy can be found in the file AGPL.md distributed with
these files.

This copyright notice MUST APPEAR in all copies of the product!
