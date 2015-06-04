![Serama](../serama.png)

# Model

## Overview

This module handles data validation and CRUD. A model instance will try to connect to the database using `config.database.{model name}` from the config.json file. If that does not exist in config, it will use the default database config, i.e. `config.database.host`, `config.database.port`, etc... You can also optionally pass in an existing connection object.

## Arguments

Model(name, fields, [connection], settings) -

* `name` a String that will be unique among models
* `fields` an Object that describes this models fields, as per the spec
* `connection` Optionally, a connection instance that is already initialized. If not passed in, the model will try to connect with data from config
* `settings` an Object that describes the default behaviour of this model

## Settings

* `cache` true
* `cacheTTL` 300
* `authenticate` true
* `callback` null
* `defaultFilters` null
* `fieldLimiters` null
* `allowExtension` false
* `count` 40
* `sortOrder` 1
* `storeRevisions` true
* `revisionCollection` "testSchemaHistory"

## Database Indexes

Database indexes can be automatically created for a collection by specifying the fields to be indexed in the `settings` object. 

An index will be created on the collection using the fields specified in the `index.keys` setting. A value of `keys: { fieldName: 1 }` will create an index for field `fieldName` using an ascending order. `keys: { fieldName: -1 }` will create an index for field `fieldName` using a descending order.

#### settings.index

```
settings: {
  cache: true,
  ...
  index: { 
    enabled: true, 
    keys: { 
      field1: 1,
      field2: -1 
    } 
  }
}
```

## Revisions

#### settings.storeRevisions
  
If `settings.storeRevisions` is **true**:

* a `revision collection` will automatically be generated in the database when the first document for the model is created
* a `revision document` will be stored in the `revision collection` when a new document is created
* a `revision document` will be stored for each subsequent update to an existing document  
* each time a `revision document` is created, the `_id` of the `revision document` is pushed onto a `history` array of the original document

#### settings.revisionCollection

If `settings.revisionCollection` is specified, the model's `revision collection` will be named according to the specified value, otherwise the model's `revision collection` will take the form `{model name}History`.



For example:


`db.testModelName.find()`

	/* Main document stored in the model's collection, with revisions referenced in the
	history array */
	
	{
		"_id" : ObjectId("548efd7687fd8b50f3dca6e5"),
		"fieldName" : "bar",
		"history" : [
			ObjectId("548efd7687fd8b50f3dca6e6"),
			ObjectId("548efd7687fd8b50f3dca6e7")
		]
	}

`db.testModelNameHistory.find()`

	/* Two revision documents stored in the model's revision collection, one created at
	the same time as the original document was created, the second created after an
	update operation to change the value of `fieldName` */
	
	{ 
		"_id" : ObjectId("548efd7687fd8b50f3dca6e6"),
		"fieldName" : "foo"
	}
	
	{
		"_id" : ObjectId("548efd7687fd8b50f3dca6e7"),
		"fieldName" : "foo",
		"history" : [
			ObjectId("548efd7687fd8b50f3dca6e6")
		]
	}

_**Note:** the API does not add or update any date/time fields to indicate the order in which revision documents were created, nor does it perform any sort operations when returning a document's revision history. It is up to the API consumer to include appropriate date/time fields and perform sort operations on the returned revision collection_

## Example Usage

    var model = require(__dirname + '/model');

    // load the schema...
    var mod = model('my_model_name', schema.fields, null, schema.settings);

Also look through the `test/acceptance/workspace/` directories for examples of schemas.
