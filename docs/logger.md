![Serama](../serama.png)

# Logger

## Overview

This module exposes three methods -

`debug`

`stage`

`prod`

Depending on the level specified in the config.json file, calls to these messages either log to the file system, or do nothing.

## Configuration

```
	"logging": {
		"enabled": true,
		"level": "DEBUG",
		"path": "./log",
		"filename": "dadi-api",
		"extension": "log",
		"dateFormat": "",
		"messageFormat": "<%= label %> - <%= date %> - <%= message %>"
	}
```

## Levels

* 'DEBUG' - most verbose, all logging is persisted
* 'STAGE' - medium logging, calls to `stage`, and `prod` are persisted.  Calls to `debug` are ignored
* 'PROD' - least amount of logging, only calls to `prod` are persisted.  All others are ignored

## Example Usage

`var logger = require('./dadi/lib/log');`

`logger.debug('debug message');`

`logger.prod('message for production');`
