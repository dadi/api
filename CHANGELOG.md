### Change Log
---
##### v1.2.2 (2016-01-18)
* Requests for paths containing `docs` skip authentication

##### v1.2.1 (2016-01-13)

* `Model.find()`
  * convert simple string filters to ObjectID if they appear to be valid ObjectIDs

##### v1.2.0 (2016-01-06)

* `Model.find()`
  * collection setting `defaultFilters` now used when performing a GET request, in addition to filters passed in the querystring
  * collection setting `fieldLimiters` now used when performing a GET request, in addition to fields passed in the querystring
  * `skip` can be passed in the querystring to explicitly set an offset. The `skip` value is normally calculated using the `count` and `page` values, so if `count = 10` and `page = 2` then `skip` becomes `10` (i.e. `(page-1)*count`). If `skip` is specified in the querystring, this value is added to the calculated value to avoid overlapping records on subsequent pages.

* Validation: the `limt` and `validationRule` schema properties have been deprecated in favour of the below. Not all rules are required, of course:

  ```
  validation: {
    minLength: 1,
    maxLength: 20,
    regex: {
      pattern: /^abc/
    }
  }
  ```

##### v0.1.10 (2015-11-18)

###### Database

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


###### Collection Schema & Validation

* Schema validation has been relaxed for update operations. Serama previously expected all required fields to be supplied in an update request, now it's fine to send only changed data
* Fix to allow required Boolean fields to be set to false

* removed references to /endpoints

###### Authentication & Authorisation

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

###### Cache
* Flush model cache on DELETE requests
* added X-Cache and X-Cache-Lookup headers
* added Server name header, default is `Bantam (Serama)`

###### Compose - Reference Fields
* allow enabling compose by querystring
* remove query parameters that don't exist in the model schema

###### Tests
* check for existence of `test` database before continuing
* use `test` database or `testdb` explicitly in some tests
