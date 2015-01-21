![Serama](../serama.png)

# Connection

## Overview

This module handles connecting to database(s). The main config **must** have a `database` field.  Within this field, the default connection is specified via top level fields. For example, inside the main config you might see -

    "database": {
        "host":"localhost",
        "port":"27017",
        "username":"",
        "password":"",
        "database":"serama",
        "secondary": {
            "enabled": true,
            "host": "127.0.0.1",
            "port": 27018,
            "username": "",
            "password": ""
        }
    },

This would mean that the default mongodb connection was mongodb://localhost:27017/serama.

There is also a second database available at mongodb://127.0.0.1:27018/secondary

## Example Usage

    var connection = require('./bantam/lib/model/connection');
    var conn1 = connection(); // connect to default db
    var conn2 = connection({
        database: "dbname",
        port: 37017,
        host: "212.123.1.23",
        username: "foo",
        password: "bar"
    }); // specify custom connection settings
