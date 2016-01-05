![Serama](../serama.png)

# Querying a collection

When querying a collection it is possible to override the default settings specified in the collection schema. Using the parameters specified below opens up the possibility of defining your business/domain logic within the API request itself.

 Parameter       | Type        |  Description                                  | Default value        |  Example
:----------------|:------------|:----------------------------------------------|:---------------------|:--------------
count            | integer     | Maximum number of results to be returned   | 50                   | 10
page             | integer     | Page number                                   | 1                    | 2
sort             | string      | Field to sort on                          | _id                  |
sortOrder       | string      | Sort direction                                | asc                  | desc
filter           | json        | MongoDB query object or Aggregation Pipeline array                            |                      | { fieldName: {"$in": ["a", "b"]}object}
fields           | json        | Specify the fields to return in the dataset.  |          | Include fields: {"field1":1,"field2":1} Exclude fields: {field2":0}

callback         | string      | Callback function to wrap the return result set in.  |               | thisIsMyCallback


## Parameters

### count

Overrides the collection's `count` setting, specifying the maximum number of documents to be returned.

### page

Enables paging within the collection. Specifying a value for `page` along with `count` (or relying on the collection's default `count` setting) will utilise MongoDB's `skip()` method to skip the first (*page * count*) documents in the collection.

### sort

Specifies the field to be used when sorting the collection. The default field is the collection's `_id` field.

### sortOrder

Overrides the collection's `sortOrder` setting. Permitted values are `asc` for an ascending sort order and `desc` for a descending sort order.

### fields

Specifies the fields to return. Extends the collection's `fieldLimiters` setting.

```
fields={"name":1,"email":1}
```

### filter

Extends the collection's `defaultFilters` setting. There are two ways to use the `filter` parameter: passing a JSON query object for performing a standard query, and passing an array containing MongoDB Aggregation Pipeline stages.

##### JSON Query Object

```
  { fieldName: {"$in": ["a", "b"]} }
```

##### Aggregation Pipeline array

###### Examples with the following document set:

```
{
  make: "Ford",
  model: "Explorer",
  onRoadCost: 10000
},
{
  make: "Ford",
  model: "Escape",
  onRoadCost: 7000
},
{
  make: "Nissan",
  model: "Pathfinder",
  onRoadCost: 15000
},
{
  make: "Ford",
  model: "Ranger",
  onRoadCost: 27000
}
```

###### 1. Return only documents for `Ford` vehicles:

```
  [
    { $match: { make: "Ford" } }
  ]
```

**Result:**

```
[
  {
    make: "Ford",
    model: "Explorer",
    onRoadCost: 10000
  },
  {
    make: "Ford",
    model: "Escape",
    onRoadCost: 7000
  },
  {
    make: "Ford",
    model: "Ranger",
    onRoadCost: 27000
  }
]
```

###### 2. Return the average `onRoadCost` for `Ford` vehicles:

```
  [
    {
      $match : { make: "Ford" }
    },
    {
      $group:
      {
        _id: "$make",
        onRoadCostAverage: { $avg : "$onRoadCost" }
      }
    }
  ]
```
**Result:**

```
[
	{
		"_id" : "Ford",
		"onRoadCostAverage" : 14666.666666666666
	}
]
```

See the MongoDB reference documentation for information about the [Aggregation Pipeline](http://docs.mongodb.org/manual/reference/operator/aggregation/#aggregation-pipeline-operator-reference).

###### Example usage

```
var query = [
    {
      $match : { make: "Ford" }
    },
    {
      $group:
      {
        _id: "$make",
        onRoadCostAverage: { $avg : "$onRoadCost" }
      }
    }
  ];

query = encodeURIComponent(JSON.stringify(query));
client.get('/versionName/databaseName/cars?filter=' + query);
```

### callback

Overrides the collection's `callback` setting.

callback must be made up of letters only.
