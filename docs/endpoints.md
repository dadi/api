![Serama](../serama.png)

# Endpoints

Endpoints in Serama can be either be mapped directly to collections in MongoDB or custom based on a wider requirements set.

## Collections

### Collections specification

Collections are defined within `/workspace/collections` as JSON files named inline with the collection MongoDB and stored witin a verison and database directory -

`{version}/{database}/{collection.NAME.json}`

Serama handles the creation and modification of collections in MongoDB directly. All that is required in order to setup a new collection and collection endpoint is the creation of the collection schema file.

Collection schemas take the following format -

	{
	    "fields": {
	        "field1": {
	            "type": "String",
	            "label": "Title",
	            "comments": "The title of the entry",
	            "limit": "",
	            "placement": "Main content",
	            "validationRule": "",
	            "required": false,
	            "message": "",
	            "display": { 
	                "index": true,
	                "edit": true
	            }
	        },
	        "field2": {
	            "type": "Number",
	            "label": "Title",
	            "comments": "The title of the entry",
	            "limit": "",
	            "placement": "Main content",
	            "validationRule": "",
	            "required": false,
	            "message": "",
	            "display": { 
	                "index": true,
	                "edit": true
	            }
	        }
	    },
	    "settings": {
	        "cache": true,
	        "cacheTTL": 300,
	        "authenticate": true,
	        "callback": null,
	        "defaultFilters": null,
	        "fieldLimiters": null,
	        "allowExtension": false,
	        "count": 40,
	        "sortOrder": 1
	    }
	}

There is an example collection endpoint included in the `workspace` directory.

#### Field Definitions

Fields that can be passed into a record are defined in the collection schema in *./workspace/collections/{version number}/{database name}/collection.{collection name}.json*

Each field is defined in the following way:

        "field_name": {
            "type": "Text input",
            "label": "Title",
            "comments": "The title of the entry",
            "limit": "",
            "placement": "Main content",
            "validationRule": "",
            "required": false,
            "message": "",
            "display": { 
                "index": true,
                "edit": true
            }
        }

 Parameter       | Description        |  Default                                  | Example
:----------------|:-------------------|:------------------------------------------|:-------
field_name | The name of the field | | ```"title"```
type | The type of the field. Possible values TBC | | ```"Text"```
label | The label for the field | | ```"Title"```
comments | The description of the field | | ```"The article title"```
limit | Length limit for the field | unlimited | ```"20"```
placement | Determines where to display the field in the backend interface (planned functionality) | | ```"Main content"```
validationRule | Regex validation rule. Field is be validated against this | | ```[A-Z]*```
required | Defines if field is required. Field is be validated against this | ```false``` | ```true```
message | The message to return if field validation fails. | ```"is invalid"``` | ```"must contain uppercase letters only"```
display | Determines in which view states the field should be visible within the backend interface (planned functionality) | | ```{ "index": true, "edit": false } ```

#### Default response

Default values for the collection endpoint are set the following way -

    "settings": {
        "cache": true,
        "cacheTTL": 300,
        "authenticate": true,
        "callback": null,
        "defaultFilters": null,
        "fieldLimiters": null,
        "allowExtension": false,
        "count": 40,
        "sortOrder": 1
    }

It is be possible to override these values using parameters at the point of API query (see "Querying a collection" below).

#### Validation

Record validation is implemented at field level based on the rules defined in the collection schema.

If a record fails validation an errors collection should be returned with the reasons for validation failure. For example -

    { 
      "success": false,
      "errors": {
        "error": {
          "field": "title",
          "message": "must contain uppercase letters only" 
        },
        "error": {
          "field": "description",
          "message": "can't be blank" 
        },
        "error": {
          "field": "start_date",
          "message": "is invalid" 
        }
      }
    }

**Note:** The default message for a field that fails validation rules is "is invalid". If a `required` field has been left blank the message should change to "can't be blank". 

### Querying a collection

It is possible to override the default view for a collection using the parameters specified below, opening up the possibility of defining your busines/domain logic within the API request itself.

 Parameter       | Type        |  Description                                  | Default value        |  Example
:----------------|:------------|:----------------------------------------------|:---------------------|:--------------
count            | integer     | Number of results to be displayed on a page   | 50                   | 10
page             | integer     | Page number                                   | 1                    | 2
sort             | string      | Field id for sorting                          | _id                  |
sortOrder       | string      | Sort direction                                | asc                  | desc
filter           | json        | MongoDB query json                            |                      | {fieldName: {"$in": ["a", "b"]}}
callback         | string      | Callback function to wrap the return result set in.  |               | thisIsMyCallback

## Custom endpoints

### Overview

An endpoint must be named such that the filename is endpoint.{endpoint name}.js, and the corresponding url will be /endpoints/{endpoint name}. The javascript file should export functions with all lowercase names that correspond to the HTTP method that the function is meant to handle.

Each function will recieve three arguments -

`(request, response, next)`

1. `request` is an instance of node's [http.IncomingMessage](http://nodejs.org/api/http.html#http_http_incomingmessage) as created internally by node
2. `response` is an instance of node's [http.ServerResponse](http://nodejs.org/api/http.html#http_class_http_serverresponse) as created internally by node
3. `next` is a function that can be passed an error, or called if this endpoint has nothing to do.  This will result in a 500, or 404 respectively.

There is an example custom endpoint included in the `workspace` directory.

### Authentication

Serama's authentication can be bypassed for your custom endpoint by adding the following to your endpoint file:

```
module.exports.model = {} 
module.exports.model.settings = { authenticate : false }
```

### Example Usage

See `test/acceptance/workspace/endpoints/endpoint.test-endpoint.js` for a "Hello World" example.

## Example API requests

_You may want to look at a handy QA testing tool called [Postman](http://www.getpostman.com/)_

### Collections POST request

    POST /vtest/testdb/test-schema HTTP/1.1
    Host: localhost:3000
    content-type: application/json
    Authorization: Bearer 171c8c12-6e9b-47a8-be29-0524070b0c65

    { "field_1": "hi world!", "field_2": 123293582345 }


### Endpoint GET request

This will return a "Hello World" example -

    GET /endpoints/test-endpoint HTTP/1.1
    Host: localhost:3000
    content-type: application/json
    Authorization: Bearer 171c8c12-6e9b-47a8-be29-0524070b0c65
