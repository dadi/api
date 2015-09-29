![Serama](../serama.png)

# Connection

## Overview

This module handles connecting to database(s). The main config **must** have a `database` property.  Within this the default connection is specified via top level fields. For example, inside the main config you might see -

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

This would mean that the default MongoDB connection was `mongodb://localhost:27017/serama`.

There is also a second database available at `mongodb://127.0.0.1:27018/secondary`


## Connection

when specifying a database in the URL, Serama will now use that database
e.g. /1.0/testdb/collectionName will use the `testdb` database

Unless database credentials are found for the named database in the global config, the connection will be made using the global `serama` database credentials.

```
    "database": {
        "host": "localhost",
        "port": 27017,
        "username": "",
        "password": "",
        "database": "serama",

        // named database
        "testdb": {
            "host": "127.0.0.1",
            "port": 27017,
            "username": "xxx",
            "password": "yyy"
        }
    }
```

### Replica Set support

```
    "database": {
        "host": "localhost",
        "port": 27017,
        "username": "",
        "password": "",
        "database": "serama",
        "replicaSet": {
            "name": "test",
            "ssl": true,
            "hosts": [
                {
                    "host": "localhost",
                    "port": 27020
                },
                {
                    "host": "localhost",
                    "port": 27021
                }
            ]
        }
    }
```

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
