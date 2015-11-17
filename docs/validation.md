![Serama](../serama.png)

# Validation

## Overview

Field validation can be defined in a schema collection file.

* A field can be validated on a type. If type describes a Javascript primitive, the field value will be checked that it matches the type
* A field can be required. Validation will fail if this field is not present during during create
* A field can be validated on length. Validation will fail if the length of the string is greater or less than the specified length limit
* A field can be validated on a regular expression pattern.

## Example Usage

{
    "fields": {
        "fieldString": {
            "type": "String",
            "required": false,
            "message": "must be a string"
        },
        "fieldNumber": {
            "type": "Number",
            "required": false,
            "message": "must be a number"
        },
        "fieldBool": {
            "type": "Boolean",
            "required": false,
            "message": "must be a boolean"
        },
        "fieldObject": {
            "type": "Object",
            "required": false,
            "message": "must be an object"
        },
        "fieldDefault": {
            "type": "String",
            "required": false,
            "default": "A default value",
            "message": ""
        },
        "fieldRegex": {
            "type": "Mixed",
            "validation": {
                "regex": {
                  "pattern": "^q+$"
                }
            },
            "required": false,
            "message": "must start with 'q'"
        },
        "fieldMaxLength": {
            "type": "String",
            "validation": {
              "maxLength": 4
            },
            "required": false,
            "message": "is too long"
        },
        "fieldMinLength": {
            "type": "String",
            "validation": {
              "minLength": 4
            },
            "required": false,
            "message": "is too short"
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
