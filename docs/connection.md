![Serama](../serama.png)

# Connection

## Overview

This module handles connecting to database(s). The main config **must** have a `database` property.  Within this the default connection is specified via top level fields. For example, inside the main config you might see -

```
    "database": {
      "hosts": [
        {
          "host": "localhost",
          "port": 27017
        }
      ],
      "username":"",
      "password":"",
      "database":"serama",
      "ssl": false,
      "replicaSet": false
    }
```

This configuration would result in a MongoDB connection string `mongodb://localhost:27017/serama`.

## Multiple Collection Databases

Serama can store data in multiple databases, using the second part of a collection route as the database name. To enable collection databases, modify your configuration file so that `enableCollectionDatabases` is true.

```
    "database": {
      "hosts": [
        {
          "host": "localhost",
          "port": 27017
        }
      ],
      "username":"",
      "password":"",
      "database":"serama",
      "ssl": false,
      "replicaSet": false,
      "enableCollectionDatabases": true
    }
```

With collection databases enabled Serama will use the database specified in a collection route. For example `http://www.example.com/1.0/library/books` will use the `library` database to store the `books` document collection.

Unless a hosts array and database credentials are found for the named database, the connection will be made using settings from the primary database configuration.

```
    "database": {
      "hosts": [
        {
          "host": "localhost",
          "port": 27017
        }
      ],
      "database": "serama",
      "username": "serama_user",
      "password": "43fgb78n@1",
      "ssl": false,
      "replicaSet": false,
      "enableCollectionDatabases": true,

      // named collection database
      "library": {
        "hosts": [
          {
            "host": "localhost",
            "port": 27017
          }
        ],
        "username": "library_user",
        "password": "dfh4637xd90!"
      }
    }
```

### MongoDB Replica Sets

Serama supports connections to MongoDB replica sets. To connect to a replica set specify each host in the `hosts` array and set the `replicaSet` property to the name of your replica set. Serama will handle determining which of the configured hosts is the primary database.

```
    "database": {
      "hosts": [
        {
          "host": "localhost",
          "port": 27017
        },
        {
          "host": "localhost",
          "port": 27020
        },
        {
          "host": "localhost",
          "port": 27021
        }
      ],
      "username": "serama_user",
      "password": "secretSquirrel",
      "database": "serama",
      "ssl": false,
      "replicaSet": "repl-abcdef"
    }
```

The above configuration will construct the following connection string:

```
mongodb://serama_user:secretSquirrel@localhost:27017,localhost:27020,localhost:27021/serama?replicaSet=repl-abcdef
```
