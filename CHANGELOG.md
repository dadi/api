# Change Log
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](http://keepachangelog.com/)
and this project adheres to [Semantic Versioning](http://semver.org/).

## [4.4.5] (2019-01-24)

### Fixed

- [#530](https://github.com/dadi/api/issues/530): run `afterGet` hooks after field hooks

## [4.4.4] (2018-12-20)

### Changed

- [#524](https://github.com/dadi/api/pull/524): upgrade `@dadi/status` package

### Fixed

- [#521](https://github.com/dadi/api/issues/521): PUT request should respect `fields` parameter in ACL
- [#522](https://github.com/dadi/api/issues/522): resources API should only list resources which the client has access to
- [#525](https://github.com/dadi/api/issues/525): required fields should not accept empty strings

## [4.4.3] (2018-11-29)

### Fixed

- [#519](https://github.com/dadi/api/pull/519): add URL property to composed Media values

## [4.4.2] (2018-11-29)

### Fixed

- [#518](https://github.com/dadi/api/pull/518): make media field handle null values

## [4.4.1] (2018-11-28)

### Fixed

- [#516](https://github.com/dadi/api/issues/516): make media field handle legacy values

## [4.4.0] (2018-11-22)

### Added

- [#415](https://github.com/dadi/api/issues/415): add Media field
- [#451](https://github.com/dadi/api/issues/451): add new validation module and operators
- [#498](https://github.com/dadi/api/issues/498): allow bulk upload and deletion of media documents
- [#507](https://github.com/dadi/api/pull/507): allow arbitrary metadata on media documents
- [#508](https://github.com/dadi/api/pull/508): support application/json content type when updating media documents
- [#514](https://github.com/dadi/api/pull/514): add mimeType validation operator and `_composed` property to media documents

### Changed

- [#510](https://github.com/dadi/api/pull/510): replace spaces with underscores in media document filenames

### Fixed

- [#509](https://github.com/dadi/api/pull/509): use correct response codes when creating and updating media documents

## [4.3.0] (2018-09-27)

### Changed

- [#490](https://github.com/dadi/api/issues/490): add i18n field character to /api/languages endpoint
- [#492](https://github.com/dadi/api/issues/492): add collection schemas and settings to /api/collections endpoint

## [4.2.2] (2018-09-04)

### Changed

- [#487](https://github.com/dadi/api/pull/487): return Promise from disk storage handler, resolves crash on media GET requests

## [4.2.1] (2018-08-28)

### Changed

- [#485](https://github.com/dadi/api/pull/485): add lang fields to field projection

## [4.2.0] (2018-08-20)

### Added

- [#453](https://github.com/dadi/api/issues/453): add support for arbitrary data against client records
- [#462](https://github.com/dadi/api/issues/462): introduce `/api/client` endpoints
- [#482](https://github.com/dadi/api/issues/482): add support for feature queries

### Changed

- [#474](https://github.com/dadi/api/issues/474): require current client secret when setting a new one
- [#476](https://github.com/dadi/api/issues/476): remove internal properties from POST and PUT payloads

## [4.1.1] (2018-08-01)

### Added

- [#465](https://github.com/dadi/api/issues/465): make ACL models accessible via an export

## [4.1.0] (2018-08-01)

### Added

Two new features in this version of API, see https://docs.dadi.cloud/api for full details:

- Multi-language support
- Document indexing and Search

## [4.0.4] (2018-07-30)

### Fixed

- [#469](https://github.com/dadi/api/issues/469): fix issue where querying String fields with a `$ne` operator causes the request to hang

## [4.0.3] (2018-07-27)

### Fixed

- [#466](https://github.com/dadi/api/issues/466): allow processing of multiple image upload requests

## [4.0.2] (2018-07-26)

### Fixed

- [#463](https://github.com/dadi/api/issues/463): fix issue with API version numbers containing a dot (`.`) when using the MongoDB data connector

## [4.0.1] (2018-07-18)

### Fixed

- [#457](https://github.com/dadi/api/issues/457): reinstate `slug` property in /api/collections endpoint
- [#460](https://github.com/dadi/api/pull/460): use correct permissions and status code when a role is revoked from a client

## [4.0.0] (2018-07-11)

### Added

- [#396](https://github.com/dadi/api/issues/396): add access control list (see https://docs.dadi.cloud/api/4.0#authorisation-and-permissions)
- [#449](https://github.com/dadi/api/pull/449): remove `/config` endpoints

### Changed

- [#438](https://github.com/dadi/api/issues/438): make CORS enabled by default
- [#447](https://github.com/dadi/api/pull/447):  adds an additional content type check when determining if the current request should be parsed by the JSON parsing middleware

### BREAKING CHANGES

#### Access control list

The main change from version 3 to 4 is the introduction of the [access control list](https://docs.dadi.cloud/api/4.0#authorisation-and-permissions). It's technically a breaking change, since any clients without `{"accessType": "admin"}` will lose access to everything by default. They need to be assigned permissions for the individual resources they should be able to access, either directly or via roles.

If you don't want to use the new advanced permissions and instead keep your clients with unrestricted access to API resources, make sure to set `{"accessType": "admin"}` in their database records. API doesn't currently offer a way to change this property via the endpoints, so you'll need to manually make this change in the database.

#### Removal of write mode on configuration endpoints

Version 4 removes the ability for clients to create, modify and delete collections, custom endpoints or update the main API configuration. The *read* endpoints were kept – e.g. `GET /api/config` is valid, but `POST /api/config` is not.

#### Other breaking changes

- Requesting a document by ID (e.g. `/version/database/collection/doc123456`) now returns a 404 if the given ID does not correspond to a valid document, instead of returning a 200 with an empty result set. This behaviour is consistent with the `DELETE` and `PUT` verbs.

## [3.2.1] (2018-06-13)

### Changed

* [#435](https://github.com/dadi/api/issues/435): Fix issue where filtering `Object` fields with nested queries would return a 400 error.

## [3.2.0] (2018-06-08)

See release notes at https://github.com/dadi/api/releases/tag/v3.2.0

### Added

* [#431](https://github.com/dadi/api/pull/431): allow DELETE requests to media collection endpoints; enable `s3.endpoint` in the configuration to allow using Digital Ocean Spaces as a storage handler.

## [3.1.2] (2018-05-01)

### Changed

* [#417](https://github.com/dadi/api/pull/417): Fix issue where `Reference` fields pointing to the media collection were not fully resolved.

## [3.1.1] (2018-04-13)

### Changed

* [#413](https://github.com/dadi/api/pull/413): Pass `req` object to hooks.

## [3.1.0-rc1] (2018-04-06)

### Added

* [#157](https://github.com/dadi/api/issues/157): Documents in Reference fields are now resolved multiple times if `settings.strictCompose` is set to `true`
* [#177](https://github.com/dadi/api/issues/177): Model API now supports Promises and named parameters. old syntax is retained for backward-compatibility.
* [#329](https://github.com/dadi/api/issues/329): Fields in referenced documents can now be specified using dot-notation in the existing `fields` parameter.
* [#336](https://github.com/dadi/api/issues/336): A Reference field can now reference documents from multiple collections.
* [#406](https://github.com/dadi/api/pull/406): Introduced handshake function to ensure compatibility of versions between API core and data connectors.

### Changed

* [#196](https://github.com/dadi/api/issues/196) and [#323](https://github.com/dadi/api/issues/323): Added field modules to encapsulate field-specific logic.
* [#300](https://github.com/dadi/api/issues/300): `_createdAt` and `_lastModifiedAt` internal fields are now appended to documents in the Model class.
* [#371](https://github.com/dadi/api/issues/371) and [#384](https://github.com/dadi/api/issues/384): Make defaults paths relative to the parent app, not the module.
* [#390](https://github.com/dadi/api/issues/390): Falsy values of Reference fields are now ignored, preserving the behavior of any other Reference fields in the document.
* [#394](https://github.com/dadi/api/issues/394): New DateTime field module now stores values as Unix timestamps and allows queries to be performed using any date format.
* [#405](https://github.com/dadi/api/pull/405): Lock down major version of `@dadi/logger`.

## [3.0.0] (2017-12-05)

See full release notes at https://github.com/dadi/api/releases/tag/v3.0.0

### Added

#### Data Connectors

API Version 3.0 supports multiple data connectors. In previous versions API used MongoDB as a backend; this is now configurable. API Data Connectors are available as NPM packages. To add one to your API installation, run the associated NPM install command:

`$ npm install @dadi/api-mongodb --save`

Each data connector has it's own configuration requirements, but API must also be configured to use the data connectors you select. Modify your API configuration as follows:

```json
{
  "datastore": "@dadi/api-mongodb",  // the NPM package name for the data connector to use for the content layer
  "auth": {
    "tokenUrl": "/token",
    "tokenTtl": 1800,
    "clientCollection": "clientStore",
    "tokenCollection": "tokenStore",
    "datastore": "@dadi/api-mongodb",  // the NPM package name for the data connector to use for the authentication layer
    "database": "test"
  }
}
```

In addition, the data connector itself normally requires it's own configuration file. For example the MongoDB data connector requires a file using the following naming convention `mongodb.<environment>.json`. These configuration files should be placed the `config` directory of the API application.

#### Connection Recovery

API is now capable of recovering from database connection failures. When API is started with no available database service it will keep retrying until a successful connection can be made, then it runs the normal boot process.

In addition, if the database connection is lost during normal operation of API, any requests made while the connection is offline will result in a HTTP 503 returned to the client.

The maximum number of connection retries can be configured in the main configuration file by adding the following block:

```json
"databaseConnection": {
  "maxRetries": 5   // default 10
}
```

### Changed

* New startup message displayed, with links to documentation
* [#141](https://github.com/dadi/api/issues/141): the internal fields will be prefixed with a special character (`_` by default) which is configurable using the configuration property `internalFieldsPrefix`
* [#180](https://github.com/dadi/api/issues/180): document properties with `null` values are not returned as part of the response
* [#251](https://github.com/dadi/api/issues/251): added a new `/hello` endpoint which returns HTTP 200 and a "Welcome to API" message
* [#263](https://github.com/dadi/api/issues/263): all delete hooks now receive a `deletedDocs` property
* [#314](https://github.com/dadi/api/issues/314): when configuration option `feedback` is `true` we now send a response body when deleting documents
* [#327](https://github.com/dadi/api/issues/327): API becomes capable of recovering from database connection failures
* [#328](https://github.com/dadi/api/issues/328): remove schema validation on settings: 'callback', 'defaultFilters', 'fieldLimiters' and 'count'. Now only requires 'cache' and 'authenticate'
* [#332](https://github.com/dadi/api/issues/332): allow POST to collection endpoints using `text/plain` content-type, which will be converted if it is valid JSON
* Configuration file validation removed, suppressing warnings on application startup
* POST/PUT/DELETE using non-existing document identifiers returns a 404:

DELETE requests throws a 404 (instead of 204) when deleting a non-existing document by ID. This applies to requests where the document ID is passed in the URL, not when in the body (e.g. DELETE /v1/db/collection/DOC-ID vs DELETE /v1/db/collection).

POST/PUT requests throw a 404 when updating a non-existing document by ID. This applies to requests where the document ID is passed in the URL, not when in the body (e.g. PUT /v1/db/collection/DOC-ID vs PUT /v1/db/collection).

Closes [#345](https://github.com/dadi/api/issues/345).

## [2.2.9] (2017-12-05)

### Changed

Fix previous release 2.2.8: [#363](https://github.com/dadi/api/issues/363): allow OPTIONS method when calling the token route

## [2.2.8] (2017-12-04)

### Changed

[#363](https://github.com/dadi/api/issues/363): allow OPTIONS method when calling the token route

## [2.2.0] (2017-07-05)

### Changed

[#289](https://github.com/dadi/api/issues/289): improved error response from hooks, with custom error support
[#311](https://github.com/dadi/api/issues/311): fix a bug that caused multiple newly-created reference field subdocuments to be returned as a poorly-formed array

## [2.1.2] (2017-06-29)

### Changed

[#289](https://github.com/dadi/api/issues/289): improved error response from hooks
[#305](https://github.com/dadi/api/issues/305): remove restriction on environment settings. Use any environment name and configuration file, rather than only "development", "qa", "production", "test"
[#306](https://github.com/dadi/api/issues/306): fix reference field composition when value is an empty array

## [2.1.0] (2017-05-29)

### Added

* [#298](https://github.com/dadi/api/issues/298): documents to be deleted will first have the current state written into the history collection, if enabled

### Changed

* add additional property `action` to history revision documents. Possible values are "update", "delete" and the appropriate value is selected when updating/deleting records
* add additional property `originalDocumentId` to history revision documents, value is the identifier of the parent document.

## [2.0.0] (2017-05-29)

### Changed

#### Upgraded MongoDB driver
Upgrade MongoDB driver to 2.2.x, from the existing 1.4.x version.

#### Fixed `create-client` script
 * use correct `accessType` property in client store documents
 * abort if chosen clientId exists already

#### Generate new documents from a pre-composed document

It is now possible to send API a full document containing pre-composed Reference fields. API will translate such a request into individual documents for the relevant collections. This functionality reduces the number of API calls that must be made from an application when inserting data.

##### For example

Assume we have two collections, `people` and `cars`. `cars` is a Reference field within the `people` collection schema. Given the following body in a POST request to `/1.0/car-club/people`:

```json
{
  "name": "Joe",
  "cars": [
    {
      "model": "Lamborghini Diablo",
      "year": 1991
    }
  ]
}
```

API will automatically create new documents in the `cars` collection and use the new identifier value in the `people` document. The final `people` document would look similar to this:

```json
{
  "name": "Joe",
  "cars": [
    "587cb6aa80222c9e7266cec0"
  ]
}
```


#### Media collections
This version introduces a few changes to how media is handled by API.

The concept of media collections has been abstracted from the public API. It removes the requirement for a collection schema, instead using a schema kept internally in API. At the moment it's hardcoded to store images (containing dimensions, size, mime type, etc.), but in the future we will look into making the schema adapt to the type of file being uploaded.

##### Endpoints

| Method | Endpoint | Purpose | Example
|:-|:---|:----|:--
| POST |`/media/sign`| Requesting a signed URL for a media upload| |
| POST  |`/media/:signedUrl`|Uploading a media asset ||
| GET | `/media`|Listing media assets ||
| GET | `/media/:assetPath`|Access a specific media asset | `/media/2017/04/27/flowers.jpg`

#### Media buckets

Even though that's abstracted from the end user, assets still need to be stored in collections. Assets POSTed to /media will be stored in a `mediaStore` collection (configurable via the `media.defaultBucket` configuration parameter). It is also possible to add additional "media buckets", configured as an array in the `media.buckets` configuration parameter.

##### Endpoints

Here are the same media collection endpoints for interacting with a media bucket called `mediaAvatars`:

| Method | Endpoint | Purpose | Example
|:-|:---|:----|:--
| POST |`/media/mediaAvatars/sign`| Requesting a signed URL for a media upload| |
| POST  |`/media/mediaAvatars/:signedUrl`|Uploading a media asset ||
| GET | `/media/mediaAvatars`|Listing media assets ||
| GET | `/media/mediaAvatars/:assetPath`|Access a specific media asset | `/media/mediaAvatars/2017/04/27/flowers.jpg`

#### Naming conflicts

If there is a data collection with the same name as one of the media buckets, API throws an error detailing the name of the conflicting collection.

#### Discovering media buckets

Added information about media buckets to the /api/collections endpoint, indicating a list of the available media buckets as well as the name of the default one.

```
GET /api/collections
```

```json
{
  "collections": [
    {
      "version": "1.0",
      "database": "library",
      "name": "Articles",
      "slug": "articles",
      "path": "/1.0/library/articles"
    },
    {
      "version": "1.0",
      "database": "library",
      "name": "Books",
      "slug": "books",
      "path": "/1.0/library/books"
    }
  ],
  "media": {
    "buckets": [
      "authorImages",
      "mediaStore"
    ],
    "defaultBucket": "mediaStore"
  }
}
```

#### Add `url` property to media documents
Instead of replacing the contents of `path`, leave that as it is and write the full URL to a new property called `url`.

```json
"image": {
  "_id": "591b5f29795b683664af01e9",
  "fileName": "3RdYMTLoL1X16djGF52cFtJovDT.jpg",
  "mimetype": "image/jpeg",
  "width": 600,
  "height": 900,
  "contentLength": 54907,
  "path": "/media/2017/05/16/3RdYMTLoL1X16djGF52cFtJovDT-1494966057926.jpg",
  "createdAt": 1494966057685,
  "createdBy": null,
  "v": 1,
  "url": "http://localhost:5000/media/2017/05/16/3RdYMTLoL1X16djGF52cFtJovDT-1494966057926.jpg"
}
```

#### Hook configuration endpoints

Extended the hooks config endpoint (`/api/hooks/:hookName/config`) to accept POST, PUT and DELETE requests to create, update and delete hooks, respectively.

#### Other

* [#245](https://github.com/dadi/api/issues/245): fix media path formatting
* [#246](https://github.com/dadi/api/issues/246): ignore _id field in query when processing query filters
* [#257](https://github.com/dadi/api/issues/257): improve performance of Reference field composition
* [#265](https://github.com/dadi/api/issues/265): validate arrays against schemas in POST requests
* [#284](https://github.com/dadi/api/issues/284): check indexes correctly when given a sort key
* remove `apiVersion` query property when composing reference fields, improves performance

### Added

#### MongoDB readPreference configuration
Added `readPreference` configuration option. Default is `secondaryPreferred`. Closed [#156](https://github.com/dadi/api/issues/156)

```json
"database": {
  "hosts": [
    {
      "host": "127.0.0.1",
      "port": 27017
    }
  ],
  "username": "",
  "password": "",
  "database": "api",
  "ssl": false,
  "replicaSet": "",
  "enableCollectionDatabases": false,
  "readPreference": "primary"
}
```

#### API baseUrl

We've introduced a `server.baseUrl` configuration parameter, which will be used to determine the URL of media assets when using the disk storage option.

```json
"baseUrl": {
  "protocol": "http",
  "port": 80,
  "host": "mydomain.com"
}
```


#### Post install script

Added a post install script which runs following an install of API from NPM. A development configuration file is created along with a basic workspace directory containing two collections, an endpoint and a hook. No files are overwritten if the config and workspace directories already exist.

## [1.16.6] (2017-05-25)

### Changed
* improved check within composer module that ignores "undefined" values as well as "null"

## [1.16.5] (2017-05-12)

### Changed
* [#260](https://github.com/dadi/api/issues/260): change media collection type to "mediaCollection"

## [1.16.4] (2017-05-12)

### Changed
* [#211](https://github.com/dadi/api/issues/211): fix composition so it doesn't return before all fields have been composed

## [1.15.5] (2017-03-30)

### Changed
* [#226](https://github.com/dadi/api/issues/226): historyFilters corrupt model filters

## [1.15.4] (2017-02-15)

### Changed
* pass auth indicator to connection ([1d3ebed](https://github.com/dadi/api/commit/1d3ebed))


## [1.15.3] (2017-02-15)

### Changed

* [#200](https://github.com/dadi/api/issues/200): explicitly add "node" command to create-client script ([8394355](https://github.com/dadi/api/commit/8394355))


## [1.15.2] (2017-01-31)

### Changed

* select non-null fields for composition ([21e48bf](https://github.com/dadi/api/commit/21e48bf))

## [1.15.1] (2017-01-23)

### Changed

* revert mongodb version to allow full 1.4 range ([0d2398c](https://github.com/dadi/api/commit/0d2398c))

## [1.15.0] (2017-01-18)

### Added

* add busboy dependency ([3eda9fe](https://github.com/dadi/api/commit/3eda9fe))
* add configurable media collection name ([c038a58](https://github.com/dadi/api/commit/c038a58))
* add error handling to remaining hook types ([79df695](https://github.com/dadi/api/commit/79df695))
* add redirectPort to config ([e1d6c58](https://github.com/dadi/api/commit/e1d6c58))
* add Redis cache tests back after a long time in exile ([5f3618e](https://github.com/dadi/api/commit/5f3618e))
* improve SSL handling ([80073eb](https://github.com/dadi/api/commit/80073eb))
* move media upload to new controller ([12cd39c](https://github.com/dadi/api/commit/12cd39c))

### Changed

* [#164](https://github.com/dadi/api/issues/164): use platform agnostic approach to directory separators ([d4e49b2](https://github.com/dadi/api/commit/d4e49b2))
* add current year to copyright notice ([1e5be89](https://github.com/dadi/api/commit/1e5be89))
* missing dependencies ([3a4dd51](https://github.com/dadi/api/commit/3a4dd51))
* remove unnecessary escape chars ([73aad00](https://github.com/dadi/api/commit/73aad00))
* remove unused variable ([4b741e3](https://github.com/dadi/api/commit/4b741e3))
* resolve ObjectIDs in batch delete query ([3d407f9](https://github.com/dadi/api/commit/3d407f9))
* send error response if path not specified ([c14edf2](https://github.com/dadi/api/commit/c14edf2))
* use platform agnostic path separator ([cfec695](https://github.com/dadi/api/commit/cfec695))


## [1.14.1] (2016-12-28)
### Changed
* [#164](https://github.com/dadi/api/issues/164): Modified collection and endpoint loading to use the current platform's directory separator, rather than assuming '/', which fails under Windows.


## [1.14.0] (2016-11-10)
### Added
* Added a `matchType` property to fields in collection schemas. Determines the type of match allowed when querying using this field. Possible values:

|Value | Behaviour
|:---|:-----
| "exact" | query will be performed using the exact value specified, e.g. { "publishedState": "published" }
| "ignoreCase" | query will be performed using a case insensitive regex of the value specified, e.g. { "publishedState": /^published$/i }
| "anything else" | query will be performed using a regex of the value specified, e.g. { "publishedState": /^published$/ }

> **Note:** If `matchType` is not specified, the default (for legacy reasons) is _a case insensitive regex of the value specified_, e.g. { "publishedState": /^published$/i }

* Added error handling to beforeCreate hooks. If an error is encountered while executing a beforeCreate hook, an error is returned in the response:

```json
{
  "success": false,
  "errors": [
    {
      "code": "API-0002",
      "title": "Hook Error",
      "details": "The hook 'myHook' failed: 'ReferenceError: title is not defined'",
      "docLink": "http://docs.dadi.tech/api/errors/API-0002"
    }
  ]
}
```

* Added environment variables for database configuration properties:

|Property | Environment variable
|:---|:-----
|Database username| "DB_USERNAME"
|Database password| "DB_PASSWORD"
|Database name| "DB_NAME"
|Auth database username| "DB_AUTH_USERNAME"
|Auth database password| "DB_AUTH_PASSWORD"
|Auth database name| "DB_AUTH_NAME"

### Changed

* Modified the model instantiation to wait a second if the database hasn't been connected yet. This avoids the error about maximum event listeners being added in the `createIndex` method.

## [1.11.1] (2016-07-16)

* no longer convert to ObjectID if the query is using dot notation and the parent field
is of type `Mixed`. This supports legacy CMS use in some cases
* remove the options when calling a collection's count endpoint, to ensure no
`limit` parameter is sent

## [1.11.0] (2016-07-14)

### Batch delete of documents
@eduardoboucas

**Usage:**

Method: DELETE
URL: `http://api.example.com/1.0/fictional-magazine-brand/articles`

Body:
```
{
  "query": {
    "title": {"$in": ["foo", "bar", "baz]}
  }
}
```

### Filter revision history and return specified fields
@eduardoboucas

The `includeHistory` param now respects the `fields` param, so that documents in history only contain the fields specified.

Added: a `historyFilters` URL parameter, to be used in conjunction with `includeHistory`, which adds the option to have a filter specific to the documents in history, with the same syntax as the existing `filter`.

This makes it possible to retrieve only the revisions where name is `Jim`:

```
http://api.example.com/1.0/fictional-magazine-brand/users/57866216acc4818e048efd36?includeHistory=true&historyFilters={"name":"Jim"}
```

Or get revisions between two dates:

```
http://api.example.com/1.0/fictional-magazine-brand/users/57866216acc4818e048efd36?includeHistory=true&historyFilters={"lastModifiedAt":{"$gte":1468424733361,"$lte":1468424737447}}
```

### Environment variables for sensitive data
@dark12222000

Configuration variables likely to contain sensitive data can now be set from environment variables, rather than committing this data to config files.

Available variables:

* NODE_ENV
* HOST
* PORT
* REDIS_ENABLED
* REDIS_HOST
* REDIS_PORT
* REDIS_PASSWORD
* KINESIS_STREAM


## [1.4.0] (2016-03-24)

### Support for Hooks (beforeCreate, afterCreate, beforeUpdate, afterUpdate, beforeDelete, afterDelete).
Provided by @eduardoboucas, many thanks for the hard work on this! Full documentation to be made available soon.

### Breaking change: Endpoint Authentication

The default setting is now 'must authenticate'. This means if you have custom endpoints
that are currently open and you want them to stay that way, add this block to the JS file:

```
module.exports.model = {
  settings: {
    authenticate: false
  }
}
```

### Connection module

Previously created connections for every loaded collection, resulting in a new connection pool
for each collection. New behaviour is to create one connection per database - if you aren't
using `enableCollectionDatabases` then this means you'll only be making one connection
to the database.

### Other
* Fix #39. Apply apiVersion filter to query only if it's configured using the `useVersionFilter` property (ed1c1d8)
* Fix #38. Allow Mixed fields through to the data query, giving back the power to use dot notation in the query (49a0a07)
* Add timestamps to console log statements (018f4f2)
* Modify API host and port requirements. `null` for host will allow connections on
  any IPv6 address (if available), otherwise any IPv4 address. If port is `0` a random port will be assigned (3d5e0e0)
* Add response to OPTIONS requests, thanks @eduardoboucas (969d808)
* Add authentication on a per-HTTP method basis, thanks @eduardoboucas (a00b72c)
* Use HTTP PUT for updates (also backwards-compatible with POST) (865e7f6)
* Add WWW-Authenticate header to when sending HTTP 401 responses (4708020)
* Add config settings for log file rotation (4e7e81d)
* Add logging level to limit log records (e282e62)

## [1.3.0] (2016-02-26)

Fix #13: Removed auto-creation of API docs path (should only happen if api-doc module is installed)
Close #14: Load domain-specific configuration if matching file exists
Close #16: Check that generated auth token doesn't already exist, generate new one if it does
Close #18: Validate `skip` & `page` parameters before calling `model.find()`
Close #19: Database `replicaSet` property should be a String, not a Boolean
Cache: add Redis caching ability and extend config to allow switching between filesystem and Redis caches
Cache: locate endpoint matching the request URL using path-to-regex so we can be certain of a match
---
## [1.2.2] (2016-01-18)
* Requests for paths containing `docs` skip authentication
* Custom endpoints with JS comments in the head of the file will have those comments added to the global app object, making for more meaningful API documentation (with the use of npm package `dadi-apidoc`)

## [1.2.1] (2016-01-13)

* `Model.find()`
  * convert simple string filters to ObjectID if they appear to be valid ObjectIDs

## [1.2.0] (2016-01-06)

* `Model.find()`
  * collection setting `defaultFilters` now used when performing a GET request, in addition to filters passed in the querystring
  * collection setting `fieldLimiters` now used when performing a GET request, in addition to fields passed in the querystring
  * `skip` can be passed in the querystring to explicitly set an offset. The `skip` value is normally calculated using the `count` and `page` values, so if `count = 10` and `page = 2` then `skip` becomes `10` (i.e. `(page-1)*count`). If `skip` is specified in the querystring, this value is added to the calculated value to avoid overlapping records on subsequent pages.

* Validation: the `limit` and `validationRule` schema properties have been deprecated in favour of the below. Not all rules are required, of course:

  ```
  validation: {
    minLength: 1,
    maxLength: 20,
    regex: {
      pattern: /^abc/
    }
  }
  ```

## v0.1.10 (2015-11-18)

### Database

* MongoDB Replica Set support
* `create()` and `update()` operations return a `results` object the same as `find()`
* Startup process now checks for existence of an index on the configured `tokenStore` collection: `{ 'token': 1,'tokenExpire': 1 }`
* TTL index on the `tokenStore` collection is set to remove documents immediately after the `tokenExpire` value
* Pass the API version from the querystring to the `find()` query
* Collection-level databases are now fully enabled. A collection as `/1.0/reviews/articles` will use a `reviews` database. This mode is disabled by default and can be enabled within the database configuration section via the "enableCollectionDatabases" property:

```
    "database": {
        "hosts": [
            {
                "host": "127.0.0.1",
                "port": 27017
            }
        ],
        "username": "",
        "password": "",
        "database": "serama",
        "ssl": false,
        "replicaSet": false,
        "enableCollectionDatabases": true
    }
```


### Collection Schema & Validation

* Schema validation has been relaxed for update operations. Serama previously expected all required fields to be supplied in an update request, now it's fine to send only changed data
* Fix to allow required Boolean fields to be set to false

* removed references to /endpoints

### Authentication & Authorisation

* Add `created` field when creating new auth tokens to enable automatic removal by TTL index
* Fixed support for client authorisation by API version, in case you need to restrict a set of users to a specific version of the API:

```
{
  clientId: 'clientX',
  secret: 'secret',
  accessType: 'user',
  permissions: {
    collections: [ { apiVersion: "1.0", path: "test-collection" } ],
    endpoints: [ { apiVersion: "1.0", path: "test-endpoint" } ]
  }
}
```

### Cache
* Flush model cache on DELETE requests
* added X-Cache and X-Cache-Lookup headers
* added Server name header, default is `Bantam (Serama)`

### Compose - Reference Fields
* allow enabling compose by querystring
* remove query parameters that don't exist in the model schema

### Tests
* check for existence of `test` database before continuing
* use `test` database or `testdb` explicitly in some tests
