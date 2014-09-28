![Serama](../serama.png)

# Validation

## Overview

There are a few different options around validation. It is defined in the model's schema fields -

* A field can be validated on a type. If type describes a Javascript primative, the field value will be checked that it matches the type
* A field can be required. Validation will fail if this field is not present during during create
* A field can be validated on a maximum length limit.  This only applies to String fields.  Validation will fail if the length of the string exceeds the limit
* A field can be validated via a regexp. Validation will fail if a value doesn't pass `RegExp.prototype.test`

## Example Usage

For examples of different types of schema validation combinations see the `test/acceptance/workspace/validation` directory.
