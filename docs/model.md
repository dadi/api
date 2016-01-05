![Serama](../serama.png)

# Model

## Overview

This module handles data validation and CRUD. A model instance will try to connect to the database using `config.database.{model name}` from the config.json file. If that does not exist in config, it will use the default database config, i.e. `config.database.host`, `config.database.port`, etc... You can also optionally pass in an existing connection object.

## Arguments

Model(name, fields, [connection], settings) -

* `name` a String that will be unique among models
* `fields` an Object that describes this model's fields, as per the spec
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
* `sort` "fieldName"
* `sortOrder` 1
* `storeRevisions` true
* `revisionCollection` "testSchemaHistory"
* `index`

### defaultFilters

Specifies a default query for the collection.

```
defaultFilters: { "publishState": "published" }
```

 A `filter` parameter passed in a query will extend the default filters. For example the following request would extend the default filters and the database query would reflect both the defaults and the filters passed in the querystring:

```
 http://api.example.com/1.0/magazine/articles?filter={"magazineTitle":"Vogue"}

 { "publishState": "published", "magazineTitle": "Vogue" }
 ```

### fieldLimiters

Specifies a default list of fields for inclusion/exclusion. Fields can be included or excluded, but not both. For example to include only `name` and `email`:

```
fieldLimiters: {"name":1, "email": 1}
```

The `_id` field is returned by default. To exclude the `_id` field:

```
fieldLimiters: {"name":1, "email": 1, "_id": 0}
```

The `_id` field is the only field which can be excluded in a list of included fields. For example, the following field list results in a Mongo error:

```
fieldLimiters: {"name":1, "email": 0}
```

To exclude fields, list only the fields for exclusion:

```
fieldLimiters: {"name":0, "email": 0}
```

## Database Indexes

Indexes provide high performance read operations for frequently used queries and are fundamental in ensuring performance under load and at scale.

Database indexes can be automatically created for a collection by specifying the fields to be indexed in the `settings` object.
An index will be created on the collection using the fields specified in the `index.keys` setting. A value of `keys: { fieldName: 1 }` will create an index for field `fieldName` using an ascending order. `keys: { fieldName: -1 }` will create an index for field `fieldName` using a descending order. Specifying multiple fields will create a compound index.

The index will be created in the background to avoid blocking other database operations.

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

### Reference types

#### Field settings

 Property       | Description                 
:---------------|:----------------------------
database           |  The name of the database that holds the reference data. Can be omitted if the field references data in the same database as the referring document.
collection           | The name of the collection that holds the reference data. Can be omitted if the field references data in the same collection as the referring document.
fields           | An array of fields to return for each referenced document.   


```
"author": {
   	"type": "Reference",
    "settings": {
      "database": "library",
   	  "collection": "person"
      "fields": ["firstName", "lastName"]
    }
}
```

##### Books `(collection.book.json)`

```
{
	"fields": {
		"title": {
		  "type": "String",
		  "required": true
		},
  		"author": {
	    	"type": "Reference",
		    "settings": {
	    	  "collection": "person"
		      "fields": ["firstName", "lastName"]
		    }
	  	},
  		"booksInSeries": {
	    	"type": "Reference"
	  	}
  	},
	"settings": {
    	"cache": true,
	    "authenticate": true,
    	"count": 40,
	    "sort": "title",
    	"sortOrder": 1
	}
}
```

##### People `(collection.person.json)`

```
{
	"fields": {
		"name": {
		  "type": "String",
		  "required": true
		},
		"occupation":	{
		  "type": "String",
		  "required": false
		},
		"nationality": {
		  "type": "String",
		  "required": false
		},
		"education": {
		  "type": "String",
		  "required": false
		},
	  	"spouse": {
	    	"type": "Reference"
  		}
	},
	"settings": {
	    "cache": true,
    	"authenticate": true,
	    "count": 40,
    	"sort": "name",
	    "sortOrder": 1
	}
}
```

##### Example Dataset - Books

```
[
	{
		"_id": "daf35614-918f-11e5-8994-feff819cdc9f",
		"title": "Harry Potter and the Philosopher's Stone",
		"author": "7602d576-9190-11e5-8994-feff819cdc9f",
		"booksInSeries": [
			"daf35998-918f-11e5-8994-feff819cdc9f",
			"daf35b82-918f-11e5-8994-feff819cdc9f",
			"daf35f88-918f-11e5-8994-feff819cdc9f",
			"daf36172-918f-11e5-8994-feff819cdc9f",
			"daf363c0-918f-11e5-8994-feff819cdc9f",
			"daf3658c-918f-11e5-8994-feff819cdc9f"
		]
	},
	{
		"_id": "daf35998-918f-11e5-8994-feff819cdc9f",
		"title": "Harry Potter and the Chamber of Secrets"
	},
	{
		"_id": "daf35b82-918f-11e5-8994-feff819cdc9f",
		"title": "Harry Potter and the Prisoner of Azkaban"
	},
	{
		"_id": "daf35f88-918f-11e5-8994-feff819cdc9f",
		"title": "Harry Potter and the Goblet of Fire"
	},
	{
		"_id": "daf36172-918f-11e5-8994-feff819cdc9f",
		"title": "Harry Potter and the Order of the Phoenix"
	},
	{
		"_id": "daf363c0-918f-11e5-8994-feff819cdc9f",
		"title": "Harry Potter and the Half-Blood Prince"
	},
	{
		"_id": "daf3658c-918f-11e5-8994-feff819cdc9f",
		"title": "Harry Potter and the Deathly Hallows"
	}
]
```

##### Example Dataset - Person

```
[
	{
		"_id": "7602d576-9190-11e5-8994-feff819cdc9f",
		"name":	"J. K. Rowling",
		"occupation":	"Novelist",
		"nationality": "British",
		"education": "Bachelor of Arts",
		"spouse": "7602d472-9190-11e5-8994-feff819cdc9f"
	},
	{
		"_id": "7602d472-9190-11e5-8994-feff819cdc9f",
		"name": "Neil Murray"
	}
]
```

## Example Usage

    var model = require(__dirname + '/model');

    // load the schema...
    var mod = model('my_model_name', schema.fields, null, schema.settings);

Also look through the `test/acceptance/workspace/` directories for examples of schemas.
